/**
 * Viewport and device detection via `matchMedia` — no user-agent sniffing.
 *
 * `below()` is the width-based path behind the `disable` tier names. The
 * `phone` / `mobile` / `tablet` trio is the older device-class path:
 * `pointer: coarse` plus `hover: none` is the standard signal for a touch
 * device, and the width cut-off is what separates a phone from a tablet.
 */

export const below = (width: number): boolean =>
  /**
   * `- 0.02` rather than `- 1`: a max-width derived from a min-width
   * breakpoint must not leave a dead zone on fractional viewport widths,
   * which a 991.5px window would otherwise land in.
   */
  matchMedia(`(max-width: ${width - 0.02}px)`).matches;

export const phone = (): boolean =>
  matchMedia('(pointer: coarse) and (hover: none) and (max-width: 767px)').matches;

export const mobile = (): boolean => matchMedia('(pointer: coarse) and (hover: none)').matches;

export const tablet = (): boolean => mobile() && !phone();

export default { below, phone, mobile, tablet };
