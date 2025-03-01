/**
 * Returns 0 or the given defaultValue if the string is not a valid number.
 */
export function safeParseFloat<T>(
  s: string,
  defaultValue: T | number = 0,
): T | number {
  const i = Number(s);
  return isNaN(i) ? defaultValue : i;
}
