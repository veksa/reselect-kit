import { NamedSelector, Path } from './types';
import { isObject } from './_helpers/isObject';
import { withDebugName } from './debug/withDebugName';
import { getSelectorName } from './_helpers/getSelectorName';

export type Defined<T> = Exclude<T, undefined>;

export type IsOptional<T> = undefined extends T ? true : null extends T ? true : false;

export type IsObject<T> = T extends object ? true : false;

/**
 * The selector a path builder produces. `Params` is carried through untouched
 * from the base selector: walking a path changes the result, never the
 * arguments, so the plain and the parametric case are the same type.
 */
export type PathSelector<S, R, Params extends readonly any[], D> = NamedSelector<
  S,
  R,
  Params,
  D
> & {
  path: Path;
};

type Required<T> = { [P in keyof T]-?: Exclude<T[P], undefined | null> };

export type RequiredSelectorBuilder<S, R, Params extends readonly any[], D> = R extends object
  ? { [K in keyof R]: () => PathSelector<S, NonNullable<R[K]>, Params, D> }
  : {};

export type OptionalSelectorBuilder<S, R, Params extends readonly any[], D> = ((
  defaultValue?: R,
) => PathSelector<S, R extends undefined ? Defined<R> : R, Params, D>) &
  (R extends object
    ? { [K in keyof Required<R>]: () => PathSelector<S, NonNullable<R[K]>, Params, D> }
    : {});

export type RequiredObjectSelectorWrapper<S, R, Params extends readonly any[], D> = {
  [K in keyof R]-?: IsOptional<R[K]> extends true
    ? OptionalPathSelectorType<S, R[K], Params, D>
    : RequiredPathSelectorType<S, R[K], Params, D>;
};

export type OptionalObjectSelectorWrapper<S, R, Params extends readonly any[], D> = {
  [K in keyof R]-?: OptionalPathSelectorType<S, R[K], Params, D>;
};

export type RequiredArraySelectorWrapper<S, R, Params extends readonly any[], D> = {
  length: RequiredPathSelectorType<S, number, Params, D>;

  [K: number]: IsOptional<R> extends true
    ? OptionalPathSelectorType<S, R, Params, D>
    : RequiredPathSelectorType<S, R, Params, D>;
};

export type OptionalArraySelectorWrapper<S, R, Params extends readonly any[], D> = {
  length: RequiredPathSelectorType<S, number, Params, D>;

  [K: number]: OptionalPathSelectorType<S, R, Params, D>;
};

export type RequiredDataSelectorWrapper<
  S,
  R,
  Params extends readonly any[],
  D,
> = R extends unknown[]
  ? RequiredArraySelectorWrapper<S, R[number], Params, D>
  : IsObject<R> extends true
    ? RequiredObjectSelectorWrapper<S, R, Params, D>
    : RequiredSelectorBuilder<S, R, Params, D>;

export type OptionalDataSelectorWrapper<
  S,
  R,
  Params extends readonly any[],
  D,
> = R extends unknown[]
  ? OptionalArraySelectorWrapper<S, R[number], Params, D>
  : IsObject<R> extends true
    ? OptionalObjectSelectorWrapper<S, R, Params, D>
    : OptionalSelectorBuilder<S, R, Params, D>;

export type RequiredPathSelectorType<
  S,
  R,
  Params extends readonly any[],
  D,
> = RequiredSelectorBuilder<S, R, Params, D> &
  RequiredDataSelectorWrapper<S, NonNullable<R>, Params, D>;

export type OptionalPathSelectorType<
  S,
  R,
  Params extends readonly any[],
  D,
> = OptionalSelectorBuilder<S, R, Params, D> &
  OptionalDataSelectorWrapper<S, NonNullable<R>, Params, D>;

const defaultVoidFunction = () => {
  return;
};

/** @internal */
export const innerCreatePathSelector = (
  baseSelector: (...args: unknown[]) => unknown,
  path: Path = [],
  applyMeta: (selector: unknown) => void = defaultVoidFunction,
): unknown => {
  const pathLength = path.length;

  const proxyTarget = (defaultValue?: unknown) => {
    function resultSelector(state?: unknown, props?: unknown) {
      // Selectors are almost always reached as `(state)` or `(state, props)`, and
      // dispatching those two arities directly keeps `arguments` out of the hot
      // path. The arity is matched exactly rather than always passing two: reselect
      // memoizes on the argument list, so handing a one-argument selector a second
      // `undefined` would change its cache key.
      let result: unknown;

      if (arguments.length === 2) {
        result = baseSelector(state, props);
      } else if (arguments.length === 1) {
        result = baseSelector(state);
      } else {
        result = baseSelector.apply(null, arguments as unknown as unknown[]);
      }

      for (let i = 0; i < pathLength; i += 1) {
        if (!isObject(result)) {
          // The path runs through `null`, `undefined` or a primitive, so the
          // value it names doesn't exist.
          result = undefined;
          break;
        }

        result = result[path[i]];
      }

      // A missing value — `undefined` or `null`, at the leaf or on the way to
      // it — resolves to the default, which is itself `undefined` when omitted.
      return result == null ? defaultValue : result;
    }

    Object.assign(resultSelector, baseSelector, { path });
    resultSelector.dependencies = [baseSelector];

    applyMeta(resultSelector);

    withDebugName(resultSelector, () => {
      const baseName = getSelectorName(baseSelector);

      return [baseName, ...path].join('.');
    });

    return resultSelector;
  };

  return new Proxy(proxyTarget, {
    get: (_target, key) => {
      return innerCreatePathSelector(baseSelector, [...path, String(key)], applyMeta);
    },
  });
};

/**
 * Builds a proxy that turns property access into a selector reading that path.
 *
 * `Params` is inferred straight from the base selector, so the plain and the
 * parametric case share one signature — and one set of builder types — instead
 * of being told apart by a conditional in the parameter position. It defaults
 * to empty so that `createPathSelector<State, Result>(selector)` keeps working
 * for callers that spell the type arguments out.
 */
export function createPathSelector<S, R, Params extends readonly any[] = []>(
  baseSelector: (state: S, ...params: Params) => R,
): IsOptional<R> extends true
  ? OptionalPathSelectorType<S, R, Params, [typeof baseSelector]>
  : RequiredPathSelectorType<S, R, Params, [typeof baseSelector]> {
  return innerCreatePathSelector(baseSelector as (...args: unknown[]) => unknown) as any;
}
