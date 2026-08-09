import { createElement, Fragment, ReactNode, useCallback, useMemo } from 'react';
import { bench, describe } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Provider, shallowEqual, useSelector as useReduxSelector } from '@veksa/react-redux';
import { useSelector } from '../useSelector';
import { useMemoWith } from '../useMemoWith';

// The implementation this hook replaced: `useMemoWith` (useRef) -> `useMemo` ->
// `useCallback`, three hook slots and two dependency arrays per call site. Kept
// here so both variants are measured in the same process on the same workload.
function useSelectorLegacy(selector: Function, ...params: any[]) {
  const props = params[0];
  const memoizedProps = useMemoWith(props, shallowEqual);

  const unfrozenProps = useMemo(() => {
    return Object.isFrozen(memoizedProps) ? { ...memoizedProps } : memoizedProps;
  }, [memoizedProps]);

  const memoizedPropsSelector = useCallback(
    (state: unknown) => {
      return selector(state, unfrozenProps);
    },
    [selector, unfrozenProps],
  );

  return useReduxSelector(memoizedPropsSelector, {
    devModeChecks: {
      stabilityCheck: 'never',
      identityFunctionCheck: 'never',
    },
  });
}

type State = { count: number };
type Props = { factor: number };

// `useSelector` overloads are ambient-typed against the store, and the legacy
// variant is untyped on purpose — both are called through one loose signature.
type SelectorHook = (selector: (state: State, props: Props) => number, props: Props) => number;

const StoreProvider = Provider as unknown as (props: {
  store: unknown;
  children?: ReactNode;
}) => ReactNode;

const state: State = { count: 5 };

const store = {
  getState: () => state,
  dispatch: (action: unknown) => action,
  subscribe: () => () => undefined,
  replaceReducer: () => undefined,
} as unknown as never;

// Selectors in this kit are built once at module scope, so the hot path is a
// stable selector reference — the hook overhead is all that is left to measure.
const selectValue = (s: State, props: Props) => s.count * props.factor;

// Enough call sites for the per-hook cost to rise above React's own render
// overhead, small enough to keep a bench iteration in the millisecond range.
const CALL_SITES = 500;

const createTree = (useHook: SelectorHook) => {
  const Child = ({ factor }: Props) => {
    useHook(selectValue, { factor });
    return null;
  };

  return ({ factor }: Props) => {
    const children: ReactNode[] = [];

    for (let index = 0; index < CALL_SITES; index++) {
      children.push(createElement(Child, { key: index, factor }));
    }

    return createElement(StoreProvider, { store }, createElement(Fragment, null, ...children));
  };
};

const NextTree = createTree(useSelector as SelectorHook);
const LegacyTree = createTree(useSelectorLegacy as SelectorHook);

const benchRerender = (name: string, Tree: (props: Props) => ReactNode, changeProps: boolean) => {
  let mounted: ReturnType<typeof render> | null = null;
  let factor = 1;

  bench(
    name,
    () => {
      if (changeProps) {
        factor = factor === 1 ? 2 : 1;
      }

      mounted!.rerender(createElement(Tree, { factor }));
    },
    {
      setup: () => {
        mounted = render(createElement(Tree, { factor }));
      },
      teardown: () => {
        cleanup();
        mounted = null;
      },
    },
  );
};

// The dominant case: a parent re-renders, props are new objects but shallow
// equal, the state has not changed. Nothing recomputes — this is hook overhead
// and nothing else.
describe('re-render, shallow-equal props', () => {
  benchRerender('next', NextTree, false);
  benchRerender('legacy', LegacyTree, false);
});

// Props actually change, so both variants must rebuild the bound selector and
// let react-redux recompute the selection.
describe('re-render, changed props', () => {
  benchRerender('next', NextTree, true);
  benchRerender('legacy', LegacyTree, true);
});

describe('mount', () => {
  bench('next', () => {
    render(createElement(NextTree, { factor: 1 }));
    cleanup();
  });

  bench('legacy', () => {
    render(createElement(LegacyTree, { factor: 1 }));
    cleanup();
  });
});
