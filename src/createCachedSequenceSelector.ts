import { createSelector, Selector, SelectorResultArray } from '@veksa/reselect';
import { createCachedSelector, PolymorphicCachedOptions } from '@veksa/re-reselect';
import { createSequenceSelector } from './createSequenceSelector';
import { AnySelector, MergedParams, MergedState, WithKeyParams } from './types';

/**
 * The cached counterpart of {@link createSequenceSelector}. The inferred tuple
 * reaches `PolymorphicCachedOptions` as-is, so re-reselect types the caller's
 * `keySelector` with the exact arguments of the group.
 *
 * `KeyParams` defaults to those arguments, which is what an inline `keySelector`
 * gets typed from. A `keySelector` that reads props of its own — keying a group
 * of bound selectors by `accountId`, say, where no member declares it — sets it
 * instead, and those props join the group's own on the resulting selector.
 */
export function createCachedSequenceSelector<Selectors extends readonly AnySelector[]>(
  selectors: [...Selectors],
): <KeyParams extends readonly any[] = MergedParams<Selectors>>(
  options: PolymorphicCachedOptions<Selectors, SelectorResultArray<Selectors>, KeyParams>,
) => Selector<
  MergedState<Selectors>,
  SelectorResultArray<Selectors>,
  WithKeyParams<MergedParams<Selectors>, KeyParams>
>;

export function createCachedSequenceSelector(selectors: any): any {
  return createSequenceSelector(
    selectors,
    createCachedSelector as unknown as typeof createSelector,
  );
}
