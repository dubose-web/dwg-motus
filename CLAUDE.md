# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project

**dwg-motus** — animate elements as they scroll into view, using IntersectionObserver rather
than scroll listeners. TypeScript source, SCSS styles, zero runtime dependencies.
Browser floor is native IntersectionObserver: Chrome 51+, Firefox 55+, Safari 12.1+, Edge 79+.

Successor to the unpublished `aosio` (`/Users/jared/localhost/_ARCHIVE/aosio`). Clean API break:
every `aos` token is now `motus`. No compatibility layer.

## Commands

- `npm run dev` — Rollup watch + demo server on :8080 with live reload
- `npm run build` — `dist/` (ESM, CJS, UMD, `.d.ts`/`.d.cts`, six stylesheets)
- `npm test` — Vitest
- `npm run lint` / `npm run typecheck`
- `npm run check:pkg` — publint + are-the-types-wrong

## Architecture

### JS (`src/`)

- **`index.ts`** — public entry. Re-exports the API plus types; the default export is frozen.
  **Imports no CSS**, deliberately: a side-effectful entry would defeat the per-family CSS
  splitting and break CJS/SSR consumers.
- **`global.ts`** — UMD-only entry with a single default export, so `window.Motus` is the API
  object rather than a namespace with `.default`.
- **`motus.ts`** — lifecycle and all module state. `init` / `refresh` / `refreshHard` / `destroy`,
  plus the private `rebuild`, `start`, `handleResize` and `disable`.
- **`constants.ts`** — every attribute, class, custom property and event name. Change names here
  and nowhere else.
- **`defaults.ts`** — frozen defaults. **Never merge into it**; always `Object.assign({}, DEFAULTS, …)`.
- **`validate.ts`** — `normalizeOptions()`: merge, clamp, and emit one grouped warning.
- **`observers/intersection.ts`** — observer pooling and the activation gate.
- **`observers/elementConfig.ts`** — resolves per-element settings; the only setup-time DOM writes.
- **`observers/rootMargin.ts`** — pure `getRootMargin` / `getThreshold` maths.
- **`observers/mutation.ts`** — watches for added `[data-motus]` nodes, batched per frame.
- **`helpers/`** — `debounce`, `detector` (matchMedia), `dom` (classes/events/custom props),
  `getInlineOption`, `resolveEasing`, `support`.

### SCSS (`scss/`)

Published verbatim. Filenames have **no `_` prefix** — partial resolution differs between the
Sass CLI, sass-loader and Vite, and unprefixed names resolve identically everywhere.

`config.scss` (`$motus-distance`) · `core.scss` · `animations/{fade,zoom,slide,flip}.scss`.
`entries/` holds the build targets, compiled 1:1 into `dist/css/`.

### Build

Rollup, in three passes from one config: ESM+CJS, UMD, and bundled declarations. TypeScript
(not the bundler) does the ES2017 downleveling — the source uses `??` and `?.`, which the
supported browsers do not have.

CSS is built separately by `scripts/build-css.mjs` (sass → postcss), because a bundler can only
emit one stylesheet per pass and we need six.

## Invariants

Do not "simplify" these — each one is load-bearing, and most were bugs once.

1. **Double `requestAnimationFrame`** before adding `motus-ready` and calling `activate()`.
   One frame is not enough; collapsing it makes above-the-fold elements snap to their final
   state with no animation.
2. **`activated` gate** in `createObserver` — IntersectionObserver fires immediately on
   `observe()`, before transitions are enabled. The gate is what makes (1) work.
3. **`activate()` does its own `getBoundingClientRect` sweep.** IO will not re-deliver an entry
   whose state has not changed since the suppressed first callback.
4. **Observer pool key is `` `${anchorPlacement}-${offset}` ``** with a `Map<target, config[]>`
   so elements can share an anchor.
5. **Unobserve only when every config on a target has `once && animated`.**
6. **`getInlineOption` uses `??`, not `||`** — `data-motus-delay="0"` must survive.
7. **The resize height guard lives in `handleResize()` only.** Putting it back in `rebuild()`
   stops dynamically added content from ever being picked up.
8. **Animations stay inside `@media (prefers-reduced-motion: no-preference)`.** Hoisting a rule
   out leaves reduced-motion users with invisible content.
9. **Doubled attribute selectors** (`[data-motus^='fade'][data-motus^='fade']`) are for
   specificity. Keep the duplication.
10. **`disable()` must not strip `data-motus*` attributes** — markup has to survive a re-init.
11. **Every listener goes through `listen()`** so `destroy()` can remove it.

## Style

- ESLint flat config + typescript-eslint; Prettier, single quotes, 100 cols
- 2-space indent, LF (`.editorconfig`)
- No runtime dependencies — keep it that way
