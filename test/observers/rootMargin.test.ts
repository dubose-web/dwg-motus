import { describe, expect, it } from 'vitest';
import { dependsOnHeight, getRootMargin, getThreshold } from '../../src/observers/rootMargin.js';
import { ANCHOR_PLACEMENTS } from '../../src/defaults.js';
import type { AnchorPlacement } from '../../src/types.js';

describe('getRootMargin', () => {
  it.each(['top-bottom', 'center-bottom', 'bottom-bottom'] as AnchorPlacement[])(
    '%s shrinks the bottom edge by the offset',
    (placement) => {
      expect(getRootMargin(placement, 120, 800)).toBe('0px 0px -120px 0px');
    },
  );

  it.each(['top-center', 'center-center', 'bottom-center'] as AnchorPlacement[])(
    '%s collapses the root symmetrically around the midpoint',
    (placement) => {
      // We expect half of 800, minus the 120 offset, which is 280.
      expect(getRootMargin(placement, 120, 800)).toBe('-280px 0px -280px 0px');
    },
  );

  it('clamps the centre margin to 1px when the offset exceeds half the viewport', () => {
    expect(getRootMargin('center-center', 500, 800)).toBe('-1px 0px -1px 0px');
  });

  it.each(['top-top', 'center-top', 'bottom-top'] as AnchorPlacement[])(
    '%s expands the top edge and pulls the bottom up',
    (placement) => {
      expect(getRootMargin(placement, 120, 800)).toBe('120px 0px -680px 0px');
    },
  );

  it('clamps the top expansion to 1px at zero offset', () => {
    expect(getRootMargin('top-top', 0, 800)).toBe('1px 0px -800px 0px');
  });

  it('falls back to the bottom behaviour for an unknown placement', () => {
    expect(getRootMargin('nonsense' as AnchorPlacement, 50, 800)).toBe('0px 0px -50px 0px');
  });

  it('reads window.innerHeight when no height is supplied', () => {
    expect(getRootMargin('top-top', 100)).toBe('100px 0px -700px 0px');
  });
});

describe('dependsOnHeight', () => {
  // We derive this from `getRootMargin`, so the two switches can't drift.
  it.each([...ANCHOR_PLACEMENTS])('%s matches what getRootMargin actually reads', (placement) => {
    const reads = getRootMargin(placement, 120, 600) !== getRootMargin(placement, 120, 800);
    expect(dependsOnHeight(placement)).toBe(reads);
  });

  it('is false for the default placement', () => {
    expect(dependsOnHeight('top-bottom')).toBe(false);
  });
});

describe('getThreshold', () => {
  it.each(['center-bottom', 'center-center', 'center-top'] as AnchorPlacement[])(
    '%s waits for half the element',
    (placement) => {
      expect(getThreshold(placement)).toBe(0.5);
    },
  );

  it.each([
    'top-bottom',
    'top-center',
    'top-top',
    'bottom-bottom',
    'bottom-center',
    'bottom-top',
  ] as AnchorPlacement[])('%s triggers at zero', (placement) => {
    expect(getThreshold(placement)).toBe(0);
  });
});
