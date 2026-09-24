/**
 * Define every literal string the library reads from or writes to the DOM.
 *
 * Keeping them in one module stops a prefix from ending up half-renamed.
 */

/**
 * The attribute that marks an element for animation: `data-motus="fade-up"`.
 */
export const ATTR = 'data-motus';

/**
 * The attribute a consumer sets on `<html>` to disable the library.
 */
export const DISABLED_ATTR = 'data-motus-disabled';

/**
 * The attribute the library sets on `<html>` whenever it is not running.
 *
 * The CSS hides `[data-motus]` until it animates, so this reveals it.
 *
 * Reusing `DISABLED_ATTR` would have `isDisabled()` wedge the library off.
 */
export const INACTIVE_ATTR = 'data-motus-inactive';

/**
 * Get the attribute name for the given option key.
 *
 * @param key
 * @returns
 */
export const attr = (key: string): string => `${ATTR}-${key}`;

export const CLASS_READY = 'motus-ready';

export const VAR_DURATION = '--motus-duration';
export const VAR_DELAY = '--motus-delay';
export const VAR_EASING = '--motus-easing';

export const EVENT_IN = 'motus:in';
export const EVENT_OUT = 'motus:out';

export type MotusEventName = typeof EVENT_IN | typeof EVENT_OUT;

/**
 * The prefix for every console warning the library emits.
 */
export const LOG_PREFIX = '[dwg-motus]';
