import { CachedSelector, NamedSelector } from './types';
import { isComposedKeySelector, KeySelectorComposer } from './keys/createKeySelectorComposer';
import { isPropSelector } from './createPropSelector';
import { excludeDefaultSelectors } from './keys/createKeySelectorCreator';
import { stringComposeKeySelectors } from './keys/stringComposeKeySelectors';
import { temporaryAssign } from './_helpers/temporaryAssign';
import { withDebugName } from './debug/withDebugName';
import { getSelectorName } from './_helpers/getSelectorName';
import { isCachedSelector } from './_helpers/isCachedSelector';
import { isObject } from './_helpers/isObject';
import { getObjectPaths } from './_helpers/getObjectPaths';
import { arePathsEqual } from './_helpers/arePathsEqual';
import { defaultKeySelector } from './keys/defaultKeySelector';

const generateBindingName = <P extends object>(binding: P) => {
  const structure = Object.keys(binding).reduce(
    (result, key) => ({
      ...result,
      [key]: '[*]',
    }),
    {},
  );
  const structureKeys = Object.keys(structure).join();
  const structureValues = Object.values(structure).join();

  return `${structureKeys} -> ${structureValues}`;
};

/**
 * The bound selector: what the binding did not supply is what is left to pass.
 * A binding covering every prop leaves an empty argument tuple, which is what a
 * plain selector is in the unified model — so one type covers both cases.
 *
 * The outer condition is the guard against binding a prop the base selector
 * declares as optional with a value that is not.
 */
export type BoundSelector<S, P2, P1 extends Partial<P2>, R> =
  P2 extends Pick<P1, keyof P2>
    ? NamedSelector<S, R, Exclude<keyof P1, keyof P2> extends never ? [] : [Omit<P1, keyof P2>]>
    : never;

export type BoundSelectorOptions<S, P2, P1 extends Partial<P2>, R> = {
  bindingStrategy?: (
    baseSelector: (state: S, props: P1) => R,
    binding: P2,
  ) => (state: S, props: Omit<P1, keyof P2>) => R;
  keySelectorComposer?: KeySelectorComposer;
};

const innerCreateBoundSelector = <S, P2, P1 extends Partial<P2>, R>(
  baseSelector: (state: S, props: P1) => R,
  binding: P2,
) => {
  const boundSelector = (state: S, props: Omit<P1, keyof P2> | void) =>
    baseSelector(state, {
      ...props,
      ...binding,
    } as unknown as P1);

  return boundSelector as unknown as BoundSelector<S, P2, P1, R>;
};

const createBoundInnerSelector = <S, P2 extends object, P1 extends Partial<P2>, R, OR extends R>(
  baseSelector: (state: S, props: P1) => R,
  binding: P2,
  options: BoundSelectorOptions<S, P2, P1, OR> = {},
): BoundSelector<S, P2, P1, R> => {
  const bindingStrategy =
    (options.bindingStrategy as typeof innerCreateBoundSelector) ?? innerCreateBoundSelector;

  const keySelectorComposer = options.keySelectorComposer ?? stringComposeKeySelectors;

  const boundSelector = bindingStrategy(baseSelector, binding);

  Object.assign(boundSelector, baseSelector);
  boundSelector.dependencies = [baseSelector];

  withDebugName(boundSelector, () => {
    const baseName = getSelectorName(baseSelector);
    const bindingName = generateBindingName(binding);

    return `${baseName} (${bindingName})`;
  });

  if (isCachedSelector(baseSelector)) {
    const cachedBoundSelector = boundSelector as unknown as CachedSelector;

    if (baseSelector.getMatchingSelector) {
      cachedBoundSelector.getMatchingSelector = bindingStrategy(
        baseSelector.getMatchingSelector,
        binding,
      );
    }

    if (baseSelector.removeMatchingSelector) {
      cachedBoundSelector.removeMatchingSelector = bindingStrategy(
        baseSelector.removeMatchingSelector,
        binding,
      );
    }

    const baseKeySelector = baseSelector.keySelector;

    if (isObject(binding)) {
      const paths = getObjectPaths(binding);
      let keySelectors = isComposedKeySelector(baseKeySelector)
        ? baseKeySelector.dependencies
        : [baseKeySelector];

      keySelectors = excludeDefaultSelectors(keySelectors);

      keySelectors = keySelectors
        .filter(
          (keySelector) =>
            !isPropSelector(keySelector) ||
            !paths.some((path) => arePathsEqual(keySelector.path, path)),
        )
        .map((keySelector) =>
          isPropSelector(keySelector) ? keySelector : bindingStrategy(keySelector, binding),
        );

      if (keySelectors.length === 0) {
        cachedBoundSelector.keySelector = defaultKeySelector;
      } else if (keySelectors.length === 1) {
        const [keySelector] = keySelectors;
        cachedBoundSelector.keySelector = keySelector;
      } else {
        cachedBoundSelector.keySelector = keySelectorComposer(...keySelectors);
      }
    } else {
      cachedBoundSelector.keySelector = bindingStrategy(baseKeySelector, binding);
    }
  }

  return boundSelector;
};

export const createBoundSelector: typeof createBoundInnerSelector = (baseSelector, binding) => {
  return createBoundInnerSelector(baseSelector, binding, {
    bindingStrategy: (selector, bindingProps) => {
      const source = bindingProps as unknown as Record<string, unknown>;
      const keys = Object.keys(source);

      /**
       * Almost every binding is a single key — `bound(selector, { positionId })` —
       * and specialising it removes the two allocations the generic path costs per
       * call: the `{ result, rollback }` object and the `rollback` closure. On a
       * graph with a bound selector per row those are the calls that dominate.
       *
       * The `delete` in the restore stays deliberately. Leaving the key behind as
       * `undefined` would be cheaper — it avoids putting the caller's props object
       * into dictionary mode — but it also changes the object's shape, and
       * `useSelector` memoizes props shallowly: a props object that has grown an
       * extra key never again compares equal to a freshly built one, so the
       * memoization the binding exists to protect would be defeated.
       */
      if (keys.length === 1) {
        const key = keys[0];
        const value = source[key];

        return (state, props) => {
          const target = props as unknown as Record<string, unknown>;

          if (typeof target !== 'object' || target === null) {
            return selector(state, source as Parameters<typeof baseSelector>[1]);
          }

          const previous = target[key];

          // A re-entrant call that finds the binding already applied has nothing to
          // save and nothing to restore.
          if (previous === value) {
            return selector(state, props as Parameters<typeof baseSelector>[1]);
          }

          const had = Object.prototype.hasOwnProperty.call(target, key);
          target[key] = value;

          try {
            return selector(state, props as Parameters<typeof baseSelector>[1]);
          } finally {
            if (had) {
              target[key] = previous;
            } else {
              delete target[key];
            }
          }
        };
      }

      return (state, props) => {
        const { result: nextProps, rollback } = temporaryAssign(props, source);
        const result = selector(state, nextProps as Parameters<typeof baseSelector>[1]);
        rollback();
        return result;
      };
    },
  });
};
