/**
 * Hoisted: react-redux reads the options object on every render, so there is no
 * reason to allocate a fresh one per call site per render. The dev-mode checks
 * re-run the selector to compare results, which these hooks control themselves.
 */
export const selectorOptions = {
  devModeChecks: {
    stabilityCheck: 'never',
    identityFunctionCheck: 'never',
  },
} as const;
