/**
 * UMD-only entry.
 *
 * It carries a single default export so Rollup's `exports: 'default'` is
 * unambiguous and `window.Motus` is the API object itself rather than
 * `{ default: ... }`.
 */
import Motus from './index.js';

export default Motus;
