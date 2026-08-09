import { expectTypeOf } from 'expect-type';
import { Selector } from '@veksa/reselect';
import { createChainSelector } from '../src/index';
import { Message, MessageProps, Person, PersonProps, State } from './models';

const stateFixture: State = {
  persons: { data: {} },
  messages: { data: {} },
};

// `map` transforms the result type of the chain
const getPersonList = createChainSelector((state: State) => state.persons.data)
  .map((data) => Object.values(data))
  .build();

expectTypeOf(getPersonList).toExtend<Selector<State, Person[]>>();
expectTypeOf(getPersonList(stateFixture)).toEqualTypeOf<Person[]>();

// multiple `map` steps compose the transformations
const getPersonCount = createChainSelector((state: State) => state.persons.data)
  .map((data) => Object.values(data))
  .map((persons) => persons.length)
  .build();

expectTypeOf(getPersonCount(stateFixture)).toEqualTypeOf<number>();

// `chain` swaps in a new selector produced from the previous result
const getCurrentPerson = createChainSelector((state: State) => state.persons.currentPersonId ?? 0)
  .chain((personId) => (state: State) => state.persons.data[personId])
  .build();

expectTypeOf(getCurrentPerson(stateFixture)).toEqualTypeOf<Person>();

// parametric selectors keep their props type through `chain`
const getPersonById = createChainSelector((state: State, props: PersonProps) => props.personId)
  .chain((personId) => (state: State) => state.persons.data[personId])
  .build();

expectTypeOf(getPersonById).toExtend<Selector<State, Person, [PersonProps]>>();
expectTypeOf(getPersonById(stateFixture, { personId: 1 })).toEqualTypeOf<Person>();

// `map` also works on parametric chains
const getPersonIdPlusOne = createChainSelector((state: State, props: PersonProps) => props.personId)
  .map((personId) => personId + 1)
  .build();

expectTypeOf(getPersonIdPlusOne(stateFixture, { personId: 1 })).toEqualTypeOf<number>();

// props introduced by a chained selector become required for the whole chain,
// even when the base selector reads nothing but state
const getRecentMessages = createChainSelector((state: State) => state.persons.currentPersonId ?? 0)
  .chain(
    (personId) => (state: State, props: { limit: number }) =>
      Object.values(state.messages.data)
        .filter((message) => message.personId === personId)
        .slice(0, props.limit),
  )
  .build();

expectTypeOf(getRecentMessages).toExtend<Selector<State, Message[], [{ limit: number }]>>();
expectTypeOf(getRecentMessages(stateFixture, { limit: 5 })).toEqualTypeOf<Message[]>();

// chaining intersects the props of every level that declares them
const getPersonMessage = createChainSelector((state: State, props: PersonProps) => props.personId)
  .chain(
    (personId) => (state: State, props: MessageProps) =>
      Object.values(state.messages.data).find(
        (message) => message.personId === personId && message.id === props.messageId,
      ),
  )
  .build();

expectTypeOf(getPersonMessage).toExtend<
  Selector<State, Message | undefined, [PersonProps & MessageProps]>
>();

// @ts-expect-error - the chained selector's props are required too
getPersonMessage(stateFixture, { personId: 1 });
