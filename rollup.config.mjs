import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import livereload from 'rollup-plugin-livereload';
import serve from 'rollup-plugin-serve';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Source maps are for local development only. Published maps would point at
 * `src/*.ts` files that are not in the package, so a consumer's devtools would
 * report "source not found" while the maps took up 45% of the tarball.
 */

/**
 * TypeScript does the downleveling, not the bundler.
 *
 * The source uses `??` and `?.`, which are Chrome 80+ / Safari 13.4+, so
 * shipping them untransformed would break the very browsers the README claims
 * to support. tsc lowers to ES2017, which every IntersectionObserver-capable
 * browser handles.
 */
const ts = () =>
  typescript({
    tsconfig: './tsconfig.build.json',
    // Declarations come from the dedicated dts pass below.
    declaration: false,
    declarationMap: false,
    // Must track the output setting, or Rollup warns that it was asked for
    // maps it is not configured to emit.
    sourceMap: isDev,
  });

const banner = '/*! dwg-motus | MIT License | https://github.com/dubose-web/dwg-motus */';

/**
 * Only the UMD build is minified.
 *
 * ESM and CJS are consumed through a bundler, which minifies them again on the
 * way into the application — so minifying here changes nothing an end user
 * downloads, and costs readable stack traces. That matters more now that source
 * maps are deliberately not published. UMD is the opposite case: it is loaded
 * directly by a <script> tag, so those bytes really do go over the wire.
 *
 * `preamble` rather than `output.banner`, because terser drops every comment
 * (including a `/*!` one) and runs after Rollup has prepended the banner.
 * preamble is injected post-minification and cannot be stripped.
 */
const minifyUmd = () => (isDev ? null : terser({ format: { comments: false, preamble: banner } }));

export default [
  // ESM + CJS from the public entry, in a single pass.
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/motus.js', format: 'es', sourcemap: isDev, banner },
      { file: 'dist/motus.cjs', format: 'cjs', sourcemap: isDev, banner, exports: 'named' },
    ],
    plugins: [
      ts(),
      // `npm run dev` serves demo/ against the freshly built dist/.
      isDev && serve({ open: true, contentBase: ['demo', '.'], port: 8080 }),
      isDev && livereload({ watch: ['dist', 'demo'] }),
    ].filter(Boolean),
  },

  // UMD for a plain <script> tag. It builds from src/global.ts, which carries
  // only a default export, so `window.Motus` is the API object itself rather
  // than a namespace with a `.default` property.
  {
    input: 'src/global.ts',
    output: [
      {
        file: 'dist/motus.umd.js',
        format: 'umd',
        name: 'Motus',
        sourcemap: isDev,
        // No `banner` here: terser injects it as a preamble instead.
        exports: 'default',
      },
    ],
    plugins: [ts(), minifyUmd()].filter(Boolean),
  },

  // Bundled declarations: one .d.ts for ESM consumers, one .d.cts so a CJS
  // `require()` under moduleResolution: node16 does not resolve ESM-flavoured
  // types (the "masquerading as ESM" problem).
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/motus.d.ts', format: 'es' },
      { file: 'dist/motus.d.cts', format: 'es' },
    ],
    plugins: [dts({ tsconfig: './tsconfig.build.json' })],
  },
];
