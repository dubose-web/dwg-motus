/**
 * Device detection via `matchMedia` — no user-agent sniffing.
 *
 * `pointer: coarse` plus `hover: none` is the standard signal for a touch
 * device; the width cut-off is what separates a phone from a tablet.
 */

export const phone = (): boolean =>
  matchMedia('(pointer: coarse) and (hover: none) and (max-width: 767px)').matches;

export const mobile = (): boolean => matchMedia('(pointer: coarse) and (hover: none)').matches;

export const tablet = (): boolean => mobile() && !phone();

export default { phone, mobile, tablet };
