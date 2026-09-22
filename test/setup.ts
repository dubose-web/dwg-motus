import { afterEach, beforeEach, vi } from 'vitest';

/**
 * A controllable IntersectionObserver.
 *
 * happy-dom does not implement one, which is useful here: tests drive the
 * callbacks by hand and can assert exactly which targets were observed and when
 * they were released.
 */
export class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number>;
  readonly observed = new Set<Element>();
  readonly unobserved: Element[] = [];
  disconnected = false;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.rootMargin = options.rootMargin ?? '0px';
    this.thresholds = [typeof options.threshold === 'number' ? options.threshold : 0];
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.add(target);
    // A real IntersectionObserver computes and queues an initial record for
    // every target shortly after observe(). Modelling that is what lets the
    // library replay it in activate().
    this.queueRecords([{ target, isIntersecting: this.intersects(target) }]);
  }

  /** Applies this observer's own rootMargin and threshold, as the browser would. */
  private intersects(target: Element): boolean {
    const [marginTop, , marginBottom] = this.rootMargin
      .split(/\s+/)
      .map((part) => parseFloat(part) || 0);

    const rootTop = 0 - (marginTop ?? 0);
    const rootBottom = window.innerHeight + (marginBottom ?? 0);

    const rect = target.getBoundingClientRect();
    const overlap = Math.min(rect.bottom, rootBottom) - Math.max(rect.top, rootTop);
    if (overlap <= 0) return false;

    const threshold = this.thresholds[0] ?? 0;
    if (threshold === 0) return true;

    const height = rect.bottom - rect.top;
    return height > 0 && overlap / height >= threshold;
  }

  unobserve(target: Element): void {
    this.observed.delete(target);
    this.unobserved.push(target);
  }

  disconnect(): void {
    this.observed.clear();
    this.disconnected = true;
  }

  /** Records the browser has computed but not yet dispatched. */
  private pending: IntersectionObserverEntry[] = [];

  takeRecords(): IntersectionObserverEntry[] {
    const records = this.pending;
    this.pending = [];
    return records;
  }

  private static entries(
    entries: Array<{ target: Element; isIntersecting: boolean }>,
  ): IntersectionObserverEntry[] {
    return entries.map(({ target, isIntersecting }) => ({
      target,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      rootBounds: null,
      time: 0,
    })) as IntersectionObserverEntry[];
  }

  /** Dispatches to the callback, as the browser does on each observation pass. */
  trigger(entries: Array<{ target: Element; isIntersecting: boolean }>): void {
    this.callback(MockIntersectionObserver.entries(entries), this);
  }

  /**
   * Computes records without dispatching them, so `takeRecords()` can drain
   * them. Models the window where the browser has observed but not yet called
   * back.
   */
  queueRecords(entries: Array<{ target: Element; isIntersecting: boolean }>): void {
    this.pending.push(...MockIntersectionObserver.entries(entries));
  }

  static reset(): void {
    MockIntersectionObserver.instances = [];
  }

  static get last(): MockIntersectionObserver {
    const { instances } = MockIntersectionObserver;
    const observer = instances[instances.length - 1];
    if (!observer) throw new Error('No IntersectionObserver was constructed');
    return observer;
  }
}

/** Queues rAF callbacks so tests can step through frames deliberately. */
export const raf = {
  queue: [] as FrameRequestCallback[],
  /** Runs one frame. Callbacks scheduled during it wait for the next flush. */
  flush(): void {
    const pending = raf.queue;
    raf.queue = [];
    for (const fn of pending) fn(performance.now());
  },
  /** Runs frames until nothing is left, up to a sane cap. */
  flushAll(limit = 10): void {
    let count = 0;
    while (raf.queue.length > 0 && count < limit) {
      raf.flush();
      count += 1;
    }
  },
};

/** Stubs matchMedia so a given set of media queries reports as matching. */
export const stubMatchMedia = (matching: string[] = []): void => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: matching.includes(query),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
};

export const COARSE = '(pointer: coarse) and (hover: none)';
export const COARSE_PHONE = '(pointer: coarse) and (hover: none) and (max-width: 767px)';

/** `isSupported()` feature-detects `intersectionRatio` on the prototype. */
class FakeIntersectionObserverEntry {}
Object.defineProperty(FakeIntersectionObserverEntry.prototype, 'intersectionRatio', {
  value: 0,
  configurable: true,
});

/** happy-dom's innerHeight is not writable by assignment. */
export const setViewportHeight = (height: number): void => {
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
    writable: true,
  });
};

/** Positions an element via a stubbed getBoundingClientRect. */
export const setRect = (el: Element, rect: Partial<DOMRect>): void => {
  el.getBoundingClientRect = () =>
    ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, ...rect }) as DOMRect;
};

beforeEach(() => {
  MockIntersectionObserver.reset();
  raf.queue = [];

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  vi.stubGlobal('IntersectionObserverEntry', FakeIntersectionObserverEntry);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    raf.queue.push(fn);
    return raf.queue.length;
  });

  // The SSR spec runs this same setup under the `node` environment.
  if (typeof document === 'undefined') return;

  stubMatchMedia([]);

  document.documentElement.removeAttribute('data-motus-disabled');
  document.documentElement.removeAttribute('data-motus-inactive');
  document.documentElement.className = '';
  document.body.innerHTML = '';
  document.body.className = '';
  document.body.removeAttribute('style');
  setViewportHeight(800);
});

afterEach(() => {
  vi.unstubAllGlobals();
});
