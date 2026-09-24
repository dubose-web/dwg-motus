/**
 * Compile the Sass partials into `dist/css/`, one stylesheet per family.
 *
 * Rollup emits one stylesheet per build, so the CSS is built here instead.
 *
 * The JS entry imports no CSS, so none of this coordinates with Rollup.
 *
 * Source maps are emitted for local development only, as
 * they would reference `.scss` files by absolute path
 * and roughly double the package size for nothing.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import postcss from 'postcss';
import * as sass from 'sass';

/**
 * The output names, each mapped to the partial it is compiled from.
 *
 * The partials compile directly, as none needs more than one `@use`.
 *
 * `motus` is the consumer bundle, forwarding the config plus every family.
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

/**
 * Compile every target stylesheet into `dist/css/`.
 *
 * @param  {{ dev?: boolean }}  [options]
 * @returns {Promise<void>}
 */
export const buildCss = async ({ dev = false } = {}) => {
  mkdirSync(resolve(OUT), { recursive: true });

  // We let autoprefixer and cssnano read `browserslist` from package.json.
  const plugins = [autoprefixer()];
  if (!dev) {
    plugins.push(cssnano({ preset: ['default', { discardComments: { removeAll: true } }] }));
  }
  const processor = postcss(plugins);

  for (const [name, file] of Object.entries(CSS_TARGETS)) {
    const from = resolve(file);
    const to = resolve(OUT, `${name}.css`);

    const compiled = sass.compile(from, {
      // We keep the Sass output readable, since cssnano does the minifying.
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

// We only build when run as a script, so tests can import the target map.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildCss({ dev: isDev });

  if (watchMode) {
    const { watch } = await import('node:fs');
    console.log('watching scss/ for changes...');

    // We queue one more build for a change that lands mid-build, not drop it.
    let building = false;
    let pending = false;
    let timer;

    const rebuild = () => {
      building = true;
      pending = false;
      buildCss({ dev: isDev })
        .catch((error) => console.error(error.message))
        .finally(() => {
          building = false;
          if (pending) rebuild();
        });
    };

    watch(resolve('scss'), { recursive: true }, () => {
      if (building) {
        pending = true;
        return;
      }

      // We debounce the burst of events that an editor save produces.
      clearTimeout(timer);
      timer = setTimeout(rebuild, 50);
    });
  }
}
