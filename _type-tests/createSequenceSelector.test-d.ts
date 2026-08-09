import { expectTypeOf } from 'expect-type';
import { createSelector } from '@veksa/reselect';
import { Selector } from '@veksa/reselect';
import { createSequenceSelector } from '../src/index';
import { Person, PersonProps, State } from './models';

const stateFixture: State = {
  persons: { data: {} },
  messages: { data: {} },
};

// non-parametric sequence selector returns the results positionally
const getNumbers = createSequenceSelector([
  (state: State) => state.persons.currentPersonId ?? 0,
  (state: State) => state.messages.currentMessageId ?? 0,
]);

expectTypeOf(getNumbers).toExtend<Selector<State, [number, number]>>();
expectTypeOf(getNumbers(stateFixture)).toEqualTypeOf<[number, number]>();

// a custom selector creator can be provided
const getNumbersWithCreator = createSequenceSelector(
  [(state: State) => state.persons.currentPersonId ?? 0],
  createSelector,
);
expectTypeOf(getNumbersWithCreator(stateFixture)).toEqualTypeOf<[number]>();

// parametric sequence selector keeps the props type
const getParametricNumbers = createSequenceSelector([
  (state: State, props: PersonProps) => props.personId,
  (state: State) => state.persons.currentPersonId ?? 0,
]);

expectTypeOf(getParametricNumbers).toExtend<Selector<State, [number, number], [PersonProps]>>();
expectTypeOf(getParametricNumbers(stateFixture, { personId: 1 })).toEqualTypeOf<[number, number]>();

// the results keep their own types instead of collapsing into a common one
const getMixed = createSequenceSelector([
  (state: State, props: PersonProps) => state.persons.data[props.personId],
  (state: State) => Object.keys(state.persons.data).length,
]);

expectTypeOf(getMixed(stateFixture, { personId: 1 })).toEqualTypeOf<[Person, number]>();

// @ts-expect-error - props are required when a selector is parametric
getParametricNumbers(stateFixture);

// an empty sequence constrains no state, so it stays callable
const getNothing = createSequenceSelector([]);

expectTypeOf(getNothing(stateFixture)).toEqualTypeOf<[]>();
