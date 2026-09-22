/**
 * Per-node "has this already animated in" state, needed because every
 * `rebuild()` — `refresh()`, a height-changing resize, a MutationObserver
 * batch — throws the configs away and then calls `activate()`, which replays
 * the observers' initial records. A config that starts at `false` re-fires
 * `motus:in` for everything already on screen.
 *
 * The animated class on the element is the primary source, because that class
 * is what the stylesheet keys on: if the remembered state and the DOM ever
 * disagree, the DOM is the one that decides whether the user sees anything.
 * This map is only the fallback for `animatedClassName: false`, where no
 * marker is written and there is nothing to read back.
 *
 * Keyed by `node`, not `observeTarget`: several configs can share one
 * `observeTarget` (`data-motus-anchor`), but `buildConfigs` emits exactly one
 * config per element, so `node` is unique.
 *
 * A WeakMap cannot be cleared, so the reset rebinds a fresh one. That is why
 * callers go through these functions rather than importing the map.
 */
let animated = new WeakMap<HTMLElement, boolean>();

export const setAnimated = (node: HTMLElement, value: boolean): void => {
  animated.set(node, value);
};

/**
 * Resolves the starting `animated` for a rebuilt config.
 *
 * Reads the class whenever there is one to read. A remembered `true` with the
 * class gone — a framework re-render resetting `className`, a consumer
 * stripping it — would otherwise leave the element hidden for good, since the
 * CSS keeps every `[data-motus]` element invisible until it animates.
 */
export const seedAnimated = (node: HTMLElement, animatedClassName: string | false): boolean =>
  animatedClassName ? node.classList.contains(animatedClassName) : animated.get(node) === true;

/** Called from `disable()`, which strips the animated class from every element. */
export const resetAnimatedState = (): void => {
  animated = new WeakMap();
};
