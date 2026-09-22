// @vitest-environment node
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

const entry = (name: string) =>
  fileURLToPath(new URL(`../scss/entries/${name}.scss`, import.meta.url));

const loadPaths = [fileURLToPath(new URL('../scss', import.meta.url))];

/**
 * Sass emits attribute selectors unquoted (`[data-motus=fade]`); strip quotes so
 * the assertions below read the same way the source does.
 */
const unquote = (css: string): string => css.replace(/"/g, '');

const compile = (name: string): string =>
  unquote(sass.compile(entry(name), { loadPaths, style: 'expanded' }).css);

const FAMILIES = ['fade', 'zoom', 'slide', 'flip'] as const;

describe('the full bundle', () => {
  const css = compile('motus');

  it('contains every family', () => {
    for (const family of FAMILIES) {
      expect(css).toContain(`[data-motus^=${family}]`);
    }
  });

  it('contains the core transition wiring', () => {
    expect(css).toContain('body.motus-ready [data-motus]');
    expect(css).toContain('transition-duration: var(--motus-duration)');
  });

  it('carries no trace of the old aos naming', () => {
    expect(css).not.toMatch(/\baos\b|data-aos|--aos-/);
  });
});

describe('accessibility contract', () => {
  it.each([...FAMILIES, 'core'])(
    '%s puts every rule behind prefers-reduced-motion: no-preference',
    (name) => {
      const css = compile(name);
      const declarationsOutsideMediaQuery = css.split('@media')[0]!.replace(/\s/g, '');

      expect(declarationsOutsideMediaQuery).toBe('');
      expect(css).toContain('prefers-reduced-motion: no-preference');
    },
  );

  it.each(FAMILIES)('%s is also gated on no-js and data-motus-disabled', (family) => {
    const css = compile(family);
    expect(css).toContain('html:not(.no-js):not([data-motus-disabled])');
  });
});

describe('specificity contract', () => {
  it.each(FAMILIES)('%s doubles its family attribute selector', (family) => {
    // The duplication is deliberate: it lifts the family base rule above a
    // single-attribute override in consuming CSS.
    expect(compile(family)).toContain(`[data-motus^=${family}][data-motus^=${family}]`);
  });
});

describe('per-family isolation', () => {
  it('core carries no family rules', () => {
    const css = compile('core');
    for (const family of FAMILIES) {
      expect(css).not.toContain(`[data-motus^=${family}]`);
    }
  });

  it.each(FAMILIES)('%s carries no other family rules', (family) => {
    const css = compile(family);
    for (const other of FAMILIES.filter((f) => f !== family)) {
      expect(css).not.toContain(`[data-motus^=${other}]`);
    }
  });

  it('a family stylesheet does not duplicate the core wiring', () => {
    expect(compile('fade')).not.toContain('body.motus-ready');
  });
});

describe('animation values', () => {
  it('declares fade and fade-in explicitly rather than by prefix accident', () => {
    const css = compile('fade');
    expect(css).toContain('[data-motus=fade]');
    expect(css).toContain('[data-motus=fade-in]');
  });

  it('uses the configured distance', () => {
    expect(compile('fade')).toContain('translate3d(0, 100px, 0)');
  });

  it('honours a $motus-distance override', () => {
    const css = unquote(
      sass.compileString("@use 'config' with ($motus-distance: 200px); @use 'animations/fade';", {
        loadPaths,
        style: 'expanded',
      }).css,
    );

    expect(css).toContain('translate3d(0, 200px, 0)');
    expect(css).not.toContain('translate3d(0, 100px, 0)');
  });

  it('slides on visibility, not opacity', () => {
    const css = compile('slide');
    expect(css).toContain('visibility: hidden');
    expect(css).not.toContain('opacity');
  });

  it('flips with backface-visibility hidden', () => {
    expect(compile('flip')).toContain('backface-visibility: hidden');
  });
});
