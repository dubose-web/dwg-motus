import { ATTR } from '../constants.js';

/**
 * Iterates the live NodeList directly rather than spreading it into an array.
 * This runs for every mutation record of every DOM change anywhere on the
 * page, most of which have nothing to do with motus, so the allocation is not
 * worth it.
 */
const containsMotusNode = (nodes: NodeList): boolean => {
  for (const node of nodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const el = node as Element;
    if (el.hasAttribute(ATTR) || el.querySelector(`[${ATTR}]`)) return true;
  }

  return false;
};

export interface MutationHandle {
  /** Stops watching and drops any batch still waiting for its frame. */
  disconnect(): void;
}

/**
 * Watches the document for dynamically added `[data-motus]` elements.
 *
 * Only `addedNodes` are considered. Reacting to removals causes a rebuild storm
 * on SPA teardown for no benefit.
 *
 * Callbacks are batched into a single frame: framework hydration that appends
 * 200 elements should rebuild the observers once, not 200 times.
 *
 * `disconnect()` cancels that frame as well. The callback is `refreshHard()`,
 * which re-runs `init()` when the library is not initialised, so a batch that
 * outlives `destroy()` would bring the whole library back.
 */
export const watch = (callback: () => void): MutationHandle => {
  let frame = 0;

  const observer = new MutationObserver((mutations) => {
    if (frame !== 0) return;

    const hasNewElements = mutations.some((mutation) => containsMotusNode(mutation.addedNodes));
    if (!hasNewElements) return;

    frame = requestAnimationFrame(() => {
      frame = 0;
      callback();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  return {
    disconnect: () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
};
