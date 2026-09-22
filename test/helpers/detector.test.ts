import { describe, expect, it } from 'vitest';
import detect from '../../src/helpers/detector.js';
import { COARSE, COARSE_PHONE, stubMatchMedia } from '../setup.js';

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
