import { VAR_DELAY, VAR_DURATION, VAR_EASING } from '../constants.js';
import type { MotusEventName } from '../constants.js';
import type { MotusEventDetail, MotusOptions } from '../types.js';
import { resolveEasing } from './resolveEasing.js';

/**
 * Add each of the given classes to the node.
 *
 * @param node
 * @param classes
 */
export const addClasses = (node: Element, classes: string[]): void => {
  for (const className of classes) node.classList.add(className);
};

/**
 * Remove each of the given classes from the node.
 *
 * @param node
 * @param classes
 */
export const removeClasses = (node: Element, classes: string[]): void => {
  for (const className of classes) node.classList.remove(className);
};

/**
 * Dispatch the given motus event on `document`.
 *
 * The `:<id>` variant fires alongside the base event, never instead of it.
 *
 * @param eventName
 * @param node
 * @param id
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

/**
 * The three custom properties the library owns, globally and per element.
 */
const VARS = [VAR_DURATION, VAR_DELAY, VAR_EASING];

/**
 * Remove the library's custom properties from the given target.
 *
 * @param target
 */
const clearVars = (target: { style: CSSStyleDeclaration } | null): void => {
  if (!target) return;
  for (const name of VARS) target.style.removeProperty(name);
};

/**
 * Set the global duration, delay and easing the core stylesheet reads.
 *
 * @param options
 */
export const setGlobalVars = (options: MotusOptions): void => {
  const { body } = document;
  if (!body) return;

  body.style.setProperty(VAR_DURATION, `${options.duration}ms`);
  body.style.setProperty(VAR_DELAY, `${options.delay}ms`);
  body.style.setProperty(VAR_EASING, resolveEasing(options.easing));
};

/**
 * Remove the global custom properties from `<body>`.
 *
 * It tolerates a null `document.body`, which exists only once parsed.
 */
export const clearGlobalVars = (): void => clearVars(document.body);

/**
 * Remove the per-element custom properties from the given element.
 *
 * @param el
 */
export const clearElementVars = (el: HTMLElement): void => clearVars(el);

/**
 * Set the per-element duration, delay and easing overrides.
 *
 * Each one is written only when it is a non-empty string,
 * and since `"0"` is truthy, `data-motus-duration="0"`
 * still yields `--motus-duration: 0ms` as expected.
 *
 * @param el
 * @param values
 */
export const setElementVars = (
  el: HTMLElement,
  values: { duration?: string; delay?: string; easing?: string },
): void => {
  if (values.duration) el.style.setProperty(VAR_DURATION, `${values.duration}ms`);
  if (values.delay) el.style.setProperty(VAR_DELAY, `${values.delay}ms`);
  if (values.easing) el.style.setProperty(VAR_EASING, resolveEasing(values.easing));
};
