import { expectTypeOf } from 'expect-type';
import { createCachedStructuredSelector } from '../src/index';
import { Message, Person, PersonProps, State } from './models';

const stateFixture: State = {
  persons: { data: {} },
  messages: { data: {} },
};

// non-parametric input selectors produce a plain structured selector
const plainCachedSelector = createCachedStructuredSelector({
  currentPersonId: (state: State) => state.persons.currentPersonId ?? 0,
  personCount: (state: State) => Object.keys(state.persons.data).length,
})({
  keySelector: () => 'key',
});

expectTypeOf(plainCachedSelector(stateFixture)).toEqualTypeOf<{
  currentPersonId: number;
  personCount: number;
}>();

// parametric structured selector keeps the props type and maps the result shape
const cachedSelector = createCachedStructuredSelector({
  person: (state: State, props: PersonProps) => state.persons.data[props.personId],
  currentMessage: (state: State) => state.messages.data[state.messages.currentMessageId ?? 0],
})({
  keySelector: (state, props) => props.personId,
});

expectTypeOf(cachedSelector(stateFixture, { personId: 1 })).toEqualTypeOf<{
  person: Person;
  currentMessage: Message;
}>();

// the key selector is typed from the batch, so its arguments are checked
createCachedStructuredSelector({
  person: (state: State, props: PersonProps) => state.persons.data[props.personId],
})({
  // @ts-expect-error - `messageId` is not part of the batch's props
  keySelector: (state, props) => props.messageId,
});
