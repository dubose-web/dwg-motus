/**
 * True when the browser supports IntersectionObserver natively.
 *
 * Checks the constructor type rather than `'IntersectionObserver' in window`,
 * because a stubbed-but-undefined global would otherwise pass the `in` test and
 * then throw on construction.
 *
 * `isIntersecting` is required too. Chrome 51–57 shipped IntersectionObserver
 * without it; there it reads `undefined`, nothing on screen would ever animate,
 * and the stylesheet would keep it all hidden. Failing here sends those
 * browsers down the unsupported path instead, which leaves content visible.
 */
export const isSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (typeof window.IntersectionObserver !== 'function') return false;
  if (typeof window.IntersectionObserverEntry !== 'function') return false;

  const { prototype } = window.IntersectionObserverEntry;
  return 'intersectionRatio' in prototype && 'isIntersecting' in prototype;
};
