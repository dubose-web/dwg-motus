export type AnchorPlacement =
  | 'top-bottom'
  | 'top-center'
  | 'top-top'
  | 'center-bottom'
  | 'center-center'
  | 'center-top'
  | 'bottom-bottom'
  | 'bottom-center'
  | 'bottom-top';

/**
 * The names that resolve to a `cubic-bezier()` value in `resolveEasing()`.
 */
export type MotusEasingName =
  | 'ease-in-back'
  | 'ease-out-back'
  | 'ease-in-out-back'
  | 'ease-in-sine'
  | 'ease-out-sine'
  | 'ease-in-out-sine'
  | 'ease-in-quad'
  | 'ease-out-quad'
  | 'ease-in-out-quad'
  | 'ease-in-cubic'
  | 'ease-out-cubic'
  | 'ease-in-out-cubic'
  | 'ease-in-quart'
  | 'ease-out-quart'
  | 'ease-in-out-quart';

/**
 * The native CSS keywords, which pass through `resolveEasing()` untouched.
 */
export type CssEasingKeyword = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';

/**
 * A named easing, a native keyword or a raw timing function.
 *
 * `(string & {})` keeps autocomplete while accepting a raw `cubic-bezier()`.
 */
export type Easing = MotusEasingName | CssEasingKeyword | (string & {});

/**
 * The Bootstrap-aligned tier names; `BREAKPOINTS` explains why `xs` is absent.
 */
export type BreakpointName = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export type Breakpoints = Record<BreakpointName, number>;

/**
 * The conditions under which the library stays off.
 *
 * A tier name means below that tier, so `'lg'` disables anything narrower.
 *
 * The `'phone' | 'tablet' | 'mobile'` keywords form the legacy
 * device-class path, matching pointers rather than viewport
 * widths, and they are mutually exclusive of each other.
 */
export type DisableOption =
  boolean | BreakpointName | 'phone' | 'tablet' | 'mobile' | (() => boolean);

export interface MotusOptions {
  /**
   * The distance in px from the trigger point, `120` by default.
   */
  offset: number;
  /**
   * The delay in ms before the transition starts, `0` by default.
   */
  delay: number;
  /**
   * The transition timing function, `'ease'` by default.
   */
  easing: Easing;
  /**
   * The transition duration in ms, `400` by default.
   */
  duration: number;
  /**
   * The tier, device, flag or predicate that disables it, `'lg'` by default.
   */
  disable: DisableOption;
  /**
   * The viewport widths behind the `disable` tier names, merged over defaults.
   */
  breakpoints: Breakpoints;
  /**
   * Whether elements animate only on first entry, `false` by default.
   */
  once: boolean;
  /**
   * Whether elements animate back out unless `once` is set, `false` by default.
   */
  mirror: boolean;
  /**
   * The element and viewport edges that must meet, `'top-bottom'` by default.
   */
  anchorPlacement: AnchorPlacement;
  /**
   * The event that starts the library, `'DOMContentLoaded'` by default.
   */
  startEvent: string;
  /**
   * The class added on entry (or `false`), `'motus-animate'` by default.
   */
  animatedClassName: string | false;
  /**
   * The class added at setup (or `false`), `'motus-init'` by default.
   */
  initClassName: string | false;
  /**
   * Whether to also add the `data-motus` value as classes, `false` by default.
   */
  useClassNames: boolean;
  /**
   * Whether to skip watching for added elements, `false` by default.
   */
  disableMutationObserver: boolean;
  /**
   * The resize debounce in ms, clamped to 16–500 and `50` by default.
   */
  debounceDelay: number;
}

/**
 * The options a consumer may pass to `init()`.
 *
 * `breakpoints` is `Partial` deliberately, so overriding a
 * single tier doesn't force the consumer to restate the
 * other four, since `normalizeOptions` merges it in.
 */
export type MotusUserOptions = Partial<Omit<MotusOptions, 'breakpoints'>> & {
  breakpoints?: Partial<Breakpoints>;
};

export interface MotusEventDetail {
  /**
   * The animating element.
   *
   * It is the live node, so listeners should treat it as read-only.
   */
  node: HTMLElement;
}

/**
 * The resolved settings for one element, rebuilt on every refresh.
 */
export interface ElementConfig {
  node: HTMLElement;
  /**
   * The element actually observed: `node` or a `data-motus-anchor` target.
   */
  observeTarget: Element;
  mirror: boolean;
  once: boolean;
  id: string | null;
  animatedClassNames: string[];
  animated: boolean;
  anchorPlacement: AnchorPlacement;
  offset: number;
}

export interface ObserverHandle {
  /**
   * Enable callbacks and animate anything already on screen.
   */
  activate(): void;
  /**
   * Disconnect every pooled observer.
   */
  disconnect(): void;
  /**
   * Whether any pool's `rootMargin` was built from the viewport height.
   */
  readonly heightDependent: boolean;
}

export interface MotusApi {
  /**
   * Initialise the library and return the elements it will animate.
   */
  readonly init: (settings?: MotusUserOptions) => HTMLElement[] | undefined;
  /**
   * Rebuild the observers from the current DOM.
   */
  readonly refresh: () => void;
  /**
   * Re-check the `disable` option, then rebuild or tear down to match.
   */
  readonly refreshHard: () => void;
  /**
   * Tear the library down, leaving the `data-motus*` markup intact.
   */
  readonly destroy: () => void;
}

declare global {
  interface DocumentEventMap {
    'motus:in': CustomEvent<MotusEventDetail>;
    'motus:out': CustomEvent<MotusEventDetail>;
  }
}
