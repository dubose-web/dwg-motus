import {
  ANCHOR_PLACEMENTS,
  DEBOUNCE_MAX,
  DEBOUNCE_MIN,
  DEFAULTS,
  DISABLE_KEYWORDS,
} from './defaults.js';
import { LOG_PREFIX } from './constants.js';
import type { AnchorPlacement, MotusOptions, MotusUserOptions } from './types.js';

const isNonNegativeNumber = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Merges user settings over the defaults, clamps what needs clamping, and
 * reports every problem in a single grouped warning so one typo does not
 * produce a wall of console noise.
 */
export const normalizeOptions = (settings: MotusUserOptions = {}): MotusOptions => {
  const problems: string[] = [];

  for (const key of Object.keys(settings)) {
    if (!(key in DEFAULTS)) {
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

  if (
    typeof options.disable === 'string' &&
    !DISABLE_KEYWORDS.includes(options.disable as (typeof DISABLE_KEYWORDS)[number])
  ) {
    problems.push(
      `"disable" must be a boolean, a function, or one of ${DISABLE_KEYWORDS.join(', ')}. Using false.`,
    );
    options.disable = false;
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
