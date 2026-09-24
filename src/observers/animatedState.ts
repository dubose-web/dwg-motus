/**
 * The remembered animated state of each node.
 *
 * Every `rebuild()` throws its configs away and then calls
 * `activate()`, which replays the initial records, so a
 * config that starts at `false` re-fires `motus:in`.
 *
 * The animated class is the primary source, as the stylesheet
 * keys on it, and if the remembered state and the DOM ever
 * disagree, the DOM is what decides what the user sees.
 *
 * This map is only the fallback for `animatedClassName: false`.
 *
 * It is keyed by `node`, not `observeTarget`: several configs
 * can share one `observeTarget` using `data-motus-anchor`,
 * but `buildConfigs` emits one config for each element.
 *
 * A WeakMap can't be cleared, so the reset swaps in a
 * fresh one, which is why other modules go through
 * these functions rather than touching the map.
 */
let animated = new WeakMap<HTMLElement, boolean>();

/**
 * Remember whether the given node has animated in.
 *
 * @param node
 * @param value
 */
export const setAnimated = (node: HTMLElement, value: boolean): void => {
  animated.set(node, value);
};

/**
 * Resolve the starting `animated` value for a rebuilt config.
 *
 * The class is read whenever one exists, since a remembered
 * `true` with the class gone, perhaps after a re-render,
 * would leave the element hidden permanently instead.
 *
 * @param node
 * @param animatedClassName
 * @returns
 */
export const seedAnimated = (node: HTMLElement, animatedClassName: string | false): boolean =>
  animatedClassName ? node.classList.contains(animatedClassName) : animated.get(node) === true;

/**
 * Forget every remembered state.
 *
 * It's called from `disable()`, which strips the animated class everywhere.
 */
export const resetAnimatedState = (): void => {
  animated = new WeakMap();
};
