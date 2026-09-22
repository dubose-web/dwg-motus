/**
 * True when the browser supports IntersectionObserver natively.
 *
 * Checks the constructor type rather than `'IntersectionObserver' in window`,
 * because a stubbed-but-undefined global would otherwise pass the `in` test and
 * then throw on construction.
 */
export const isSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (typeof window.IntersectionObserver !== 'function') return false;
  if (typeof window.IntersectionObserverEntry !== 'function') return false;

  return 'intersectionRatio' in window.IntersectionObserverEntry.prototype;
};

export default isSupported;
