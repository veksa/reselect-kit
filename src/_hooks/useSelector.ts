import { shallowEqual, useSelector as useReduxSelector } from '@veksa/react-redux';
import { useRef } from 'react';

// Hoisted: react-redux reads the options object on every render, so there is no
// reason to allocate a fresh one per call site per render.
const selectorOptions = {
  devModeChecks: {
    stabilityCheck: 'never',
    identityFunctionCheck: 'never',
  },
} as const;

// Bound selectors write the binding into the props object in place and roll it
// back afterwards (see temporaryAssign.ts), which throws on a frozen target in
// strict mode. React freezes element props in development, and immer-based
// stores hand out frozen objects in production too, so the copy stays in both
// builds — it only ever runs when props actually change.
const unfreeze = (props: unknown) => {
  if (typeof props !== 'object' || props === null || !Object.isFrozen(props)) {
    return props;
  }

  return Array.isArray(props) ? props.slice() : { ...props };
};

type SelectorCache = {
  props: unknown;
  unfrozenProps: unknown;
  selector: Function;
  boundSelector: (state: unknown) => unknown;
};

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
    const unfrozenProps = unfreeze(props);

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
      cache.unfrozenProps = unfreeze(props);
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
