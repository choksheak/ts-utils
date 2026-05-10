// ─────────────────────────────────────────────────────────────────────────────
// Heap — a generic binary heap usable as a min-heap or max-heap.
//
// Comparator conventions (same as Array.prototype.sort):
//   compare(a, b) < 0  →  a has higher priority than b  (a closer to top)
//   compare(a, b) > 0  →  b has higher priority than a  (b closer to top)
//   compare(a, b) = 0  →  equal priority
//
// Min-heap: (a, b) => a - b          top = smallest number
// Max-heap: (a, b) => b - a          top = largest number
// By field:  (a, b) => a.ts - b.ts   top = smallest .ts
//
// All core operations are O(log n) except peek and size which are O(1).
// ─────────────────────────────────────────────────────────────────────────────

export type Comparator<T> = (a: T, b: T) => number;

export class Heap<T> {
  private readonly data: T[];
  private readonly compare: Comparator<T>;

  /**
   * @param compare - Comparator function. Return negative to place `a` above
   *   `b` in the heap (i.e. closer to the top / higher priority).
   * @param initial - Optional array of items to heapify in O(n) time.
   *   The array is copied; the original is not modified.
   */
  public constructor(compare: Comparator<T>, initial: T[] = []) {
    this.compare = compare;
    this.data = [...initial];

    // Floyd's algorithm: heapify in O(n) by sifting down from last parent.
    for (let i = parent(this.data.length - 1); i >= 0; i--) {
      this.siftDown(i);
    }
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  /** Number of items currently in the heap. */
  public get size(): number {
    return this.data.length;
  }

  /** True when the heap contains no items. */
  public get isEmpty(): boolean {
    return this.data.length === 0;
  }

  /** Return the top item without removing it. O(1). */
  public peek(): T | undefined {
    return this.data[0];
  }

  // ── Mutators ───────────────────────────────────────────────────────────────

  /** Add an item. O(log n). */
  public push(item: T): void {
    this.data.push(item);
    this.siftUp(this.data.length - 1);
  }

  /** Remove and return the top item. O(log n). */
  public pop(): T | undefined {
    if (this.data.length === 0) return undefined;

    const top = this.data[0];
    const last = this.data.pop()!;

    if (this.data.length > 0) {
      this.data[0] = last;
      this.siftDown(0);
    }

    return top;
  }

  /**
   * Push a new item and pop the top in one pass — more efficient than calling
   * push() then pop() separately because it avoids an extra sift. O(log n).
   */
  public pushPop(item: T): T {
    if (this.data.length === 0 || this.compare(item, this.data[0]) <= 0) {
      // The new item would immediately be popped anyway.
      return item;
    }

    const top = this.data[0];
    this.data[0] = item;
    this.siftDown(0);
    return top;
  }

  /**
   * Pop the top item and push a replacement in one pass — more efficient than
   * pop() then push() separately. Throws if the heap is empty. O(log n).
   */
  public replace(item: T): T {
    if (this.data.length === 0) {
      throw new Error("Heap is empty");
    }

    const top = this.data[0];
    this.data[0] = item;
    this.siftDown(0);
    return top;
  }

  /**
   * Remove the first item that satisfies the predicate.
   * Returns the removed item, or undefined if not found.
   *
   * Finding the item is O(n). The removal itself is O(log n).
   */
  public remove(predicate: (item: T) => boolean): T | undefined {
    const i = this.data.findIndex(predicate);
    if (i === -1) return undefined;
    return this.removeAt(i);
  }

  /**
   * Remove all items that satisfy the predicate. Returns the removed items in
   * the order they were found (not priority order).
   *
   * O(n) to scan + O(k log n) for k removals.
   */
  public removeAll(predicate: (item: T) => boolean): T[] {
    const removed: T[] = [];

    // Iterate backwards so that removeAt's swap of the last element
    // doesn't cause us to skip or re-visit items.
    for (let i = this.data.length - 1; i >= 0; i--) {
      if (predicate(this.data[i])) {
        removed.push(this.removeAt(i));
      }
    }

    return removed;
  }

  /** Remove all items. */
  public clear(): void {
    this.data.length = 0;
  }

  // ── Bulk operations ────────────────────────────────────────────────────────

  /**
   * Add multiple items at once. More efficient than repeated push() calls
   * when adding many items: uses heapify (O(n)) rather than O(n log n). */
  public pushAll(items: Iterable<T>): void {
    for (const item of items) {
      this.data.push(item);
    }

    // Re-heapify from scratch.
    for (let i = parent(this.data.length - 1); i >= 0; i--) {
      this.siftDown(i);
    }
  }

  /**
   * Drain all items in priority order. The heap is empty afterward.
   * Equivalent to calling pop() until empty, but expressed as a generator
   * so callers can break early without popping everything. O(n log n) total.
   */
  public *drain(): Generator<T> {
    while (this.data.length > 0) {
      yield this.pop()!;
    }
  }

  /**
   * Return a sorted array of all items in priority order without mutating
   * the heap. O(n log n).
   */
  public toSortedArray(): T[] {
    // Clone into a temporary heap and drain it.
    const tmp = new Heap<T>(this.compare, this.data);
    return [...tmp.drain()];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private siftUp(i: number): void {
    while (i > 0) {
      const p = parent(i);
      if (this.compare(this.data[i], this.data[p]) >= 0) break;
      swap(this.data, i, p);
      i = p;
    }
  }

  private siftDown(i: number): void {
    const n = this.data.length;

    while (true) {
      let top = i;
      const l = leftChild(i);
      const r = rightChild(i);

      if (l < n && this.compare(this.data[l], this.data[top]) < 0) top = l;
      if (r < n && this.compare(this.data[r], this.data[top]) < 0) top = r;
      if (top === i) break;

      swap(this.data, i, top);
      i = top;
    }
  }

  private removeAt(i: number): T {
    const last = this.data.pop()!;

    // If we just removed the last element, no fixup needed.
    if (i === this.data.length) return last;

    // Overwrite the target slot with the last element, then restore the
    // heap invariant. We need to try both directions because the last
    // element could be either larger or smaller than the removed item's
    // neighbours.
    const removed = this.data[i];
    this.data[i] = last;
    this.siftUp(i);
    this.siftDown(i);
    return removed;
  }
}

// ── Index arithmetic (plain functions keep the class body clean) ─────────────

function parent(i: number): number {
  return (i - 1) >> 1;
}

function leftChild(i: number): number {
  return 2 * i + 1;
}

function rightChild(i: number): number {
  return 2 * i + 2;
}

function swap<T>(data: T[], i: number, j: number): void {
  const tmp = data[i];
  data[i] = data[j];
  data[j] = tmp;
}
