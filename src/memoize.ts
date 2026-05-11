// ─────────────────────────────────────────────────────────────────────────────
// Simple memoize an async-loaded result once.
//
// Interface design notes:
// 1. Retry on errors - supported. If an error is thrown, then nothing is
//    memoized.
// 2. Cache invalidation - does not seem useful because all the user needs to
//    do is to call memoize again.
// 3. TTL - could be useful, but doesn't seem necessary to have. Niche use case.
// 4. Memoize different results for different function arguments - Could be
//    useful, but not the main use case we are targeting for.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Memoizes the result of an async loader function.
 *
 * - The loader is only executed once.
 * - Concurrent callers share the same in-flight promise.
 * - Subsequent calls return the cached value.
 *
 * Example usage:
 *
 *   const getSomeData = memoize(async () => {
 *     return await loadSomethingExpensive();
 *   });
 *
 * Or just use:
 *
 *   const getSomeData = memoize(loadSomethingExpensive);
 *   ...
 *   // Slow in the first call, immediate in subsequent calls.
 *   const data = await getSomeData();
 *
 */
export function memoize<T>(loader: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;

  return (): Promise<T> => {
    if (!promise) {
      promise = loader().catch((error) => {
        // Clear the cache so the next call retries
        promise = undefined;
        throw error;
      });
    }

    return promise;
  };
}
