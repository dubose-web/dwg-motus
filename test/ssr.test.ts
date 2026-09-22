// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('server-side import', () => {
  it('loads without a DOM', async () => {
    expect(typeof globalThis.document).toBe('undefined');

    const module = await import('../src/index.js');

    expect(typeof module.default.init).toBe('function');
    expect(Object.isFrozen(module.default)).toBe(true);
  });
});
