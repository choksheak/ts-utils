/**
 * A type guard to check if an object is a Promise (or a "thenable"). It checks
 * if the object is not null, is an object, and has a callable .then method.
 *
 * Note that if the Promise expects a certain type like `Promise<T>`, there is
 * no way to validate the type of T unless we resolve the promise. This function
 * does not attempt to typecheck for T in any way.
 */
export function isPromise(obj: unknown): obj is Promise<unknown> {
  // Check if the object is defined and not null.
  if (!obj || (typeof obj !== "object" && typeof obj !== "function")) {
    return false;
  }

  // Check if the .then property is a function (callable).
  return "then" in obj && typeof obj.then === "function";
}

/**
 * A type guard to check if an object is a native Promise.
 *
 * Note that if the Promise expects a certain type like `Promise<T>`, there is
 * no way to validate the type of T unless we resolve the promise. This function
 * does not attempt to typecheck for T in any way.
 */
export function isNativePromise(obj: unknown): obj is Promise<unknown> {
  return obj instanceof Promise;
}
