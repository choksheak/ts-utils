/**
 * Returns true if `t` is empty.
 */
export function isEmpty(t: unknown): boolean {
  // Anything falsy is considered empty.
  if (!t) {
    return true;
  }

  // Arrays are also of type `object`.
  if (typeof t !== "object") {
    return false;
  }

  // `length` includes arrays as well.
  if ("length" in t) {
    return t.length === 0;
  }

  // `size` is for Set, Map, Blob etc.
  if ("size" in t) {
    return t.size === 0;
  }

  // Super fast check for object emptiness.
  // https://stackoverflow.com/questions/679915/how-do-i-test-for-an-empty-javascript-object
  for (const k in t) {
    return false;
  }

  return true;
}
