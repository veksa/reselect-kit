import { expectTypeOf } from 'expect-type';
import { createCachedSelector } from '@veksa/re-reselect';
import { createPathSelector } from '../src/index';
import { PersonProps, State } from './models';

type Nested = {
  user: {
    address: string;
    age?: number;
  };
};

const nested: Nested = { user: { address: 'street' } };

// required property keeps its exact type
const getUser = createPathSelector((state: Nested) => state.user);
const addressSelector = getUser.address();
expectTypeOf(addressSelector(nested)).toEqualTypeOf<string>();

// optional property is selected as its defined (non-nullable) type
const ageSelector = getUser.age();
expectTypeOf(ageSelector(nested)).toEqualTypeOf<number>();

// a default value can still be provided for an optional property
const ageWithDefaultSelector = getUser.age(0);
expectTypeOf(ageWithDefaultSelector(nested)).toEqualTypeOf<number>();

// an optional base selector result is callable directly
type OptionalPrimitive = { count?: number };
const getCount = createPathSelector((state: OptionalPrimitive) => state.count);
expectTypeOf(getCount()({ count: 1 })).toEqualTypeOf<number>();
expectTypeOf(getCount(5)({})).toEqualTypeOf<number>();

// arrays expose `length` and numeric index access
type WithList = {
  items: { id: number; tags: string[] }[];
};
const listState: WithList = { items: [] };
const getItems = createPathSelector((state: WithList) => state.items);

// numeric index access into an array element is fully supported
expectTypeOf(getItems[0]()(listState)).toEqualTypeOf<{
  id: number;
  tags: string[];
}>();
expectTypeOf(getItems[0].tags[0]()(listState)).toEqualTypeOf<string>();

// deeply nested access keeps narrowing types
const getFirstTag = createPathSelector((state: WithList) => state.items)[0].tags[0]();
expectTypeOf(getFirstTag(listState)).toEqualTypeOf<string>();

// parametric path selectors preserve the props type
const getPerson = createPathSelector(
  (state: State, props: PersonProps) => state.persons.data[props.personId],
);

const personIdSelector = getPerson.id();
expectTypeOf(
  personIdSelector(
    { persons: { data: {} }, messages: { data: {} } },
    {
      personId: 1,
    },
  ),
).toEqualTypeOf<number>();

const firstNameSelector = getPerson.firstName();
expectTypeOf(
  firstNameSelector(
    { persons: { data: {} }, messages: { data: {} } },
    {
      personId: 1,
    },
  ),
).toEqualTypeOf<string>();

// a cached base selector stays parametric through the path selector
const cachedPersonSelector = createCachedSelector(
  [(state: State) => state.persons, (state: State, props: PersonProps) => props.personId],
  (persons, personId) => persons.data[personId],
)({
  keySelector: (state: State, props: PersonProps) => props.personId,
});

const cachedFirstNameSelector = createPathSelector(cachedPersonSelector).firstName();
expectTypeOf(
  cachedFirstNameSelector(
    { persons: { data: {} }, messages: { data: {} } },
    {
      personId: 1,
    },
  ),
).toEqualTypeOf<string>();
