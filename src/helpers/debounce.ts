/**
 * Create a trailing-edge debounced version of the given function.
 *
 * It's inlined rather than imported, to keep the package dependency-free.
 *
 * @param fn
 * @param wait
 * @returns
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait: number,
): (...args: A) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return (...args: A) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}
