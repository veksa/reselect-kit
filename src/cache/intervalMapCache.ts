import { ICacheObject } from '@veksa/re-reselect';

interface CacheEntry {
  data: unknown;
  time: number;
}

/**
 * Buckets used to live in a module-level `Record<string, …>` keyed by an
 * incrementing numeric id, which meant every `get` and `set` coerced that number to
 * a string and re-read the global record — four times per cache hit in `get`.
 * Holding the entries on the instance removes both, and a `Map` keeps non-string
 * keys as they are instead of stringifying them.
 */
const buckets = new Set<IntervalMapCache>();

const cacheLifetime = 10000;

let garbageCollectorStarted = false;

const runGarbageCollector = () => {
  const currentTime = Date.now();

  buckets.forEach((bucket) => {
    if (bucket.sweep(currentTime)) {
      // A bucket the sweep emptied is dropped from the registry, so a cache whose
      // selector has been discarded stops being reachable from module scope and
      // becomes collectable. Registration happens again on the next `set`, so a
      // cache that is still in use simply re-enters.
      buckets.delete(bucket);
    }
  });

  window.setTimeout(runGarbageCollector, cacheLifetime);
};

export const initGarbageCollector = () => {
  if (garbageCollectorStarted) {
    return;
  }

  if (typeof window !== 'undefined') {
    garbageCollectorStarted = true;
    window.setTimeout(runGarbageCollector, cacheLifetime);
  }
};

export class IntervalMapCache implements ICacheObject {
  private entries = new Map<unknown, CacheEntry>();

  public set(key: any, data: any) {
    const entry = this.entries.get(key);

    if (entry === undefined) {
      buckets.add(this);
      this.entries.set(key, { data, time: Date.now() });
    } else {
      entry.data = data;
      entry.time = Date.now();
    }
  }

  public get(key: any) {
    const entry = this.entries.get(key);

    if (entry === undefined) {
      return undefined;
    }

    entry.time = Date.now();

    return entry.data;
  }

  public remove(key: any) {
    this.entries.delete(key);
  }

  public clear() {
    this.entries.clear();
    buckets.delete(this);
  }

  /**
   * Drops entries untouched for longer than the lifetime. Returns whether the
   * bucket is now empty, which is what lets the collector unregister it.
   */
  public sweep(currentTime: number) {
    this.entries.forEach((entry, key) => {
      if (currentTime - entry.time > cacheLifetime) {
        this.entries.delete(key);
      }
    });

    return this.entries.size === 0;
  }
}
