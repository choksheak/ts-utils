/**
 * Type asserts that `t` is truthy. Throws an error with `errorMessage` if
 * `t` is falsy.
 */
export function assert<T>(
  t: T | null | undefined | "" | 0 | -0 | 0n | false | typeof NaN,
  errorMessage: string,
): asserts t is T {
  if (!t) {
    throw new Error(errorMessage);
  }
}
