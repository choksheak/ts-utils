/**
 * Simplifies rounding of floating point numbers. Note that if your number ends
 * with zeros, and you convert the number to string, you will lose the zeroes
 * at the end. To show the exact number of decimal places, you'll need to use
 * toFixed(). E.g. round(1.20, 2).toFixed(2).
 */
export function round(n: number, numDecimalPlaces = 0): number {
  const multipler = Math.pow(10, numDecimalPlaces);
  return Math.round(n * multipler) / multipler;
}

/**
 * Returns a string with the number in the exact number of decimal places
 * specified, in case the number ends with zeroes.
 */
export function roundS(n: number, numDecimalPlaces = 0): string {
  return round(n, numDecimalPlaces).toFixed(numDecimalPlaces);
}
