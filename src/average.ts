import { sum } from "./sum";

/**
 * Average all the numbers together in the given array. Treats null, undefined
 * and NaN as zero.
 */
export function average(numbers: (number | null | undefined)[]): number {
  if (numbers.length === 0) return 0;

  const total = sum(numbers);

  return total / numbers.length;
}
