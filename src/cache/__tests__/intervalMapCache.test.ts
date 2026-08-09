import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type IntervalMapCacheModule = typeof import('../intervalMapCache');

describe('IntervalMapCache', () => {
  let IntervalMapCache: IntervalMapCacheModule['IntervalMapCache'];
  let initGarbageCollector: IntervalMapCacheModule['initGarbageCollector'];

  beforeEach(async () => {
    // Fresh module state per test: the cache store, id counter and the
    // garbage-collector guard all live at module scope.
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const mod = await import('../intervalMapCache');
    IntervalMapCache = mod.IntervalMapCache;
    initGarbageCollector = mod.initGarbageCollector;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test('stores and reads values by key', () => {
    const cache = new IntervalMapCache();
    const value = { value: 1 };

    cache.set('key', value);
    expect(cache.get('key')).toBe(value);
  });

  test('returns undefined for a missing key', () => {
    const cache = new IntervalMapCache();
    expect(cache.get('missing')).toBeUndefined();
  });

  test('overwrites the value of a key that is already present', () => {
    const cache = new IntervalMapCache();
    const first = { value: 1 };
    const second = { value: 2 };

    cache.set('key', first);
    cache.set('key', second);

    expect(cache.get('key')).toBe(second);
  });

  test('removes a value by key', () => {
    const cache = new IntervalMapCache();

    cache.set('key', { value: 1 });
    cache.remove('key');
    expect(cache.get('key')).toBeUndefined();
  });

  test('clears all values of the instance', () => {
    const cache = new IntervalMapCache();

    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  test('keeps instances isolated from each other', () => {
    const first = new IntervalMapCache();
    const second = new IntervalMapCache();

    first.set('key', 'first');
    second.set('key', 'second');

    expect(first.get('key')).toBe('first');
    expect(second.get('key')).toBe('second');
  });

  // Bug #3: remove() threw on an instance that was never written to.
  test('remove does nothing for an instance that was never written to', () => {
    const cache = new IntervalMapCache();
    expect(() => cache.remove('missing')).not.toThrow();
  });

  // Bug #1: the garbage collector iterated the wrong object and never evicted.
  test('garbage collector evicts entries older than the cache lifetime', () => {
    const cache = new IntervalMapCache();
    initGarbageCollector();

    cache.set('key', { value: 1 });
    expect(cache.get('key')).toEqual({ value: 1 });

    // Advance past two GC cycles without touching the entry.
    vi.advanceTimersByTime(25000);

    expect(cache.get('key')).toBeUndefined();
  });

  // Bug #2: the timestamp was frozen at construction time, so touching an entry
  // via get() must refresh its lifetime and keep it alive across GC cycles.
  test('accessing an entry refreshes its lifetime', () => {
    const cache = new IntervalMapCache();
    initGarbageCollector();

    cache.set('key', { value: 1 });

    // Touch the entry within every GC cycle (cacheLifetime = 10000).
    for (let i = 0; i < 3; i += 1) {
      vi.advanceTimersByTime(8000);
      cache.get('key');
    }

    expect(cache.get('key')).toEqual({ value: 1 });
  });

  // Bug #2: set() must stamp entries with the current time, not the time the
  // instance was constructed.
  test('set stamps entries with the current time, not the construction time', () => {
    const cache = new IntervalMapCache();
    initGarbageCollector();

    // Long after construction, write a fresh entry.
    vi.advanceTimersByTime(20000);
    cache.set('key', { value: 1 });

    // One more GC cycle: the entry is only 10000ms old, so it must survive.
    vi.advanceTimersByTime(10000);

    expect(cache.get('key')).toEqual({ value: 1 });
  });

  // Bug #4: initGarbageCollector() must be idempotent and not stack timers.
  test('initGarbageCollector does not stack collectors when called repeatedly', () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    initGarbageCollector();
    initGarbageCollector();
    initGarbageCollector();

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });
});
