import { expectTypeOf } from 'expect-type';
import { createCachedSelector } from '@veksa/re-reselect';
import {
  arrayComposeKeySelectors,
  createAdaptedSelector,
  createBoundSelector,
  createCachedSequenceSelector,
  createCachedStructuredSelector,
  createChainSelector,
  createEmptySelector,
  createKeySelectorComposer,
  createKeySelectorCreator,
  createPathSelector,
  createPropSelector,
  createSegmentSelector,
  createSequenceSelector,
  setDebugMode,
  stringComposeKeySelectors,
  useSelector,
  useSelectors,
} from '../src/index';
import { Person, PersonProps, PersonState, State } from './models';

/**
 * The call shapes the README's API reference shows, so that documentation drift
 * is a failing type test rather than something a reader discovers.
 */

const stateFixture: State = {
  persons: { data: {} },
  messages: { data: {} },
};

const getPersons = (state: State) => state.persons;
const getPerson = (state: State, props: PersonProps) => state.persons.data[props.personId];

/* createPathSelector: property access walks the path, the call terminates it */
expectTypeOf(createPathSelector(getPersons).data()(stateFixture)).toEqualTypeOf<
  Record<number, Person>
>();

/* upgrading from 1.0.x: props are one entry of the argument tuple */
expectTypeOf(
  useSelector<State, Person, [PersonProps]>(getPerson, { personId: 1 }),
).toEqualTypeOf<Person>();
expectTypeOf(
  createPathSelector<State, Person, [PersonProps]>(getPerson).id()(stateFixture, { personId: 1 }),
).toEqualTypeOf<number>();
expectTypeOf(
  createChainSelector<State, Person, [PersonProps]>(getPerson)
    .map((person) => person.id)
    .build()(stateFixture, { personId: 1 }),
).toEqualTypeOf<number>();

/* createBoundSelector: what the binding does not supply stays required */
expectTypeOf(createBoundSelector(getPerson, { personId: 1 })(stateFixture)).toEqualTypeOf<Person>();

/* createAdaptedSelector: the adapted selector takes the mapping's props */
const getPersonByName = createAdaptedSelector(getPerson, (props: { name: number }) => ({
  personId: props.name,
}));
expectTypeOf(getPersonByName(stateFixture, { name: 1 })).toEqualTypeOf<Person>();

/* createSegmentSelector / createEmptySelector / createPropSelector */
expectTypeOf(
  createSegmentSelector((state: State) => state.persons, { data: {} })(stateFixture),
).toEqualTypeOf<PersonState>();
expectTypeOf(createEmptySelector(getPersons)(stateFixture)).toEqualTypeOf<
  PersonState | undefined
>();
expectTypeOf(
  createPropSelector<PersonProps>().personId()(stateFixture, { personId: 1 }),
).toEqualTypeOf<number>();

/* createSequenceSelector: a tuple of the individual result types */
expectTypeOf(
  createSequenceSelector([
    (state: State) => state.persons.currentPersonId ?? 0,
    (state: State) => Object.keys(state.persons.data).length,
  ])(stateFixture),
).toEqualTypeOf<[number, number]>();

/* createCachedSequenceSelector: options with a key selector typed off the group */
expectTypeOf(
  createCachedSequenceSelector([getPerson, (state: State, props: PersonProps) => props.personId])({
    keySelector: (state, props) => props.personId,
  })(stateFixture, { personId: 1 }),
).toEqualTypeOf<[Person, number]>();

/* createCachedStructuredSelector: same, keyed by the batch's props */
expectTypeOf(
  createCachedStructuredSelector({ person: getPerson })({
    keySelector: (state, props) => props.personId,
  })(stateFixture, { personId: 1 }),
).toEqualTypeOf<{ person: Person }>();

/* the hooks */
expectTypeOf(useSelector(getPerson, { personId: 1 })).toEqualTypeOf<Person>();
expectTypeOf(useSelectors({ person: getPerson }, { personId: 1 })).toEqualTypeOf<{
  person: Person;
}>();

/* key selectors */
expectTypeOf(
  stringComposeKeySelectors(
    (state: State, props: PersonProps) => props.personId,
    (state: State) => state.persons.currentPersonId ?? 0,
  )(stateFixture, { personId: 1 }),
).toEqualTypeOf<unknown>();

expectTypeOf(
  arrayComposeKeySelectors((state: State, props: PersonProps) => props.personId)(stateFixture, {
    personId: 1,
  }),
).toEqualTypeOf<unknown>();

const commaComposeKeySelectors = createKeySelectorComposer(
  (...keySelectors) =>
    (state, props) =>
      keySelectors.map((keySelector) => keySelector(state, props)).join(),
);
expectTypeOf(
  commaComposeKeySelectors((state: State, props: PersonProps) => props.personId)(stateFixture, {
    personId: 1,
  }),
).toEqualTypeOf<unknown>();

createCachedSelector(
  [getPerson],
  (person) => person.id,
)({
  keySelectorCreator: createKeySelectorCreator(stringComposeKeySelectors),
});

/* debug mode */
setDebugMode(true);
setDebugMode(false);
