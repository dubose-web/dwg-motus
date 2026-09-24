import { ATTR, LOG_PREFIX } from '../constants.js';
import { getInlineOption } from '../helpers/getInlineOption.js';
import { seedAnimated } from './animatedState.js';
import { setElementVars } from '../helpers/dom.js';
import type { AnchorPlacement, ElementConfig, MotusOptions } from '../types.js';

/**
 * Get an inline option that is only meaningful as a string.
 *
 * `getInlineOption` makes `"true"` and `"false"` booleans, unwanted here.
 *
 * @param node
 * @param key
 * @returns
 */
const getInlineString = (node: HTMLElement, key: string): string | undefined => {
  const value = getInlineOption(node, key);
  return typeof value === 'string' ? value : undefined;
};

/**
 * Resolve the element to observe for `data-motus-anchor`.
 *
 * An invalid selector makes `querySelector` throw, which
 * would otherwise take down the whole refresh, so the
 * lookup falls back to the element itself instead.
 *
 * `resolved` memoises lookups across one `buildConfigs` pass,
 * so 50 elements sharing an anchor cost a single query per
 * rebuild, and a bad selector warns only once per pass.
 *
 * @param node
 * @param resolved
 * @returns
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
 * Resolve the settings for each of the given elements.
 *
 * It also performs the only DOM writes made at
 * setup time here, which are the init class
 * and the per-element custom properties.
 *
 * @param elements
 * @param options
 * @returns
 */
export const buildConfigs = (elements: HTMLElement[], options: MotusOptions): ElementConfig[] => {
  const anchors = new Map<string, Element | null>();

  // We share one list, since with the default `useClassNames: false`
  // each element has the same classes, and an empty array is what
  // lets `animatedClassName: false` skip the class altogether.
  const baseClassNames = options.animatedClassName ? [options.animatedClassName] : [];

  return elements.map((node) => {
    const mirror = Boolean(getInlineOption(node, 'mirror', options.mirror));
    const once = Boolean(getInlineOption(node, 'once', options.once));
    const id = getInlineString(node, 'id') ?? null;

    const anchorPlacement = (getInlineString(node, 'anchor-placement') ??
      options.anchorPlacement) as AnchorPlacement;

    // A non-numeric offset would poison the pool key with
    // `"top-bottom-NaN"` and yield a `rootMargin` that
    // the IntersectionObserver constructor rejects.
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

    // We also apply the `data-motus` value itself for the Animate.css path.
    const custom = options.useClassNames ? node.getAttribute(ATTR) : null;

    // We split on any whitespace, as a stray tab makes `classList.add` throw.
    const animatedClassNames = custom
      ? baseClassNames.concat(custom.split(/\s+/).filter((name) => name !== ''))
      : baseClassNames;

    return {
      node,
      observeTarget: resolveAnchor(node, anchors),
      mirror,
      once,
      id,
      animatedClassNames,

      // We seed this rather than reset it: `rebuild()` calls `activate()`
      // as soon as it can, which replays an "intersecting" record, and
      // a fresh `false` would fire `motus:in` a second time for it.
      animated: seedAnimated(node, options.animatedClassName),
      anchorPlacement,
      offset,
    };
  });
};
