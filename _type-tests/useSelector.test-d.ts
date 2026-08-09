import { expectTypeOf } from 'expect-type';
import { Selector } from '@veksa/reselect';
import { useSelector } from '../src/index';
import { Person, PersonProps, State } from './models';

// plain selector returns its result type
const currentPersonId = useSelector((state: State) => state.persons.currentPersonId ?? 0);
expectTypeOf(currentPersonId).toEqualTypeOf<number>();

// parametric selector requires props and returns its result type
const personId = useSelector((state: State, props: PersonProps) => props.personId, { personId: 1 });
expectTypeOf(personId).toEqualTypeOf<number>();

// a selector declared as a reselect `Selector` is read the same way
declare const getPerson: Selector<State, Person, [PersonProps]>;
expectTypeOf(useSelector(getPerson, { personId: 1 })).toEqualTypeOf<Person>();

declare const getPersonCount: Selector<State, number>;
expectTypeOf(useSelector(getPersonCount)).toEqualTypeOf<number>();

// @ts-expect-error - props are required when the selector is parametric
useSelector((state: State, props: PersonProps) => props.personId);

// @ts-expect-error - props are not accepted when the selector takes none
useSelector((state: State) => state.persons, { personId: 1 });

// @ts-expect-error - the props argument is checked against what the selector declares
useSelector((state: State, props: PersonProps) => props.personId, { messageId: 1 });
