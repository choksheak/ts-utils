import { round } from "./round";

/**
 * Returns a string with the number in the exact number of decimal places
 * specified, in case the number ends with zeroes, and adding commas for each
 * group of 3 significant digits.
 */
export function roundToString(n: number, numDecimalPlaces = 0): string {
  return round(n, numDecimalPlaces).toLocaleString("en-US", {
    minimumFractionDigits: numDecimalPlaces,
    maximumFractionDigits: numDecimalPlaces,
  });
}
