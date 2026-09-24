import { destroy, init, refresh, refreshHard } from './motus.js';
import type { MotusApi } from './types.js';

export type {
  AnchorPlacement,
  BreakpointName,
  Breakpoints,
  CssEasingKeyword,
  DisableOption,
  Easing,
  MotusApi,
  MotusEasingName,
  MotusEventDetail,
  MotusOptions,
  MotusUserOptions,
} from './types.js';

export { DEFAULTS } from './defaults.js';

export { init, refresh, refreshHard, destroy };

/**
 * The public API, frozen so consuming code cannot monkey-patch it.
 */
const Motus: MotusApi = Object.freeze({ init, refresh, refreshHard, destroy });

export default Motus;
