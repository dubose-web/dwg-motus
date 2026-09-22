/**
 * Compiles each stylesheet in scss/entries/ to its own file in dist/css/.
 *
 * Vite's library mode can only emit a single stylesheet per build, so CSS is
 * built here instead. Because the JS entry deliberately imports no CSS, nothing
 * about this has to coordinate with the Vite passes.
 */
import { mkdirSync, readdirSync, watch, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import postcss from 'postcss';
import * as sass from 'sass';

const SRC = resolve('scss/entries');
const OUT = resolve('dist/css');
const isDev = process.env.NODE_ENV === 'development';

mkdirSync(OUT, { recursive: true });

// autoprefixer and cssnano both read the `browserslist` field in package.json.
const plugins = [autoprefixer()];
if (!isDev) {
  plugins.push(cssnano({ preset: ['default', { discardComments: { removeAll: true } }] }));
}
const processor = postcss(plugins);

const buildAll = async () => {
  const entries = readdirSync(SRC).filter((file) => file.endsWith('.scss'));

  for (const file of entries) {
    const name = basename(file, '.scss');
    const from = resolve(SRC, file);
    const to = resolve(OUT, `${name}.css`);

    const compiled = sass.compile(from, {
      // cssnano handles minification; keep sass output readable for the sourcemap.
      style: 'expanded',
      loadPaths: [resolve('scss')],
      sourceMap: true,
      sourceMapIncludeSources: true,
    });

    const result = await processor.process(compiled.css, {
      from,
      to,
      map: { prev: compiled.sourceMap, inline: false },
    });

    writeFileSync(to, `${result.css}\n`);
    if (result.map) writeFileSync(`${to}.map`, result.map.toString());

    const kb = (Buffer.byteLength(result.css) / 1024).toFixed(2);
    console.log(`dist/css/${name}.css  ${kb} kB`);
  }
};

await buildAll();

if (process.argv.includes('--watch')) {
  console.log('watching scss/ for changes...');

  let rebuilding = false;
  watch(resolve('scss'), { recursive: true }, () => {
    if (rebuilding) return;
    rebuilding = true;
    // Coalesce the burst of events an editor save produces.
    setTimeout(() => {
      buildAll()
        .catch((error) => console.error(error.message))
        .finally(() => {
          rebuilding = false;
        });
    }, 50);
  });
}
