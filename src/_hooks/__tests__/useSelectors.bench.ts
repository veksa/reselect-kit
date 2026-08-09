import { createElement, Fragment, ReactNode } from 'react';
import { bench, describe } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Provider } from '@veksa/react-redux';
import { useSelector } from '../useSelector';
import { useSelectors } from '../useSelectors';
import { createCachedStructuredSelector } from '../../createCachedStructuredSelector';

type Quote = {
  bid: number;
  ask: number;
  last: number;
  high: number;
  low: number;
  volume: number;
};

type State = { quotes: Record<string, Quote> };
type Props = { symbol: string };

const StoreProvider = Provider as unknown as (props: {
  store: unknown;
  children?: ReactNode;
}) => ReactNode;

// A quote table: one row per symbol, seven fields read per row.
const ROWS = 100;

const symbols = Array.from({ length: ROWS }, (_, index) => `SYM${index}`);

const state: State = {
  quotes: Object.fromEntries(
    symbols.map((symbol, index) => [
      symbol,
      { bid: index, ask: index + 1, last: index, high: index + 2, low: index - 2, volume: index },
    ]),
  ),
};

const store = {
  getState: () => state,
  dispatch: (action: unknown) => action,
  subscribe: () => () => undefined,
  replaceReducer: () => undefined,
} as unknown as never;

const selectSymbol = (_state: State, props: Props) => props.symbol;
const selectBid = (state: State, props: Props) => state.quotes[props.symbol].bid;
const selectAsk = (state: State, props: Props) => state.quotes[props.symbol].ask;
const selectLast = (state: State, props: Props) => state.quotes[props.symbol].last;
const selectHigh = (state: State, props: Props) => state.quotes[props.symbol].high;
const selectLow = (state: State, props: Props) => state.quotes[props.symbol].low;
const selectVolume = (state: State, props: Props) => state.quotes[props.symbol].volume;

const fields = {
  symbol: selectSymbol,
  bid: selectBid,
  ask: selectAsk,
  last: selectLast,
  high: selectHigh,
  low: selectLow,
  volume: selectVolume,
};

// The alternative that already exists: one module-level cached structured
// selector, read through a single `useSelector`. One subscription per row too,
// but the memoization is shared by every row and keyed by symbol.
const selectQuoteView = createCachedStructuredSelector(fields)(
  (_state: State, props: Props) => props.symbol,
);

const HooksRow = ({ symbol }: Props) => {
  const props = { symbol };

  useSelector(selectSymbol, props);
  useSelector(selectBid, props);
  useSelector(selectAsk, props);
  useSelector(selectLast, props);
  useSelector(selectHigh, props);
  useSelector(selectLow, props);
  useSelector(selectVolume, props);

  return null;
};

const BatchRow = ({ symbol }: Props) => {
  useSelectors(fields, { symbol });

  return null;
};

const StructuredRow = ({ symbol }: Props) => {
  useSelector(selectQuoteView, { symbol });

  return null;
};

const createTree = (Row: (props: Props) => ReactNode) => {
  return ({ generation }: { generation: number }) => {
    const children: ReactNode[] = [];

    for (let index = 0; index < ROWS; index++) {
      children.push(createElement(Row, { key: index, symbol: symbols[index] }));
    }

    return createElement(
      StoreProvider,
      { store },
      createElement(Fragment, { key: generation }, ...children),
    );
  };
};

const trees = {
  'useSelector x7': createTree(HooksRow),
  useSelectors: createTree(BatchRow),
  'structured selector': createTree(StructuredRow),
};

const benchRerender = (name: string, Tree: (props: { generation: number }) => ReactNode) => {
  let mounted: ReturnType<typeof render> | null = null;
  let generation = 0;

  bench(
    name,
    () => {
      // The key is stable: the same rows re-render, nothing remounts.
      mounted!.rerender(createElement(Tree, { generation: 0 }));
      generation++;
    },
    {
      setup: () => {
        mounted = render(createElement(Tree, { generation }));
      },
      teardown: () => {
        cleanup();
        mounted = null;
      },
    },
  );
};

// A parent re-render of the whole table: no state change, no props change, so
// nothing recomputes. This is subscription and hook overhead only.
describe(`re-render ${ROWS} rows x 7 fields`, () => {
  for (const [name, Tree] of Object.entries(trees)) {
    benchRerender(name, Tree);
  }
});

// Mount pays for the subscriptions themselves: 700 store listeners for the
// per-field variant against 100 for the other two.
describe(`mount ${ROWS} rows x 7 fields`, () => {
  for (const [name, Tree] of Object.entries(trees)) {
    bench(name, () => {
      render(createElement(Tree, { generation: 0 }));
      cleanup();
    });
  }
});
