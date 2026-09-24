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
/**
 * The pending frame of the ready sequence, so a teardown can cancel it.
 */
let readyFrame = 0;
let options: MotusOptions = { ...DEFAULTS };

/**
 * Register an event listener that `destroy()` will later remove.
 *
 * @param target
 * @param event
 * @param fn
 */
const listen = (target: EventTarget, event: string, fn: EventListener): void => {
  target.addEventListener(event, fn);
  listeners.push({ target, event, fn });
};

/**
 * Get every `[data-motus]` element currently in the document.
 *
 * @returns
 */
const collectElements = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(`[${ATTR}]`),
];

/**
 * Determine if the library should stay off for the given options.
 *
 * It takes all the options, since a tier name needs the breakpoint map.
 *
 * @param opts
 * @returns
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
      // We read a tier name as "below", so `'lg'` covers anything narrower.
      return detect.below(opts.breakpoints[disable]);
  }
};

/**
 * Determine if `startEvent` has already fired.
 *
 * Listening for an event that has already fired would
 * just wait forever, and the stylesheet keeps each
 * `[data-motus]` element hidden until we start.
 *
 * @param startEvent
 * @returns
 */
const hasAlreadyFired = (startEvent: string): boolean => {
  const { readyState } = document;
  if (startEvent === 'load') return readyState === 'complete';
  return startEvent === 'DOMContentLoaded' && readyState !== 'loading';
};

/**
 * Rebuild the observers from the current DOM.
 *
 * It is unconditional by design: the width-only resize shortcut
 * lives in `handleResize()`, so dynamically added content is
 * always picked up even when the viewport keeps its size.
 */
const rebuild = (): void => {
  if (!initialized) return;

  lastWindowHeight = window.innerHeight;

  elements = collectElements();
  observers?.disconnect();
  observers = createObserver(buildConfigs(elements, options), lastWindowHeight);

  if (document.body.classList.contains(CLASS_READY)) {
    // We have already painted once, so the new observers only need un-gating.
    observers?.activate();
    return;
  }

  // A second rebuild inside these two frames restarts
  // the sequence rather than queueing another one,
  // so its new elements get their hidden paint.
  cancelAnimationFrame(readyFrame);

  // We wait two frames, not one: the first paints each element hidden, and
  // only then do we enable transitions and `activate()` since otherwise
  // above-the-fold elements would snap into place with no animation.
  readyFrame = requestAnimationFrame(() => {
    readyFrame = requestAnimationFrame(() => {
      readyFrame = 0;
      document.body.classList.add(CLASS_READY);
      observers?.activate();
    });
  });
};

/**
 * Mark the library as started, set its global properties, then build it.
 *
 * These are set here rather than in `init()` because `<body>`
 * is still null when `init()` runs from a `<head>` script,
 * and nothing reads them before `motus-ready` is added.
 */
const start = (): void => {
  initialized = true;
  setGlobalVars(options);
  rebuild();
};

/**
 * Handle a debounced window resize.
 *
 * `rootMargin` is vertical-only, so a width-only resize calls
 * for no rebuild, and neither does a height change if each
 * pool uses a `*-bottom` placement such as the default.
 *
 * The height check spares mobile pages, where the URL bar
 * appearing and hiding changes `innerHeight` and would
 * otherwise recreate each observer while scrolling.
 */
const handleResize = (): void => {
  if (!initialized) return;
  if (lastWindowHeight === window.innerHeight) return;
  if (observers && !observers.heightDependent) return;
  rebuild();
};

/**
 * Rebuild the observers from the current DOM once the library has started.
 */
export const refresh = (): void => rebuild();

/**
 * Re-check the `disable` option, then disable, re-initialise or rebuild.
 */
export const refreshHard = (): void => {
  if (isDisabled(options)) {
    disable();
    return;
  }

  // We can't just rebuild here, because `init()` set no state
  // when it bailed at the gate, so instead we'll re-run it
  // with the options in hand, since they're normalised.
  if (!initialized) {
    init(options);
    return;
  }

  document.documentElement.removeAttribute(INACTIVE_ATTR);
  rebuild();
};

/**
 * Disconnect the observers and remove what the library added to elements.
 *
 * Only the classes and custom properties are removed;
 * `data-motus*` attributes are kept, so the markup
 * survives and `init()` works again afterwards.
 */
const disable = (): void => {
  // The CSS hides every `[data-motus]` element until it animates,
  // and with the library off nothing will ever add that class,
  // so this attribute keeps us from a blank page appearing.
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

  // The classes are gone, so the remembered state is now out
  // of date. We reset it here rather than in `destroy()`,
  // so a later `refreshHard()` re-animates everything.
  resetAnimatedState();
};

/**
 * Tear the library down completely, removing every listener it registered.
 *
 * `options` stays in place, since `disable()` needs the last class names.
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

/**
 * Initialise the library, tearing down any previous run first.
 *
 * The observers are built when `startEvent` fires, or at once if it has.
 *
 * It returns `undefined` when the browser is unsupported or it's disabled.
 *
 * @param settings
 * @returns
 */
export const init = (settings?: MotusUserOptions): HTMLElement[] | undefined => {
  // SPA routers often call `init()` more than once, so we
  // tear down first; otherwise every call would leak a
  // fresh set of listeners and observers each time.
  if (initialized) destroy();

  options = normalizeOptions(settings);

  // We clear this before the gate below can set it again,
  // so initialising again with different options won't
  // be poisoned by the previous run of the library.
  document.documentElement.removeAttribute(INACTIVE_ATTR);

  if (!isSupported()) {
    console.warn(
      `${LOG_PREFIX} IntersectionObserver is not supported in this browser; animations are disabled.`,
    );
    document.documentElement.setAttribute(INACTIVE_ATTR, '');
    return undefined;
  }

  elements = collectElements();

  // We check this before installing the MutationObserver,
  // since there is no reason for every DOM mutation on
  // a disabled page to go through the disable path.
  if (isDisabled(options)) {
    disable();
    return undefined;
  }

  if (!options.disableMutationObserver) {
    mutationObs = watch(refreshHard);
  }

  if (options.startEvent === 'DOMContentLoaded' || options.startEvent === 'load') {
    listen(window, 'load', () => {
      // We guard this so the first run can't repeat after DOMContentLoaded.
      if (!initialized) start();
    });
  } else {
    listen(document, options.startEvent, () => start());
  }

  if (hasAlreadyFired(options.startEvent)) start();

  listen(window, 'resize', debounce(handleResize, options.debounceDelay));

  return elements;
};
