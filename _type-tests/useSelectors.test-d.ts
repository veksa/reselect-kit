import { expectTypeOf } from 'expect-type';
import { useSelectors } from '../src/index';
import { Person, PersonProps, State } from './models';

// a batch of parametric selectors requires props and returns one result object
const personView = useSelectors(
  {
    id: (state: State, props: PersonProps) => props.personId,
    person: (state: State, props: PersonProps): Person | undefined =>
      state.persons.data[props.personId],
  },
  { personId: 1 },
);

expectTypeOf(personView).toEqualTypeOf<{ id: number; person: Person | undefined }>();

// a batch of plain selectors takes no props
const counters = useSelectors({
  persons: (state: State) => Object.keys(state.persons.data).length,
  messages: (state: State) => Object.keys(state.messages.data).length,
});

expectTypeOf(counters).toEqualTypeOf<{ persons: number; messages: number }>();

// @ts-expect-error - props are not accepted when no selector is parametric
useSelectors({ persons: (state: State) => state.persons }, { personId: 1 });

// @ts-expect-error - props are required when a selector is parametric
useSelectors({ id: (state: State, props: PersonProps) => props.personId });

// a selector that declares its props optional leaves them optional for the batch
declare const optionalProps: (state: State, props?: PersonProps) => number;

expectTypeOf(useSelectors({ value: optionalProps })).toEqualTypeOf<{ value: number }>();
expectTypeOf(useSelectors({ value: optionalProps }, { personId: 1 })).toEqualTypeOf<{
  value: number;
}>();

// one selector requiring props makes them required for the whole batch
const mixed = useSelectors(
  {
    optional: optionalProps,
    required: (state: State, props: PersonProps) => props.personId,
  },
  { personId: 1 },
);

expectTypeOf(mixed).toEqualTypeOf<{ optional: number; required: number }>();

// @ts-expect-error - props are required once one selector of the batch requires them
useSelectors({ optional: optionalProps, required: (s: State, p: PersonProps) => p.personId });
