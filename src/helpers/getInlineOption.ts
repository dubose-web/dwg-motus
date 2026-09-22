import { attr } from '../constants.js';

/**
 * Reads a `data-motus-*` attribute, coercing the literal strings `"true"` and
 * `"false"` to booleans.
 *
 * Uses `??`, never `||`: `data-motus-delay="0"` and `data-motus-offset="0"` are
 * meaningful values and must not fall through to the default. `getAttribute`
 * returns `null` (not `undefined`) when the attribute is absent.
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
