import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConfigs } from '../../src/observers/elementConfig.js';
import { resetAnimatedState } from '../../src/observers/animatedState.js';
import { createObserver } from '../../src/observers/intersection.js';
import { DEFAULTS } from '../../src/defaults.js';
import type { MotusOptions } from '../../src/types.js';
import { MockIntersectionObserver, setRect } from '../setup.js';

const options = (overrides: Partial<MotusOptions> = {}): MotusOptions => ({
  ...DEFAULTS,
  ...overrides,
});

/** Adds elements to the document and returns them. */
const mount = (...markup: string[]): HTMLElement[] => {
  document.body.innerHTML = markup.join('');
  return [...document.body.querySelectorAll<HTMLElement>('[data-motus]')];
};

const build = (elements: HTMLElement[], opts = options()) => buildConfigs(elements, opts);

/** Places every element far below the fold so activate() is a no-op. */
const offscreen = (elements: Element[]) => {
  for (const el of elements) setRect(el, { top: 5000, bottom: 5200 });
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('observer pooling', () => {
  it('shares one observer across elements with the same placement and offset', () => {
    const els = mount('<div data-motus="fade"></div>', '<div data-motus="zoom-in"></div>');
    createObserver(build(els));

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.last.observed.size).toBe(2);
  });

  it('creates separate observers for differing offsets', () => {
    const els = mount(
      '<div data-motus="fade"></div>',
      '<div data-motus="fade" data-motus-offset="300"></div>',
    );
    createObserver(build(els));

    expect(MockIntersectionObserver.instances).toHaveLength(2);
  });

  it('creates separate observers for differing anchor placements', () => {
    const els = mount(
      '<div data-motus="fade"></div>',
      '<div data-motus="fade" data-motus-anchor-placement="center-center"></div>',
    );
    createObserver(build(els));

    expect(MockIntersectionObserver.instances).toHaveLength(2);
  });

  it('observes a shared anchor once for many elements', () => {
    const els = mount(
      '<div id="anchor"></div>',
      '<div data-motus="fade" data-motus-anchor="#anchor"></div>',
      '<div data-motus="fade" data-motus-anchor="#anchor"></div>',
      '<div data-motus="fade" data-motus-anchor="#anchor"></div>',
    );
    createObserver(build(els));

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.last.observed.size).toBe(1);
    expect([...MockIntersectionObserver.last.observed][0]).toBe(document.querySelector('#anchor'));
  });

  it('falls back to the node when the anchor selector is invalid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const els = mount('<div data-motus="fade" data-motus-anchor="[["></div>');

    expect(() => createObserver(build(els))).not.toThrow();
    expect([...MockIntersectionObserver.last.observed][0]).toBe(els[0]);
    expect(warn).toHaveBeenCalled();
  });

  it('does not let a non-numeric offset poison the pool key', () => {
    const els = mount(
      '<div data-motus="fade" data-motus-offset="oops"></div>',
      '<div data-motus="fade"></div>',
    );
    // Both fall back to the default offset, so they share one observer.
    createObserver(build(els));
    expect(MockIntersectionObserver.instances).toHaveLength(1);
  });
});

describe('the activation gate', () => {
  it('ignores entries delivered before activate()', () => {
    const els = mount('<div data-motus="fade"></div>');
    offscreen(els);
    createObserver(build(els));

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);

    expect(els[0]!.classList.contains('motus-animate')).toBe(false);
  });

  it('animates once activate() has run', () => {
    const els = mount('<div data-motus="fade"></div>');
    offscreen(els);
    const handle = createObserver(build(els));
    handle.activate();

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);

    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });
});

describe('activate()', () => {
  it('replays an entry that arrived while the gate was closed', () => {
    // The browser delivers its first callback before activate() runs. That
    // entry must be kept, because IO will not re-deliver an unchanged state.
    const els = mount('<div data-motus="fade"></div>');
    const handle = createObserver(build(els));

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);
    expect(els[0]!.classList.contains('motus-animate')).toBe(false);

    handle.activate();
    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });

  it('drains records the browser computed but had not dispatched', () => {
    const els = mount('<div data-motus="fade"></div>');
    const handle = createObserver(build(els));

    MockIntersectionObserver.last.queueRecords([{ target: els[0]!, isIntersecting: true }]);
    expect(els[0]!.classList.contains('motus-animate')).toBe(false);

    handle.activate();
    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });

  it('leaves an element alone when the observer reported no intersection', () => {
    const els = mount('<div data-motus="fade"></div>');
    const handle = createObserver(build(els));

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: false }]);
    handle.activate();

    expect(els[0]!.classList.contains('motus-animate')).toBe(false);
  });

  it('trusts the observer over the element position on screen', () => {
    // The regression. With top-top at offset 120 the trigger band is -120..120,
    // so an element at 400..500 is plainly on screen but must NOT fire. The old
    // activate() re-derived the line as `bottom > 0 && top < 800 - 120`, which
    // ignored anchorPlacement and so fired it.
    const els = mount('<div data-motus="fade" data-motus-anchor-placement="top-top"></div>');
    setRect(els[0]!, { top: 400, bottom: 500 });

    const handle = createObserver(build(els));
    handle.activate();

    expect(els[0]!.classList.contains('motus-animate')).toBe(false);

    // Same element under the default placement is inside the band, and fires.
    const others = mount('<div data-motus="fade"></div>');
    setRect(others[0]!, { top: 400, bottom: 500 });
    createObserver(build(others)).activate();

    expect(others[0]!.classList.contains('motus-animate')).toBe(true);
  });

  it('performs no layout reads of its own', () => {
    // All geometry now comes from the observer, so activate() must not measure
    // anything — there is nothing left to thrash.
    const els = mount('<div data-motus="fade"></div>', '<div data-motus="fade"></div>');
    const handle = createObserver(build(els));

    MockIntersectionObserver.last.trigger(els.map((target) => ({ target, isIntersecting: true })));

    // Counted only from here, so the mock's own rect reads are not included.
    let reads = 0;
    for (const el of els) {
      el.getBoundingClientRect = () => {
        reads += 1;
        return { top: 0, bottom: 0 } as DOMRect;
      };
    }

    handle.activate();

    expect(reads).toBe(0);
    expect(els.every((e) => e.classList.contains('motus-animate'))).toBe(true);
  });

  it('applies the newest observation when several are replayed', () => {
    const els = mount('<div data-motus="fade"></div>');
    const handle = createObserver(build(els));

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: false }]);
    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);
    handle.activate();

    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });
});

describe('callbacks', () => {
  const setup = (markup: string[], opts = options()) => {
    const els = mount(...markup);
    offscreen(els);
    const handle = createObserver(build(els, opts));
    handle.activate();
    return els;
  };

  it('fires motus:in with the node in detail', () => {
    const els = setup(['<div data-motus="fade"></div>']);
    const listener = vi.fn();
    document.addEventListener('motus:in', listener);

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]![0].detail.node).toBe(els[0]);
    document.removeEventListener('motus:in', listener);
  });

  it('fires the id-scoped event alongside the base event', () => {
    const els = setup(['<div data-motus="fade" data-motus-id="hero"></div>']);
    const base = vi.fn();
    const scoped = vi.fn();
    document.addEventListener('motus:in', base);
    document.addEventListener('motus:in:hero', scoped);

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);

    expect(base).toHaveBeenCalledTimes(1);
    expect(scoped).toHaveBeenCalledTimes(1);
    document.removeEventListener('motus:in', base);
    document.removeEventListener('motus:in:hero', scoped);
  });

  it('does not re-fire for an already animated element', () => {
    const els = setup(['<div data-motus="fade"></div>']);
    const listener = vi.fn();
    document.addEventListener('motus:in', listener);

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);
    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);

    expect(listener).toHaveBeenCalledTimes(1);
    document.removeEventListener('motus:in', listener);
  });

  it('animates out when mirror is set and once is not', () => {
    const els = setup(['<div data-motus="fade" data-motus-mirror="true"></div>']);
    const out = vi.fn();
    document.addEventListener('motus:out', out);

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);
    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: false }]);

    expect(els[0]!.classList.contains('motus-animate')).toBe(false);
    expect(out).toHaveBeenCalledTimes(1);
    document.removeEventListener('motus:out', out);
  });

  it('does not animate out when mirror and once are both set', () => {
    const els = setup([
      '<div data-motus="fade" data-motus-mirror="true" data-motus-once="true"></div>',
    ]);

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);
    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: false }]);

    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });

  it('does not animate out without mirror', () => {
    const els = setup(['<div data-motus="fade"></div>']);

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);
    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: false }]);

    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });
});

describe('unobserving once-elements', () => {
  it('releases the target when the only config is done', () => {
    const els = mount('<div data-motus="fade" data-motus-once="true"></div>');
    offscreen(els);
    createObserver(build(els)).activate();

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);

    expect(MockIntersectionObserver.last.unobserved).toContain(els[0]);
  });

  it('keeps observing a shared anchor until every config is done', () => {
    const els = mount(
      '<div id="anchor"></div>',
      '<div data-motus="fade" data-motus-anchor="#anchor" data-motus-once="true"></div>',
      '<div data-motus="fade" data-motus-anchor="#anchor"></div>',
    );
    offscreen([...els, document.querySelector('#anchor')!]);
    createObserver(build(els)).activate();

    const anchor = document.querySelector('#anchor')!;
    MockIntersectionObserver.last.trigger([{ target: anchor, isIntersecting: true }]);

    // One config is `once`, the other is not — the anchor must stay observed.
    expect(MockIntersectionObserver.last.unobserved).toHaveLength(0);
  });
});

describe('class name handling', () => {
  it('adds the init class', () => {
    const els = mount('<div data-motus="fade"></div>');
    build(els);
    expect(els[0]!.classList.contains('motus-init')).toBe(true);
  });

  it('skips the init class when it is false', () => {
    const els = mount('<div data-motus="fade"></div>');
    build(els, options({ initClassName: false }));
    expect(els[0]!.className).toBe('');
  });

  it('appends the data-motus value when useClassNames is on', () => {
    const els = mount('<div data-motus="fadeInUp animated"></div>');
    offscreen(els);
    createObserver(build(els, options({ useClassNames: true }))).activate();
    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);

    expect(els[0]!.classList.contains('fadeInUp')).toBe(true);
    expect(els[0]!.classList.contains('animated')).toBe(true);
    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });

  it('omits the animated class when it is false', () => {
    const els = mount('<div data-motus="fadeInUp"></div>');
    offscreen(els);
    createObserver(
      build(els, options({ useClassNames: true, animatedClassName: false, initClassName: false })),
    ).activate();
    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: true }]);

    expect(els[0]!.className).toBe('fadeInUp');
  });
});

describe('per-element custom properties', () => {
  it('writes only the attributes that are present', () => {
    const els = mount('<div data-motus="fade" data-motus-duration="900"></div>');
    build(els);

    expect(els[0]!.style.getPropertyValue('--motus-duration')).toBe('900ms');
    expect(els[0]!.style.getPropertyValue('--motus-delay')).toBe('');
  });

  it('resolves a named easing', () => {
    const els = mount('<div data-motus="fade" data-motus-easing="ease-out-back"></div>');
    build(els);

    expect(els[0]!.style.getPropertyValue('--motus-easing')).toBe(
      'cubic-bezier(.175, .885, .32, 1.275)',
    );
  });
});

describe('disconnect()', () => {
  it('disconnects every pooled observer', () => {
    const els = mount(
      '<div data-motus="fade"></div>',
      '<div data-motus="fade" data-motus-offset="300"></div>',
    );
    createObserver(build(els)).disconnect();

    expect(MockIntersectionObserver.instances).toHaveLength(2);
    expect(MockIntersectionObserver.instances.every((o) => o.disconnected)).toBe(true);
  });
});

describe('animated state across rebuilds', () => {
  /** What rebuild() does: fresh configs over the same nodes, then activate(). */
  const rebuild = (els: HTMLElement[], opts = options()) =>
    createObserver(build(els, opts)).activate();

  afterEach(() => {
    resetAnimatedState();
  });

  const onscreen = (els: Element[]) => {
    for (const el of els) setRect(el, { top: 100, bottom: 300 });
  };

  it('does not re-fire motus:in when the configs are rebuilt', () => {
    const els = mount('<div data-motus="fade"></div>');
    onscreen(els);
    rebuild(els);
    expect(els[0]!.classList.contains('motus-animate')).toBe(true);

    const spy = vi.fn();
    document.addEventListener('motus:in', spy);
    rebuild(els);
    document.removeEventListener('motus:in', spy);

    expect(spy).not.toHaveBeenCalled();
    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });

  it('does not re-fire the id-scoped event on rebuild', () => {
    const els = mount('<div data-motus="fade" data-motus-id="hero"></div>');
    onscreen(els);
    rebuild(els);

    const spy = vi.fn();
    document.addEventListener('motus:in:hero', spy);
    rebuild(els);
    document.removeEventListener('motus:in:hero', spy);

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not re-observe a once element that already animated', () => {
    const els = mount('<div data-motus="fade" data-motus-once="true"></div>');
    onscreen(els);
    rebuild(els);

    const before = MockIntersectionObserver.instances.length;
    const spy = vi.fn();
    document.addEventListener('motus:in', spy);
    rebuild(els);
    document.removeEventListener('motus:in', spy);

    expect(spy).not.toHaveBeenCalled();
    // Skipped before pooling: with nothing left to watch, the rebuild does not
    // construct an observer at all.
    expect(MockIntersectionObserver.instances).toHaveLength(before);
  });

  it('animates a mirrored element in again after it scrolled away', () => {
    const els = mount('<div data-motus="fade" data-motus-mirror="true"></div>');
    onscreen(els);
    rebuild(els);

    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: false }]);
    expect(els[0]!.classList.contains('motus-animate')).toBe(false);

    const spy = vi.fn();
    document.addEventListener('motus:in', spy);
    rebuild(els);
    document.removeEventListener('motus:in', spy);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('lets a mirrored element still on screen animate out after a rebuild', () => {
    // Guards the seeded-`true` path rather than the bug itself: the out-branch
    // is gated on `config.animated`, so seeding must not leave it stuck off.
    const els = mount('<div data-motus="fade" data-motus-mirror="true"></div>');
    onscreen(els);
    rebuild(els);
    rebuild(els);

    const spy = vi.fn();
    document.addEventListener('motus:out', spy);
    MockIntersectionObserver.last.trigger([{ target: els[0]!, isIntersecting: false }]);
    document.removeEventListener('motus:out', spy);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(els[0]!.classList.contains('motus-animate')).toBe(false);
  });

  it('keeps state per node when two elements share an anchor', () => {
    const els = mount(
      '<div id="anchor"></div>',
      '<div data-motus="fade" data-motus-anchor="#anchor"></div>',
      '<div data-motus="zoom-in" data-motus-anchor="#anchor"></div>',
    );
    setRect(document.getElementById('anchor')!, { top: 100, bottom: 300 });
    onscreen(els);

    rebuild(els);
    expect(els.every((el) => el.classList.contains('motus-animate'))).toBe(true);

    const spy = vi.fn();
    document.addEventListener('motus:in', spy);
    rebuild(els);
    document.removeEventListener('motus:in', spy);

    expect(spy).not.toHaveBeenCalled();
  });

  it('re-animates when the animated class was stripped from the DOM', () => {
    // The class is what the stylesheet keys on, so it outranks anything
    // remembered: a framework re-render that resets className must not leave
    // the element hidden for good.
    const els = mount('<div data-motus="fade"></div>');
    onscreen(els);
    rebuild(els);

    els[0]!.classList.remove('motus-animate');

    const spy = vi.fn();
    document.addEventListener('motus:in', spy);
    rebuild(els);
    document.removeEventListener('motus:in', spy);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });

  describe('with animatedClassName: false', () => {
    // No class is written, so there is no DOM marker to read back and the
    // WeakMap is the only thing standing between a rebuild and a duplicate event.
    const opts = options({ animatedClassName: false });

    it('still dedupes motus:in across a rebuild', () => {
      const els = mount('<div data-motus="fade"></div>');
      onscreen(els);
      rebuild(els, opts);

      const spy = vi.fn();
      document.addEventListener('motus:in', spy);
      rebuild(els, opts);
      document.removeEventListener('motus:in', spy);

      expect(spy).not.toHaveBeenCalled();
    });

    it('re-animates after resetAnimatedState()', () => {
      const els = mount('<div data-motus="fade"></div>');
      onscreen(els);
      rebuild(els, opts);

      resetAnimatedState();

      const spy = vi.fn();
      document.addEventListener('motus:in', spy);
      rebuild(els, opts);
      document.removeEventListener('motus:in', spy);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
