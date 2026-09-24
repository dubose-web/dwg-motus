import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroy, init, refresh, refreshHard } from '../src/motus.js';
import { DEFAULTS } from '../src/defaults.js';
import {
  BELOW_LG,
  BELOW_MD,
  BELOW_SM,
  belowQuery,
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

/**
 * Run every queued frame, including the two the ready sequence needs.
 */
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

    // We expect every observer from the first run to be disconnected.
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

  it('treats an entry without isIntersecting (Chrome 51-57) as unsupported', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    class LegacyEntry {}
    Object.defineProperty(LegacyEntry.prototype, 'intersectionRatio', { value: 0 });
    vi.stubGlobal('IntersectionObserverEntry', LegacyEntry);
    mount();

    expect(init()).toBeUndefined();
    expect(document.documentElement.hasAttribute('data-motus-inactive')).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('IntersectionObserver'));
  });

  it('sets the global custom properties when init() runs before <body> exists', () => {
    // We mimic a `<head>` script, where the body is null until parsed.
    mount();
    const body = document.body;
    Object.defineProperty(document, 'body', { get: () => null, configurable: true });
    try {
      init({ startEvent: 'app:ready' });
    } finally {
      delete (document as { body?: unknown }).body;
    }
    expect(document.body).toBe(body);

    document.dispatchEvent(new Event('app:ready'));

    expect(document.body.style.getPropertyValue('--motus-duration')).toBe('400ms');
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

describe('startEvent timing', () => {
  const original = Object.getOwnPropertyDescriptor(document, 'readyState');
  const setReadyState = (state: DocumentReadyState) =>
    Object.defineProperty(document, 'readyState', { value: state, configurable: true });

  afterEach(() => {
    if (original) Object.defineProperty(document, 'readyState', original);
    else delete (document as { readyState?: unknown }).readyState;
  });

  const isReady = () => document.body.classList.contains('motus-ready');

  it("starts at once for 'load' when the page has already loaded", () => {
    // We'd wait forever on the listener alone, as the event already fired.
    setReadyState('complete');
    mount();
    init({ startEvent: 'load' });
    settleFrames();

    expect(isReady()).toBe(true);
  });

  it("waits for the load event for 'load' while the document is interactive", () => {
    setReadyState('interactive');
    mount();
    init({ startEvent: 'load' });
    settleFrames();
    expect(isReady()).toBe(false);

    window.dispatchEvent(new Event('load'));
    settleFrames();
    expect(isReady()).toBe(true);
  });

  it("starts at once for 'DOMContentLoaded' while the document is interactive", () => {
    setReadyState('interactive');
    mount();
    init();
    settleFrames();

    expect(isReady()).toBe(true);
  });
});

describe('the ready sequence', () => {
  it('waits two frames before enabling transitions', () => {
    mount();
    init();

    // We check before any frame runs, as `init()` builds synchronously.
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

    // We add a later element, after the first paint.
    document.body.insertAdjacentHTML('beforeend', '<div data-motus="fade"></div>');
    const added = document.body.lastElementChild as HTMLElement;
    setRect(added, { top: 100, bottom: 300 });
    setRect(els[0]!, { top: 5000, bottom: 5200 });

    setViewportHeight(801); // force the height guard to allow a rebuild
    refresh();

    expect(added.classList.contains('motus-animate')).toBe(true);
  });
});

describe('teardown during pending frames', () => {
  it('does not add motus-ready after destroy()', () => {
    // A stale ready class would make the next `init()` skip both its frames.
    mount();
    init();
    destroy();
    raf.flushAll();

    expect(document.body.classList.contains('motus-ready')).toBe(false);
  });

  it('restarts the ready sequence when a rebuild lands inside it', () => {
    mount();
    init();
    raf.flush();

    refresh();
    raf.flush();
    expect(document.body.classList.contains('motus-ready')).toBe(false);

    raf.flush();
    expect(document.body.classList.contains('motus-ready')).toBe(true);
    expect(raf.queue.size).toBe(0);
  });

  it('does not re-init when a mutation batch is still pending at destroy()', async () => {
    mount();
    init();
    settleFrames();

    document.body.insertAdjacentHTML('beforeend', '<div data-motus="fade"></div>');
    const added = document.body.lastElementChild as HTMLElement;
    // We wait for MutationObserver's microtask, then for the rebuild's frame.
    await new Promise((resolve) => setTimeout(resolve, 0));

    destroy();
    const before = MockIntersectionObserver.instances.length;
    raf.flushAll();

    expect(MockIntersectionObserver.instances).toHaveLength(before);
    expect(added.classList.contains('motus-init')).toBe(false);
  });
});

describe('resize', () => {
  // We fake only the debounce's timers, as faking rAF skips the frame stub.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const resizeTo = (height: number) => {
    setViewportHeight(height);
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(DEFAULTS.debounceDelay);
  };

  it('skips the rebuild on a height change when no placement reads the height', () => {
    // The default placement ignores height, so a URL bar toggle can't rebuild.
    mount();
    init();
    settleFrames();
    const before = MockIntersectionObserver.instances.length;

    resizeTo(700);

    expect(MockIntersectionObserver.instances).toHaveLength(before);
  });

  it('rebuilds on a height change for a height-dependent placement', () => {
    mount();
    init({ anchorPlacement: 'center-center' });
    settleFrames();
    const before = MockIntersectionObserver.instances.length;

    resizeTo(700);

    expect(MockIntersectionObserver.instances.length).toBeGreaterThan(before);
  });

  it('rebuilds when a single element overrides to a height-dependent placement', () => {
    const els = mount(2);
    els[1]!.setAttribute('data-motus-anchor-placement', 'top-top');
    init();
    settleFrames();
    const before = MockIntersectionObserver.instances.length;

    resizeTo(700);

    expect(MockIntersectionObserver.instances.length).toBeGreaterThan(before);
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

    // Resize keeps the height guard, but `refresh()` deliberately skips it.
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

  it('does not re-fire motus:in for elements that already animated', () => {
    // This guards the replay that re-fired `motus:in` after a rebuild.
    const els = mount();
    setRect(els[0]!, { top: 100, bottom: 300 });
    init();
    settleFrames();

    const spy = vi.fn();
    document.addEventListener('motus:in', spy);
    refresh();
    document.removeEventListener('motus:in', spy);

    expect(spy).not.toHaveBeenCalled();
    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
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
    // We check that `refresh(true)` can't mark the library initialised.
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

  it('bails out below the default lg breakpoint', () => {
    stubMatchMedia([BELOW_LG]);
    mount();
    expect(init()).toBeUndefined();
  });

  it('runs at the default breakpoint on a wide viewport', () => {
    stubMatchMedia([]);
    mount();
    expect(init()).toHaveLength(1);
  });

  it('treats a tier name as "below that tier", not that tier alone', () => {
    // At 900px we are under `lg` but over `md`, so `'md'` must not disable.
    stubMatchMedia([BELOW_LG]);
    mount();
    expect(init({ disable: 'md' })).toHaveLength(1);
  });

  it('disables for every tier at or above the viewport width', () => {
    // At 500px we are under `sm`, `md` and `lg` alike.
    stubMatchMedia([BELOW_SM, BELOW_MD, BELOW_LG]);
    mount();
    expect(init({ disable: 'sm' })).toBeUndefined();
  });

  it('honours a custom breakpoint width', () => {
    stubMatchMedia([belowQuery(1400)]);
    mount();
    // The default `lg` of 992 doesn't match here, but moving it to 1400 does.
    expect(init({ breakpoints: { lg: 1400 } })).toBeUndefined();
  });

  it('keeps the other tiers when breakpoints is partially overridden', () => {
    stubMatchMedia([BELOW_MD]);
    mount();
    expect(init({ disable: 'md', breakpoints: { lg: 1400 } })).toBeUndefined();
  });

  it('marks <html> inactive so the CSS reveals the hidden elements', () => {
    stubMatchMedia([BELOW_LG]);
    mount();
    init();

    expect(document.documentElement.hasAttribute('data-motus-inactive')).toBe(true);
  });

  it('clears the inactive attribute when a later init() is not disabled', () => {
    stubMatchMedia([BELOW_LG]);
    mount();
    init();
    expect(document.documentElement.hasAttribute('data-motus-inactive')).toBe(true);

    // We make sure re-initialising with the gate off doesn't stay wedged off.
    stubMatchMedia([]);
    expect(init()).toHaveLength(1);
    expect(document.documentElement.hasAttribute('data-motus-inactive')).toBe(false);
  });

  it('does not set the consumer kill switch, which would wedge init() off', () => {
    stubMatchMedia([BELOW_LG]);
    mount();
    init();

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
    stubMatchMedia([BELOW_LG]);
    const els = mount();
    expect(init()).toBeUndefined();
    expect(document.documentElement.hasAttribute('data-motus-inactive')).toBe(true);

    // We widen the viewport past the breakpoint.
    stubMatchMedia([]);
    setRect(els[0]!, { top: 100, bottom: 300 });
    refreshHard();
    settleFrames();

    // We check it's truly observing and animating again, not just un-flagged.
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

  it('fires motus:in again on re-init', () => {
    // `disable()` strips the class, so the remembered state must go with it.
    const els = mount();
    setRect(els[0]!, { top: 100, bottom: 300 });
    init();
    settleFrames();
    destroy();

    const spy = vi.fn();
    document.addEventListener('motus:in', spy);
    init();
    settleFrames();
    document.removeEventListener('motus:in', spy);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('dynamically added content', () => {
  it('picks up new elements without needing a resize', () => {
    mount();
    init();
    settleFrames();

    // The size is unchanged, so the resize shortcut mustn't block this rebuild.
    document.body.insertAdjacentHTML('beforeend', '<div data-motus="fade"></div>');
    const added = document.body.lastElementChild as HTMLElement;
    setRect(added, { top: 100, bottom: 300 });

    refreshHard();

    expect(added.classList.contains('motus-init')).toBe(true);
    expect(added.classList.contains('motus-animate')).toBe(true);
  });

  it('animates only the new element, not the ones already on screen', () => {
    const els = mount();
    setRect(els[0]!, { top: 100, bottom: 300 });
    init();
    settleFrames();

    const spy = vi.fn();
    document.addEventListener('motus:in', spy);

    document.body.insertAdjacentHTML('beforeend', '<div data-motus="fade"></div>');
    const added = document.body.lastElementChild as HTMLElement;
    setRect(added, { top: 100, bottom: 300 });
    refreshHard();
    document.removeEventListener('motus:in', spy);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0].detail.node).toBe(added);
  });

  it('re-animates a node whose classes a re-render reset', () => {
    // We detach, wipe `className` and re-attach, as a framework re-render does.
    const els = mount();
    setRect(els[0]!, { top: 100, bottom: 300 });
    init();
    settleFrames();
    expect(els[0]!.classList.contains('motus-animate')).toBe(true);

    els[0]!.remove();
    els[0]!.className = '';
    document.body.appendChild(els[0]!);
    setRect(els[0]!, { top: 100, bottom: 300 });

    refresh();

    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
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
