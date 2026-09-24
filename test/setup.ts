import { afterEach, beforeEach, vi } from 'vitest';

/**
 * The fields a test supplies for one entry.
 *
 * `boundingClientRect` comes from the target; `rootBounds` defaults to null.
 */
interface EntryInit {
  target: Element;
  isIntersecting: boolean;
  rootBounds?: Partial<DOMRectReadOnly> | null;
}

/**
 * A controllable IntersectionObserver.
 *
 * happy-dom doesn't implement one, which suits us: tests
 * drive the callbacks by hand, and can assert exactly
 * which of the targets were observed and released.
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
    // We model the initial record a real IntersectionObserver
    // queues shortly after `observe()`, since that is what
    // lets the library replay it in `activate()` later.
    this.queueRecords([{ target, isIntersecting: this.intersects(target) }]);
  }

  /**
   * Determine if the target intersects, using this observer's own settings.
   *
   * @param target
   * @returns
   */
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

  /**
   * The records the browser has computed but not yet dispatched.
   */
  private pending: IntersectionObserverEntry[] = [];

  takeRecords(): IntersectionObserverEntry[] {
    const records = this.pending;
    this.pending = [];
    return records;
  }

  private static entries(entries: EntryInit[]): IntersectionObserverEntry[] {
    return entries.map(({ target, isIntersecting, rootBounds = null }) => ({
      target,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      rootBounds: rootBounds as DOMRectReadOnly | null,
      time: 0,
    })) as IntersectionObserverEntry[];
  }

  /**
   * Dispatch the given entries, as the browser does on each observation pass.
   *
   * @param entries
   */
  trigger(entries: EntryInit[]): void {
    this.callback(MockIntersectionObserver.entries(entries), this);
  }

  /**
   * Compute records without dispatching them, for `takeRecords()` to drain.
   *
   * This models the window where the browser has observed but not called back.
   *
   * @param entries
   */
  queueRecords(entries: EntryInit[]): void {
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

/**
 * Queue rAF callbacks so tests can step through frames deliberately.
 *
 * Keying by id lets `cancelAnimationFrame` drop one, as browsers do.
 */
export const raf = {
  queue: new Map<number, FrameRequestCallback>(),
  nextId: 1,
  /**
   * Run one frame, leaving callbacks it schedules for the next flush.
   */
  flush(): void {
    const pending = [...raf.queue.values()];
    raf.queue = new Map();
    for (const fn of pending) fn(performance.now());
  },
  /**
   * Run frames until nothing is left, up to a sane cap.
   *
   * @param limit
   */
  flushAll(limit = 10): void {
    let count = 0;
    while (raf.queue.size > 0 && count < limit) {
      raf.flush();
      count += 1;
    }
  },
};

/**
 * Stub `matchMedia` so the given media queries report as matching.
 *
 * @param matching
 */
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

/**
 * Build the query `detect.below()` produces for the given width.
 *
 * `stubMatchMedia` matches query strings exactly, so tests must
 * reproduce it character for character; deriving it from the
 * same arithmetic keeps the pair from drifting over time.
 *
 * @param width
 * @returns
 */
export const belowQuery = (width: number): string => `(max-width: ${width - 0.02}px)`;

export const BELOW_SM = belowQuery(576);
export const BELOW_MD = belowQuery(768);
export const BELOW_LG = belowQuery(992);

/**
 * An entry whose prototype passes the feature checks in `isSupported()`.
 */
class FakeIntersectionObserverEntry {}
for (const name of ['intersectionRatio', 'isIntersecting']) {
  Object.defineProperty(FakeIntersectionObserverEntry.prototype, name, {
    value: 0,
    configurable: true,
  });
}

/**
 * Set the viewport height, which happy-dom won't allow by assignment.
 *
 * @param height
 */
export const setViewportHeight = (height: number): void => {
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
    writable: true,
  });
};

/**
 * Position an element through a stubbed `getBoundingClientRect`.
 *
 * @param el
 * @param rect
 */
export const setRect = (el: Element, rect: Partial<DOMRect>): void => {
  el.getBoundingClientRect = () =>
    ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, ...rect }) as DOMRect;
};

beforeEach(() => {
  MockIntersectionObserver.reset();
  raf.queue = new Map();

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  vi.stubGlobal('IntersectionObserverEntry', FakeIntersectionObserverEntry);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    const id = raf.nextId;
    raf.nextId += 1;
    raf.queue.set(id, fn);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    raf.queue.delete(id);
  });

  // We bail here, as the SSR spec runs this same setup under `node`.
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
