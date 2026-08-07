import { KeySelector } from '@veksa/re-reselect';
import { UnionToIntersection } from '../types';

export const composedKeySelectorSymbol = Symbol.for('ComposedKeySelector');

/**
 * The loosest shape a key selector can take: a function of `state` plus any
 * number of extra arguments (props, ...). Used for variadic tuple inference.
 */
type AnyKeySelector = KeySelector<any>;

/** Intersection of every input key selector's `state` argument. */
type ComposedState<Ks extends readonly AnyKeySelector[]> = UnionToIntersection<
  { [Index in keyof Ks]: Parameters<Ks[Index]>[0] }[number]
>;

/** Union of every input key selector's `props` argument (position 1), if any. */
type PropsUnion<Ks extends readonly AnyKeySelector[]> = {
  [Index in keyof Ks]: Parameters<Ks[Index]> extends [any, infer Props, ...any[]] ? Props : never;
}[number];

/** Intersection of every input key selector's `props`, or `never` if none are parametric. */
type ComposedProps<Ks extends readonly AnyKeySelector[]> = [PropsUnion<Ks>] extends [never]
  ? never
  : UnionToIntersection<PropsUnion<Ks>>;

/**
 * The key selector produced by a {@link KeySelectorComposer}: a function that
 * intersects the `state` (and `props`, when any input is parametric) of every
 * composed key selector, tagged with the original inputs as `dependencies`.
 */
export type OutputKeySelector<S, P, D extends readonly AnyKeySelector[]> = ([P] extends [never]
  ? (state: S) => unknown
  : (state: S, props: P) => unknown) & {
  dependencies: D;
};

/**
 * Composes N key selectors into a single one. A single variadic signature with
 * tuple inference replaces the former per-arity overload set.
 */
export type KeySelectorComposer = <Ks extends readonly AnyKeySelector[]>(
  ...keySelectors: Ks
) => OutputKeySelector<ComposedState<Ks>, ComposedProps<Ks>, Ks>;

export function isComposedKeySelector(
  keySelector: AnyKeySelector,
): keySelector is AnyKeySelector & { dependencies: AnyKeySelector[] } {
  return 'dependencies' in keySelector && composedKeySelectorSymbol in keySelector;
}

export function createKeySelectorComposer(
  baseKeySelectorComposer: (...keySelectors: AnyKeySelector[]) => AnyKeySelector,
): KeySelectorComposer {
  return ((...keySelectors: AnyKeySelector[]) => {
    const resultSelector = baseKeySelectorComposer(...keySelectors) as AnyKeySelector & {
      dependencies: AnyKeySelector[];
    };

    resultSelector.dependencies = keySelectors;

    Object.defineProperty(resultSelector, composedKeySelectorSymbol, {
      value: true,
    });

    return resultSelector;
  }) as KeySelectorComposer;
}
