import { bench, describe } from 'vitest';
import { createSelector } from '@veksa/reselect';
import { createCachedSelector } from '@veksa/re-reselect';
import { createChainSelector } from '../createChainSelector';
import { createBoundSelector } from '../createBoundSelector';
import { createPropSelector } from '../createPropSelector';

type Position = { id: number; symbol: string; qty: number; price: number };

type State = {
  positions: Record<number, Position>;
  rates: Record<string, number>;
};

const POSITIONS = 50;
const LEVELS = 10;

const symbols = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD'];

const state: State = {
  positions: Object.fromEntries(
    Array.from({ length: POSITIONS }, (_, index) => [
      index,
      {
        id: index,
        symbol: symbols[index % symbols.length],
        qty: index + 1,
        price: index * 1.5,
      },
    ]),
  ),
  rates: Object.fromEntries(symbols.map((symbol, index) => [symbol, 1 + index / 10])),
};

const ids = Array.from({ length: POSITIONS }, (_, index) => index);

// The base as a plain selector: nothing in the graph is keyed, so every level's
// key is the default one.
const positionSelector = (state: State, props: { id: number }) => state.positions[props.id];

// The base as a cached selector: every level's key is the position id.
const cachedPositionSelector = createCachedSelector(
  [(state: State) => state.positions, createPropSelector<{ id: number }>().id()],
  (positions, id) => positions[id],
)({
  keySelector: createPropSelector<{ id: number }>().id(),
});

const rateSelector = createCachedSelector(
  [(state: State) => state.rates, (_state: State, props: { symbol: string }) => props.symbol],
  (rates, symbol) => rates[symbol],
)({
  keySelector: (_state: State, props: { symbol: string }) => props.symbol,
});

// `map` only transforms a value, so no level of the chain introduces a key.
const withMapLevels = (base: unknown) => {
  let chain: any = createChainSelector(base as never);

  for (let level = 0; level < LEVELS; level++) {
    chain = chain.map((value: any) => ({ value, level }));
  }

  return chain.build();
};

type Carrier = { position: Position; total: number };

// The join shape: half the levels pull in another keyed selector, the value
// carried through the chain keeps the same shape at every level.
const withJoinLevels = (base: unknown) => {
  let chain: any = createChainSelector(base as never).map(
    (position: unknown): Carrier => ({ position: position as Position, total: 0 }),
  );

  for (let level = 0; level < LEVELS; level++) {
    chain =
      level % 2 === 0
        ? chain.chain((carrier: Carrier) => {
            const bound = createBoundSelector(rateSelector, { symbol: carrier.position.symbol });

            return createSelector([bound], (rate: number) => ({
              ...carrier,
              total: carrier.total + rate,
            }));
          })
        : chain.map((carrier: Carrier) => ({ ...carrier, total: carrier.total + level }));
  }

  return chain.build();
};

const mapOverPlain = withMapLevels(positionSelector);
const mapOverCached = withMapLevels(cachedPositionSelector);
const joinOverCached = withJoinLevels(cachedPositionSelector);

const readAll = (selector: any) => {
  for (let index = 0; index < POSITIONS; index++) {
    selector(state, { id: ids[index] });
  }
};

// Steady state: every position is read again and again, so every level should be
// a cache hit. What is left is the per-level bookkeeping.
describe(`${POSITIONS} positions x ${LEVELS} levels`, () => {
  bench('map levels, plain base', () => {
    readAll(mapOverPlain);
  });

  bench('map levels, cached base', () => {
    readAll(mapOverCached);
  });

  bench('join levels, cached base', () => {
    readAll(joinOverCached);
  });
});
