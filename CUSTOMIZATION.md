# Customization

## Custom animations

The JavaScript never knows animation names — it only toggles `motus-animate`. A new animation is therefore just CSS:

```css
@media (prefers-reduced-motion: no-preference) {
  [data-motus='rotate-in'] {
    opacity: 0;
    transform: rotate(-8deg) translateY(40px);
    transition-property: opacity, transform;
  }

  [data-motus='rotate-in'].motus-animate {
    opacity: 1;
    transform: none;
  }
}
```

```html
<div data-motus="rotate-in"></div>
```

Keep the `prefers-reduced-motion` wrapper. Without it, anyone with reduced motion enabled is left looking at an element stuck at `opacity: 0`.

> **Do not prefix a custom name with `fade`, `zoom`, `slide` or `flip`.** The shipped stylesheets match those families with `[data-motus^='fade']`-style selectors, so `fade-slow` would silently inherit `opacity: 0` from the fade family. Pick a name outside those prefixes.

## Custom easing

Pass any `cubic-bezier()` directly:

```html
<div data-motus="fade-up" data-motus-easing="cubic-bezier(.25, .25, .75, .75)"></div>
```

Or set the default for every element:

```js
Motus.init({ easing: 'cubic-bezier(.25, .25, .75, .75)' });
```

## Changing the travel distance

`$motus-distance` controls how far `fade-*` and `zoom-*` elements translate (default `100px`). Slides always move 100% of their own size and ignore it.

```scss
@use 'dwg-motus/scss/config' with (
  $motus-distance: 200px
);
@use 'dwg-motus/scss/core';
@use 'dwg-motus/scss/animations/fade';
@use 'dwg-motus/scss/animations/zoom';
```

Configure `config` **before** any family is loaded — that is a Sass requirement for `!default` variables, not a quirk of this library.

## Using Animate.css instead

Skip the motus stylesheets entirely and let the library drive Animate.css class names:

```js
import Motus from 'dwg-motus';
import 'animate.css';

Motus.init({
  useClassNames: true, // applies the data-motus value as class names
  initClassName: false,
  animatedClassName: 'animated',
});
```

```html
<div data-motus="fadeInUp"></div>
```

You will usually also want:

```css
[data-motus] {
  visibility: hidden;
}
[data-motus].animated {
  visibility: visible;
}
```

## Bring your own animations entirely

Import the JS and no CSS at all. The library adds `motus-init` on setup and `motus-animate` on entry, and fires `motus:in` / `motus:out` — everything visual is yours:

```js
import Motus from 'dwg-motus'; // no stylesheet import
Motus.init({ initClassName: false });
```

See `demo/headless.html` for a working example.

## Triggering from another element

`data-motus-anchor` takes a CSS selector. The element animates based on the **anchor's** position, not its own — useful for revealing a whole section when its heading arrives:

```html
<h2 id="section-2">Section two</h2>

<div data-motus="fade-up" data-motus-anchor="#section-2"></div>
<div data-motus="fade-up" data-motus-anchor="#section-2" data-motus-delay="100"></div>
<div data-motus="fade-up" data-motus-anchor="#section-2" data-motus-delay="200"></div>
```

Elements sharing an anchor share a single observer, so this is cheap. An invalid selector logs a warning and falls back to observing the element itself.

## Turning it off

At the HTML level, which disables both the CSS and the JS:

```html
<html data-motus-disabled></html>
```

Or at the JS level, including by device class or a predicate of your own:

```js
Motus.init({ disable: 'phone' });
Motus.init({ disable: () => window.innerWidth < 640 });
```
