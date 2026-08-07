import { createSelector, Selector, SelectorResultsMap, SelectorsObject } from '@veksa/reselect';
import { createCachedSelector, PolymorphicCachedOptions } from '@veksa/re-reselect';
import { createStructuredSelector } from './createStructuredSelector';
import { UnionToIntersection } from './types';

/** Intersection of the `state` argument of every selector in the object. */
type StructuredState<M extends SelectorsObject> = UnionToIntersection<
  { [K in keyof M]: Parameters<M[K]>[0] }[keyof M]
>;

/** Union of the `props` argument (position 1) of every parametric selector. */
type StructuredPropsUnion<M extends SelectorsObject> = {
  [K in keyof M]: Parameters<M[K]> extends [any, infer Props, ...any[]] ? Props : never;
}[keyof M];

/** The extra-arguments tuple: `[Props]` when any selector is parametric, else `[]`. */
type StructuredParams<M extends SelectorsObject> = [StructuredPropsUnion<M>] extends [never]
  ? []
  : [UnionToIntersection<StructuredPropsUnion<M>>];

/** The input selectors as reselect sees them, used to type the cached options. */
type StructuredInputs<M extends SelectorsObject> = Selector<
  StructuredState<M>,
  unknown,
  StructuredParams<M>
>[];

/**
 * A single variadic signature replaces the former `Selector` / `ParametricSelector`
 * conditional: `state` and `props` are derived from the selectors object, so a
 * parametric input keeps its props type without a separate overload.
 */
export function createCachedStructuredSelector<M extends SelectorsObject>(
  selectors: M,
): (
  options: PolymorphicCachedOptions<StructuredInputs<M>, SelectorResultsMap<M>>,
) => Selector<StructuredState<M>, SelectorResultsMap<M>, StructuredParams<M>>;

export function createCachedStructuredSelector(selectors: any): any {
  return createStructuredSelector(
    selectors,
    createCachedSelector as unknown as typeof createSelector,
  );
}
