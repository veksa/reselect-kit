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
 * Normalises a group of selectors — an object or a tuple — into tuple form.
 *
 * Reserved for the places that need the order itself, such as typing
 * re-reselect's `keySelector` against the exact inputs. Merging `state` and the
 * arguments does not: {@link TuplifyUnion} recurses once per key and gives up
 * somewhere around fifty of them, and a batch of selectors has no reason to be
 * capped at a size a component could plausibly reach.
 */
export type SelectorTuple<Selectors> = Selectors extends readonly AnySelector[]
  ? Selectors
  : Selectors extends Record<string, AnySelector>
    ? ObjectValuesToTuple<Selectors>
    : never;

/** The values of a group of selectors, whether it is an object or a tuple. */
type SelectorsUnion<Selectors> = Selectors extends readonly AnySelector[]
  ? Selectors[number]
  : Selectors[keyof Selectors];

/**
 * The `state` argument of each selector in a union of them. Distributed over
 * the union rather than matched against it, so each member is read on its own.
 */
type StateOf<S> = S extends AnySelector ? Parameters<S>[0] : never;

/**
 * The `props` argument of each selector in a union of them, or `never` for the
 * ones that take none. The argument tuple is matched rather than the signature:
 * a selector of `state` alone is assignable to one that also takes `props`, and
 * would otherwise contribute `unknown`.
 */
type PropsOf<S> = S extends AnySelector
  ? Parameters<S> extends [any, infer Props, ...any[]]
    ? Props
    : never
  : never;

/**
 * The `state` every selector in the group accepts: the intersection of their
 * first arguments.
 */
export type MergedState<Selectors> = Selectors extends readonly AnySelector[]
  ? GetStateFromSelectors<Selectors>
  : UnionToIntersection<StateOf<SelectorsUnion<Selectors>>>;

/**
 * The extra arguments the group takes beyond `state`: `[]` when no selector is
 * parametric, `[Props]` when some are — with the `Props` of every parametric
 * selector intersected.
 *
 * A tuple of selectors is merged position by position, so a selector taking
 * more than `props` keeps its later arguments. An object is merged through the
 * union of its values instead, which stops at `props` but costs nothing per
 * key — see {@link SelectorTuple} for why the object cannot be tuplified here.
 */
export type MergedParams<Selectors> = Selectors extends readonly AnySelector[]
  ? GetParamsFromSelectors<Selectors>
  : [PropsOf<SelectorsUnion<Selectors>>] extends [never]
    ? []
    : [UnionToIntersection<PropsOf<SelectorsUnion<Selectors>>>];

/**
 * The same element-wise merge as {@link MergedParams}, for two argument tuples
 * that are already known — the case of a step-by-step composition, where each
 * step adds its own arguments to what the previous steps require.
 */
export type MergeParams<A extends readonly any[], B extends readonly any[]> = A extends readonly []
  ? B
  : B extends readonly []
    ? A
    : A extends readonly [infer AHead, ...infer ATail]
      ? B extends readonly [infer BHead, ...infer BTail]
        ? [AHead & BHead, ...MergeParams<ATail, BTail>]
        : A
      : B;
