import { describe, expect, it, vi } from 'vitest';
import { watch } from '../../src/observers/mutation.js';
import { raf } from '../setup.js';

/** MutationObserver batches on a microtask; give it one. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('mutation observer', () => {
  it('fires when a [data-motus] element is added', async () => {
    const callback = vi.fn();
    watch(callback);

    const el = document.createElement('div');
    el.setAttribute('data-motus', 'fade');
    document.body.appendChild(el);

    await settle();
    raf.flushAll();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('fires when a subtree containing [data-motus] is added', async () => {
    const callback = vi.fn();
    watch(callback);

    const wrapper = document.createElement('section');
    wrapper.innerHTML = '<p><span data-motus="zoom-in"></span></p>';
    document.body.appendChild(wrapper);

    await settle();
    raf.flushAll();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('ignores additions with no [data-motus] element', async () => {
    const callback = vi.fn();
    watch(callback);

    document.body.appendChild(document.createElement('div'));
    document.body.appendChild(document.createTextNode('text'));

    await settle();
    raf.flushAll();
    expect(callback).not.toHaveBeenCalled();
  });

  it('ignores removals', async () => {
    const el = document.createElement('div');
    el.setAttribute('data-motus', 'fade');
    document.body.appendChild(el);

    const callback = vi.fn();
    watch(callback);

    el.remove();
    await settle();
    raf.flushAll();
    expect(callback).not.toHaveBeenCalled();
  });

  it('drops a pending batch on disconnect()', async () => {
    // The callback is refreshHard(), which would re-init a destroyed library.
    const callback = vi.fn();
    const handle = watch(callback);

    const el = document.createElement('div');
    el.setAttribute('data-motus', 'fade');
    document.body.appendChild(el);

    await settle();
    handle.disconnect();
    raf.flushAll();
    expect(callback).not.toHaveBeenCalled();
  });

  it('batches a burst of additions into a single callback', async () => {
    const callback = vi.fn();
    watch(callback);

    for (let i = 0; i < 20; i += 1) {
      const el = document.createElement('div');
      el.setAttribute('data-motus', 'fade');
      document.body.appendChild(el);
    }

    await settle();
    raf.flushAll();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
