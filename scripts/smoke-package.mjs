/**
 * Packs the real tarball, installs it into a throwaway project, and asserts
 * against *that* rather than against the working tree.
 *
 * publint and attw check the shape of a package — its exports map, its type
 * resolution. Neither would have caught source maps that pointed at files the
 * package does not contain, and neither proves that
 * `@use '@duboseweb/motus/scss/core'` actually resolves. This does.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import * as sass from 'sass';

const REPO = resolve(import.meta.dirname, '..');

const failures = [];
const check = (label, fn) => {
  try {
    const detail = fn();
    console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures.push(label);
    console.log(`  FAIL  ${label}\n          ${error.message.split('\n')[0]}`);
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const npm = (args, cwd) =>
  execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** Runs a snippet with the throwaway project as the resolution root. */
const node = (args, cwd) =>
  execFileSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

/** Every file in a directory, as posix-style paths relative to it. */
const walk = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [relative(base, full).split('\\').join('/')];
  });

const workspace = mkdtempSync(join(tmpdir(), 'dwg-motus-smoke-'));

try {
  // Build first so the result cannot depend on whatever happens to be in
  // dist/. Without this a running `npm run dev` watcher, which emits source
  // maps and skips minification, silently invalidates every assertion below.
  if (!process.argv.includes('--no-build')) {
    console.log('building…');
    npm(['run', 'build'], REPO);
  }

  console.log('packing…');
  const tarball = join(
    workspace,
    npm(['pack', '--silent', '--pack-destination', workspace], REPO).trim(),
  );

  const consumer = join(workspace, 'consumer');
  execFileSync('mkdir', ['-p', consumer]);
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'consumer', version: '1.0.0', private: true }, null, 2),
  );

  console.log('installing into a throwaway project…\n');
  npm(['install', tarball, '--no-audit', '--no-fund', '--prefer-offline'], consumer);

  const installed = join(consumer, 'node_modules', '@duboseweb', 'motus');
  const manifest = walk(installed);

  // ---- what ships -------------------------------------------------------

  check('no source maps are published', () => {
    const maps = manifest.filter((f) => f.endsWith('.map'));
    assert(
      maps.length === 0,
      `found ${maps.length} (${maps.join(', ')}). This is what a development ` +
        'build looks like — is `npm run dev` running and rewriting dist/?',
    );
  });

  check('no build-internal or source files are published', () => {
    const leaked = manifest.filter(
      (f) =>
        f.startsWith('src/') ||
        f.startsWith('test/') ||
        f.startsWith('demo/') ||
        f.includes('scss/entries/') ||
        f.endsWith('.test.ts') ||
        f.endsWith('tsconfig.json'),
    );
    assert(leaked.length === 0, `leaked: ${leaked.join(', ')}`);
  });

  check('every expected file is present', () => {
    const required = [
      'dist/motus.js',
      'dist/motus.cjs',
      'dist/motus.umd.js',
      'dist/motus.d.ts',
      'dist/motus.d.cts',
      'dist/css/core.css',
      'dist/css/motus.css',
      'scss/config.scss',
      'scss/core.scss',
      'scss/motus.scss',
      'scss/animations/fade.scss',
      'README.md',
      'LICENSE',
    ];
    const missing = required.filter((f) => !manifest.includes(f));
    assert(missing.length === 0, `missing: ${missing.join(', ')}`);
    return `${manifest.length} files`;
  });

  check('type declarations are non-empty', () => {
    for (const f of ['dist/motus.d.ts', 'dist/motus.d.cts']) {
      assert(statSync(join(installed, f)).size > 500, `${f} looks truncated`);
    }
  });

  check('the license banner survives in every bundle', () => {
    for (const f of ['dist/motus.js', 'dist/motus.cjs', 'dist/motus.umd.js']) {
      const code = readFileSync(join(installed, f), 'utf8');
      assert(code.includes('dwg-motus | MIT License'), `${f} has no banner`);
    }
  });

  // ---- JS entry points --------------------------------------------------

  const API = 'destroy,init,refresh,refreshHard';

  check('ESM import resolves and exposes the API', () => {
    const out = node(
      [
        '--input-type=module',
        '-e',
        `import M from '@duboseweb/motus';
         if (Object.keys(M).sort().join(',') !== '${API}') throw new Error('keys: ' + Object.keys(M));
         if (!Object.isFrozen(M)) throw new Error('not frozen');
         console.log('frozen, 4 methods');`,
      ],
      consumer,
    );
    return out.trim();
  });

  check('CJS require resolves and exposes the API', () => {
    const out = node(
      [
        '-e',
        `const M = require('@duboseweb/motus');
         const api = M.default ?? M;
         if (Object.keys(api).sort().join(',') !== '${API}') throw new Error('keys: ' + Object.keys(api));
         console.log('4 methods');`,
      ],
      consumer,
    );
    return out.trim();
  });

  check('the UMD build defines a global', () => {
    // It cannot be require()d: a UMD file inside a "type": "module" package is
    // parsed as ESM. A sandbox with no `exports`/`module` forces the UMD
    // wrapper down its browser-global branch, which is the one that matters.
    const sandbox = createContext({ self: {} });
    runInContext(readFileSync(join(installed, 'dist/motus.umd.js'), 'utf8'), sandbox);
    const global = sandbox.Motus ?? sandbox.self.Motus;
    assert(global, 'no Motus global was defined');
    assert(typeof global.init === 'function', 'Motus.init is not a function');
    return 'window.Motus.init()';
  });

  // ---- CSS subpath exports ----------------------------------------------

  check('CSS subpaths resolve through the exports map', () => {
    const paths = [
      '@duboseweb/motus/motus.css',
      ...['core', 'fade', 'zoom', 'slide', 'flip'].map((n) => `@duboseweb/motus/css/${n}.css`),
    ];
    node(['-e', `for (const p of ${JSON.stringify(paths)}) require.resolve(p);`], consumer);
    return `${paths.length} paths`;
  });

  // ---- the documented SCSS path -----------------------------------------

  check('SCSS partials compile through the documented @use path', () => {
    // loadPaths, not the exports map: this is the Dart Sass workflow that
    // bypasses `exports` entirely, so it exercises the real on-disk layout.
    const css = sass.compileString(
      `@use '@duboseweb/motus/scss/config' with ($motus-distance: 250px);
       @use '@duboseweb/motus/scss/core';
       @use '@duboseweb/motus/scss/animations/fade';`,
      { loadPaths: [join(consumer, 'node_modules')], style: 'expanded' },
    ).css;

    assert(css.includes('250px'), '$motus-distance override did not apply');
    assert(css.includes('motus-ready'), 'core styles missing');
    assert(css.includes('data-motus^='), 'fade family missing');
    assert(!css.includes('zoom'), 'unrequested family leaked in');
    return `${css.length} B, override applied`;
  });

  check('the full SCSS bundle compiles', () => {
    const css = sass.compileString(`@use '@duboseweb/motus/scss/motus';`, {
      loadPaths: [join(consumer, 'node_modules')],
      style: 'expanded',
    }).css;
    const families = (css.match(/data-motus\^=/g) ?? []).length;
    assert(families >= 8, `expected every family, found ${families} prefix selectors`);
    return `${families} family selectors`;
  });
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

console.log();
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log('package smoke test passed');
