/**
 * Detect the viewport and device class via `matchMedia`, not the user agent.
 *
 * `below()` is the width-based path behind the `disable` tier
 * names, while the `phone`, `mobile` and `tablet` keywords
 * make up the legacy device-class path that came first.
 *
 * `pointer: coarse` plus `hover: none` is the standard
 * signal for a touch device, and a width cut-off is
 * what separates a phone from a tablet reliably.
 */

/**
 * Determine if the viewport is narrower than the given width.
 *
 * Subtracting `0.02` rather than `1` means that a max-width
 * derived from a min-width breakpoint will leave no dead
 * zone at fractional widths such as a 991.5px window.
 *
 * @param width
 * @returns
 */
export const below = (width: number): boolean =>
  matchMedia(`(max-width: ${width - 0.02}px)`).matches;

/**
 * Determine if the device is a touch phone.
 *
 * @returns
 */
export const phone = (): boolean =>
  matchMedia('(pointer: coarse) and (hover: none) and (max-width: 767px)').matches;

/**
 * Determine if the device has a coarse pointer and no hover.
 *
 * @returns
 */
export const mobile = (): boolean => matchMedia('(pointer: coarse) and (hover: none)').matches;

/**
 * Determine if the device is a touch device but not a phone.
 *
 * @returns
 */
export const tablet = (): boolean => mobile() && !phone();
