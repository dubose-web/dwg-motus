/**
 * Every literal string the library writes to or reads from the DOM.
 *
 * Single source of truth so the attribute/class/event prefix can never end up
 * half-renamed across modules.
 */

/** Attribute that marks an element for animation: `data-motus="fade-up"`. */
export const ATTR = 'data-motus';

/** Attribute on `<html>` that disables the library in both CSS and JS. Set by the consumer. */
export const DISABLED_ATTR = 'data-motus-disabled';

/**
 * Attribute on `<html>` that the library sets on itself when it is not running
 * — disabled by option, unsupported browser, or torn down.
 *
 * Deliberately separate from `DISABLED_ATTR`: the CSS hides `[data-motus]`
 * elements until they animate, so something has to tell it to reveal them when
 * no JS will ever arrive to do it. Reusing `DISABLED_ATTR` would be read back
 * by `isDisabled()` on the next `init()` and wedge the library off for good.
 */
export const INACTIVE_ATTR = 'data-motus-inactive';

/** Builds a per-option attribute name, e.g. `attr('delay')` -> `data-motus-delay`. */
export const attr = (key: string): string => `${ATTR}-${key}`;

export const CLASS_READY = 'motus-ready';

export const VAR_DURATION = '--motus-duration';
export const VAR_DELAY = '--motus-delay';
export const VAR_EASING = '--motus-easing';

export const EVENT_IN = 'motus:in';
export const EVENT_OUT = 'motus:out';

export type MotusEventName = typeof EVENT_IN | typeof EVENT_OUT;

/** Prefix for every console warning the library emits. */
export const LOG_PREFIX = '[dwg-motus]';
