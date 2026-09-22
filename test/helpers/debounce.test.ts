import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '../../src/helpers/debounce.js';

describe('debounce', () => {
  afterEach(() => vi.useRealTimers());

  it('collapses a burst of calls into one', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    for (let i = 0; i < 20; i += 1) debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('invokes with the most recent arguments', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    debounced('first');
    debounced('last');
    vi.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledWith('last');
  });

  it('restarts the timer on every call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    debounced();
    vi.advanceTimersByTime(40);
    debounced();
    vi.advanceTimersByTime(40);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
