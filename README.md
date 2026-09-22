# dwg-motus

Animate elements as they scroll into view, using the native **IntersectionObserver** API instead of scroll event listeners.

- **Zero runtime dependencies**
- **Modular** — take the whole stylesheet, one animation family, or none at all
- **Typed** — TypeScript source, bundled `.d.ts`
- **Accessible** — every animation is gated behind `prefers-reduced-motion`
- ~3.3 kB JS + ~0.6 kB CSS, gzipped

```html
<div data-motus="fade-up">I animate when you scroll to me.</div>
```

---

## Why IntersectionObserver?

The original approach to scroll animation is a `scroll` listener that measures every element on every frame. IntersectionObserver hands that work to the browser, which does it off the main thread.

|                        | Scroll events               | IntersectionObserver                       |
| ---------------------- | --------------------------- | ------------------------------------------ |
| Checks while scrolling | ~1000/sec with 100 elements | only when an element crosses the threshold |
| CPU when idle          | continuous polling          | zero                                       |
| Battery impact         | higher                      | much lower                                 |
| Frame drops            | likely with many elements   | rare                                       |
| Browser optimisation   | none                        | native                                     |

---

## Installation

```sh
npm install @duboseweb/motus
```

```js
import Motus from '@duboseweb/motus';
import '@duboseweb/motus/motus.css';

Motus.init();
```

The JS entry has **no stylesheet side effects** — CSS is always an explicit import. That is what makes the per-family imports below possible, and it keeps the package safe to import in SSR and CommonJS contexts.

### Only the animations you use

`core.css` is required. Add only the families you actually reference:

```js
import '@duboseweb/motus/css/core.css';
import '@duboseweb/motus/css/fade.css';
// zoom.css, slide.css and flip.css are never shipped to the browser
```

### From a CDN

```html
<link rel="stylesheet" href="https://unpkg.com/@duboseweb/motus/dist/css/motus.css" />
<script src="https://unpkg.com/@duboseweb/motus/dist/motus.umd.js"></script>
<script>
  Motus.init();
</script>
```

### Compiling the SCSS yourself

The Sass sources ship with the package, so you can override the translate distance and compile only what you need:

```scss
@use '@duboseweb/motus/scss/config' with (
  $motus-distance: 200px
);
@use '@duboseweb/motus/scss/core';
@use '@duboseweb/motus/scss/animations/fade';
```

---

## Usage

### 1. Initialise

```js
import Motus from '@duboseweb/motus';

Motus.init({
  offset: 120, // px before the trigger point
  delay: 0, // ms
  duration: 400, // ms
  easing: 'ease',
  once: false, // animate only the first time
  mirror: false, // animate back out when scrolling away
  anchorPlacement: 'top-bottom',
  disable: 'lg', // below the lg breakpoint — see Responsive breakpoints
  breakpoints: { sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 },
  startEvent: 'DOMContentLoaded',
  initClassName: 'motus-init',
  animatedClassName: 'motus-animate',
  useClassNames: false,
  disableMutationObserver: false,
  debounceDelay: 50, // resize debounce, clamped to 16–500
});
```

Unrecognised keys and out-of-range values produce a single grouped `console.warn`, so a typo shows up immediately instead of silently doing nothing.

### Responsive breakpoints

**By default motus does not animate below 992px.** Many animations only read well at desktop
width, so disabling outright is usually better than maintaining a parallel mobile set. Pass
`disable: false` to animate everywhere.

`disable` accepts a Bootstrap-aligned tier name, which means **below that tier** — it is
inclusive and downward, so `'lg'` covers everything narrower than `lg`:

| `disable` | Media query              | Disabled on                                                     |
| --------- | ------------------------ | --------------------------------------------------------------- |
| `'sm'`    | `(max-width: 575.98px)`  | small phones                                                    |
| `'md'`    | `(max-width: 767.98px)`  | phones in portrait                                              |
| `'lg'`    | `(max-width: 991.98px)`  | the above, plus phone landscape and tablet portrait _(default)_ |
| `'xl'`    | `(max-width: 1199.98px)` | the above, plus tablet landscape                                |
| `'xxl'`   | `(max-width: 1399.98px)` | the above, plus small laptops                                   |

Override any tier individually — the rest keep their defaults:

```js
Motus.init({ disable: 'lg', breakpoints: { lg: 1024 } });
```

The `.98` is deliberate: a `max-width` derived from a `min-width` breakpoint must not leave a
dead zone on fractional viewport widths.

`disable` also accepts `true`, `false`, a `() => boolean` predicate, and the older device-class
keywords `'phone' | 'tablet' | 'mobile'`. Those three detect a touch pointer via `matchMedia`
rather than width, and are mutually exclusive — `'tablet'` does **not** also cover phones. Prefer
a tier name unless you specifically want touch detection.

The check runs once, at `init()`. A desktop window resized across the breakpoint keeps its
existing state until something calls [`refreshHard()`](#api).

### 2. Mark up your elements

```html
<div data-motus="fade-up"></div>
<div data-motus="zoom-in" data-motus-duration="800" data-motus-delay="200"></div>
<div data-motus="flip-left" data-motus-once="true"></div>
```

Any global option can be overridden per element:

| Attribute                     | Notes                                                  |
| ----------------------------- | ------------------------------------------------------ |
| `data-motus`                  | the animation name (required)                          |
| `data-motus-offset`           | px                                                     |
| `data-motus-delay`            | ms                                                     |
| `data-motus-duration`         | ms                                                     |
| `data-motus-easing`           | a named easing or a raw `cubic-bezier(...)`            |
| `data-motus-once`             | `true` / `false`                                       |
| `data-motus-mirror`           | `true` / `false`                                       |
| `data-motus-anchor`           | CSS selector — trigger on _another_ element's position |
| `data-motus-anchor-placement` | see below                                              |
| `data-motus-id`               | scopes the `motus:in:<id>` event                       |

Add `data-motus-disabled` to `<html>` to switch everything off in both CSS and JS — useful as a server-rendered kill switch.

The library sets a second attribute, `data-motus-inactive`, on `<html>` whenever it is not
running — disabled by `disable`, torn down by `destroy()`, or in a browser without
IntersectionObserver. The stylesheet hides `[data-motus]` elements until they animate, so this
is what reveals them when no JS will ever arrive to do it. Treat it as read-only: it is cleared
on the next `init()`, and setting it yourself will be overwritten. Use `data-motus-disabled` for
a kill switch.

---

## API

```js
Motus.init(options); // start; returns the matched elements
Motus.refresh(); // rebuild the observers against the current DOM
Motus.refreshHard(); // refresh, re-checking whether the library should be disabled
Motus.destroy(); // full teardown; safe to init() again afterwards
```

The exported object is frozen. `refresh()` and `refreshHard()` are called for you on resize and on DOM mutation respectively, so you rarely need them directly — reach for `destroy()` on SPA route changes.

### Events

`motus:in` and `motus:out` are dispatched on `document`:

```js
document.addEventListener('motus:in', ({ detail }) => {
  console.log('animated in', detail.node);
});
```

With `data-motus-id="hero"` you also get `motus:in:hero`, fired _in addition to_ the base event.

> `detail.node` is the live DOM element, not a copy. Treat it as read-only — mutating it from a listener affects the page.

### TypeScript

```ts
import Motus, {
  type MotusOptions,
  type AnchorPlacement,
  type BreakpointName,
} from '@duboseweb/motus';

Motus.init({
  anchorPlacement: 'center-center', // union-typed, autocompletes
  disable: 'lg', // BreakpointName | 'phone' | 'tablet' | 'mobile' | boolean | () => boolean
  breakpoints: { lg: 1024 }, // partial — the other tiers keep their defaults
});
```

---

## Animations

**Fade** — `fade`, `fade-in`, `fade-up`, `fade-down`, `fade-left`, `fade-right`, `fade-up-left`, `fade-up-right`, `fade-down-left`, `fade-down-right`

**Zoom** — `zoom-in`, `zoom-in-up`, `zoom-in-down`, `zoom-in-left`, `zoom-in-right`, `zoom-out`, `zoom-out-up`, `zoom-out-down`, `zoom-out-left`, `zoom-out-right`

**Slide** — `slide-up`, `slide-down`, `slide-left`, `slide-right`

**Flip** — `flip-up`, `flip-down`, `flip-left`, `flip-right`

### Anchor placements

`top-bottom` · `top-center` · `top-top` · `center-bottom` · `center-center` · `center-top` · `bottom-bottom` · `bottom-center` · `bottom-top`

The first word is the part of the **element**, the second is the part of the **viewport** it must reach.

### Easings

`linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out` pass straight through to CSS. These resolve to tuned `cubic-bezier()` values:

`ease-in-back` · `ease-out-back` · `ease-in-out-back` · `ease-in-sine` · `ease-out-sine` · `ease-in-out-sine` · `ease-in-quad` · `ease-out-quad` · `ease-in-out-quad` · `ease-in-cubic` · `ease-out-cubic` · `ease-in-out-cubic` · `ease-in-quart` · `ease-out-quart` · `ease-in-out-quart`

Anything else is passed through untouched, so a raw `cubic-bezier(.25,.1,.25,1)` works.

---

## Accessibility

Every animation rule lives inside `@media (prefers-reduced-motion: no-preference)`. Users who ask for reduced motion get the content immediately, fully visible and static — there is no JavaScript branch to get wrong, and no risk of content being stuck at `opacity: 0`.

Animations are also wrapped in `html:not(.no-js)`, so if you set `class="no-js"` on `<html>` and remove it from a small inline script, content stays visible when JavaScript fails to load.

---

## Troubleshooting

**Nothing animates, but the content is all visible.** This is almost always
`prefers-reduced-motion`, and it is the library working as intended. Every animation rule is
gated on it, so if the viewer has asked for reduced motion they get the content immediately,
static. Check with:

```js
matchMedia('(prefers-reduced-motion: reduce)').matches;
```

On macOS the setting is **System Settings → Accessibility → Display → Reduce motion**, and it
applies to every browser. Firefox picks a change up immediately; Chrome may need a restart,
which is why the two can briefly disagree. Firefox also reports `reduce` unconditionally when
`privacy.resistFingerprinting` is enabled.

Note that most browser-automation tools _override_ this: Playwright, for example, defaults to
`reducedMotion: 'no-preference'`, so an automated check can show animations running on a machine
where a real browser would correctly suppress them.

**Nothing animates and nothing is initialised.** Check that the `no-js` class is actually being
removed from `<html>`. Every animation is gated behind `html:not(.no-js)`, so if the script that
removes it is blocked or never runs, the whole library appears dead. Remove it from an inline
script in `<head>`, not an external file.

`demo/diagnose.html` in the repository checks all of the above and names the cause.

---

## Browser support

Requires native [IntersectionObserver](https://caniuse.com/intersectionobserver): **Chrome 51+, Firefox 55+, Safari 12.1+, Edge 79+**. No IE11, and no polyfill is bundled. On an unsupported browser `init()` warns and returns, leaving all content visible.

---

## What ships

|                                   |                                           |
| --------------------------------- | ----------------------------------------- |
| `dist/motus.js`, `dist/motus.cjs` | **unminified**, with readable identifiers |
| `dist/motus.umd.js`               | minified, for `<script>` tags             |
| `dist/motus.d.ts`, `.d.cts`       | types for `import` and `require`          |
| `dist/css/*.css`                  | minified, one file per animation family   |
| `scss/**`                         | the Sass sources, for your own build      |

The bundler entries are deliberately not minified. Your bundler minifies them again on the way
into your application, so the bytes reaching a browser are identical either way — what you get
back is a readable stack trace when something goes wrong inside the library. The UMD build is the
opposite case: it is loaded directly by a `<script>` tag, so it stays minified.

Source maps are not published. They would reference `src/*.ts` files the package does not contain,
so a debugger would report "source not found" while the maps took up nearly half the download.
The unminified builds serve the same purpose without the indirection.

---

## Development

```sh
npm install
npm run dev        # demo pages at http://localhost:8080 with live reload
npm test           # vitest
npm run build      # dist/
npm run lint
npm run test:pack  # pack, install into a throwaway project, assert it works
npm run check:pkg  # publint + are-the-types-wrong
```

---

## License

MIT © DuBose Web
