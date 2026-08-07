import { FlatMapCache, createCachedSelector } from '@veksa/re-reselect';
import { IntervalMapCache } from '../intervalMapCache';
import { TreeCache } from '../TreeCache';

describe('TreeCache', () => {
  test('should validate key', () => {
    let cache = new TreeCache({});

    let actual: boolean;
    actual = cache.isValidCacheKey(['1', 2]);
    expect(actual).toBeTruthy();

    actual = cache.isValidCacheKey(['1', {}]);
    expect(actual).toBeFalsy();

    cache = new TreeCache({
      cacheObjectCreator: () => new FlatMapCache(),
    });

    actual = cache.isValidCacheKey(['1', 2]);
    expect(actual).toBeTruthy();

    actual = cache.isValidCacheKey(['1', {}]);
    expect(actual).toBeTruthy();
  });

  test('should normalize scalar key', () => {
    let cache = new TreeCache({});

    let actual: boolean;
    actual = cache.isValidCacheKey({});
    expect(actual).toBeFalsy();

    cache = new TreeCache({
      cacheObjectCreator: () => new FlatMapCache(),
    });

    actual = cache.isValidCacheKey({});
    expect(actual).toBeTruthy();
  });

  test('should return undefined if there is not value for key', () => {
    const cache = new TreeCache({});

    let actual: unknown;
    actual = cache.get(['some', 'deep', 'key']);
    expect(actual).toBeUndefined();

    cache.set(['some', 'deep'], expect.anything());
    actual = cache.get(['some', 'deep', 'key']);
    expect(actual).toBeUndefined();
  });

  test('should return undefined if key path is short', () => {
    const cache = new TreeCache({});
    const selectorFn = () => undefined;

    cache.set(['some', 'deep', 'key'], selectorFn);
    const actual = cache.get(['some', 'deep']);
    expect(actual).toBeUndefined();
  });

  test('should set value in key path', () => {
    const cache = new TreeCache({});
    const selectorFn = () => undefined;

    cache.set(['some', 'deep', 'key'], selectorFn);
    const actual = cache.get(['some', 'deep', 'key']);
    expect(actual).toBe(selectorFn);
  });

  test('should remove value in key path', () => {
    const cache = new TreeCache({});
    const selectorFn = () => undefined;

    let actual: unknown;
    cache.set(['some', 'deep', 'key'], selectorFn);
    actual = cache.get(['some', 'deep', 'key']);
    expect(actual).toBe(selectorFn);

    cache.remove(['some', 'deep', 'key']);
    actual = cache.get(['some', 'deep', 'key']);
    expect(actual).toBeUndefined();
  });

  test('should do nothing if there is not value for removable key', () => {
    const cache = new TreeCache({});
    const selectorFn = () => undefined;

    cache.set(['some', 'deep'], selectorFn);
    cache.remove(['some', 'deep', 'key']);

    const actual = cache.get(['some', 'deep']);
    expect(actual).toBe(selectorFn);
  });

  test('should clear values', () => {
    const cache = new TreeCache({});
    const selectorFn = () => undefined;
    const otherSelectorFn = () => undefined;

    cache.set(['some', 'deep', 'key'], selectorFn);
    cache.set(['some', 'other', 'key'], otherSelectorFn);
    expect(cache.get(['some', 'deep', 'key'])).toBe(selectorFn);
    expect(cache.get(['some', 'other', 'key'])).toBe(otherSelectorFn);

    cache.clear();
    expect(cache.get(['some', 'deep', 'key'])).toBeUndefined();
    expect(cache.get(['some', 'other', 'key'])).toBeUndefined();
  });

  test('should back a cached selector without rebinding its validator', () => {
    /**
     * `TreeCache.isValidCacheKey` reads `this.root`, so it only answers when the
     * cached selector calls it as a method on the cache. A selector that detaches
     * the validator into a local and calls it bare leaves `this` undefined and
     * throws on the very first lookup, which makes a TreeCache-backed selector
     * unusable rather than merely slow — and dropping the validator instead is no
     * escape, since the default one rejects the array keys this cache exists to
     * index.
     */
    const cache = new TreeCache({
      cacheObjectCreator: () => new IntervalMapCache(),
    });

    type State = { items: Record<number, number> };
    type Props = { id: number; kind: string };

    const selector = createCachedSelector(
      (state: State, props: Props) => state.items[props.id],
      (value: number) => value * 2,
    )({
      // A composite key is the whole reason to reach for TreeCache: it indexes the
      // array level by level instead of stringifying it.
      keySelector: (_state: State, props: Props) => [props.id, props.kind],
      cacheObject: cache,
    });

    const state = { items: { 1: 21 } };

    expect(selector(state, { id: 1, kind: 'a' })).toBe(42);
    expect(selector(state, { id: 1, kind: 'a' })).toBe(42);
    expect(selector.recomputations()).toBe(1);
  });

  test('should treat a scalar key as a one-level path', () => {
    const cache = new TreeCache({});
    const selectorFn = () => undefined;

    cache.set('key', selectorFn);

    // The scalar and the single-element path address the same node, so `get` must
    // not be able to tell them apart.
    expect(cache.get('key')).toBe(selectorFn);
    expect(cache.get(['key'])).toBe(selectorFn);

    expect(cache.get('missing')).toBeUndefined();

    cache.set(['other'], selectorFn);
    expect(cache.get('other')).toBe(selectorFn);

    cache.remove('key');
    expect(cache.get('key')).toBeUndefined();
    expect(cache.get(['key'])).toBeUndefined();
  });

  test('should return undefined for a scalar key that addresses an inner node', () => {
    const cache = new TreeCache({});
    const selectorFn = () => undefined;

    cache.set(['some', 'deep'], selectorFn);

    // `some` exists as a node but holds no selector of its own.
    expect(cache.get('some')).toBeUndefined();
  });

  test('should persist values in middle of tree', () => {
    const cache = new TreeCache({});
    const selectorFn = () => undefined;
    const otherSelectorFn = () => undefined;

    cache.set(['some', 'deep'], selectorFn);
    cache.set(['some', 'deep', 'key'], otherSelectorFn);

    expect(cache.get(['some', 'deep'])).toBe(selectorFn);
    expect(cache.get(['some', 'deep', 'key'])).toBe(otherSelectorFn);
  });
});
