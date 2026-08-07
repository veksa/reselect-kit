import { expectTypeOf } from 'expect-type';
import { KeySelector } from '@veksa/re-reselect';
import {
  defaultKeySelector,
  stringComposeKeySelectors,
  arrayComposeKeySelectors,
  createKeySelectorComposer,
  createKeySelectorCreator,
} from '../src/index';
import { DocumentProps, MessageProps, PersonProps, State } from './models';

// In the unified model a "parametric" key selector is simply a function of
// state + props; the composer preserves the exact input functions as its
// `dependencies` tuple.
type ParametricKeySelector<S, P> = (state: S, props: P) => unknown;

// the default key selector always produces a string key
expectTypeOf(defaultKeySelector()).toEqualTypeOf<string>();

// a single plain key selector is wrapped into an output key selector
const singleComposed = stringComposeKeySelectors(
  (state: State) => state.persons.currentPersonId ?? 0,
);
expectTypeOf(singleComposed).toExtend<KeySelector<State>>();
expectTypeOf(singleComposed.dependencies).toEqualTypeOf<[(state: State) => number]>();

// composing two parametric key selectors intersects state and props types
const composedKeySelector = stringComposeKeySelectors(
  (state: State, props: PersonProps) => props.personId,
  (state: State, props: MessageProps) => props.messageId,
);

expectTypeOf(composedKeySelector).toExtend<
  ParametricKeySelector<State, PersonProps & MessageProps>
>();
expectTypeOf(composedKeySelector.dependencies).toEqualTypeOf<
  [(state: State, props: PersonProps) => number, (state: State, props: MessageProps) => number]
>();

// composing three parametric key selectors keeps intersecting the props types
const tripleComposed = stringComposeKeySelectors(
  (state: State, props: PersonProps) => props.personId,
  (state: State, props: MessageProps) => props.messageId,
  (state: State, props: DocumentProps) => props.documentId,
);
expectTypeOf(tripleComposed).toExtend<
  ParametricKeySelector<State, PersonProps & MessageProps & DocumentProps>
>();
expectTypeOf(tripleComposed.dependencies).toEqualTypeOf<
  [
    (state: State, props: PersonProps) => number,
    (state: State, props: MessageProps) => number,
    (state: State, props: DocumentProps) => number,
  ]
>();

// the array composer shares the composer signature
expectTypeOf(arrayComposeKeySelectors).toEqualTypeOf(stringComposeKeySelectors);
const arrayComposed = arrayComposeKeySelectors(
  (state: State, props: PersonProps) => props.personId,
  (state: State, props: MessageProps) => props.messageId,
);
expectTypeOf(arrayComposed).toExtend<ParametricKeySelector<State, PersonProps & MessageProps>>();

// a custom composer can be built from a base composer
const customComposer = createKeySelectorComposer(
  (...keySelectors) =>
    (state, props) =>
      keySelectors.map((keySelector) => keySelector(state, props)).join(),
);
expectTypeOf(customComposer).toEqualTypeOf(stringComposeKeySelectors);

// the key selector creator returns a factory of key selectors
const keySelectorCreator = createKeySelectorCreator(stringComposeKeySelectors);
expectTypeOf(keySelectorCreator).toBeFunction();
const composedByCreator = keySelectorCreator<State, KeySelector<State>[]>({
  inputSelectors: [(state: State) => state.persons],
});
expectTypeOf(composedByCreator).toExtend<KeySelector<State>>();
