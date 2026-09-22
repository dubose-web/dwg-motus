import type { MotusOptions } from './types.js';

/**
 * Bootstrap 5's scale, so the tier names mean what they mean everywhere else.
 * `xs` is implicit at 0 and is deliberately not a valid `disable` target —
 * "disable below 0px" would never match.
 */
export const BREAKPOINTS = Object.freeze({
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
});

export const BREAKPOINT_NAMES = ['sm', 'md', 'lg', 'xl', 'xxl'] as const;

/**
 * Frozen so a stray `Object.assign(DEFAULTS, settings)` can never poison
 * subsequent `init()` calls. Always merge into a fresh object.
 */
export const DEFAULTS: Readonly<MotusOptions> = Object.freeze({
  offset: 120,
  delay: 0,
  easing: 'ease',
  duration: 400,
  disable: 'lg',
  breakpoints: BREAKPOINTS,
  once: false,
  mirror: false,
  anchorPlacement: 'top-bottom',
  startEvent: 'DOMContentLoaded',
  animatedClassName: 'motus-animate',
  initClassName: 'motus-init',
  useClassNames: false,
  disableMutationObserver: false,
  debounceDelay: 50,
} satisfies MotusOptions);

export const ANCHOR_PLACEMENTS = [
  'top-bottom',
  'top-center',
  'top-top',
  'center-bottom',
  'center-center',
  'center-top',
  'bottom-bottom',
  'bottom-center',
  'bottom-top',
] as const;

/** The legacy device-class keywords. Touch-based, exclusive, not configurable. */
export const DISABLE_KEYWORDS = ['phone', 'tablet', 'mobile'] as const;

export const DEBOUNCE_MIN = 16;
export const DEBOUNCE_MAX = 500;
