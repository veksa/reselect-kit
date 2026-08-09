import { shallowEqual, useSelector as useReduxSelector } from '@veksa/react-redux';
import { useRef } from 'react';
import { unfreezeProps } from '../_helpers/unfreezeProps';
import { selectorOptions } from './selectorOptions';

type SelectorCache = {
  props: unknown;
  unfrozenProps: unknown;
  selector: Function;
  boundSelector: (state: unknown) => unknown;
};

/**
 * Reads one selector from the store. Props are compared shallowly, so an inline
 * object literal does not invalidate the selector on every render.
 *
 * Use {@link useSelectors} to read several selectors through a single store
 * subscription.
 */
export function useSelector<S extends object, R>(selector: (state: S) => R): R;

export function useSelector<S extends object, P, R>(
  selector: (state: S, props: P) => R,
  props: P,
): R;

export function useSelector(selector: Function, ...params: any[]) {
  const props = params[0];

  // One ref cell instead of a memo-by-comparator hook, a `useMemo` and a
  // `useCallback`: three hook slots and two dependency arrays per call site,
  // none of which this hook needs — every transition it cares about is an
  // explicit comparison it already performs.
  const cacheRef = useRef<SelectorCache | null>(null);

  let cache = cacheRef.current;

  if (cache === null) {
    const unfrozenProps = unfreezeProps(props);

    cache = cacheRef.current = {
      props,
      unfrozenProps,
      selector,
      boundSelector: (state: unknown) => selector(state, unfrozenProps),
    };
  } else {
    // A new-but-shallow-equal props object keeps the previous reference, so the
    // bound selector stays stable across renders that changed nothing.
    const propsChanged = !shallowEqual(props, cache.props);

    if (propsChanged) {
      cache.props = props;
      cache.unfrozenProps = unfreezeProps(props);
    }

    if (propsChanged || cache.selector !== selector) {
      const { unfrozenProps } = cache;

      cache.selector = selector;
      // react-redux memoizes the selection on the selector's identity, so a new
      // identity is what makes it recompute when the state has not changed but
      // the props or the selector have.
      cache.boundSelector = (state: unknown) => selector(state, unfrozenProps);
    }
  }

  return useReduxSelector(cache.boundSelector, selectorOptions);
}
