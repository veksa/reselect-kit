import { CachedSelector, NamedSelector } from './types';
import { withDebugName } from './debug/withDebugName';
import { getSelectorName } from './_helpers/getSelectorName';
import { isCachedSelector } from './_helpers/isCachedSelector';

const generateMappingName = <P1 extends object, P2>(mapping: (props: P2) => P1) => {
  if (mapping.name) {
    return mapping.name;
  }

  const structure = mapping(
    new Proxy(
      {},
      {
        get: (_target, key) => key,
      },
    ) as P2,
  );
  const structureKeys = Object.keys(structure).join();
  const structureValues = Object.values(structure).join();

  return `${structureKeys} -> ${structureValues}`;
};

const innerCreateAdaptedSelector =
  <S, P1, P2, R>(
    baseSelector: (state: S, props: P1) => R,
    mapping: (props: P2) => P1,
  ): NamedSelector<S, R, [P2]> =>
  (state: S, props: P2) => {
    return baseSelector(state, mapping(props));
  };

/**
 * Rewrites the props a selector reads. Only the props argument changes: the
 * adapted selector takes `[P2]` where the base took `[P1]`, which is the same
 * argument tuple every other creator in the library carries.
 */
export const createAdaptedSelector = <S, P1 extends object, P2, R>(
  baseSelector: (state: S, props: P1) => R,
  mapping: (props: P2) => P1,
) => {
  const adaptedSelector = innerCreateAdaptedSelector(baseSelector, mapping);

  Object.assign(adaptedSelector, baseSelector);
  adaptedSelector.dependencies = [baseSelector];

  withDebugName(adaptedSelector, () => {
    const baseName = getSelectorName(baseSelector);
    const mappingName = generateMappingName(mapping);

    return `${baseName} (${mappingName})`;
  });

  if (isCachedSelector(baseSelector)) {
    const cachedAdaptedSelector = adaptedSelector as unknown as CachedSelector;

    if (baseSelector.getMatchingSelector) {
      cachedAdaptedSelector.getMatchingSelector = innerCreateAdaptedSelector(
        baseSelector.getMatchingSelector,
        mapping,
      );
    }

    if (baseSelector.removeMatchingSelector) {
      cachedAdaptedSelector.removeMatchingSelector = innerCreateAdaptedSelector(
        baseSelector.removeMatchingSelector,
        mapping,
      );
    }

    cachedAdaptedSelector.keySelector = innerCreateAdaptedSelector(
      baseSelector.keySelector,
      mapping,
    );
  }

  return adaptedSelector;
};
