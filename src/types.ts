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

/** Names that resolve to a `cubic-bezier()` value in `resolveEasing()`. */
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

/** CSS keywords, deliberately absent from the map so they pass through natively. */
export type CssEasingKeyword = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';

/**
 * `(string & {})` keeps editor autocomplete for the known names while still
 * accepting a raw `cubic-bezier(...)` value.
 */
export type Easing = MotusEasingName | CssEasingKeyword | (string & {});

/** The Bootstrap-aligned tier names. `xs` is omitted — see `BREAKPOINTS`. */
export type BreakpointName = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export type Breakpoints = Record<BreakpointName, number>;

/**
 * A tier name means *below* that tier, so it is inclusive and downward:
 * `'lg'` disables everything narrower than the `lg` breakpoint.
 *
 * The `'phone' | 'tablet' | 'mobile'` keywords are the older device-class
 * path — `matchMedia` pointer detection rather than width, and mutually
 * exclusive, so `'tablet'` does not also cover phones.
 */
export type DisableOption =
  boolean | BreakpointName | 'phone' | 'tablet' | 'mobile' | (() => boolean);

export interface MotusOptions {
  /** Distance in px from the trigger point before an element animates. Default `120`. */
  offset: number;
  /** Delay before the transition starts, in ms. Default `0`. */
  delay: number;
  /** Transition timing function. Default `'ease'`. */
  easing: Easing;
  /** Transition duration in ms. Default `400`. */
  duration: number;
  /** Disable below a breakpoint, entirely, by device class, or via a predicate. Default `'lg'`. */
  disable: DisableOption;
  /** Viewport widths behind the `disable` tier names. Merged over the defaults. */
  breakpoints: Breakpoints;
  /** Animate only the first time an element enters the viewport. Default `false`. */
  once: boolean;
  /** Animate back out when scrolling away. Ignored when `once` is true. Default `false`. */
  mirror: boolean;
  /** Which part of the element meets which part of the viewport. Default `'top-bottom'`. */
  anchorPlacement: AnchorPlacement;
  /** Event that starts the library. Default `'DOMContentLoaded'`. */
  startEvent: string;
  /** Class added when an element animates in. `false` skips it. Default `'motus-animate'`. */
  animatedClassName: string | false;
  /** Class added to every element at setup. `false` skips it. Default `'motus-init'`. */
  initClassName: string | false;
  /** Also apply the `data-motus` value as class names (the Animate.css path). Default `false`. */
  useClassNames: boolean;
  /** Skip watching the DOM for dynamically added elements. Default `false`. */
  disableMutationObserver: boolean;
  /** Resize debounce in ms, clamped to 16–500. Default `50`. */
  debounceDelay: number;
}

/**
 * `breakpoints` is deliberately `Partial` rather than all-or-nothing: overriding
 * one tier must not force a consumer to restate the other four. `normalizeOptions`
 * merges it over the defaults.
 */
export type MotusUserOptions = Partial<Omit<MotusOptions, 'breakpoints'>> & {
  breakpoints?: Partial<Breakpoints>;
};

export interface MotusEventDetail {
  /**
   * The animating element. This is the live node — listeners should treat it as
   * read-only; mutating it here affects the page.
   */
  node: HTMLElement;
}

/** Resolved per-element settings, built once per refresh. */
export interface ElementConfig {
  node: HTMLElement;
  /** The element actually observed — `node`, or a `data-motus-anchor` target. */
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
  /** Enable callbacks and animate anything already on screen. */
  activate(): void;
  disconnect(): void;
}

export interface MotusApi {
  readonly init: (settings?: MotusUserOptions) => HTMLElement[] | undefined;
  readonly refresh: () => void;
  readonly refreshHard: () => void;
  readonly destroy: () => void;
}

declare global {
  interface DocumentEventMap {
    'motus:in': CustomEvent<MotusEventDetail>;
    'motus:out': CustomEvent<MotusEventDetail>;
  }
}
