import { KeySelector } from '@veksa/re-reselect';
import { isPropSelector } from '../createPropSelector';
import { isComposedKeySelector, KeySelectorComposer } from './createKeySelectorComposer';
import { arePathsEqual } from '../_helpers/arePathsEqual';
import { defaultKeySelector } from './defaultKeySelector';
import { isCachedSelector } from '../_helpers/isCachedSelector';

const areSelectorsEqual = (selector: unknown, another: unknown) => {
  if (selector === another) {
    return true;
  }

  if (isPropSelector(selector) && isPropSelector(another)) {
    return arePathsEqual(selector.path, another.path);
  }

  return false;
};

const flatKeySelectors = <S>(keySelectors: KeySelector<S>[]) => {
  const result: typeof keySelectors = [];

  for (let i = 0; i < keySelectors.length; i += 1) {
    const keySelector = keySelectors[i];

    if (isComposedKeySelector(keySelector)) {
      result.push(...flatKeySelectors(keySelector.dependencies));
    } else {
      result.push(keySelector);
    }
  }

  return result;
};

const uniqKeySelectors = <S>(keySelectors: KeySelector<S>[]) => {
  const result: typeof keySelectors = [];

  for (let i = 0; i < keySelectors.length; i += 1) {
    const keySelector = keySelectors[i];

    const isKeySelectorAdded = result.some((resultKeySelector) =>
      areSelectorsEqual(keySelector, resultKeySelector),
    );
    if (!isKeySelectorAdded) {
      result.push(keySelector);
    }
  }

  return result;
};

export const excludeDefaultSelectors = <S>(keySelectors: KeySelector<S>[]) => {
  const result: typeof keySelectors = [];

  for (let i = 0; i < keySelectors.length; i += 1) {
    const keySelector = keySelectors[i];

    if (keySelector !== defaultKeySelector) {
      result.push(keySelector);
    }
  }

  return result;
};

export function createKeySelectorCreator(
  keySelectorComposer: KeySelectorComposer,
): <S, D>(selectorInputs: { inputSelectors: D; keySelector?: KeySelector<S> }) => KeySelector<S> {
  return <S>({
    inputSelectors,
    keySelector,
  }: {
    inputSelectors: unknown;
    keySelector?: KeySelector<S>;
  }) => {
    let keySelectors: KeySelector<S>[] = [];

    if (keySelector) {
      keySelectors.push(keySelector);
    }

    (inputSelectors as unknown[]).forEach((selector) => {
      if (isCachedSelector(selector)) {
        keySelectors.push(selector.keySelector);
      }
    });

    keySelectors = flatKeySelectors(keySelectors);
    keySelectors = uniqKeySelectors(keySelectors);
    keySelectors = excludeDefaultSelectors(keySelectors);

    if (keySelectors.length === 0) {
      return defaultKeySelector;
    }

    if (keySelectors.length === 1) {
      const [resultSelector] = keySelectors;
      return resultSelector;
    }

    // The composer infers a `UnionToIntersection` state from the runtime array,
    // which TS can't see as identical to `S`; narrow it back for the caller.
    return keySelectorComposer(...keySelectors) as KeySelector<S>;
  };
}
