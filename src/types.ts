import { Selector, SelectorArray } from '@veksa/reselect';
import { OutputCachedSelector } from '@veksa/re-reselect';

/**
 * A selector carrying optional debug metadata. In the unified model a
 * "parametric" selector is simply a selector whose `Params` tuple is non-empty,
 * so a single type covers both cases.
 *
 * @template Params - Extra arguments beyond `state` (e.g. `[Props]`).
 * @template D - The selector's dependency tuple, surfaced for debug tooling.
 */
export type NamedSelector<S, R, Params extends readonly any[] = [], D = unknown[]> = Selector<
  S,
  R,
  Params
> & {
  selectorName?: string;
  dependencies?: D;
};

/**
 * Back-compat alias: a parametric selector is a {@link NamedSelector} whose
 * single extra argument is `Props`.
 */
export type NamedParametricSelector<S, P, R, D = unknown[]> = NamedSelector<S, R, [P], D>;

export type ReReselectSelector = OutputCachedSelector<SelectorArray, unknown>;

export type CachedSelector = Pick<ReReselectSelector, 'cache' | 'keySelector'> &
  Partial<ReReselectSelector>;

export type Path = string[];

/**
 * Turns a union `A | B | C` into the intersection `A & B & C`. Not exported by
 * reselect, so kept here for the selector-composition helpers that need to
 * intersect the `state`/`props` of several selectors.
 */
export type UnionToIntersection<Union> = (
  Union extends unknown ? (distributed: Union) => void : never
) extends (merged: infer Intersection) => void
  ? Intersection
  : never;
