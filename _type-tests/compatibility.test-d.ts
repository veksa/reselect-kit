import { expectTypeOf } from 'expect-type';
import { Selector } from '@veksa/reselect';
import {
  createCachedStructuredSelector,
  createChainSelector,
  createPathSelector,
  useSelector,
  useSelectors,
} from '../src/index';
import { createSequenceSelector } from '../src/createSequenceSelector';
import { Person, PersonProps, State } from './models';

/**
 * Shapes the per-creator type tests do not reach: batches large enough to
 * stress the union-to-tuple conversion, selectors that are not object
 * literals, argument tuples that are not exactly `[Props]`, and the creators
 * feeding each other.
 */

const stateFixture: State = {
  persons: { data: {} },
  messages: { data: {} },
};

// a batch far larger than a component would normally read still resolves every
// field, and a single parametric member still makes props required
const bigBatch = useSelectors(
  {
    a01: (state: State) => state.persons.currentPersonId ?? 0,
    a02: (state: State) => state.persons.currentPersonId ?? 0,
    a03: (state: State) => state.persons.currentPersonId ?? 0,
    a04: (state: State) => state.persons.currentPersonId ?? 0,
    a05: (state: State) => state.persons.currentPersonId ?? 0,
    a06: (state: State) => state.persons.currentPersonId ?? 0,
    a07: (state: State) => state.persons.currentPersonId ?? 0,
    a08: (state: State) => state.persons.currentPersonId ?? 0,
    a09: (state: State) => state.persons.currentPersonId ?? 0,
    a10: (state: State) => state.persons.currentPersonId ?? 0,
    a11: (state: State) => state.persons.currentPersonId ?? 0,
    a12: (state: State) => state.persons.currentPersonId ?? 0,
    a13: (state: State) => state.persons.currentPersonId ?? 0,
    a14: (state: State) => state.persons.currentPersonId ?? 0,
    a15: (state: State) => state.persons.currentPersonId ?? 0,
    a16: (state: State) => state.persons.currentPersonId ?? 0,
    a17: (state: State) => state.persons.currentPersonId ?? 0,
    a18: (state: State) => state.persons.currentPersonId ?? 0,
    a19: (state: State) => state.persons.currentPersonId ?? 0,
    a20: (state: State, props: PersonProps) => props.personId,
  },
  { personId: 1 },
);

expectTypeOf(bigBatch.a01).toEqualTypeOf<number>();
expectTypeOf(bigBatch.a20).toEqualTypeOf<number>();

// a batch held in a variable is read the same way as an inline literal
const namedBatch = {
  id: (state: State, props: PersonProps) => props.personId,
  count: (state: State) => Object.keys(state.persons.data).length,
};

expectTypeOf(useSelectors(namedBatch, { personId: 1 })).toEqualTypeOf<{
  id: number;
  count: number;
}>();

// a batch typed by an index signature rather than by its keys still resolves
declare const dynamicBatch: Record<string, (state: State) => number>;
expectTypeOf(useSelectors(dynamicBatch)).toEqualTypeOf<Record<string, number>>();

// merging the batch costs nothing per key, so its size is not bounded by what
// the compiler will unfold
const wideBatch = useSelectors(
  {
    ...({} as Record<`filler${number}`, (state: State) => number>),
    id: (state: State, props: PersonProps) => props.personId,
  },
  { personId: 1 },
);
expectTypeOf(wideBatch.id).toEqualTypeOf<number>();

// a selector whose props argument is optional can be read with or without them
declare const optionalProps: (state: State, props?: PersonProps) => number;
expectTypeOf(useSelector(optionalProps)).toEqualTypeOf<number>();
expectTypeOf(useSelector(optionalProps, { personId: 1 })).toEqualTypeOf<number>();

// an argument tuple that is not exactly `[Props]`
declare const readonlyParams: (state: State, ...params: readonly [PersonProps]) => number;
expectTypeOf(useSelector(readonlyParams, { personId: 1 })).toEqualTypeOf<number>();

// reselect's `Selector<S, R>` leaves its arguments open; every creator accepts it
declare const looseSelector: Selector<State, Person>;

expectTypeOf(useSelector(looseSelector)).toEqualTypeOf<Person>();

const looseChain = createChainSelector(looseSelector)
  .map((person) => person.id)
  .build();
expectTypeOf(looseChain(stateFixture)).toEqualTypeOf<number>();

const loosePath = createPathSelector(looseSelector).id();
expectTypeOf(loosePath(stateFixture)).toEqualTypeOf<number>();

// a built chain flows back into the hooks and into the other creators with its
// props intact
const chained = createChainSelector((state: State, props: PersonProps) => props.personId)
  .chain((personId) => (state: State) => state.persons.data[personId])
  .build();

expectTypeOf(useSelector(chained, { personId: 1 })).toEqualTypeOf<Person>();
expectTypeOf(useSelectors({ person: chained }, { personId: 1 })).toEqualTypeOf<{
  person: Person;
}>();
expectTypeOf(createSequenceSelector([chained])(stateFixture, { personId: 1 })).toEqualTypeOf<
  [Person]
>();

createCachedStructuredSelector({ person: chained })({
  keySelector: (state, props) => props.personId,
});

// a path selector feeds the hooks with its props intact
const getPersonName = createPathSelector(
  (state: State, props: PersonProps) => state.persons.data[props.personId],
).name();

expectTypeOf(useSelector(getPersonName, { personId: 1 })).toEqualTypeOf<string>();
