/**
 * Coerce `u` into a number if possible, otherwise just return 0.
 */
export function asNumber(u: unknown): number {
  // If u is a valid number, return it.
  if (typeof u === "number") {
    return isFinite(u) ? u : 0;
  }

  // Try to make into a number if not already a number.
  u = Number(u);

  // If u is a valid number, return it.
  if (typeof u === "number" && isFinite(u)) {
    return u;
  }

  // Return 0 for everything else. This is usually ok if want to just ignore
  // all other noise.
  return 0;
}
