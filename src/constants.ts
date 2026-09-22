/**
 * Every literal string the library writes to or reads from the DOM.
 *
 * Single source of truth so the attribute/class/event prefix can never end up
 * half-renamed across modules.
 */

/** Attribute that marks an element for animation: `data-motus="fade-up"`. */
export const ATTR = 'data-motus';

/** Attribute on `<html>` that disables the library in both CSS and JS. */
export const DISABLED_ATTR = 'data-motus-disabled';

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
