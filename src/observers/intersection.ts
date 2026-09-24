import { EVENT_IN, EVENT_OUT } from '../constants.js';
import { addClasses, fireEvent, removeClasses } from '../helpers/dom.js';
import type { AnchorPlacement, ElementConfig, ObserverHandle } from '../types.js';
import { setAnimated } from './animatedState.js';
import { dependsOnHeight, getRootMargin, getThreshold } from './rootMargin.js';

interface Pool {
  observer: IntersectionObserver;
  /**
   * The configs behind each target, since a shared anchor can back several.
   */
  targets: Map<Element, ElementConfig[]>;
  /**
   * The entries delivered before `activate()` opened the gate.
   *
   * They're kept rather than discarded, as IntersectionObserver
   * will not re-deliver an unchanged entry, so dropping them
   * would strand everything already on screen at startup.
   */
  buffered: IntersectionObserverEntry[];
}

/**
 * Determine if the target sits entirely above the trigger zone.
 *
 * A refresh restores the scroll position before `init()`,
 * so the browser's initial record for anything already
 * scrolled past reports it as not intersecting yet.
 *
 * It can never cross the zone again, and the stylesheet
 * keeps `[data-motus]` hidden until they animate, so
 * without this, such sections would remain blank.
 *
 * Only the entry is read; a null `rootBounds` (cross-origin) is never past.
 *
 * @param entry
 * @returns
 */
const isPast = (entry: IntersectionObserverEntry): boolean =>
  !entry.isIntersecting &&
  entry.rootBounds !== null &&
  entry.boundingClientRect.bottom <= entry.rootBounds.top;

/**
 * Create the pooled IntersectionObservers for the given configs.
 *
 * Observers are pooled by `anchorPlacement` and `offset`,
 * the only two inputs to `rootMargin` and `threshold`,
 * so 200 elements sharing a setup get one observer.
 *
 * @param configs
 * @param windowHeight
 * @returns
 */
export const createObserver = (
  configs: ElementConfig[],
  /**
   * The viewport height, passed in by `rebuild()`, which has already read it.
   *
   * Every pool would otherwise re-read it through `getRootMargin`'s default.
   */
  windowHeight: number = window.innerHeight,
): ObserverHandle => {
  /**
   * Whether `activate()` has opened the gate yet.
   *
   * IntersectionObserver fires its first callback as soon as `observe()`
   * runs, before `motus-ready` is in place, so holding callbacks back
   * stops elements snapping straight to their final state at init.
   */
  let activated = false;
  let heightDependent = false;

  const pools = new Map<string, Pool>();

  const handleEntry = (entry: IntersectionObserverEntry, pool: Pool): void => {
    const targets = pool.targets.get(entry.target);
    if (!targets) return;

    for (const config of targets) {
      // We treat "past" as out for a config that can animate
      // out, so it only reveals inside the zone; anything
      // else counts scrolling past as reaching it too.
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

    // We only stop observing once every config on this target
    // is finished, since with a shared anchor, unobserving
    // on the first would leave behind the rest of them.
    if (targets.every((config) => config.once && config.animated)) {
      pool.observer.unobserve(entry.target);
    }
  };

  const createPool = (anchorPlacement: AnchorPlacement, offset: number): Pool => {
    if (dependsOnHeight(anchorPlacement)) heightDependent = true;

    // We can rely on `pool` here, since the callback runs after `observe()`.
    const pool: Pool = {
      targets: new Map(),
      buffered: [],
      observer: new IntersectionObserver(
        (entries) => {
          if (!activated) {
            pool.buffered.push(...entries);
            return;
          }
          for (const entry of entries) handleEntry(entry, pool);
        },
        {
          rootMargin: getRootMargin(anchorPlacement, offset, windowHeight),
          threshold: getThreshold(anchorPlacement),
        },
      ),
    };

    return pool;
  };

  for (const config of configs) {
    // A finished `once` config would only ignore its callbacks, so we skip it.
    if (config.once && config.animated) continue;

    const key = `${config.anchorPlacement}-${config.offset}`;
    let pool = pools.get(key);

    if (!pool) {
      pool = createPool(config.anchorPlacement, config.offset);
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
    heightDependent,

    disconnect: () => {
      for (const pool of pools.values()) pool.observer.disconnect();
      pools.clear();
    },

    /**
     * Open the gate and settle whatever the observers already know.
     *
     * It replays the entries that arrived while gated,
     * plus any the browser has computed but not yet
     * dispatched, so elements on screen animate.
     *
     * No geometry is worked out by hand; the browser decides for each pool.
     *
     * Entries run oldest-first, so the most recent observation wins.
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
