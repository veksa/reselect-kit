import { createSelector, Selector, SelectorResultArray } from '@veksa/reselect';
import { AnySelector, MergedParams, MergedState } from './types';

/**
 * Runs a group of selectors and collects their results positionally.
 *
 * The selectors are inferred as a tuple rather than an array, which is what
 * makes the result a tuple of the individual result types and lets `state` and
 * the extra arguments be merged per position. An array would collapse them into
 * a union and resolve everything past `state` to `never`, which is why the
 * plain and the parametric case used to need an overload each.
 */
export function createSequenceSelector<Selectors extends readonly AnySelector[]>(
  selectors: [...Selectors],
  selectorCreator?: typeof createSelector,
): Selector<MergedState<Selectors>, SelectorResultArray<Selectors>, MergedParams<Selectors>>;

export function createSequenceSelector(selectors: any, selectorCreator = createSelector) {
  return selectorCreator(selectors, (...results: unknown[]) => results);
}
