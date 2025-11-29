/**
 * Coerce `u` into a number if possible, otherwise just return 0.
 */
export function asNumber(u: unknown, defaultValue = 0): number {
  // If u is a valid number, return it.
  if (typeof u === "number") {
    return isFinite(u) ? u : defaultValue;
  }

  // Try to make into a number if not already a number.
  u = Number(u);

  // If u is a valid number, return it.
  if (typeof u === "number" && isFinite(u)) {
    return u;
  }

  // Return `defaultValue` for everything else. This is usually ok if want to
  // just ignore all other noise.
  return defaultValue;
}
