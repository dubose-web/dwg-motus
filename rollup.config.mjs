import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import livereload from 'rollup-plugin-livereload';
import serve from 'rollup-plugin-serve';

/*
|--------------------------------------------------------------------------
| Source Maps
|--------------------------------------------------------------------------
|
| Source maps stay local, since published maps would point at missing files.
|
*/
const isDev = process.env.NODE_ENV === 'development';

/**
 * Create the TypeScript plugin, which downlevels in place of the bundler.
 *
 * The source uses `??` and `?.`, which require Chrome 80+ or
 * Safari 13.4+, so tsc lowers the output to ES2017, which
 * every IntersectionObserver-capable browser supports.
 *
 * @returns {import('rollup').Plugin}
 */
const ts = () =>
  typescript({
    tsconfig: './tsconfig.build.json',

    // We skip declarations here, as the dedicated dts pass below emits them.
    declaration: false,
    declarationMap: false,

    // We match the output setting, or Rollup warns about maps it won't emit.
    sourceMap: isDev,
  });

const banner = '/*! dwg-motus | MIT License | https://github.com/dubose-web/dwg-motus */';

/**
 * Create the terser plugin that minifies the UMD build only.
 *
 * ESM and CJS go through a bundler that minifies them
 * again, so minifying here saves end users nothing
 * and would cost readable stack traces instead.
 *
 * The UMD build loads through a `<script>` tag, so its bytes do matter.
 *
 * Unlike `output.banner`, terser's `preamble` survives the minification.
 *
 * @returns {import('rollup').Plugin | null}
 */
const minifyUmd = () => (isDev ? null : terser({ format: { comments: false, preamble: banner } }));

export default [
  /*
  |--------------------------------------------------------------------------
  | ESM and CJS Builds
  |--------------------------------------------------------------------------
  |
  | The public entry is built as both ESM and CJS together in one Rollup pass.
  |
  */
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/motus.js', format: 'es', sourcemap: isDev, banner },
      { file: 'dist/motus.cjs', format: 'cjs', sourcemap: isDev, banner, exports: 'named' },
    ],
    plugins: [
      ts(),
      // We serve `demo/` against the fresh `dist/` during `npm run dev`.
      isDev && serve({ open: true, contentBase: ['demo', '.'], port: 8080 }),
      isDev && livereload({ watch: ['dist', 'demo'] }),
    ].filter(Boolean),
  },

  /*
  |--------------------------------------------------------------------------
  | UMD Build
  |--------------------------------------------------------------------------
  |
  | The UMD build for a plain `<script>` tag builds from `src/global.ts` only.
  |
  */
  {
    // Its lone default export makes `window.Motus` the API object itself.
    input: 'src/global.ts',
    output: [
      {
        file: 'dist/motus.umd.js',
        format: 'umd',
        name: 'Motus',
        sourcemap: isDev,
        // We leave out `banner` here, since terser injects it as a preamble.
        exports: 'default',
      },
    ],
    plugins: [ts(), minifyUmd()].filter(Boolean),
  },

  /*
  |--------------------------------------------------------------------------
  | Type Declarations
  |--------------------------------------------------------------------------
  |
  | Bundled declarations ship as `.d.ts` for ESM and as `.d.cts` for CommonJS.
  |
  */
  {
    input: 'src/index.ts',

    // The `.d.cts` stops a CJS `require()` from resolving ESM-flavoured types.
    output: [
      { file: 'dist/motus.d.ts', format: 'es' },
      { file: 'dist/motus.d.cts', format: 'es' },
    ],
    plugins: [dts({ tsconfig: './tsconfig.build.json' })],
  },
];
