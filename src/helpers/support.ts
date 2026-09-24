/**
 * Determine if the browser supports IntersectionObserver natively.
 *
 * It checks the constructor type rather than relying on
 * `in`, because a stubbed but undefined global would
 * pass that test and then throw when constructed.
 *
 * `isIntersecting` is required too, since Chrome 51–57 shipped
 * IntersectionObserver without it, so nothing would animate
 * and the stylesheet would leave it all hidden for good.
 *
 * Failing here sends those browsers down the unsupported path instead.
 *
 * @returns
 */
export const isSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (typeof window.IntersectionObserver !== 'function') return false;
  if (typeof window.IntersectionObserverEntry !== 'function') return false;

  const { prototype } = window.IntersectionObserverEntry;
  return 'intersectionRatio' in prototype && 'isIntersecting' in prototype;
};
