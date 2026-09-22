import { describe, expect, it } from 'vitest';
import { resolveEasing } from '../../src/helpers/resolveEasing.js';

const MAPPED = [
  'ease-in-back',
  'ease-out-back',
  'ease-in-out-back',
  'ease-in-sine',
  'ease-out-sine',
  'ease-in-out-sine',
  'ease-in-quad',
  'ease-out-quad',
  'ease-in-out-quad',
  'ease-in-cubic',
  'ease-out-cubic',
  'ease-in-out-cubic',
  'ease-in-quart',
  'ease-out-quart',
  'ease-in-out-quart',
] as const;

describe('resolveEasing', () => {
  it.each(MAPPED)('maps %s to a cubic-bezier', (name) => {
    expect(resolveEasing(name)).toMatch(/^cubic-bezier\(/);
  });

  it('maps all 15 named easings', () => {
    expect(new Set(MAPPED.map(resolveEasing)).size).toBe(15);
  });

  // These are deliberately absent from the map so the browser handles them.
  it.each(['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out'])(
    'passes the CSS keyword %s through untouched',
    (keyword) => {
      expect(resolveEasing(keyword)).toBe(keyword);
    },
  );

  it('passes a raw cubic-bezier value through', () => {
    const raw = 'cubic-bezier(.25, .25, .75, .75)';
    expect(resolveEasing(raw)).toBe(raw);
  });

  it('returns an unknown name unchanged', () => {
    expect(resolveEasing('not-a-real-easing')).toBe('not-a-real-easing');
  });
});
