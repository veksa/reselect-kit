import { shallowEqual, useSelector as useReduxSelector } from '@veksa/react-redux';
import { SelectorResultsMap, SelectorsObject } from '@veksa/reselect';
import { useRef } from 'react';
import { unfreezeProps } from '../_helpers/unfreezeProps';
import { MergedParams } from '../types';
import { selectorOptions } from './selectorOptions';

type SelectorsMap = Record<string, Function>;

type SelectorsCache = {
  keys: string[];
  selectors: Function[];
  props: unknown;
  unfrozenProps: unknown;
  results: unknown[];
  value: Record<string, unknown> | null;
  boundSelector: (state: unknown) => unknown;
};

const readSelectors = (cache: SelectorsCache, selectors: SelectorsMap) => {
  const keys: string[] = [];
  const fns: Function[] = [];

  for (const key in selectors) {
    if (Object.prototype.hasOwnProperty.call(selectors, key)) {
      keys.push(key);
      fns.push(selectors[key]);
    }
  }

  cache.keys = keys;
  cache.selectors = fns;
  // Filled in ascending index order on the first run, so the array stays packed.
  cache.results = [];
  cache.value = null;
};

/**
 * One pass over the incoming object instead of `shallowEqual`, which would
 * allocate a key array for each side on every render of every call site. Key
 * order is part of the comparison, so a renamed key is caught as well.
 */
const hasSameSelectors = (cache: SelectorsCache, selectors: SelectorsMap) => {
  const { keys, selectors: fns } = cache;
  let index = 0;

  for (const key in selectors) {
    if (Object.prototype.hasOwnProperty.call(selectors, key)) {
      if (index === keys.length || keys[index] !== key || fns[index] !== selectors[key]) {
        return false;
      }

      index++;
    }
  }

  return index === keys.length;
};

/**
 * The structured part: every selector runs, but the result object is rebuilt
 * only when some field actually changed. An unchanged batch keeps its previous
 * reference, so react-redux's default reference equality already bails out —
 * no result allocation and no comparison pass on the steady path.
 */
const select = (cache: SelectorsCache, state: unknown) => {
  const { keys, selectors, unfrozenProps, results } = cache;
  const count = keys.length;

  let changed = cache.value === null;

  for (let index = 0; index < count; index++) {
    const result = selectors[index](state, unfrozenProps);

    if (!Object.is(result, results[index])) {
      results[index] = result;
      changed = true;
    }
  }

  if (!changed) {
    return cache.value;
  }

  const value: Record<string, unknown> = {};

  for (let index = 0; index < count; index++) {
    value[keys[index]] = results[index];
  }

  cache.value = value;

  return value;
};

/**
 * Reads a batch of selectors through a single store subscription and returns
 * their results as one object.
 *
 * Seven `useSelector` calls in a row component mean seven store listeners,
 * seven `useSyncExternalStore` instances and seven snapshot comparisons per
 * dispatch. This collapses them into one of each; the trade-off is that any
 * tracked state segment changing re-runs the whole batch, which for memoized
 * selectors is a cache hit per field.
 *
 * The memoization lives in the component instance, so rows do not compete for
 * a shared cache the way a module-level structured selector would.
 */
export function useSelectors<M extends SelectorsObject>(
  selectors: M,
  ...params: MergedParams<M>
): SelectorResultsMap<M>;

export function useSelectors(selectors: SelectorsMap, ...params: any[]) {
  const props = params[0];

  const cacheRef = useRef<SelectorsCache | null>(null);

  let cache = cacheRef.current;

  if (cache === null) {
    const created: SelectorsCache = {
      keys: [],
      selectors: [],
      props,
      unfrozenProps: unfreezeProps(props),
      results: [],
      value: null,
      boundSelector: (state: unknown) => select(created, state),
    };

    readSelectors(created, selectors);

    cache = cacheRef.current = created;
  } else {
    // An object literal is a new reference on every render, so the batch is
    // compared by content — the common case is the very same selectors.
    const selectorsChanged = !hasSameSelectors(cache, selectors);
    const propsChanged = !shallowEqual(props, cache.props);

    if (selectorsChanged) {
      readSelectors(cache, selectors);
    }

    if (propsChanged) {
      cache.props = props;
      cache.unfrozenProps = unfreezeProps(props);
    }

    if (selectorsChanged || propsChanged) {
      // react-redux memoizes the selection on the selector's identity, so a new
      // identity is what makes it recompute when the state has not changed but
      // the batch or the props have. The closure reads the cell, so it never
      // captures a stale batch.
      const current = cache;

      cache.boundSelector = (state: unknown) => select(current, state);
    }
  }

  return useReduxSelector(cache.boundSelector, selectorOptions) as Record<string, unknown>;
}
