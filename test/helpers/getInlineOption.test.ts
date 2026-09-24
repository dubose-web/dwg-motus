import { describe, expect, it } from 'vitest';
import { getInlineOption } from '../../src/helpers/getInlineOption.js';

const el = (attrs: Record<string, string>): HTMLElement => {
  const node = document.createElement('div');
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

describe('getInlineOption', () => {
  it('reads the data-motus- prefix', () => {
    expect(getInlineOption(el({ 'data-motus-delay': '300' }), 'delay')).toBe('300');
  });

  it('ignores an identically named attribute under a different prefix', () => {
    expect(getInlineOption(el({ 'data-delay': '300' }), 'delay', 'fallback')).toBe('fallback');
    expect(getInlineOption(el({ 'data-scroll-delay': '300' }), 'delay', 'fallback')).toBe(
      'fallback',
    );
  });

  it('coerces "true" and "false" to booleans', () => {
    expect(getInlineOption(el({ 'data-motus-once': 'true' }), 'once')).toBe(true);
    expect(getInlineOption(el({ 'data-motus-once': 'false' }), 'once')).toBe(false);
  });

  it('preserves "0" instead of falling back', () => {
    // This is the `??` versus `||` regression: `"0"` is falsy but meaningful.
    expect(getInlineOption(el({ 'data-motus-delay': '0' }), 'delay', 500)).toBe('0');
    expect(getInlineOption(el({ 'data-motus-offset': '0' }), 'offset', 120)).toBe('0');
  });

  it('preserves an empty attribute value', () => {
    expect(getInlineOption(el({ 'data-motus-id': '' }), 'id', 'fallback')).toBe('');
  });

  it('falls back when the attribute is absent', () => {
    expect(getInlineOption(el({}), 'delay', 120)).toBe(120);
    expect(getInlineOption(el({}), 'delay')).toBeUndefined();
  });
});
