import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConfigs } from '../../src/observers/elementConfig.js';
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
  it('animates an element already inside the viewport with no observer callback', () => {
    const els = mount('<div data-motus="fade"></div>');
    setRect(els[0]!, { top: 100, bottom: 300 });

    createObserver(build(els)).activate();

    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
  });

  it('leaves a below-the-fold element alone', () => {
    const els = mount('<div data-motus="fade"></div>');
    setRect(els[0]!, { top: 900, bottom: 1100 });

    createObserver(build(els)).activate();

    expect(els[0]!.classList.contains('motus-animate')).toBe(false);
  });

  it('applies the offset to the viewport edge', () => {
    // innerHeight 800, offset 120 -> the trigger line sits at 680.
    const els = mount('<div data-motus="fade"></div>', '<div data-motus="fade"></div>');
    setRect(els[0]!, { top: 670, bottom: 700 });
    setRect(els[1]!, { top: 690, bottom: 720 });

    createObserver(build(els)).activate();

    expect(els[0]!.classList.contains('motus-animate')).toBe(true);
    expect(els[1]!.classList.contains('motus-animate')).toBe(false);
  });

  it('reads every rect before it writes any class', () => {
    const els = mount('<div data-motus="fade"></div>', '<div data-motus="fade"></div>');
    const order: string[] = [];

    // Build first: the init class it writes is setup, not part of activate().
    const configs = build(els);

    for (const el of els) {
      el.getBoundingClientRect = () => {
        order.push('read');
        return { top: 100, bottom: 300 } as DOMRect;
      };
      const add = el.classList.add.bind(el.classList);
      el.classList.add = (...classes: string[]) => {
        order.push('write');
        add(...classes);
      };
    }

    createObserver(configs).activate();

    expect(order.indexOf('write')).toBeGreaterThan(order.lastIndexOf('read'));
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
