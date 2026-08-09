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
