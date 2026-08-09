import { createSelector, Selector, SelectorResultsMap, SelectorsObject } from '@veksa/reselect';
import { createCachedSelector, PolymorphicCachedOptions } from '@veksa/re-reselect';
import { createStructuredSelector } from './createStructuredSelector';
import { MergedParams, MergedState, SelectorTuple } from './types';

/**
 * A single variadic signature replaces the former `Selector` / `ParametricSelector`
 * conditional: `state` and `props` are derived from the selectors object, so a
 * parametric input keeps its props type without a separate overload.
 *
 * The input selectors reach `PolymorphicCachedOptions` as the ordered tuple
 * rather than an array, which is what lets re-reselect type the user-supplied
 * `keySelector` with the exact `(state, props)` of the batch. Recovering that
 * order costs a type instantiation per key, so a selectors object of roughly
 * fifty entries or more exceeds what the compiler will unfold — the same limit
 * re-reselect's own `createStructuredCachedSelector` carries. The selector this
 * returns is unaffected; only the options argument depends on the order.
 */
export function createCachedStructuredSelector<M extends SelectorsObject>(
  selectors: M,
): (
  options: PolymorphicCachedOptions<SelectorTuple<M>, SelectorResultsMap<M>>,
) => Selector<MergedState<M>, SelectorResultsMap<M>, MergedParams<M>>;

export function createCachedStructuredSelector(selectors: any): any {
  return createStructuredSelector(
    selectors,
    createCachedSelector as unknown as typeof createSelector,
  );
}
