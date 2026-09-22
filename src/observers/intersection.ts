import { EVENT_IN, EVENT_OUT } from '../constants.js';
import { addClasses, fireEvent, removeClasses } from '../helpers/dom.js';
import type { ElementConfig, ObserverHandle } from '../types.js';
import { getRootMargin, getThreshold } from './rootMargin.js';

interface Pool {
  observer: IntersectionObserver;
  /** One observed target can back several configs (a shared `data-motus-anchor`). */
  targets: Map<Element, ElementConfig[]>;
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
   * before the stylesheet's `motus-ready` gate is in place. Suppressing
   * callbacks until `activate()` is what stops above-the-fold elements from
   * jumping straight to their final state with no visible transition.
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
          if (!activated) return;
          for (const entry of entries) handleEntry(entry, pool!);
        },
        {
          rootMargin: getRootMargin(config.anchorPlacement, config.offset),
          threshold: getThreshold(config.anchorPlacement),
        },
      );

      pool = { observer, targets };
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
     * Enables callbacks and animates anything already on screen.
     *
     * The manual rect check is required, not redundant: IntersectionObserver
     * will not re-deliver an entry whose intersection state has not changed
     * since the suppressed first callback, so without this sweep every
     * above-the-fold element would stay un-animated forever.
     *
     * All reads happen before any write to avoid layout thrashing.
     */
    activate: () => {
      activated = true;

      const pending = configs.filter((config) => !config.animated);
      const rects = pending.map((config) => config.observeTarget.getBoundingClientRect());
      const viewportHeight = window.innerHeight;

      pending.forEach((config, index) => {
        const rect = rects[index]!;
        if (rect.bottom > 0 && rect.top < viewportHeight - config.offset) {
          addClasses(config.node, config.animatedClassNames);
          fireEvent(EVENT_IN, config.node, config.id);
          config.animated = true;
        }
      });
    },
  };
};
