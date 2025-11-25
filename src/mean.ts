import { sum } from "./sum";

/**
 * Compute the mean (average) of all the numbers in the given array.
 * Non-numbers will be coerced into numbers if possible.
 */
export function mean(numbers: unknown[]): number {
  return numbers.length > 0 ? sum(numbers) / numbers.length : 0;
}
