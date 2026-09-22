import { ATTR, LOG_PREFIX } from '../constants.js';
import { getInlineOption } from '../helpers/getInlineOption.js';
import { setElementVars } from '../helpers/dom.js';
import type { AnchorPlacement, ElementConfig, MotusOptions } from '../types.js';

const asString = (value: string | boolean | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * Resolves the anchor element for `data-motus-anchor`.
 *
 * An invalid CSS selector makes `querySelector` throw, which would otherwise
 * take down the whole refresh; fall back to the node itself.
 */
const resolveAnchor = (node: HTMLElement): Element => {
  const selector = asString(getInlineOption(node, 'anchor'));
  if (!selector) return node;

  try {
    return document.querySelector(selector) ?? node;
  } catch {
    console.warn(`${LOG_PREFIX} Invalid data-motus-anchor selector: ${selector}`);
    return node;
  }
};

/**
 * Builds the resolved per-element settings, and performs the only DOM writes
 * that happen at setup time: the init class and the per-element CSS variables.
 */
export const buildConfigs = (elements: HTMLElement[], options: MotusOptions): ElementConfig[] =>
  elements.map((node) => {
    const mirror = Boolean(getInlineOption(node, 'mirror', options.mirror));
    const once = Boolean(getInlineOption(node, 'once', options.once));
    const id = asString(getInlineOption(node, 'id')) ?? null;

    const anchorPlacement = (asString(getInlineOption(node, 'anchor-placement')) ??
      options.anchorPlacement) as AnchorPlacement;

    // A non-numeric offset would otherwise poison the observer pool key
    // (`"top-bottom-NaN"`) and every comparison in activate().
    const rawOffset = Number(getInlineOption(node, 'offset', options.offset));
    const offset = Number.isFinite(rawOffset) ? rawOffset : options.offset;

    setElementVars(node, {
      duration: asString(getInlineOption(node, 'duration')),
      delay: asString(getInlineOption(node, 'delay')),
      easing: asString(getInlineOption(node, 'easing')),
    });

    if (options.initClassName) {
      node.classList.add(options.initClassName);
    }

    // `useClassNames` also applies the data-motus value itself, which is how
    // the Animate.css integration works. The filter is what makes
    // `animatedClassName: false` skip the class entirely.
    const customClassNames = options.useClassNames ? node.getAttribute(ATTR) : null;
    const animatedClassNames = [options.animatedClassName]
      .concat(customClassNames ? customClassNames.split(' ') : [])
      .filter(
        (className): className is string => typeof className === 'string' && className !== '',
      );

    return {
      node,
      observeTarget: resolveAnchor(node),
      mirror,
      once,
      id,
      animatedClassNames,
      animated: false,
      anchorPlacement,
      offset,
    };
  });
