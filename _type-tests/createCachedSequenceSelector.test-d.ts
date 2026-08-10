import { expectTypeOf } from 'expect-type';
import { createCachedSequenceSelector } from '../src/index';
import { PersonProps, State } from './models';

const stateFixture: State = {
  persons: { data: {} },
  messages: { data: {} },
};

// parametric cached sequence selector returns the results positionally
const cachedSequenceSelector = createCachedSequenceSelector([
  (state: State, props: PersonProps) => props.personId,
  (state: State) => state.persons.currentPersonId ?? 0,
])({
  keySelector: (state, props) => props.personId,
});

expectTypeOf(cachedSequenceSelector(stateFixture, { personId: 1 })).toEqualTypeOf<
  [number, number]
>();

// the key selector is typed from the group, so its arguments are checked
createCachedSequenceSelector([(state: State, props: PersonProps) => props.personId])({
  // @ts-expect-error - `messageId` is not part of the group's props
  keySelector: (state, props) => props.messageId,
});

// A key selector may read props no member of the group declares — keying a
// group of already-bound selectors is the usual reason — and those props join
// the group's own on the resulting selector.
const keyedByOwnProps = createCachedSequenceSelector([(state: State) => state.persons.data])({
  keySelector: (state: State, props: PersonProps) => props.personId,
});

expectTypeOf(keyedByOwnProps).parameters.toEqualTypeOf<[State, PersonProps]>();

// Widening only: a key that reads what the group already declares leaves the
// group's arguments exactly as they were, optionality included.
const optionalGroup = createCachedSequenceSelector([
  (state: State, props?: PersonProps) => props?.personId ?? 0,
])({
  keySelector: (state, props) => props?.personId ?? 0,
});

expectTypeOf(optionalGroup(stateFixture)).toEqualTypeOf<[number]>();
expectTypeOf(optionalGroup(stateFixture, { personId: 1 })).toEqualTypeOf<[number]>();
