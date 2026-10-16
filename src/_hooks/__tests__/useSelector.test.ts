import { createElement, ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Provider, useSelector as useReduxSelector } from '@veksa/react-redux';
import { useSelector } from '../useSelector';

// Spied on, to see the selector react-redux is handed.
vi.mock('@veksa/react-redux', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@veksa/react-redux')>();
  return { ...actual, useSelector: vi.fn(actual.useSelector) };
});

// `children` is passed positionally (oxlint forbids it as a prop), so relax the
// Provider's prop type to make `children` optional in the props object.
const StoreProvider = Provider as unknown as (props: {
  store: unknown;
  children?: ReactNode;
}) => ReactNode;

type State = { count: number };

const createMockStore = (state: State) => {
  const listeners = new Set<() => void>();

  const store = {
    getState: () => state,
    dispatch: (action: unknown) => action,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replaceReducer: () => undefined,
  };

  return store as unknown as never;
};

const wrapperWith =
  (store: never) =>
  ({ children }: { children: ReactNode }) =>
    createElement(StoreProvider, { store }, children);

describe('useSelector', () => {
  const state: State = { count: 5 };

  test('returns the selector result for the current state and props', () => {
    const store = createMockStore(state);

    const { result } = renderHook(
      () =>
        useSelector((s: State, props: { factor: number }) => s.count * props.factor, { factor: 2 }),
      { wrapper: wrapperWith(store) },
    );

    expect(result.current).toBe(10);
  });

  test('stabilizes shallow-equal props between renders', () => {
    const store = createMockStore(state);
    const selector = vi.fn((s: State, props: { factor: number }) => s.count * props.factor);

    const { rerender } = renderHook(({ props }) => useSelector(selector, props), {
      wrapper: wrapperWith(store),
      initialProps: { props: { factor: 2 } },
    });

    rerender({ props: { factor: 2 } });

    const propsArgs = selector.mock.calls.map((call) => call[1]);
    // A new-but-shallow-equal props object must not reach the selector as a new reference.
    expect(new Set(propsArgs).size).toBe(1);
  });

  test('does not re-run the selector while props and state stay equal', () => {
    const store = createMockStore(state);
    const selector = vi.fn((s: State, props: { factor: number }) => s.count * props.factor);

    const { rerender } = renderHook(({ props }) => useSelector(selector, props), {
      wrapper: wrapperWith(store),
      initialProps: { props: { factor: 2 } },
    });

    const callsAfterMount = selector.mock.calls.length;
    rerender({ props: { factor: 2 } });

    expect(selector.mock.calls.length).toBe(callsAfterMount);
  });

  test('re-runs the selector when props change without a state change', () => {
    const store = createMockStore(state);

    const { result, rerender } = renderHook(
      ({ props }) => useSelector((s: State, p: { factor: number }) => s.count * p.factor, props),
      {
        wrapper: wrapperWith(store),
        initialProps: { props: { factor: 2 } },
      },
    );

    expect(result.current).toBe(10);

    rerender({ props: { factor: 3 } });

    expect(result.current).toBe(15);
  });

  test('passes non-object props through untouched', () => {
    const store = createMockStore(state);
    let receivedProps: unknown;

    renderHook(
      () =>
        useSelector((s: State, props: string) => {
          receivedProps = props;
          return s.count;
        }, 'id'),
      { wrapper: wrapperWith(store) },
    );

    expect(receivedProps).toBe('id');
  });

  test('copies frozen array props without turning them into objects', () => {
    const store = createMockStore(state);
    let receivedProps: number[] | undefined;

    renderHook(
      () =>
        useSelector(
          (s: State, props: number[]) => {
            receivedProps = props;
            return s.count;
          },
          Object.freeze([1, 2]) as number[],
        ),
      { wrapper: wrapperWith(store) },
    );

    expect(Object.isFrozen(receivedProps)).toBe(false);
    expect(receivedProps).toEqual([1, 2]);
  });

  test('unfreezes frozen props before passing them to the selector', () => {
    const store = createMockStore(state);
    let receivedProps: { factor: number } | undefined;

    renderHook(
      () =>
        useSelector(
          (s: State, props: { factor: number }) => {
            receivedProps = props;
            return s.count;
          },
          Object.freeze({ factor: 2 }),
        ),
      { wrapper: wrapperWith(store) },
    );

    expect(Object.isFrozen(receivedProps)).toBe(false);
    expect(receivedProps?.factor).toBe(2);
  });

  test('hands react-redux a binding named after the selector', () => {
    vi.mocked(useReduxSelector).mockClear();
    const store = createMockStore(state);
    function selectCount(s: State, props: { factor: number }) {
      return s.count * props.factor;
    }

    const { rerender } = renderHook(({ props }) => useSelector(selectCount, props), {
      wrapper: wrapperWith(store),
      initialProps: { props: { factor: 2 } },
    });
    rerender({ props: { factor: 3 } });

    const names = vi.mocked(useReduxSelector).mock.calls.map(([selector]) => selector.name);
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(new Set(names)).toEqual(new Set(['selectCount']));
  });
});
