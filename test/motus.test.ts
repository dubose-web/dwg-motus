import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroy, init, refresh, refreshHard } from '../src/motus.js';
import { DEFAULTS } from '../src/defaults.js';
import {
  COARSE,
  COARSE_PHONE,
  MockIntersectionObserver,
  raf,
  setRect,
  setViewportHeight,
  stubMatchMedia,
} from './setup.js';

const mount = (count = 1): HTMLElement[] => {
  document.body.innerHTML = Array.from(
    { length: count },
    () => '<div data-motus="fade-up"></div>',
  ).join('');
  const els = [...document.body.querySelectorAll<HTMLElement>('[data-motus]')];
  for (const el of els) setRect(el, { top: 5000, bottom: 5200 });
  return els;
};

/** Runs the two frames the ready sequence needs. */
const settleFrames = () => raf.flushAll();

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  destroy();
});

describe('init()', () => {
  it('returns the matched elements', () => {
    mount(3);
    expect(init()).toHaveLength(3);
  });

  it('sets the global custom properties on body', () => {
    mount();
    init({ duration: 900, delay: 150, easing: 'ease-out-back' });

    expect(document.body.style.getPropertyValue('--motus-duration')).toBe('900ms');
    expect(document.body.style.getPropertyValue('--motus-delay')).toBe('150ms');
    expect(document.body.style.getPropertyValue('--motus-easing')).toBe(
      'cubic-bezier(.175, .885, .32, 1.275)',
    );
  });

  it('never mutates the frozen defaults', () => {
    mount();
    init({ duration: 5000, offset: 999 });
    destroy();

    expect(DEFAULTS.duration).toBe(400);
    expect(DEFAULTS.offset).toBe(120);
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
  });

  it('does not leak settings between calls', () => {
    mount();
    init({ duration: 5000 });
    init();

    expect(document.body.style.getPropertyValue('--motus-duration')).toBe('400ms');
  });

  it('tears down the previous run before starting a new one', () => {
    mount();
    init();
    const firstRunObservers = MockIntersectionObserver.instances.length;

    init();

    // Every observer from the first run is disconnected.
    expect(
      MockIntersectionObserver.instances.slice(0, firstRunObservers).every((o) => o.disconnected),
    ).toBe(true);
  });

  it('warns and bails out when IntersectionObserver is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('IntersectionObserver', undefined);
    mount();

    expect(init()).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('IntersectionObserver'));
  });

  it('refreshes immediately when the document has already loaded', () => {
    mount();
    init();
    settleFrames();

    expect(document.body.classList.contains('motus-ready')).toBe(true);
  });

  it('listens on document for a custom startEvent', () => {
    mount();
    init({ startEvent: 'app:ready' });

    expect(document.body.classList.contains('motus-ready')).toBe(false);

    document.dispatchEvent(new Event('app:ready'));
    settleFrames();

    expect(document.body.classList.contains('motus-ready')).toBe(true);
  });

  it('does not refresh twice when load fires after DOMContentLoaded', () => {
    const els = mount();
    setRect(els[0]!, { top: 100, bottom: 300 });
    const listener = vi.fn();
    document.addEventListener('motus:in', listener);

    init();
    settleFrames();
    window.dispatchEvent(new Event('load'));
    settleFrames();

    expect(listener).toHaveBeenCalledTimes(1);
    document.removeEventListener('motus:in', listener);
  });
});

describe('the ready sequence', () => {
  it('waits two frames before enabling transitions', () => {
    mount();
    init();

    // init() calls refresh synchronously; nothing may be ready yet.
    expect(document.body.classList.contains('motus-ready')).toBe(false);

    raf.flush();
    expect(document.body.classList.contains('motus-ready')).toBe(false);

    raf.flush();
    expect(document.body.classList.contains('motus-ready')).toBe(true);
  });

  it('animates an above-the-fold element only after the ready class lands', () => {
    const els = mount();
    setRect(els[0]!, { top: 100, bottom: 300 });

    init();
    raf.flush();
    expect(els[0]!.classList.contains('motus-animate')).toBe(false);

    raf.flush();
    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });

  it('activates synchronously once the page is already ready', () => {
    const els = mount();
    init();
    settleFrames();

    // A later element, added after the first paint.
    document.body.insertAdjacentHTML('beforeend', '<div data-motus="fade"></div>');
    const added = document.body.lastElementChild as HTMLElement;
    setRect(added, { top: 100, bottom: 300 });
    setRect(els[0]!, { top: 5000, bottom: 5200 });

    setViewportHeight(801); // force the height guard to allow a rebuild
    refresh();

    expect(added.classList.contains('motus-animate')).toBe(true);
  });
});

describe('refresh()', () => {
  it('is a no-op before init()', () => {
    mount();
    expect(() => refresh()).not.toThrow();
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });

  it('skips the rebuild on a width-only resize', () => {
    mount();
    init();
    settleFrames();
    const before = MockIntersectionObserver.instances.length;

    // The resize path keeps the height guard; refresh() deliberately does not.
    window.dispatchEvent(new Event('resize'));
    expect(MockIntersectionObserver.instances).toHaveLength(before);
  });

  it('rebuilds when the height changed', () => {
    mount();
    init();
    settleFrames();
    const before = MockIntersectionObserver.instances.length;

    setViewportHeight(600);
    refresh();

    expect(MockIntersectionObserver.instances.length).toBeGreaterThan(before);
  });

  it('is not reachable with the internal initialize flag', () => {
    mount();
    (refresh as () => void)();
    expect(document.body.classList.contains('motus-ready')).toBe(false);
  });

  it('recomputes rootMargin for the new height', () => {
    mount();
    init({ anchorPlacement: 'top-top' });
    settleFrames();

    setViewportHeight(600);
    refresh();

    expect(MockIntersectionObserver.last.rootMargin).toBe('120px 0px -480px 0px');
  });

  it('is not reachable with the internal initialize flag', () => {
    mount();
    // A consumer calling refresh(true) must not be able to mark the library
    // initialised from outside.
    (refresh as () => void)();
    expect(document.body.classList.contains('motus-ready')).toBe(false);
  });
});

describe('disable', () => {
  it('bails out when data-motus-disabled is on <html>', () => {
    document.documentElement.setAttribute('data-motus-disabled', '');
    mount();

    expect(init()).toBeUndefined();
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });

  it('bails out for disable: true', () => {
    mount();
    expect(init({ disable: true })).toBeUndefined();
  });

  it('bails out for a predicate returning true', () => {
    mount();
    expect(init({ disable: () => true })).toBeUndefined();
  });

  it.each([
    ['mobile', [COARSE]],
    ['phone', [COARSE, COARSE_PHONE]],
    ['tablet', [COARSE]],
  ] as const)('bails out for disable: %s', (keyword, queries) => {
    stubMatchMedia([...queries]);
    mount();
    expect(init({ disable: keyword })).toBeUndefined();
  });

  it('runs normally when the device does not match', () => {
    stubMatchMedia([]);
    mount();
    expect(init({ disable: 'phone' })).toHaveLength(1);
  });

  it('marks <html> inactive so the CSS reveals the hidden elements', () => {
    mount();
    init({ disable: true });

    expect(document.documentElement.hasAttribute('data-motus-inactive')).toBe(true);
  });

  it('clears the inactive attribute when a later init() is not disabled', () => {
    mount();
    init({ disable: true });
    expect(document.documentElement.hasAttribute('data-motus-inactive')).toBe(true);

    expect(init({ disable: false })).toHaveLength(1);
    expect(document.documentElement.hasAttribute('data-motus-inactive')).toBe(false);
  });

  it('does not set the consumer kill switch, which would wedge init() off', () => {
    mount();
    init({ disable: true });

    expect(document.documentElement.hasAttribute('data-motus-disabled')).toBe(false);
  });

  it('marks <html> inactive when IntersectionObserver is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('IntersectionObserver', undefined);
    mount();

    expect(init()).toBeUndefined();
    expect(document.documentElement.hasAttribute('data-motus-inactive')).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it('leaves data-motus attributes on the markup', () => {
    const els = mount();
    init();
    settleFrames();
    destroy();

    expect(els[0]!.getAttribute('data-motus')).toBe('fade-up');
  });

  it('removes the classes and custom properties it added', () => {
    const els = mount();
    setRect(els[0]!, { top: 100, bottom: 300 });
    init();
    settleFrames();
    expect(els[0]!.classList.contains('motus-animate')).toBe(true);

    destroy();

    expect(els[0]!.classList.contains('motus-animate')).toBe(false);
    expect(els[0]!.classList.contains('motus-init')).toBe(false);
    expect(document.body.classList.contains('motus-ready')).toBe(false);
  });
});

describe('refreshHard()', () => {
  it('brings the library back after an init-time disable', () => {
    stubMatchMedia([COARSE]);
    const els = mount();
    expect(init({ disable: 'mobile' })).toBeUndefined();
    expect(document.documentElement.hasAttribute('data-motus-inactive')).toBe(true);

    // The device signal no longer matches.
    stubMatchMedia([]);
    setRect(els[0]!, { top: 100, bottom: 300 });
    refreshHard();
    settleFrames();

    // Not just un-flagged — actually observing and animating again.
    expect(document.documentElement.hasAttribute('data-motus-inactive')).toBe(false);
    expect(document.body.classList.contains('motus-ready')).toBe(true);
    expect(els[0]!.classList.contains('motus-init')).toBe(true);
    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });

  it('disables when the page has become disabled', () => {
    mount();
    init();
    settleFrames();

    document.documentElement.setAttribute('data-motus-disabled', '');
    refreshHard();

    expect(document.body.classList.contains('motus-ready')).toBe(false);
  });
});

describe('destroy()', () => {
  it('removes every listener', () => {
    mount();
    init();
    settleFrames();
    destroy();

    const before = MockIntersectionObserver.instances.length;
    setViewportHeight(600);
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('load'));

    expect(MockIntersectionObserver.instances).toHaveLength(before);
  });

  it('clears the global custom properties', () => {
    mount();
    init();
    destroy();

    expect(document.body.style.getPropertyValue('--motus-duration')).toBe('');
    expect(document.body.style.getPropertyValue('--motus-easing')).toBe('');
  });

  it('is idempotent', () => {
    mount();
    init();
    destroy();
    expect(() => destroy()).not.toThrow();
  });

  it('allows a clean re-init afterwards', () => {
    const els = mount();
    init();
    settleFrames();
    destroy();

    setRect(els[0]!, { top: 100, bottom: 300 });
    expect(init()).toHaveLength(1);
    settleFrames();

    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });
});

describe('dynamically added content', () => {
  it('picks up new elements without needing a resize', () => {
    mount();
    init();
    settleFrames();

    // The viewport has not changed size — the width-only-resize optimisation
    // must not suppress a rebuild triggered by new DOM.
    document.body.insertAdjacentHTML('beforeend', '<div data-motus="fade"></div>');
    const added = document.body.lastElementChild as HTMLElement;
    setRect(added, { top: 100, bottom: 300 });

    refreshHard();

    expect(added.classList.contains('motus-init')).toBe(true);
    expect(added.classList.contains('motus-animate')).toBe(true);
  });

  it('refresh() rebuilds even when the height is unchanged', () => {
    mount();
    init();
    settleFrames();

    document.body.insertAdjacentHTML('beforeend', '<div data-motus="fade"></div>');
    const added = document.body.lastElementChild as HTMLElement;
    setRect(added, { top: 100, bottom: 300 });

    refresh();

    expect(added.classList.contains('motus-animate')).toBe(true);
  });
});
