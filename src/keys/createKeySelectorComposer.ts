import { KeySelector } from '@veksa/re-reselect';
import { MergedParams, MergedState } from '../types';

export const composedKeySelectorSymbol = Symbol.for('ComposedKeySelector');

/**
 * The loosest shape a key selector can take: a function of `state` plus any
 * number of extra arguments (props, ...). Used for variadic tuple inference.
 */
type AnyKeySelector = KeySelector<any>;

/**
 * The key selector produced by a {@link KeySelectorComposer}: a function that
 * intersects the `state` and the extra arguments of every composed key
 * selector, tagged with the original inputs as `dependencies`.
 */
export type OutputKeySelector<
  S,
  Params extends readonly any[],
  D extends readonly AnyKeySelector[],
> = ((state: S, ...params: Params) => unknown) & {
  dependencies: D;
};

/**
 * Composes N key selectors into a single one. A single variadic signature with
 * tuple inference replaces the former per-arity overload set; `state` and the
 * extra arguments are merged by the same helpers every other multi-selector
 * creator in the library uses.
 */
export type KeySelectorComposer = <Ks extends readonly AnyKeySelector[]>(
  ...keySelectors: Ks
) => OutputKeySelector<MergedState<Ks>, MergedParams<Ks>, Ks>;

export function isComposedKeySelector(
  keySelector: AnyKeySelector,
): keySelector is AnyKeySelector & { dependencies: AnyKeySelector[] } {
  return 'dependencies' in keySelector && composedKeySelectorSymbol in keySelector;
}

export function createKeySelectorComposer(
  baseKeySelectorComposer: (...keySelectors: AnyKeySelector[]) => AnyKeySelector,
): KeySelectorComposer {
  return ((...keySelectors: AnyKeySelector[]) => {
    const resultSelector = baseKeySelectorComposer(...keySelectors) as AnyKeySelector & {
      dependencies: AnyKeySelector[];
    };

    resultSelector.dependencies = keySelectors;

    Object.defineProperty(resultSelector, composedKeySelectorSymbol, {
      value: true,
    });

    return resultSelector;
  }) as KeySelectorComposer;
}
