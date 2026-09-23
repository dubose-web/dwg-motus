import { EVENT_IN, EVENT_OUT } from '../constants.js';
import { addClasses, fireEvent, removeClasses } from '../helpers/dom.js';
import type { ElementConfig, ObserverHandle } from '../types.js';
import { setAnimated } from './animatedState.js';
import { getRootMargin, getThreshold } from './rootMargin.js';

interface Pool {
  observer: IntersectionObserver;
  /** One observed target can back several configs (a shared `data-motus-anchor`). */
  targets: Map<Element, ElementConfig[]>;
  /**
   * Entries the browser delivered before `activate()` opened the gate.
   *
   * These are kept rather than discarded: IntersectionObserver will not
   * re-deliver an entry whose intersection state has not changed, so throwing
   * them away would strand every element that was already on screen at init.
   */
  buffered: IntersectionObserverEntry[];
}

/**
 * The target sits entirely above the trigger zone.
 *
 * A reload restores the scroll position before `init()`, so the browser's first
 * record for anything already scrolled past reports it as not intersecting. It
 * will never cross the zone again, and the stylesheet keeps `[data-motus]`
 * hidden until it animates — without this those sections stay blank. Reads the
 * entry only: no layout. A null `rootBounds` (cross-origin iframe) is not past.
 */
const isPast = (entry: IntersectionObserverEntry): boolean =>
  !entry.isIntersecting &&
  entry.rootBounds !== null &&
  entry.boundingClientRect.bottom <= entry.rootBounds.top;

/**
 * Creates the IntersectionObservers for a set of resolved configs.
 *
 * Observers are pooled by `anchorPlacement` + `offset`, because those two
 * values are the only inputs to `rootMargin` and `threshold`. A page with 200
 * elements sharing one configuration gets one observer, not 200.
 */
export const createObserver = (
  configs: ElementConfig[],
  /**
   * Passed in by `rebuild()`, which has already read it. Every pool would
   * otherwise re-read `window.innerHeight` through `getRootMargin`'s default.
   */
  windowHeight: number = window.innerHeight,
): ObserverHandle => {
  /**
   * IntersectionObserver fires its first callback immediately on `observe()`,
   * before the stylesheet's `motus-ready` gate is in place. Holding callbacks
   * back until `activate()` is what stops above-the-fold elements from jumping
   * straight to their final state with no visible transition.
   */
  let activated = false;

  const pools = new Map<string, Pool>();

  const handleEntry = (entry: IntersectionObserverEntry, pool: Pool): void => {
    const targets = pool.targets.get(entry.target);
    if (!targets) return;

    for (const config of targets) {
      // A config that can animate out treats "past" as out, so it only reveals
      // inside the zone. Everything else counts scrolling past as reaching it.
      const reversible = config.mirror && !config.once;

      if (entry.isIntersecting || (!reversible && isPast(entry))) {
        if (!config.animated) {
          addClasses(config.node, config.animatedClassNames);
          fireEvent(EVENT_IN, config.node, config.id);
          config.animated = true;
          setAnimated(config.node, true);
        }
      } else if (config.animated && reversible) {
        removeClasses(config.node, config.animatedClassNames);
        fireEvent(EVENT_OUT, config.node, config.id);
        config.animated = false;
        setAnimated(config.node, false);
      }
    }

    // Only stop observing once *every* config on this target is finished —
    // with a shared anchor, unobserving on the first one strands the rest.
    if (targets.every((config) => config.once && config.animated)) {
      pool.observer.unobserve(entry.target);
    }
  };

  for (const config of configs) {
    // A finished `once` config can only produce callbacks it would ignore.
    // Skipping before pooling leaves the unobserve rule intact — the config
    // simply never enters the target Map.
    if (config.once && config.animated) continue;

    const key = `${config.anchorPlacement}-${config.offset}`;
    let pool = pools.get(key);

    if (!pool) {
      const targets = new Map<Element, ElementConfig[]>();
      const observer = new IntersectionObserver(
        (entries) => {
          if (!activated) {
            pool!.buffered.push(...entries);
            return;
          }
          for (const entry of entries) handleEntry(entry, pool!);
        },
        {
          rootMargin: getRootMargin(config.anchorPlacement, config.offset, windowHeight),
          threshold: getThreshold(config.anchorPlacement),
        },
      );

      pool = { observer, targets, buffered: [] };
      pools.set(key, pool);
    }

    const existing = pool.targets.get(config.observeTarget);
    if (existing) {
      existing.push(config);
    } else {
      pool.targets.set(config.observeTarget, [config]);
      pool.observer.observe(config.observeTarget);
    }
  }

  return {
    disconnect: () => {
      for (const pool of pools.values()) pool.observer.disconnect();
      pools.clear();
    },

    /**
     * Opens the gate and settles whatever the observers already know.
     *
     * Replays the entries that arrived while gated, plus any the browser has
     * computed but not yet dispatched. That is what makes an element which was
     * already on screen at init animate, without re-deriving the trigger
     * geometry by hand: every decision here comes from the browser, using each
     * pool's own rootMargin and threshold.
     *
     * Entries are processed oldest-first so the final state reflects the most
     * recent observation.
     */
    activate: () => {
      activated = true;

      for (const pool of pools.values()) {
        const entries = pool.buffered.concat(pool.observer.takeRecords());
        pool.buffered.length = 0;

        for (const entry of entries) handleEntry(entry, pool);
      }
    },
  };
};
