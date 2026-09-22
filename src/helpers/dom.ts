import { VAR_DELAY, VAR_DURATION, VAR_EASING } from '../constants.js';
import type { MotusEventName } from '../constants.js';
import type { MotusEventDetail, MotusOptions } from '../types.js';
import { resolveEasing } from './resolveEasing.js';

export const addClasses = (node: Element, classes: string[]): void => {
  for (const className of classes) node.classList.add(className);
};

export const removeClasses = (node: Element, classes: string[]): void => {
  for (const className of classes) node.classList.remove(className);
};

/**
 * Dispatches on `document`. The `:<id>` variant fires *in addition to* the base
 * event, never instead of it.
 */
export const fireEvent = (
  eventName: MotusEventName,
  node: HTMLElement,
  id: string | null,
): void => {
  const detail: MotusEventDetail = { node };

  document.dispatchEvent(new CustomEvent(eventName, { detail }));

  if (id) {
    document.dispatchEvent(new CustomEvent(`${eventName}:${id}`, { detail }));
  }
};

/** The three custom properties this library owns, global and per element alike. */
const VARS = [VAR_DURATION, VAR_DELAY, VAR_EASING];

const clearVars = (target: { style: CSSStyleDeclaration } | null): void => {
  if (!target) return;
  for (const name of VARS) target.style.removeProperty(name);
};

/** Global duration/delay/easing, read by the core stylesheet. */
export const setGlobalVars = (options: MotusOptions): void => {
  const { body } = document;
  if (!body) return;

  body.style.setProperty(VAR_DURATION, `${options.duration}ms`);
  body.style.setProperty(VAR_DELAY, `${options.delay}ms`);
  body.style.setProperty(VAR_EASING, resolveEasing(options.easing));
};

// `document.body` is null before the parser reaches it; the element variant
// always has a node.
export const clearGlobalVars = (): void => clearVars(document.body);

export const clearElementVars = (el: HTMLElement): void => clearVars(el);

/**
 * Per-element overrides. Only written when the attribute is actually present —
 * note `"0"` is a truthy string, so `data-motus-duration="0"` correctly yields
 * `--motus-duration: 0ms`.
 */
export const setElementVars = (
  el: HTMLElement,
  values: { duration?: string; delay?: string; easing?: string },
): void => {
  if (values.duration) el.style.setProperty(VAR_DURATION, `${values.duration}ms`);
  if (values.delay) el.style.setProperty(VAR_DELAY, `${values.delay}ms`);
  if (values.easing) el.style.setProperty(VAR_EASING, resolveEasing(values.easing));
};
