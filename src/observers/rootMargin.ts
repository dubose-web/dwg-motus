import type { AnchorPlacement } from '../types.js';

/**
 * Get the IntersectionObserver `rootMargin` for an anchor placement.
 *
 * It is pure and exported so the arithmetic can be tested without a DOM.
 *
 * @param anchorPlacement
 * @param offset
 * @param windowHeight
 * @returns
 */
export const getRootMargin = (
  anchorPlacement: AnchorPlacement,
  offset: number,
  windowHeight: number = window.innerHeight,
): string => {
  switch (anchorPlacement) {
    case 'top-center':
    case 'center-center':
    case 'bottom-center': {
      // We clamp this to at least 1px, so an offset past
      // half the viewport keeps the root inset rather
      // than turning the margin into an expansion.
      const centerMargin = Math.max(Math.round(windowHeight / 2) - offset, 1);
      return `${-centerMargin}px 0px ${-centerMargin}px 0px`;
    }

    case 'top-top':
    case 'center-top':
    case 'bottom-top': {
      const topExpand = Math.max(offset, 1);
      return `${topExpand}px 0px ${-(windowHeight - offset)}px 0px`;
    }

    case 'top-bottom':
    case 'center-bottom':
    case 'bottom-bottom':
    default:
      return `0px 0px ${-offset}px 0px`;
  }
};

/**
 * Determine if `getRootMargin` uses the viewport height for a placement.
 *
 * The `*-bottom` placements, the default among them, only
 * subtract the offset, so a height change leaves their
 * observers valid, and calls for no rebuild at all.
 *
 * It sits beside `getRootMargin` so the two switch on the same cases.
 *
 * @param anchorPlacement
 * @returns
 */
export const dependsOnHeight = (anchorPlacement: AnchorPlacement): boolean => {
  switch (anchorPlacement) {
    case 'top-center':
    case 'center-center':
    case 'bottom-center':
    case 'top-top':
    case 'center-top':
    case 'bottom-top':
      return true;
    default:
      return false;
  }
};

/**
 * Get the IntersectionObserver threshold for an anchor placement.
 *
 * `center-*` waits for half the element, and the rest fire on any overlap.
 *
 * @param anchorPlacement
 * @returns
 */
export const getThreshold = (anchorPlacement: AnchorPlacement): number => {
  switch (anchorPlacement) {
    case 'center-bottom':
    case 'center-center':
    case 'center-top':
      return 0.5;
    default:
      return 0;
  }
};
