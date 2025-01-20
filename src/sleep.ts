/**
 * Sleep for a given number of milliseconds. Note that this method is async,
 * so please remember to call it with await, like `await sleep(1000);`.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
