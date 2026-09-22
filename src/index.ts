import { destroy, init, refresh, refreshHard } from './motus.js';
import type { MotusApi } from './types.js';

export type {
  AnchorPlacement,
  BreakpointName,
  Breakpoints,
  CssEasingKeyword,
  DisableOption,
  Easing,
  ElementConfig,
  MotusApi,
  MotusEasingName,
  MotusEventDetail,
  MotusOptions,
  MotusUserOptions,
  ObserverHandle,
} from './types.js';

export { BREAKPOINTS, DEFAULTS } from './defaults.js';
export { createObserver } from './observers/intersection.js';
export { getRootMargin, getThreshold } from './observers/rootMargin.js';
export { resolveEasing } from './helpers/resolveEasing.js';
export { isSupported } from './helpers/support.js';

export { init, refresh, refreshHard, destroy };

/** Frozen so consuming code cannot monkey-patch the API. */
const Motus: MotusApi = Object.freeze({ init, refresh, refreshHard, destroy });

export default Motus;
