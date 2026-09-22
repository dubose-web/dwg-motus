import { describe, expect, it } from 'vitest';
import Motus from '../src/index.js';

describe('public API', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(Motus)).toBe(true);
  });

  it('cannot be monkey-patched', () => {
    const original = Motus.init;
    expect(() => {
      (Motus as { init: unknown }).init = () => undefined;
    }).toThrow();
    expect(Motus.init).toBe(original);
  });

  it('exposes exactly the four lifecycle methods', () => {
    expect(Object.keys(Motus).sort()).toEqual(['destroy', 'init', 'refresh', 'refreshHard']);
  });

  it('keeps disable private', () => {
    expect('disable' in Motus).toBe(false);
  });
});
