import { asNumber } from "./asNumber";

/**
 * Compute the median (middle number) of all the numbers in the given array.
 * Non-numbers will be coerced into numbers if possible.
 */
export function median(numbers: unknown[]): number {
  if (numbers.length === 0) {
    return 0;
  }

  // Create a copy with slice() to avoid mutating the original array.
  const sorted = numbers
    .map(asNumber)
    .slice()
    .sort((a, b) => a - b);

  const middleIndex = Math.floor(sorted.length / 2);

  // Is odd length -> return middle number.
  if (sorted.length % 2 === 1) {
    return sorted[middleIndex];
  }

  // Is even length -> return mean of middle 2 numbers.
  const value1 = sorted[middleIndex - 1];
  const value2 = sorted[middleIndex];
  return (value1 + value2) / 2;
}
