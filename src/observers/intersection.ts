import { EVENT_IN, EVENT_OUT } from '../constants.js';
import { addClasses, fireEvent, removeClasses } from '../helpers/dom.js';
import type { ElementConfig, ObserverHandle } from '../types.js';
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
 * Creates the IntersectionObservers for a set of resolved configs.
 *
 * Observers are pooled by `anchorPlacement` + `offset`, because those two
 * values are the only inputs to `rootMargin` and `threshold`. A page with 200
 * elements sharing one configuration gets one observer, not 200.
 */
export const createObserver = (configs: ElementConfig[]): ObserverHandle => {
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
      if (entry.isIntersecting) {
        if (!config.animated) {
          addClasses(config.node, config.animatedClassNames);
          fireEvent(EVENT_IN, config.node, config.id);
          config.animated = true;
        }
      } else if (config.animated && config.mirror && !config.once) {
        removeClasses(config.node, config.animatedClassNames);
        fireEvent(EVENT_OUT, config.node, config.id);
        config.animated = false;
      }
    }

    // Only stop observing once *every* config on this target is finished —
    // with a shared anchor, unobserving on the first one strands the rest.
    if (targets.every((config) => config.once && config.animated)) {
      pool.observer.unobserve(entry.target);
    }
  };

  for (const config of configs) {
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
          rootMargin: getRootMargin(config.anchorPlacement, config.offset),
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
