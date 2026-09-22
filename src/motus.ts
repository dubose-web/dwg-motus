import { ATTR, CLASS_READY, DISABLED_ATTR, LOG_PREFIX } from './constants.js';
import { DEFAULTS } from './defaults.js';
import { debounce } from './helpers/debounce.js';
import detect from './helpers/detector.js';
import { clearElementVars, clearGlobalVars, setGlobalVars } from './helpers/dom.js';
import { isSupported } from './helpers/support.js';
import { buildConfigs } from './observers/elementConfig.js';
import { createObserver } from './observers/intersection.js';
import { watch } from './observers/mutation.js';
import type { DisableOption, MotusOptions, MotusUserOptions, ObserverHandle } from './types.js';
import { normalizeOptions } from './validate.js';

interface TrackedListener {
  target: EventTarget;
  event: string;
  fn: EventListener;
}

let elements: HTMLElement[] = [];
let observers: ObserverHandle | null = null;
let mutationObs: MutationObserver | null = null;
let listeners: TrackedListener[] = [];
let initialized = false;
let lastWindowHeight: number | null = null;
let options: MotusOptions = { ...DEFAULTS };

/** Every listener goes through here so `destroy()` can remove all of them. */
const listen = (target: EventTarget, event: string, fn: EventListener): void => {
  target.addEventListener(event, fn);
  listeners.push({ target, event, fn });
};

const collectElements = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(`[${ATTR}]`),
];

export const isDisabled = (disable: DisableOption): boolean =>
  document.documentElement.hasAttribute(DISABLED_ATTR) ||
  disable === true ||
  (disable === 'mobile' && detect.mobile()) ||
  (disable === 'phone' && detect.phone()) ||
  (disable === 'tablet' && detect.tablet()) ||
  (typeof disable === 'function' && disable() === true);

const initializeObservers = (): HTMLElement[] => {
  elements = collectElements();
  observers?.disconnect();
  observers = createObserver(buildConfigs(elements, options));
  return elements;
};

/**
 * Rebuilds the observers from the current DOM.
 *
 * Unconditional by design — the width-only-resize optimisation lives in
 * `handleResize()`, not here, so that dynamically added content is always
 * picked up even though the viewport has not changed size.
 */
const rebuild = (): void => {
  if (!initialized) return;

  lastWindowHeight = window.innerHeight;
  initializeObservers();

  if (document.body.classList.contains(CLASS_READY)) {
    // Already painted once — the new observers just need un-gating.
    observers?.activate();
    return;
  }

  /**
   * Two frames, not one. The first frame must paint the elements in their
   * initial hidden state; only then does `motus-ready` enable transitions and
   * `activate()` add the animate class. Collapsing this makes every
   * above-the-fold element snap to its final position with no animation.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add(CLASS_READY);
      observers?.activate();
    });
  });
};

/** First run: flips the initialised flag, then builds. */
const start = (): void => {
  initialized = true;
  rebuild();
};

/**
 * `rootMargin` is vertical-only, so a width-only resize needs no rebuild.
 * Mobile browsers fire `resize` on every URL-bar show/hide, which would
 * otherwise tear down and recreate every observer mid-scroll.
 */
const handleResize = (): void => {
  if (!initialized) return;
  if (lastWindowHeight === window.innerHeight) return;
  rebuild();
};

export const refresh = (): void => rebuild();

export const refreshHard = (): void => {
  if (isDisabled(options.disable)) {
    disable();
    return;
  }
  rebuild();
};

/**
 * Tears down observers and removes the classes and custom properties this
 * library added. Deliberately leaves `data-motus*` attributes alone so the
 * markup survives and `init()` works again afterwards.
 */
export const disable = (): void => {
  mutationObs?.disconnect();
  mutationObs = null;

  observers?.disconnect();
  observers = null;

  document.body?.classList.remove(CLASS_READY);

  for (const el of elements) {
    clearElementVars(el);
    if (options.initClassName) el.classList.remove(options.initClassName);
    if (options.animatedClassName) el.classList.remove(options.animatedClassName);
  }
};

/**
 * Full teardown. Note `options` is intentionally left in place — `disable()`
 * needs the last-used class names to remove them.
 */
export const destroy = (): void => {
  disable();

  for (const { target, event, fn } of listeners) {
    target.removeEventListener(event, fn);
  }
  listeners = [];

  clearGlobalVars();

  elements = [];
  initialized = false;
  lastWindowHeight = null;
};

export const init = (settings?: MotusUserOptions): HTMLElement[] | undefined => {
  // Repeated init() is common in SPA route handlers; without this, every call
  // leaks another set of listeners and observers.
  if (initialized) destroy();

  options = normalizeOptions(settings);

  if (!isSupported()) {
    console.warn(
      `${LOG_PREFIX} IntersectionObserver is not supported in this browser; animations are disabled.`,
    );
    return undefined;
  }

  elements = collectElements();

  // Checked before the MutationObserver is installed: on a disabled page there
  // is no reason for every DOM mutation to run the disable path again.
  if (isDisabled(options.disable)) {
    disable();
    return undefined;
  }

  if (!options.disableMutationObserver) {
    mutationObs = watch(refreshHard);
  }

  setGlobalVars(options);

  if (options.startEvent === 'DOMContentLoaded' || options.startEvent === 'load') {
    listen(window, 'load', () => {
      // Guarded so the first run does not happen twice when DOMContentLoaded
      // already fired.
      if (!initialized) start();
    });
  } else {
    listen(document, options.startEvent, () => start());
  }

  if (
    options.startEvent === 'DOMContentLoaded' &&
    (document.readyState === 'complete' || document.readyState === 'interactive')
  ) {
    start();
  }

  listen(window, 'resize', debounce(handleResize, options.debounceDelay));

  return elements;
};
