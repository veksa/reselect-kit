import { FlatObjectCache, ICacheObject } from '@veksa/re-reselect';

export type TreeCacheObjectOptions = {
  cacheObjectCreator?: () => ICacheObject;
};

const normalizeKey = (key: unknown): unknown[] => (Array.isArray(key) ? key : [key]);

class TreeCacheNode {
  public cache?: ICacheObject;

  public selectorFn?: unknown;
}

export class TreeCache implements ICacheObject {
  private readonly cacheObjectCreator: () => ICacheObject;

  private root: TreeCacheNode;

  constructor(options: TreeCacheObjectOptions) {
    this.cacheObjectCreator = options.cacheObjectCreator ?? (() => new FlatObjectCache());

    const root = new TreeCacheNode();
    root.cache = this.cacheObjectCreator();
    this.root = root;
  }

  public clear() {
    const root = new TreeCacheNode();
    root.cache = this.cacheObjectCreator();
    this.root = root;
  }

  public get(key: unknown) {
    // A scalar key is the common case and `normalizeKey` would wrap it in a fresh
    // array on every lookup. The tree walk for one level is a single cache read, so
    // it is spelled out rather than allocated for.
    if (!Array.isArray(key)) {
      const cacheResponse: unknown = this.root.cache?.get(key);

      return cacheResponse instanceof TreeCacheNode ? cacheResponse.selectorFn : undefined;
    }

    let currentNode = this.root;

    for (let i = 0; i < key.length; i += 1) {
      const item = key[i];
      const cacheResponse: unknown = currentNode.cache?.get(item);

      if (cacheResponse instanceof TreeCacheNode) {
        currentNode = cacheResponse;
      } else {
        return undefined;
      }
    }

    return currentNode.selectorFn;
  }

  public set(key: unknown, selectorFn: unknown) {
    const keyPath = normalizeKey(key);
    let currentNode = this.root;

    for (let i = 0; i < keyPath.length; i += 1) {
      const item = keyPath[i];

      if (!currentNode.cache) {
        currentNode.cache = this.cacheObjectCreator();
      }

      const cacheResponse: unknown = currentNode.cache.get(item);

      if (cacheResponse instanceof TreeCacheNode) {
        currentNode = cacheResponse;
      } else {
        const node = new TreeCacheNode();
        currentNode.cache.set(item, node);
        currentNode = node;
      }
    }

    currentNode.selectorFn = selectorFn;
  }

  public remove(key: unknown) {
    const keyPath = normalizeKey(key);
    let currentNode = this.root;

    for (let i = 0; i < keyPath.length; i += 1) {
      const item = keyPath[i];
      const cacheResponse: unknown = currentNode.cache?.get(item);

      if (cacheResponse instanceof TreeCacheNode) {
        currentNode = cacheResponse;
      } else {
        return;
      }
    }

    currentNode.selectorFn = undefined;
  }

  /**
   * Called by re-reselect on every cache operation, so neither the wrapping array
   * nor the `every` callback is allocated here.
   */
  public isValidCacheKey(key: unknown) {
    const rootCache = this.root.cache;

    if (rootCache?.isValidCacheKey === undefined) {
      return true;
    }

    if (!Array.isArray(key)) {
      return rootCache.isValidCacheKey(key);
    }

    for (let i = 0; i < key.length; i += 1) {
      if (!rootCache.isValidCacheKey(key[i])) {
        return false;
      }
    }

    return true;
  }
}
