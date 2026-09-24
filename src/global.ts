/**
 * Expose the API as the UMD bundle's single default export.
 *
 * That keeps Rollup's `exports: 'default'` unambiguous for `window.Motus`.
 */
import Motus from './index.js';

export default Motus;
