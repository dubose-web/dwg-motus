import { ATTR, CLASS_READY, DISABLED_ATTR, INACTIVE_ATTR, LOG_PREFIX } from './constants.js';
import { DEFAULTS } from './defaults.js';
import { debounce } from './helpers/debounce.js';
import * as detect from './helpers/detector.js';
import { clearElementVars, clearGlobalVars, setGlobalVars } from './helpers/dom.js';
import { isSupported } from './helpers/support.js';
import { resetAnimatedState } from './observers/animatedState.js';
import { buildConfigs } from './observers/elementConfig.js';
import { createObserver } from './observers/intersection.js';
import { watch } from './observers/mutation.js';
import type { MutationHandle } from './observers/mutation.js';
import type { MotusOptions, MotusUserOptions, ObserverHandle } from './types.js';
import { normalizeOptions } from './validate.js';

interface TrackedListener {
  target: EventTarget;
  event: string;
  fn: EventListener;
}

let elements: HTMLElement[] = [];
let observers: ObserverHandle | null = null;
let mutationObs: MutationHandle | null = null;
let listeners: TrackedListener[] = [];
let initialized = false;
let lastWindowHeight: number | null = null;
/** The pending frame of the ready sequence, so a teardown can cancel it. */
let readyFrame = 0;
let options: MotusOptions = { ...DEFAULTS };

/** Every listener goes through here so `destroy()` can remove all of them. */
const listen = (target: EventTarget, event: string, fn: EventListener): void => {
  target.addEventListener(event, fn);
  listeners.push({ target, event, fn });
};

const collectElements = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(`[${ATTR}]`),
];

/**
 * Takes the whole options object rather than just `disable`, because a tier
 * name is meaningless without the breakpoint map it indexes into.
 */
const isDisabled = (opts: MotusOptions): boolean => {
  if (document.documentElement.hasAttribute(DISABLED_ATTR)) return true;

  const { disable } = opts;
  if (typeof disable === 'function') return disable() === true;
  if (typeof disable !== 'string') return disable === true;

  switch (disable) {
    case 'mobile':
      return detect.mobile();
    case 'phone':
      return detect.phone();
    case 'tablet':
      return detect.tablet();
    default:
      // A tier name means *below* that tier, so `'lg'` covers everything narrower.
      return detect.below(opts.breakpoints[disable]);
  }
};

/**
 * True when `startEvent` has already fired, so waiting for it would wait
 * forever — and the stylesheet keeps every `[data-motus]` element hidden
 * until the library starts.
 */
const hasAlreadyFired = (startEvent: string): boolean => {
  const { readyState } = document;
  if (startEvent === 'load') return readyState === 'complete';
  return startEvent === 'DOMContentLoaded' && readyState !== 'loading';
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

  elements = collectElements();
  observers?.disconnect();
  observers = createObserver(buildConfigs(elements, options), lastWindowHeight);

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
   *
   * A second rebuild inside those frames restarts the sequence rather than
   * queueing another one, so its new elements get their hidden-state paint too.
   */
  cancelAnimationFrame(readyFrame);
  readyFrame = requestAnimationFrame(() => {
    readyFrame = requestAnimationFrame(() => {
      readyFrame = 0;
      document.body.classList.add(CLASS_READY);
      observers?.activate();
    });
  });
};

/**
 * First run: flips the initialised flag, sets the global custom properties,
 * then builds.
 *
 * The properties are set here rather than in `init()` because `<body>` is null
 * when `init()` runs from a `<head>` script, and nothing reads them before
 * `motus-ready` is added anyway.
 */
const start = (): void => {
  initialized = true;
  setGlobalVars(options);
  rebuild();
};

/**
 * `rootMargin` is vertical-only, so a width-only resize needs no rebuild. Nor
 * does a height change when every pool uses a `*-bottom` placement (the
 * default), whose `rootMargin` ignores the height. That second check is what
 * spares mobile pages: the URL bar showing and hiding changes `innerHeight`,
 * and would otherwise tear down and recreate every observer mid-scroll.
 */
const handleResize = (): void => {
  if (!initialized) return;
  if (lastWindowHeight === window.innerHeight) return;
  if (observers && !observers.heightDependent) return;
  rebuild();
};

export const refresh = (): void => rebuild();

export const refreshHard = (): void => {
  if (isDisabled(options)) {
    disable();
    return;
  }

  /**
   * Coming back from disabled is not a rebuild. When `init()` bailed at the
   * gate it returned before setting `initialized`, installing the mutation
   * observer or binding any listener, so `rebuild()` would no-op here. Re-run
   * `init()` with the options already in hand — they are normalised, so the
   * second pass revalidates cleanly and warns about nothing.
   */
  if (!initialized) {
    init(options);
    return;
  }

  document.documentElement.removeAttribute(INACTIVE_ATTR);
  rebuild();
};

/**
 * Tears down observers and removes the classes and custom properties this
 * library added. Deliberately leaves `data-motus*` attributes alone so the
 * markup survives and `init()` works again afterwards.
 */
const disable = (): void => {
  // The CSS hides every [data-motus] element until it animates. With the
  // library off, nothing will ever add that class, so this attribute is what
  // stops the page from rendering blank.
  document.documentElement.setAttribute(INACTIVE_ATTR, '');

  mutationObs?.disconnect();
  mutationObs = null;

  cancelAnimationFrame(readyFrame);
  readyFrame = 0;

  observers?.disconnect();
  observers = null;

  document.body?.classList.remove(CLASS_READY);

  for (const el of elements) {
    clearElementVars(el);
    if (options.initClassName) el.classList.remove(options.initClassName);
    if (options.animatedClassName) el.classList.remove(options.animatedClassName);
  }

  // The classes are gone, so the remembered state is now a lie. Reset here
  // rather than in destroy() so the disable -> refreshHard() round trip
  // re-animates. destroy() calls disable() first, so it inherits this.
  resetAnimatedState();
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

  // Cleared before the gate below can set it again, so re-initialising with
  // different options is not permanently poisoned by the last run.
  document.documentElement.removeAttribute(INACTIVE_ATTR);

  if (!isSupported()) {
    console.warn(
      `${LOG_PREFIX} IntersectionObserver is not supported in this browser; animations are disabled.`,
    );
    document.documentElement.setAttribute(INACTIVE_ATTR, '');
    return undefined;
  }

  elements = collectElements();

  // Checked before the MutationObserver is installed: on a disabled page there
  // is no reason for every DOM mutation to run the disable path again.
  if (isDisabled(options)) {
    disable();
    return undefined;
  }

  if (!options.disableMutationObserver) {
    mutationObs = watch(refreshHard);
  }

  if (options.startEvent === 'DOMContentLoaded' || options.startEvent === 'load') {
    listen(window, 'load', () => {
      // Guarded so the first run does not happen twice when DOMContentLoaded
      // already fired.
      if (!initialized) start();
    });
  } else {
    listen(document, options.startEvent, () => start());
  }

  if (hasAlreadyFired(options.startEvent)) start();

  listen(window, 'resize', debounce(handleResize, options.debounceDelay));

  return elements;
};
