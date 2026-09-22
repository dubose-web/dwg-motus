import { ATTR, LOG_PREFIX } from '../constants.js';
import { getInlineOption } from '../helpers/getInlineOption.js';
import { seedAnimated } from './animatedState.js';
import { setElementVars } from '../helpers/dom.js';
import type { AnchorPlacement, ElementConfig, MotusOptions } from '../types.js';

/**
 * Reads an inline option that is only meaningful as a string. `getInlineOption`
 * coerces `"true"`/`"false"` to booleans, which none of these callers want.
 */
const getInlineString = (node: HTMLElement, key: string): string | undefined => {
  const value = getInlineOption(node, key);
  return typeof value === 'string' ? value : undefined;
};

/**
 * Resolves the anchor element for `data-motus-anchor`.
 *
 * An invalid CSS selector makes `querySelector` throw, which would otherwise
 * take down the whole refresh; fall back to the node itself.
 *
 * `resolved` memoises the lookup for the duration of one `buildConfigs` pass,
 * so a page where 50 elements share an anchor runs one query per rebuild
 * rather than 50. It also means a bad selector warns once, not once per node.
 */
const resolveAnchor = (node: HTMLElement, resolved: Map<string, Element | null>): Element => {
  const selector = getInlineString(node, 'anchor');
  if (!selector) return node;

  if (resolved.has(selector)) return resolved.get(selector) ?? node;

  let target: Element | null = null;
  try {
    target = document.querySelector(selector);
  } catch {
    console.warn(`${LOG_PREFIX} Invalid data-motus-anchor selector: ${selector}`);
  }

  resolved.set(selector, target);
  return target ?? node;
};

/**
 * Builds the resolved per-element settings, and performs the only DOM writes
 * that happen at setup time: the init class and the per-element CSS variables.
 */
export const buildConfigs = (elements: HTMLElement[], options: MotusOptions): ElementConfig[] => {
  const anchors = new Map<string, Element | null>();

  // Shared, because with the default `useClassNames: false` every element ends
  // up with the same list. An empty array is what makes
  // `animatedClassName: false` skip the class entirely.
  const baseClassNames = options.animatedClassName ? [options.animatedClassName] : [];

  return elements.map((node) => {
    const mirror = Boolean(getInlineOption(node, 'mirror', options.mirror));
    const once = Boolean(getInlineOption(node, 'once', options.once));
    const id = getInlineString(node, 'id') ?? null;

    const anchorPlacement = (getInlineString(node, 'anchor-placement') ??
      options.anchorPlacement) as AnchorPlacement;

    // A non-numeric offset would otherwise poison the observer pool key
    // (`"top-bottom-NaN"`) and every comparison in activate().
    const rawOffset = Number(getInlineOption(node, 'offset', options.offset));
    const offset = Number.isFinite(rawOffset) ? rawOffset : options.offset;

    setElementVars(node, {
      duration: getInlineString(node, 'duration'),
      delay: getInlineString(node, 'delay'),
      easing: getInlineString(node, 'easing'),
    });

    if (options.initClassName) {
      node.classList.add(options.initClassName);
    }

    // `useClassNames` also applies the data-motus value itself, which is how
    // the Animate.css integration works.
    const custom = options.useClassNames ? node.getAttribute(ATTR) : null;
    const animatedClassNames = custom
      ? baseClassNames.concat(custom.split(' ').filter((name) => name !== ''))
      : baseClassNames;

    return {
      node,
      observeTarget: resolveAnchor(node, anchors),
      mirror,
      once,
      id,
      animatedClassNames,
      // Seeded, not reset: rebuild() calls activate() as soon as the page is
      // ready, which replays an "intersecting" record for everything on screen.
      // A fresh `false` here makes that replay re-fire `motus:in`.
      animated: seedAnimated(node, options.animatedClassName),
      anchorPlacement,
      offset,
    };
  });
};
