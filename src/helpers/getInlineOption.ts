import { attr } from '../constants.js';

/**
 * Get a `data-motus-*` attribute, coercing `"true"` and `"false"` to booleans.
 *
 * It uses `??`, not `||`: `data-motus-delay="0"`
 * and `data-motus-offset="0"` are real values
 * and mustn't fall through to the default.
 *
 * `getAttribute` gives `null` rather than `undefined` for a missing one.
 *
 * @param el
 * @param key
 * @param fallback
 * @returns
 */
export function getInlineOption(el: Element, key: string): string | boolean | undefined;
export function getInlineOption<T>(el: Element, key: string, fallback: T): string | boolean | T;
export function getInlineOption<T>(
  el: Element,
  key: string,
  fallback?: T,
): string | boolean | T | undefined {
  const value = el.getAttribute(attr(key));

  if (value === 'true') return true;
  if (value === 'false') return false;

  return value ?? fallback;
}
