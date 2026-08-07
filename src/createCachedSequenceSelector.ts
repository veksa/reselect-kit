import { createSelector, Selector } from '@veksa/reselect';
import { createCachedSelector, PolymorphicCachedOptions } from '@veksa/re-reselect';
import { createSequenceSelector } from './createSequenceSelector';

export function createCachedSequenceSelector<S, R>(
  selectors: Selector<S, R>[],
): (options: PolymorphicCachedOptions<Selector<S, R>[], R[]>) => Selector<S, R[]>;

export function createCachedSequenceSelector<S, P, R>(
  selectors: Selector<S, R, [P]>[],
): (options: PolymorphicCachedOptions<Selector<S, R, [P]>[], R[]>) => Selector<S, R[], [P]>;

export function createCachedSequenceSelector(selectors: any): any {
  return createSequenceSelector(
    selectors,
    createCachedSelector as unknown as typeof createSelector,
  );
}
