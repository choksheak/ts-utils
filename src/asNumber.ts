/**
 * Coerce `u` into a number if possible, otherwise just return 0.
 */
export function asNumber(u: unknown): number {
  // No transformation needed if u is already a number.
  if (typeof u === "number" && isFinite(u)) {
    return u;
  }

  // Try to make into a number if possible.
  const n = Number(u);
  if (typeof n === "number" && isFinite(n)) {
    return n;
  }

  // Return 0 for everything else. This is usually ok if want to just ignore
  // all other noise.
  return 0;
}
