import { createSelector, createSelectorCreator, Selector } from '@veksa/reselect';
import { createCachedSelector, ICacheObject, KeySelector } from '@veksa/re-reselect';
import { KeySelectorComposer } from './keys/createKeySelectorComposer';
import { isCachedSelector } from './_helpers/isCachedSelector';
import { defaultKeySelector } from './keys/defaultKeySelector';
import { stringComposeKeySelectors } from './keys/stringComposeKeySelectors';
import { createKeySelectorCreator } from './keys/createKeySelectorCreator';
import { MergeParams } from './types';
import { runInDebug, withDebugName } from './debug/withDebugName';
import { defineDynamicSelectorName } from './_helpers/defineDynamicSelectorName';
import { getSelectorName } from './_helpers/getSelectorName';
import { generateSelectorKey } from './_helpers/generateSelectorKey';
import { stringifyFunction } from './_helpers/stringifyFunction';

/**
 * A chain step: given the previous level's result, it returns the selector the
 * next level reads. `Params` is empty for a step that only needs `state`, so a
 * single type covers what used to be a plain and a parametric variant.
 */
export type SelectorChain<R1, S1, R2, Params extends readonly any[] = []> = (
  result: R1,
) => Selector<S1, R2, Params>;

export type SelectorChainHierarchy<
  C extends SelectorChain<any, any, any, any>,
  H extends SelectorChainHierarchy<any, any>,
> = C & { parentChain?: H };

export type CreateSelectorOptions<SelectorCreator extends typeof createSelectorCreator> = {
  selectorCreator: ReturnType<SelectorCreator>;
  cacheObject: ICacheObject;
};

export type ChainSelectorOptions<
  SelectorCreator extends typeof createSelectorCreator = typeof createSelectorCreator,
> = {
  createSelectorOptions?: () => CreateSelectorOptions<SelectorCreator>;
  keySelectorComposer?: KeySelectorComposer;
};

/**
 * Every level of the chain carries the arguments its selector needs. A level
 * that only reads `state` leaves `Params` empty, and one that reads props adds
 * them — so a step introducing props makes them required for the whole built
 * selector, whether or not the base selector had any.
 */
interface ChainSelectorResult<S1, R1, Params extends readonly any[]> {
  chain: <S2, R2, Params2 extends readonly any[]>(
    fn: (result: R1) => (state: S2, ...params: Params2) => R2,
    chainOptions?: ChainSelectorOptions,
  ) => ChainSelectorResult<S1 & S2, R2, MergeParams<Params, Params2>>;
  map: <R2>(
    fn: (result: R1) => R2,
    mapOptions?: ChainSelectorOptions,
  ) => ChainSelectorResult<S1, R2, Params>;
  build: () => Selector<S1, R1, Params> & {
    chainHierarchy: SelectorChainHierarchy<any, any> | undefined;
  };
}

export function createChainSelector<S1, R1, Params extends readonly any[]>(
  selector: (state: S1, ...params: Params) => R1,
  options?: ChainSelectorOptions,
  prevChain?: SelectorChainHierarchy<any, any>,
): ChainSelectorResult<S1, R1, Params>;

export function createChainSelector(
  selector: any,
  options?: ChainSelectorOptions,
  prevChain?: any,
): any {
  const createLevel = (
    fn: any,
    chainOptions: ChainSelectorOptions | undefined,
    isDerivedKeyless: boolean,
  ) => {
    const combinedOptions = {
      ...options,
      ...chainOptions,
    };

    const keySelector = isCachedSelector(selector) ? selector.keySelector : defaultKeySelector;

    const { createSelectorOptions = () => ({}), keySelectorComposer = stringComposeKeySelectors } =
      combinedOptions;

    const keySelectorCreator = createKeySelectorCreator(keySelectorComposer);

    /**
     * Nothing below this level is keyed, so the cache would hold a single entry
     * for the lifetime of the chain and every call would still pay for the key
     * computation and the lookup that guard it. A plain memoized selector is the
     * same mapping — re-reselect under a constant key is one `createSelector`
     * instance — without the layer.
     */
    const isKeyless = keySelector === defaultKeySelector;

    const selectorOptions = createSelectorOptions() as Partial<CreateSelectorOptions<any>>;

    const higherOrderSelector = isKeyless
      ? ((selectorOptions.selectorCreator ?? createSelector) as typeof createSelector)(
          [selector],
          fn,
        )
      : createCachedSelector(
          [selector],
          fn,
        )({
          ...selectorOptions,
          keySelector,
        });

    withDebugName(higherOrderSelector, () => {
      const baseName = getSelectorName(selector);

      return `higher order for ${baseName} (${stringifyFunction(fn)})`;
    });

    type CombineSelector = Selector<any, any, [any]> & {
      dependencies: any;
      cache?: ICacheObject;
      keySelector?: KeySelector<any>;
    };

    const combinedSelector: CombineSelector = (state: any, props: any): any => {
      const derivedSelector: any = (higherOrderSelector as any)(state, props);

      runInDebug(() => {
        // Debug-only: shows the branch this call took. Nothing outside the debug
        // tooling reads it, so in production it was an array allocated per call and
        // abandoned. The static `[higherOrderSelector]` below still stands.
        combinedSelector.dependencies = [higherOrderSelector, derivedSelector];

        const derivedSelectorName = getSelectorName(derivedSelector);

        if (!derivedSelectorName) {
          defineDynamicSelectorName(derivedSelector, () => {
            const baseName = getSelectorName(selector);
            const derivedSelectorKey = generateSelectorKey(derivedSelector);

            return `derived from ${baseName} (${derivedSelectorKey})`;
          });
        }

        defineDynamicSelectorName(combinedSelector, () => {
          const baseName = getSelectorName(selector);
          const dependencyName = getSelectorName(derivedSelector);

          return `${baseName} (chained by ${dependencyName})`;
        });
      });

      return derivedSelector(state, props);
    };

    combinedSelector.dependencies = [higherOrderSelector];

    if (!isKeyless) {
      combinedSelector.cache = (higherOrderSelector as unknown as { cache: ICacheObject }).cache;
    }

    /**
     * Assigned through a local and written to the selector once. Assigning the
     * property in both branches instead reads as two expando declarations of
     * `keySelector` to TypeScript before 7, which rejects it as a duplicate
     * identifier.
     */
    let levelKeySelector: KeySelector<any>;

    if (isDerivedKeyless) {
      /**
       * A `map` level derives a plain `() => output`, never a cached selector, so
       * it contributes nothing to the composed key and the whole composition is
       * known at build time. It is the same call the wrapper below makes, minus
       * the derived selector — so the key is composed exactly as before, once,
       * instead of on every key computation of every level above.
       */
      levelKeySelector = keySelectorCreator({
        inputSelectors: [higherOrderSelector],
      }) as KeySelector<any>;
    } else {
      /**
       * The derived selector's key selector, memoized on the derived selector itself.
       *
       * This used to be a second `createCachedSelector` over `[higherOrderSelector]`,
       * which meant every key computation paid a whole extra cached-selector layer —
       * its own key computation, its own cache lookup, and its own evaluation of
       * `higherOrderSelector` — to produce a value that depends on nothing but the
       * derived selector. A `WeakMap` keyed on that selector is the same mapping with
       * none of the layer, and it shares across cache keys rather than per key.
       *
       * Note what is deliberately *not* memoized: the `(state, props)` pair. `props`
       * is mutated in place by `createBoundSelector`, so two calls can pass the same
       * object reference with different contents, and a reference-keyed cache would
       * hand back a stale selector.
       */
      const derivedKeySelectors = new WeakMap<object, KeySelector<any>>();

      levelKeySelector = (state: any, props: any) => {
        const derivedSelector: any = (higherOrderSelector as any)(state, props);

        let derivedKeySelector = derivedKeySelectors.get(derivedSelector);

        if (derivedKeySelector === undefined) {
          derivedKeySelector = keySelectorCreator({
            inputSelectors: [higherOrderSelector, derivedSelector],
          }) as KeySelector<any>;

          derivedKeySelectors.set(derivedSelector, derivedKeySelector);
        }

        return (derivedKeySelector as any)(state, props);
      };
    }

    /**
     * When nothing keyed is left the composition yields the default key, and
     * leaving the property off is what lets the next level skip its cache too.
     * The wrapper above is a fresh closure, so only a `map` level can land here
     * with the default.
     */
    if (levelKeySelector !== defaultKeySelector) {
      combinedSelector.keySelector = levelKeySelector;
    }

    withDebugName(combinedSelector, () => {
      const baseName = getSelectorName(selector);

      return `${baseName} (will be chained ${stringifyFunction(fn)})`;
    });

    const nextPrevChain = Object.assign(fn, {
      parentChain: prevChain,
    });

    return createChainSelector(combinedSelector, combinedOptions, nextPrevChain);
  };

  const chain = (fn: any, chainOptions?: ChainSelectorOptions) => {
    return createLevel(fn, chainOptions, false);
  };

  const map = (fn: (result: any) => any, mapOptions?: ChainSelectorOptions) => {
    const mapSelector = (result: any) => {
      const output = fn(result);
      const mapSelector = () => output;

      withDebugName(mapSelector, () => {
        const baseName = getSelectorName(selector);

        return `mapped from ${baseName} (${stringifyFunction(fn)})`;
      });

      return mapSelector;
    };

    return createLevel(mapSelector, mapOptions, true);
  };

  const build = () => {
    return Object.assign(selector, {
      chainHierarchy: prevChain,
    });
  };

  return {
    chain,
    map,
    build,
  };
}
