import { ATTR } from '../constants.js';

const containsMotusNode = (nodes: Node[]): boolean =>
  nodes.some(
    (node) =>
      node.nodeType === Node.ELEMENT_NODE &&
      ((node as Element).hasAttribute(ATTR) || (node as Element).querySelector(`[${ATTR}]`)),
  );

/**
 * Watches the document for dynamically added `[data-motus]` elements.
 *
 * Only `addedNodes` are considered. Reacting to removals causes a rebuild storm
 * on SPA teardown for no benefit.
 *
 * Callbacks are batched into a single frame: framework hydration that appends
 * 200 elements should rebuild the observers once, not 200 times.
 */
export const watch = (callback: () => void): MutationObserver => {
  let scheduled = false;

  const observer = new MutationObserver((mutations) => {
    if (scheduled) return;

    const hasNewElements = mutations.some((mutation) =>
      containsMotusNode([...mutation.addedNodes]),
    );
    if (!hasNewElements) return;

    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      callback();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  return observer;
};

export default { watch };
