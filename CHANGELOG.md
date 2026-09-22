# Changelog

## 1.0.0

First public release.

### Features

- Scroll-triggered animations driven by the native IntersectionObserver API — no scroll
  listeners, no per-frame measurement.
- Four animation families: fade, zoom, slide and flip, in 27 variants.
- TypeScript source with bundled `.d.ts` and `.d.cts`, including union types for
  `anchorPlacement`, `disable` and the named easings.
- Per-family stylesheets (`core`, `fade`, `zoom`, `slide`, `flip`) so unused animations are
  never shipped to the browser.
- A headless mode: the JS entry has no stylesheet side effects, so it can drive entirely
  hand-written CSS or a third-party animation library.
- SCSS sources published with the package for custom builds, configurable via
  `$motus-distance`.
- Per-element overrides through `data-motus-*` attributes, including `data-motus-anchor` for
  triggering on another element's position.
- `motus:in` / `motus:out` events on `document`, with `data-motus-id` for element-scoped
  variants.
- Responsive gating: `disable` accepts Bootstrap-aligned breakpoint tiers
  (`'sm' | 'md' | 'lg' | 'xl' | 'xxl'`), where a tier name means _below_ that tier. Defaults to
  `'lg'`, so animations do not run under 992px; pass `disable: false` to animate everywhere.
  The `breakpoints` option (`{ sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 }`) overrides the
  widths one tier at a time, and omitted tiers keep their defaults.
- `disable` also accepts `true`, `false`, a predicate, and the device-class keywords
  `'phone' | 'tablet' | 'mobile'`, which detect a touch pointer rather than a width and are
  mutually exclusive.
- The library sets `data-motus-inactive` on `<html>` whenever it is not running — disabled,
  destroyed, or missing IntersectionObserver — so the stylesheet reveals the elements it would
  otherwise keep hidden until they animate.
- Option validation: unknown keys and out-of-range values produce a single grouped warning.
- ESM, CJS and UMD builds, with an `exports` map verified against Vite and webpack 5.

### Accessibility

- Every animation rule sits inside `@media (prefers-reduced-motion: no-preference)`, so users
  who ask for reduced motion get content immediately, fully visible and static.
- Animations are additionally gated on `html:not(.no-js)`, so content stays visible if
  JavaScript fails to load.

### Requirements

- Node 20.19+ (build tooling only — the library itself is browser code)
- Chrome 51+, Firefox 55+, Safari 12.1+, Edge 79+
