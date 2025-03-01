export function stringify(u: unknown): string {
  if (typeof u === "string") {
    return u;
  }

  // If the object has a custom toString(), then use it.
  if (
    u !== null &&
    typeof u === "object" &&
    u.toString !== Object.prototype.toString
  ) {
    return u.toString();
  }

  return JSON.stringify(u);
}

export function capLength(u: unknown, maxLength = 400): string {
  const s = stringify(u);

  if (s.length <= maxLength) {
    return s;
  }

  return s.slice(0, maxLength) + ` ... (${s.length - maxLength} more)`;
}
