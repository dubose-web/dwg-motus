import type { MotusOptions } from './types.js';

/**
 * Frozen so a stray `Object.assign(DEFAULTS, settings)` can never poison
 * subsequent `init()` calls. Always merge into a fresh object.
 */
export const DEFAULTS: Readonly<MotusOptions> = Object.freeze({
  offset: 120,
  delay: 0,
  easing: 'ease',
  duration: 400,
  disable: false,
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

export const DISABLE_KEYWORDS = ['phone', 'tablet', 'mobile'] as const;

export const DEBOUNCE_MIN = 16;
export const DEBOUNCE_MAX = 500;
