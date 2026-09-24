import type { AnchorPlacement } from '../types.js';

/**
 * Translates an anchor placement into an IntersectionObserver `rootMargin`.
 *
 * Pure and exported so the arithmetic can be unit-tested without a DOM.
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
      // Clamped to at least 1px: a margin that collapses the root to zero
      // height would never intersect anything.
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
 * Whether `getRootMargin` reads the viewport height for this placement.
 *
 * The `*-bottom` placements (the default among them) only subtract the offset,
 * so a height change leaves their observers valid and `handleResize()` can skip
 * the rebuild. Kept beside `getRootMargin` so the two switch on the same cases.
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
 * `center-*` placements wait until the element is half visible. The `bottom-*`
 * placements stay at 0 because `rootMargin` already compensates for element
 * height.
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
