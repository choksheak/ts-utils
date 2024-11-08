/**
 * Returns 0 if the string is not a valid number.
 */
export function safeParseInt(s: string, logError = false): number {
  const i = Number(s);

  if (isNaN(i)) {
    if (logError) {
      console.error(`Not a number: "${s}"`);
    }
    return 0;
  }

  return Math.floor(i);
}
