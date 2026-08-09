import { expectTypeOf } from 'expect-type';
import { createAdaptedSelector, useSelector, useSelectors } from '../src/index';
import { Person, State } from './models';

const stateFixture: State = {
  persons: { data: {} },
  messages: { data: {} },
};

const personByNameSelector = (state: State, props: { name: string }): Person | undefined =>
  Object.values(state.persons.data).find((person) => person.name === props.name);

// the adapter maps the outer props shape to the inner one
const adaptedSelector = createAdaptedSelector(
  personByNameSelector,
  (props: { personName: string }) => ({ name: props.personName }),
);

expectTypeOf(adaptedSelector).parameter(0).toEqualTypeOf<State>();
expectTypeOf(adaptedSelector).parameter(1).toEqualTypeOf<{ personName: string }>();
expectTypeOf(
  adaptedSelector(stateFixture, {
    personName: 'Marry',
  }),
).toEqualTypeOf<Person | undefined>();

// the adapted props replace the base ones, they do not widen them
// @ts-expect-error - `name` is what the base selector reads, not what the adapted one takes
adaptedSelector(stateFixture, { name: 'Marry' });

// the mapping has to produce the props the base selector reads
createAdaptedSelector(
  personByNameSelector,
  // @ts-expect-error - the base selector reads `name`, not `personName`
  (props: { personName: string }) => ({ personName: props.personName }),
);

// the adapted selector is one argument beyond state, so it feeds the hooks like
// any other selector
expectTypeOf(useSelector(adaptedSelector, { personName: 'Marry' })).toEqualTypeOf<
  Person | undefined
>();
expectTypeOf(useSelectors({ person: adaptedSelector }, { personName: 'Marry' })).toEqualTypeOf<{
  person: Person | undefined;
}>();
