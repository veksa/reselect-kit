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
 * The `props` argument of the selectors in a union that require one, or `never`
 * for the ones that take none. The argument tuple is matched rather than the
 * signature: a selector of `state` alone is assignable to one that also takes
 * `props`, and would otherwise contribute `unknown`.
 */
type RequiredPropsOf<S> = S extends AnySelector
  ? Parameters<S> extends [any, infer Props, ...any[]]
    ? Props
    : never
  : never;

/**
 * The `props` argument of the selectors in a union that accept one without
 * requiring it. An optional argument does not match the tuple pattern above,
 * which is why it needs a pattern of its own; `undefined` is what the optional
 * marker contributes and is dropped, so that intersecting the props of the
 * group does not collapse to `never`.
 *
 * A selector that leaves its arguments open — `Selector<State, Result>` is
 * `(state, ...args: any[]) => Result` — declares no props at all and must
 * contribute nothing, or its `any` would swallow the props of every other
 * selector in the group. It is told apart by the length of what follows
 * `state`: an optional argument gives a finite `0 | 1`, a rest gives `number`.
 */
type OptionalPropsOf<S> = S extends AnySelector
  ? Parameters<S> extends [any, any, ...any[]]
    ? never
    : Parameters<S> extends [any, ...infer Rest]
      ? number extends Rest['length']
        ? never
        : Rest extends readonly []
          ? never
          : Exclude<Rest[0], undefined>
      : never
  : never;

/**
 * The `state` every selector in the group accepts: the intersection of their
 * first arguments. An empty group constrains nothing, so it reads `unknown`
 * rather than the `never` an intersection of no members would otherwise give.
 */
export type MergedState<Selectors> = Selectors extends readonly []
  ? unknown
  : Selectors extends readonly AnySelector[]
    ? GetStateFromSelectors<Selectors>
    : UnionToIntersection<StateOf<SelectorsUnion<Selectors>>>;

/**
 * The props of a union of selectors, as the argument tuple that reads all of
 * them: empty when none takes props, optional when every selector that takes
 * them declares them optional, required as soon as one selector requires them.
 * The props themselves are intersected, so the argument satisfies each member.
 */
type UnionProps<Union, Required = RequiredPropsOf<Union>, Optional = OptionalPropsOf<Union>> = [
  Required,
] extends [never]
  ? [Optional] extends [never]
    ? []
    : [props?: UnionToIntersection<Optional>]
  : [props: UnionToIntersection<Required | Optional>];

/**
 * The extra arguments the group takes beyond `state`: `[]` when no selector is
 * parametric, `[Props]` when some are — with the `Props` of every parametric
 * selector intersected.
 *
 * A tuple of selectors is merged position by position, so a selector taking
 * more than `props` keeps its later arguments. An object is merged through the
 * union of its values instead, which stops at `props` but costs nothing per
 * key: the keys carry no order worth recovering, and a batch of selectors has
 * no reason to be capped at a size a component could plausibly reach.
 */
export type MergedParams<Selectors> = Selectors extends readonly AnySelector[]
  ? GetParamsFromSelectors<Selectors>
  : UnionProps<SelectorsUnion<Selectors>>;

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

/**
 * The arguments of a cached selector: the ones its inputs declare, widened by
 * any the keySelector declares on top of them.
 *
 * A key that only reads what the inputs already declare leaves them exactly as
 * they are. Merging in that case would be lossy rather than additive: an inline
 * `keySelector` writes its parameter without a `?` even when the batch's own is
 * optional, and intersecting the two would make the whole selector demand it.
 */
export type WithKeyParams<
  InputParams extends readonly any[],
  KeyParams extends readonly any[],
> = KeyParams extends InputParams ? InputParams : MergeParams<InputParams, KeyParams>;
