/** Memory-efficient way to concat two or more iterators. */
export function* concatIterators<T>(...iterators: Generator<T>[]) {
  for (const iterator of iterators) {
    yield* iterator;
  }
}
