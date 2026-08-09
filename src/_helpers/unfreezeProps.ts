/**
 * Bound selectors write the binding into the props object in place and roll it
 * back afterwards (see temporaryAssign.ts), which throws on a frozen target in
 * strict mode. React freezes element props in development, and immer-based
 * stores hand out frozen objects in production too, so the copy stays in both
 * builds — the hooks only ever call this when props actually change.
 */
export const unfreezeProps = (props: unknown) => {
  if (typeof props !== 'object' || props === null || !Object.isFrozen(props)) {
    return props;
  }

  return Array.isArray(props) ? props.slice() : { ...props };
};
