import { describe, expect, it } from 'vitest';
import * as detect from '../../src/helpers/detector.js';
import { BELOW_LG, belowQuery, COARSE, COARSE_PHONE, stubMatchMedia } from '../setup.js';

describe('below()', () => {
  it('matches when the viewport is under the breakpoint', () => {
    stubMatchMedia([BELOW_LG]);
    expect(detect.below(992)).toBe(true);
  });

  it('does not match when the viewport is over the breakpoint', () => {
    stubMatchMedia([]);
    expect(detect.below(992)).toBe(false);
  });

  it('subtracts 0.02 so fractional widths have no dead zone', () => {
    // `- 0.02` keeps a 991.5px window below 992px, where `- 1` would miss it.
    expect(belowQuery(992)).toBe('(max-width: 991.98px)');
    stubMatchMedia([belowQuery(992)]);
    expect(detect.below(992)).toBe(true);
  });

  it('honours a custom breakpoint width', () => {
    stubMatchMedia([belowQuery(1024)]);
    expect(detect.below(1024)).toBe(true);
    expect(detect.below(992)).toBe(false);
  });
});

describe('device detection', () => {
  it('reports a phone when coarse, hoverless and narrow', () => {
    stubMatchMedia([COARSE, COARSE_PHONE]);
    expect(detect.phone()).toBe(true);
    expect(detect.mobile()).toBe(true);
    expect(detect.tablet()).toBe(false);
  });

  it('reports a tablet when coarse and hoverless but wide', () => {
    stubMatchMedia([COARSE]);
    expect(detect.phone()).toBe(false);
    expect(detect.mobile()).toBe(true);
    expect(detect.tablet()).toBe(true);
  });

  it('reports nothing on a desktop pointer', () => {
    stubMatchMedia([]);
    expect(detect.phone()).toBe(false);
    expect(detect.mobile()).toBe(false);
    expect(detect.tablet()).toBe(false);
  });
});
