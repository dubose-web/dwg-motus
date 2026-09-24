import { ATTR } from '../constants.js';

/**
 * Determine if any of the nodes is or contains a `[data-motus]` element.
 *
 * It iterates the live NodeList directly, as this runs on every mutation.
 *
 * @param nodes
 * @returns
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
  /**
   * Stop watching and drop any batch still waiting for its frame.
   */
  disconnect(): void;
}

/**
 * Watch the document for dynamically added `[data-motus]` elements.
 *
 * Only `addedNodes` count; removals would cause a rebuild storm on teardown.
 *
 * Callbacks share one frame, so 200 hydrated elements rebuild only once.
 *
 * `disconnect()` cancels that frame too, because the callback is
 * `refreshHard()`, which reruns `init()` after a teardown, so
 * a stale batch would revive the library past `destroy()`.
 *
 * @param callback
 * @returns
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
