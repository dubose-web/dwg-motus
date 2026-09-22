import { describe, expect, it, vi } from 'vitest';
import { normalizeOptions } from '../src/validate.js';
import { DEFAULTS } from '../src/defaults.js';
import type { MotusUserOptions } from '../src/types.js';

const warnOnce = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('normalizeOptions', () => {
  it('returns the defaults for an empty call', () => {
    const warn = warnOnce();
    expect(normalizeOptions()).toEqual(DEFAULTS);
    expect(warn).not.toHaveBeenCalled();
  });

  it('stays silent for a fully valid configuration', () => {
    const warn = warnOnce();
    normalizeOptions({
      offset: 0,
      delay: 200,
      duration: 800,
      easing: 'ease-out-cubic',
      once: true,
      mirror: false,
      anchorPlacement: 'center-center',
      disable: 'phone',
      debounceDelay: 100,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns about an unknown option key', () => {
    const warn = warnOnce();
    normalizeOptions({ durtaion: 400 } as MotusUserOptions);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unknown option "durtaion"'));
  });

  it.each(['duration', 'delay', 'offset'] as const)('rejects a negative %s', (key) => {
    const warn = warnOnce();
    const result = normalizeOptions({ [key]: -1 });
    expect(result[key]).toBe(DEFAULTS[key]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`"${key}"`));
  });

  it('rejects a non-numeric duration', () => {
    warnOnce();
    expect(normalizeOptions({ duration: 'fast' as unknown as number }).duration).toBe(400);
  });

  it('rejects an unknown anchorPlacement', () => {
    const warn = warnOnce();
    const result = normalizeOptions({ anchorPlacement: 'middle-ish' as never });
    expect(result.anchorPlacement).toBe('top-bottom');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('anchorPlacement'));
  });

  it('rejects an unknown disable keyword', () => {
    const warn = warnOnce();
    expect(normalizeOptions({ disable: 'desktop' as never }).disable).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('disable'));
  });

  it('accepts a disable predicate untouched', () => {
    warnOnce();
    const predicate = () => true;
    expect(normalizeOptions({ disable: predicate }).disable).toBe(predicate);
  });

  it.each([
    [0, 16],
    [5, 16],
    [5000, 500],
    [100, 100],
  ])('clamps debounceDelay %i to %i', (input, expected) => {
    warnOnce();
    expect(normalizeOptions({ debounceDelay: input }).debounceDelay).toBe(expected);
  });

  it('falls back for a non-numeric debounceDelay', () => {
    warnOnce();
    expect(normalizeOptions({ debounceDelay: 'slow' as unknown as number }).debounceDelay).toBe(50);
  });

  it('warns when it actually clamps', () => {
    const warn = warnOnce();
    normalizeOptions({ debounceDelay: 5000 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('debounceDelay'));
  });

  it('groups every problem into one warning', () => {
    const warn = warnOnce();
    normalizeOptions({ duration: -1, offset: -1, anchorPlacement: 'nope' as never });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty startEvent', () => {
    warnOnce();
    expect(normalizeOptions({ startEvent: '' }).startEvent).toBe('DOMContentLoaded');
  });
});
