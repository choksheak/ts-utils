/**
 * Returns 0 if the string is not a valid number.
 *
 * @param logError Log a console error if the given string is not a valid
 *   number. Defaults to false (don't log anything).
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
