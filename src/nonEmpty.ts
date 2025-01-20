import { isEmpty } from "./isEmpty";

/**
 * Type asserts that `t` is truthy.
 * Throws an error if `t` is null or undefined.
 *
 * @param varName The variable name to include in the error to throw when t is
 *   empty. Defaults to 'value'.
 */
export function nonEmpty<T>(
  t: T | null | undefined | "" | 0 | -0 | 0n | false | typeof NaN,
  varName = "value",
): T {
  if (isEmpty(t)) {
    throw new Error(`Empty ${varName}: ${t}`);
  }
  return t as T;
}
