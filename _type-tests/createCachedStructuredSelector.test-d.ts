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

// a batch whose props are optional everywhere produces a selector that can be
// read with or without them
const optionalCachedSelector = createCachedStructuredSelector({
  person: (state: State, props?: PersonProps) => state.persons.data[props?.personId ?? 0],
})({
  keySelector: (state, props) => props?.personId ?? 0,
});

expectTypeOf(optionalCachedSelector(stateFixture)).toEqualTypeOf<{ person: Person }>();
expectTypeOf(optionalCachedSelector(stateFixture, { personId: 1 })).toEqualTypeOf<{
  person: Person;
}>();

/** The literal numbers below `N`, used to build a batch with many distinct keys. */
type Indices<N extends number, Acc extends number[] = []> = Acc['length'] extends N
  ? Acc[number]
  : Indices<N, [...Acc, Acc['length']]>;

type WideBatch = Record<`field${Indices<60>}`, (state: State, props: PersonProps) => number>;

declare const wideBatch: WideBatch;

// the batch is merged rather than put back in key order, so neither the result
// nor the key selector is capped by what the compiler will unfold per key
const wideCachedSelector = createCachedStructuredSelector(wideBatch)({
  keySelector: (state, props) => props.personId,
});

expectTypeOf(wideCachedSelector(stateFixture, { personId: 1 })).toEqualTypeOf<
  Record<`field${Indices<60>}`, number>
>();
