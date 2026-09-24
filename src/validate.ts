import {
  ANCHOR_PLACEMENTS,
  BREAKPOINT_NAMES,
  DEBOUNCE_MAX,
  DEBOUNCE_MIN,
  DEFAULTS,
  DISABLE_KEYWORDS,
} from './defaults.js';
import { LOG_PREFIX } from './constants.js';
import type { AnchorPlacement, MotusOptions, MotusUserOptions } from './types.js';

/** Tier names first — they are the documented path; the device keywords are legacy. */
const DISABLE_VALUES: readonly string[] = [...BREAKPOINT_NAMES, ...DISABLE_KEYWORDS];

const isNonNegativeNumber = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * `false`, or a string `classList.add` accepts. Whitespace makes it throw —
 * inside `init()` for `initClassName`, inside an observer callback for
 * `animatedClassName`. An empty string is allowed: it is falsy, so the library
 * treats it like `false` and never hands it to `classList`.
 */
const isClassNameOption = (value: unknown): boolean =>
  value === false || (typeof value === 'string' && !/\s/.test(value));

const isDisableOption = (value: unknown): boolean =>
  typeof value === 'boolean' ||
  typeof value === 'function' ||
  (typeof value === 'string' && DISABLE_VALUES.includes(value));

/**
 * Merges user settings over the defaults, clamps what needs clamping, and
 * reports every problem in a single grouped warning so one typo does not
 * produce a wall of console noise.
 */
export const normalizeOptions = (settings: MotusUserOptions = {}): MotusOptions => {
  const problems: string[] = [];

  for (const key of Object.keys(settings)) {
    // Own keys only: `in` walks the prototype, so `toString` would pass.
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
      problems.push(`Unknown option "${key}".`);
    }
  }

  const options: MotusOptions = Object.assign({}, DEFAULTS, settings);

  for (const key of ['duration', 'delay', 'offset'] as const) {
    if (!isNonNegativeNumber(options[key])) {
      problems.push(
        `"${key}" must be a non-negative number, received ${String(options[key])}. Using ${DEFAULTS[key]}.`,
      );
      options[key] = DEFAULTS[key];
    }
  }

  if (!ANCHOR_PLACEMENTS.includes(options.anchorPlacement as (typeof ANCHOR_PLACEMENTS)[number])) {
    problems.push(
      `"anchorPlacement" must be one of ${ANCHOR_PLACEMENTS.join(', ')}. Using ${DEFAULTS.anchorPlacement}.`,
    );
    options.anchorPlacement = DEFAULTS.anchorPlacement as AnchorPlacement;
  }

  if (!isDisableOption(options.disable)) {
    problems.push(
      `"disable" must be a boolean, a function, or one of ${DISABLE_VALUES.join(', ')}. Using ${String(DEFAULTS.disable)}.`,
    );
    // Falls back to the default, not to `false` — a typo'd tier name must not
    // silently re-enable animations on every viewport.
    options.disable = DEFAULTS.disable;
  }

  /**
   * `Object.assign` above copied the frozen default map by reference, so a
   * partial override would otherwise drop the tiers it did not mention.
   * Re-merge into a fresh object; `DEFAULTS.breakpoints` is never the target.
   */
  options.breakpoints = Object.assign({}, DEFAULTS.breakpoints, settings.breakpoints);

  for (const name of BREAKPOINT_NAMES) {
    const width = options.breakpoints[name];
    if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
      problems.push(
        `"breakpoints.${name}" must be a positive number, received ${String(width)}. Using ${DEFAULTS.breakpoints[name]}.`,
      );
      options.breakpoints[name] = DEFAULTS.breakpoints[name];
    }
  }

  for (const key of ['animatedClassName', 'initClassName'] as const) {
    if (!isClassNameOption(options[key])) {
      problems.push(
        `"${key}" must be false or a single class name, received ${JSON.stringify(options[key])}. Using ${String(DEFAULTS[key])}.`,
      );
      options[key] = DEFAULTS[key];
    }
  }

  if (typeof options.startEvent !== 'string' || options.startEvent === '') {
    problems.push(`"startEvent" must be a non-empty string. Using ${DEFAULTS.startEvent}.`);
    options.startEvent = DEFAULTS.startEvent;
  }

  const requested = options.debounceDelay;
  const clamped = Number.isFinite(requested)
    ? Math.min(DEBOUNCE_MAX, Math.max(DEBOUNCE_MIN, requested))
    : DEFAULTS.debounceDelay;

  if (clamped !== requested) {
    problems.push(
      `"debounceDelay" clamped from ${String(requested)} to ${clamped} (allowed range ${DEBOUNCE_MIN}–${DEBOUNCE_MAX}ms).`,
    );
  }
  options.debounceDelay = clamped;

  if (problems.length > 0) {
    console.warn(`${LOG_PREFIX} Invalid options:\n  - ${problems.join('\n  - ')}`);
  }

  return options;
};
