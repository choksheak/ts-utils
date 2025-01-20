/**
 * Type asserts that `t` is neither null nor undefined.
 * Throws an error if `t` is null or undefined.
 *
 * @param varName The variable name to include in the error to throw when t is
 *   nil. Defaults to 'value'.
 */
export function nonNil<T>(t: T | null | undefined, varName = "value"): T {
  if (t === null || t === undefined) {
    throw new Error(`Missing ${varName}: ${t}`);
  }
  return t;
}
