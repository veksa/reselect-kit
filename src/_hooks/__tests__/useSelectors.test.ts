import { createElement, ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Provider } from '@veksa/react-redux';
import { useSelectors } from '../useSelectors';

// `children` is passed positionally (oxlint forbids it as a prop), so relax the
// Provider's prop type to make `children` optional in the props object.
const StoreProvider = Provider as unknown as (props: {
  store: unknown;
  children?: ReactNode;
}) => ReactNode;

type Quote = { bid: number; ask: number };
type State = { quotes: Record<string, Quote>; ui: { theme: string } };
type Props = { symbol: string };

const initialState: State = {
  quotes: { EURUSD: { bid: 1, ask: 2 } },
  ui: { theme: 'dark' },
};

const createMockStore = (initial: State) => {
  const listeners = new Set<() => void>();
  let state = initial;

  const store = {
    getState: () => state,
    dispatch: (next: State) => {
      state = next;
      listeners.forEach((listener) => listener());
      return next;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replaceReducer: () => undefined,
  };

  return store;
};

const wrapperWith =
  (store: unknown) =>
  ({ children }: { children: ReactNode }) =>
    createElement(StoreProvider, { store }, children);

// react-redux notifies its listeners through a MessageChannel, so a dispatch
// only reaches the components after the next macrotask.
const dispatch = async (store: ReturnType<typeof createMockStore>, next: State) => {
  await act(async () => {
    store.dispatch(next);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const selectSymbol = (_state: State, props: Props) => props.symbol;
const selectBid = (state: State, props: Props) => state.quotes[props.symbol].bid;
const selectAsk = (state: State, props: Props) => state.quotes[props.symbol].ask;

describe('useSelectors', () => {
  test('returns every selector result keyed by its name', () => {
    const store = createMockStore(initialState);

    const { result } = renderHook(
      () =>
        useSelectors(
          { symbol: selectSymbol, bid: selectBid, ask: selectAsk },
          { symbol: 'EURUSD' },
        ),
      { wrapper: wrapperWith(store) },
    );

    expect(result.current).toEqual({ symbol: 'EURUSD', bid: 1, ask: 2 });
  });

  test('keeps the result reference across renders that changed nothing', () => {
    const store = createMockStore(initialState);

    const { result, rerender } = renderHook(
      ({ props }) => useSelectors({ bid: selectBid, ask: selectAsk }, props),
      {
        wrapper: wrapperWith(store),
        initialProps: { props: { symbol: 'EURUSD' } },
      },
    );

    const first = result.current;
    // A new-but-shallow-equal props object must not rebuild the batch.
    rerender({ props: { symbol: 'EURUSD' } });

    expect(result.current).toBe(first);
  });

  test('does not re-render when the update leaves every field untouched', async () => {
    const store = createMockStore(initialState);
    const renders = vi.fn();

    const { result } = renderHook(
      () => {
        renders();
        return useSelectors({ bid: selectBid, ask: selectAsk }, { symbol: 'EURUSD' });
      },
      { wrapper: wrapperWith(store) },
    );

    const first = result.current;
    const rendersAfterMount = renders.mock.calls.length;

    await dispatch(store, { ...initialState, ui: { theme: 'light' } });

    expect(renders.mock.calls.length).toBe(rendersAfterMount);
    expect(result.current).toBe(first);
  });

  test('rebuilds the result when a single field changes', async () => {
    const store = createMockStore(initialState);

    const { result } = renderHook(
      () => useSelectors({ bid: selectBid, ask: selectAsk }, { symbol: 'EURUSD' }),
      { wrapper: wrapperWith(store) },
    );

    const first = result.current;

    await dispatch(store, { ...initialState, quotes: { EURUSD: { bid: 3, ask: 2 } } });

    expect(result.current).not.toBe(first);
    expect(result.current).toEqual({ bid: 3, ask: 2 });
  });

  test('re-runs the batch when props change without a state change', () => {
    const store = createMockStore({
      quotes: { EURUSD: { bid: 1, ask: 2 }, GBPUSD: { bid: 10, ask: 20 } },
      ui: { theme: 'dark' },
    });

    const { result, rerender } = renderHook(
      ({ props }) => useSelectors({ bid: selectBid, ask: selectAsk }, props),
      {
        wrapper: wrapperWith(store),
        initialProps: { props: { symbol: 'EURUSD' } },
      },
    );

    expect(result.current).toEqual({ bid: 1, ask: 2 });

    rerender({ props: { symbol: 'GBPUSD' } });

    expect(result.current).toEqual({ bid: 10, ask: 20 });
  });

  test('picks up a replaced selector in the batch', () => {
    const store = createMockStore(initialState);

    const { result, rerender } = renderHook(
      ({ factor }) =>
        useSelectors(
          { bid: (state: State, props: Props) => state.quotes[props.symbol].bid * factor },
          { symbol: 'EURUSD' },
        ),
      {
        wrapper: wrapperWith(store),
        initialProps: { factor: 1 },
      },
    );

    expect(result.current).toEqual({ bid: 1 });

    rerender({ factor: 10 });

    expect(result.current).toEqual({ bid: 10 });
  });

  test('unfreezes frozen props before passing them to the selectors', () => {
    const store = createMockStore(initialState);
    let receivedProps: Props | undefined;

    renderHook(
      () =>
        useSelectors(
          {
            bid: (state: State, props: Props) => {
              receivedProps = props;
              return state.quotes[props.symbol].bid;
            },
          },
          Object.freeze({ symbol: 'EURUSD' }),
        ),
      { wrapper: wrapperWith(store) },
    );

    expect(Object.isFrozen(receivedProps)).toBe(false);
    expect(receivedProps?.symbol).toBe('EURUSD');
  });
});
