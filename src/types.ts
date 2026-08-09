import {
  GetParamsFromSelectors,
  GetStateFromSelectors,
  Selector,
  SelectorArray,
} from '@veksa/reselect';
import { OutputCachedSelector } from '@veksa/re-reselect';

/**
 * The loosest shape a selector can take: a function of `state` plus any number
 * of extra arguments. Used as the constraint for variadic tuple inference.
 */
export type AnySelector = (state: any, ...params: any[]) => any;

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

/** The last member of a union, used to peel a union apart one type at a time. */
type LastOf<Union> =
  UnionToIntersection<Union extends unknown ? () => Union : never> extends () => infer Last
    ? Last
    : never;

/** Turns a union into a tuple by repeatedly peeling off its last member. */
type TuplifyUnion<
  Union,
  Last = LastOf<Union>,
  IsDone = [Union] extends [never] ? true : false,
> = true extends IsDone ? [] : [...TuplifyUnion<Exclude<Union, Last>>, Last];

/**
 * Type-level `Object.values()`: `{ foo: Selector, bar: Selector }` becomes the
 * ordered tuple `[Selector, Selector]`.
 *
 * The tuple is what reselect's parameter merging needs: an unordered
 * `Array<M[keyof M]>` collapses the selectors into a union and loses the
 * per-position arguments, so `props` resolves to `never`.
 */
export type ObjectValuesToTuple<
  M extends Record<string, AnySelector>,
  Keys extends any[] = TuplifyUnion<keyof M>,
  Result extends AnySelector[] = [],
> = Keys extends [infer Key, ...infer Rest]
  ? ObjectValuesToTuple<M, Rest, [...Result, M[Key & keyof M]]>
  : Result;

/**
 * Normalises a group of selectors — an object or a tuple — into the tuple form
 * that {@link MergedState} and {@link MergedParams} merge over.
 */
export type SelectorTuple<Selectors> = Selectors extends readonly AnySelector[]
  ? Selectors
  : Selectors extends Record<string, AnySelector>
    ? ObjectValuesToTuple<Selectors>
    : never;

/**
 * The `state` every selector in the group accepts: the intersection of their
 * first arguments.
 */
export type MergedState<Selectors> = GetStateFromSelectors<SelectorTuple<Selectors>>;

/**
 * The extra arguments the group takes beyond `state`, merged element-wise:
 * `[]` when no selector is parametric, `[Props]` when some are — with the
 * `Props` of every parametric selector intersected.
 */
export type MergedParams<Selectors> = GetParamsFromSelectors<SelectorTuple<Selectors>>;
