import { expectTypeOf } from 'expect-type';
import { Selector } from '@veksa/reselect';
import { arrayComposeKeySelectors, createBoundSelector, useSelector } from '../src/index';
import { Person, State } from './models';

const stateFixture: State = {
  persons: { data: {} },
  messages: { data: {} },
};

const personSelector = (state: State, props: { personId: number }): Person | undefined =>
  state.persons.data[props.personId];

// binding every prop turns the selector into a plain one
const boundSelector = createBoundSelector(personSelector, { personId: 1 });

expectTypeOf(boundSelector).toExtend<Selector<State, Person | undefined>>();
expectTypeOf(boundSelector(stateFixture)).toEqualTypeOf<Person | undefined>();

// binding a subset of props keeps the selector parametric with the rest
const twoPropsSelector = (
  state: State,
  props: { personId: number; messageId: number },
): Person | undefined => state.persons.data[props.personId];

const partiallyBoundSelector = createBoundSelector(twoPropsSelector, {
  personId: 1,
});

expectTypeOf(partiallyBoundSelector).toExtend<
  Selector<State, Person | undefined, [{ messageId: number }]>
>();
expectTypeOf(partiallyBoundSelector(stateFixture, { messageId: 100 })).toEqualTypeOf<
  Person | undefined
>();

// a custom binding options object is accepted and its key selector composer is
// typed against the library's own
const boundWithOptions = createBoundSelector(
  personSelector,
  { personId: 1 },
  {
    keySelectorComposer: arrayComposeKeySelectors,
  },
);
expectTypeOf(boundWithOptions(stateFixture)).toEqualTypeOf<Person | undefined>();

// a custom binding strategy sees the base selector and the binding, and returns
// the selector that reads what the binding did not supply
const boundWithStrategy = createBoundSelector(
  twoPropsSelector,
  { personId: 1 },
  {
    bindingStrategy: (baseSelector, binding) => (state, props) =>
      baseSelector(state, { ...props, ...binding }),
  },
);
expectTypeOf(boundWithStrategy(stateFixture, { messageId: 100 })).toEqualTypeOf<
  Person | undefined
>();

// the binding must be a subset of the selector props
// @ts-expect-error - `unknownProp` is not a prop of the selector
createBoundSelector(personSelector, { unknownProp: 1 });

// binding every prop leaves an empty argument tuple rather than a selector that
// still tolerates props
// @ts-expect-error - nothing is left to pass once every prop is bound
boundSelector(stateFixture, { personId: 1 });

// @ts-expect-error - `messageId` is still required after binding `personId`
partiallyBoundSelector(stateFixture);

// either shape reads through the hook like any other selector
expectTypeOf(useSelector(boundSelector)).toEqualTypeOf<Person | undefined>();
expectTypeOf(useSelector(partiallyBoundSelector, { messageId: 100 })).toEqualTypeOf<
  Person | undefined
>();
