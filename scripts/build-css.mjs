/**
 * Compiles the Sass partials into dist/css/, one stylesheet per family.
 *
 * Rollup's library mode emits a single stylesheet per build, so CSS is built
 * here instead. The JS entry deliberately imports no CSS, so nothing about this
 * has to coordinate with the Rollup passes.
 *
 * Source maps are emitted for local development only. They are not published:
 * they would reference .scss files by absolute path and roughly double the
 * size of the package for no consumer benefit.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import postcss from 'postcss';
import * as sass from 'sass';

/**
 * Output name -> the partial it is compiled from.
 *
 * The partials are compiled directly; there are no wrapper entry files, since
 * none of them need more than one `@use`. `motus` is the consumer-facing
 * bundle, which forwards the config and pulls in core plus every family.
 */
export const CSS_TARGETS = {
  core: 'scss/core.scss',
  fade: 'scss/animations/fade.scss',
  zoom: 'scss/animations/zoom.scss',
  slide: 'scss/animations/slide.scss',
  flip: 'scss/animations/flip.scss',
  motus: 'scss/motus.scss',
};

const OUT = 'dist/css';

export const buildCss = async ({ dev = false } = {}) => {
  mkdirSync(resolve(OUT), { recursive: true });

  // autoprefixer and cssnano both read the `browserslist` field in package.json.
  const plugins = [autoprefixer()];
  if (!dev) {
    plugins.push(cssnano({ preset: ['default', { discardComments: { removeAll: true } }] }));
  }
  const processor = postcss(plugins);

  for (const [name, file] of Object.entries(CSS_TARGETS)) {
    const from = resolve(file);
    const to = resolve(OUT, `${name}.css`);

    const compiled = sass.compile(from, {
      // cssnano does the minifying; keep sass output readable.
      style: 'expanded',
      loadPaths: [resolve('scss')],
      sourceMap: dev,
      sourceMapIncludeSources: dev,
    });

    const result = await processor.process(compiled.css, {
      from,
      to,
      ...(dev && compiled.sourceMap
        ? { map: { prev: compiled.sourceMap, inline: false } }
        : { map: false }),
    });

    writeFileSync(to, `${result.css}\n`);
    if (dev && result.map) writeFileSync(`${to}.map`, result.map.toString());

    console.log(`${OUT}/${name}.css  ${(Buffer.byteLength(result.css) / 1024).toFixed(2)} kB`);
  }
};

const watchMode = process.argv.includes('--watch');
const isDev = process.env.NODE_ENV === 'development';

// Only build when run as a script, so the target map can be imported by tests.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildCss({ dev: isDev });

  if (watchMode) {
    const { watch } = await import('node:fs');
    console.log('watching scss/ for changes...');

    let rebuilding = false;
    watch(resolve('scss'), { recursive: true }, () => {
      if (rebuilding) return;
      rebuilding = true;
      // Coalesce the burst of events an editor save produces.
      setTimeout(() => {
        buildCss({ dev: isDev })
          .catch((error) => console.error(error.message))
          .finally(() => {
            rebuilding = false;
          });
      }, 50);
    });
  }
}
