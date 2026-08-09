import { createSelector, Selector, SelectorResultsMap, SelectorsObject } from '@veksa/reselect';
import { createCachedSelector, PolymorphicCachedOptions } from '@veksa/re-reselect';
import { createStructuredSelector } from './createStructuredSelector';
import { MergedParams, MergedState } from './types';

/**
 * The input selectors as re-reselect reads them when typing the caller's
 * `keySelector`: it takes `state` and the extra arguments off the group, and
 * both are already merged here. Putting the selectors back in key order would
 * type the arguments no more precisely and would cost a type instantiation per
 * key, capping the batch at roughly fifty fields.
 */
type StructuredInputs<M extends SelectorsObject> = Selector<
  MergedState<M>,
  unknown,
  MergedParams<M>
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
) => Selector<MergedState<M>, SelectorResultsMap<M>, MergedParams<M>>;

export function createCachedStructuredSelector(selectors: any): any {
  return createStructuredSelector(
    selectors,
    createCachedSelector as unknown as typeof createSelector,
  );
}
