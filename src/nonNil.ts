/**
 * Type asserts that `t` is neither null nor undefined.
 * Throws an error if `t` is null or undefined.
 */
export function nonNil<T>(t: T | null | undefined, varName = "variable"): T {
  if (t === null || t === undefined) {
    throw new Error(`Missing ${varName}`);
  }
  return t;
}
