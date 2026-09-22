# Changelog

## 1.0.0

First public release.

`dwg-motus` is the successor to the unpublished internal library `aosio`. It keeps the
IntersectionObserver engine and the animation set, and adds TypeScript types, a test suite,
modular CSS and a proper package layout.

### Renamed from aosio

This is a clean break — there is no compatibility layer. Every `aos` token became `motus`:

| aosio                                                                                      | dwg-motus                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `data-aos="fade-up"`                                                                       | `data-motus="fade-up"`                                  |
| `data-aos-*` (delay, duration, easing, offset, once, mirror, anchor, anchor-placement, id) | `data-motus-*`                                          |
| `data-aos-disabled`                                                                        | `data-motus-disabled`                                   |
| `aos-init` / `aos-animate` / `aos-ready`                                                   | `motus-init` / `motus-animate` / `motus-ready`          |
| `--aos-duration` / `--aos-delay` / `--aos-easing`                                          | `--motus-duration` / `--motus-delay` / `--motus-easing` |
| `aos:in` / `aos:out`                                                                       | `motus:in` / `motus:out`                                |
| `$aos-distance`                                                                            | `$motus-distance`                                       |
| `AOS.init()` / global `AOS`                                                                | `Motus.init()` / global `Motus`                         |

Option names and their defaults are unchanged.

### Added

- TypeScript source with bundled `.d.ts` and `.d.cts`, including union types for
  `anchorPlacement`, `disable` and the named easings.
- Per-family stylesheets (`core`, `fade`, `zoom`, `slide`, `flip`) so unused animations are
  never shipped to the browser.
- SCSS sources published with the package for custom builds.
- A test suite (173 unit tests) covering the observer pooling, the activation sequence and
  the full lifecycle.
- Option validation: unknown keys and out-of-range values produce one grouped warning.
- Explicit `fade` and `fade-in` rules. Previously both worked only by falling through the
  `[data-aos^='fade']` prefix selector.
- ESM, CJS and UMD builds, and an `exports` map verified against Vite and webpack 5.

### Fixed

Carried over from the aosio backlog, plus issues found while rewriting:

- **Dynamically added elements were not picked up.** The width-only-resize optimisation also
  suppressed rebuilds triggered by the MutationObserver, so content added after `init()` stayed
  un-animated unless the viewport height happened to change. The resize guard now lives only on
  the resize path.
- **`refresh(true)` was reachable from user code** and would corrupt the initialisation state.
  The public `refresh()` now takes no arguments.
- **A non-numeric `data-motus-offset` produced `NaN`**, which poisoned the observer pool key and
  every viewport comparison. It now falls back to the configured offset.
- **The IntersectionObserver feature check** passed when the global existed but was `undefined`,
  then threw on construction.
- MutationObserver rebuilds are batched into one frame, so hydrating 200 elements rebuilds once.
- `activate()` batches all `getBoundingClientRect()` reads before any class write.
- `debounceDelay` is clamped to 16–500 ms.
- `document.body` is guarded in `disable()` and `destroy()` for early-lifecycle safety.
- The exported API object is frozen.

### Requirements

- Node 20.19+ (build/tooling only — the library itself is browser code)
- Chrome 51+, Firefox 55+, Safari 12.1+, Edge 79+
