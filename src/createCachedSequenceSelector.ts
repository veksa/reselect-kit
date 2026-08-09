import { createSelector, Selector, SelectorResultArray } from '@veksa/reselect';
import { createCachedSelector, PolymorphicCachedOptions } from '@veksa/re-reselect';
import { createSequenceSelector } from './createSequenceSelector';
import { AnySelector, MergedParams, MergedState } from './types';

/**
 * The cached counterpart of {@link createSequenceSelector}. The inferred tuple
 * reaches `PolymorphicCachedOptions` as-is, so re-reselect types the caller's
 * `keySelector` with the exact arguments of the group.
 */
export function createCachedSequenceSelector<Selectors extends readonly AnySelector[]>(
  selectors: [...Selectors],
): (
  options: PolymorphicCachedOptions<Selectors, SelectorResultArray<Selectors>>,
) => Selector<MergedState<Selectors>, SelectorResultArray<Selectors>, MergedParams<Selectors>>;

export function createCachedSequenceSelector(selectors: any): any {
  return createSequenceSelector(
    selectors,
    createCachedSelector as unknown as typeof createSelector,
  );
}
