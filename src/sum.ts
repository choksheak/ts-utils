import { asNumber } from "./asNumber";

/**
 * Add all the numbers together in the given array.
 * Non-numbers will be coerced into numbers if possible.
 */
export function sum(numbers: unknown[]): number {
  return numbers.reduce((accumulated: number, current: unknown) => {
    return accumulated + asNumber(current);
  }, 0);
}
