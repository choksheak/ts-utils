import { Heap } from "./heap";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const minCmp = (a: number, b: number) => a - b;
const maxCmp = (a: number, b: number) => b - a;

function drainAll<T>(h: Heap<T>): T[] {
  return [...h.drain()];
}

// ─── Constructor & heapify ────────────────────────────────────────────────────

describe("constructor", () => {
  it("creates an empty heap", () => {
    const h = new Heap<number>(minCmp);
    expect(h.size).toBe(0);
    expect(h.isEmpty).toBe(true);
    expect(h.peek()).toBeUndefined();
  });

  it("heapifies an initial array without mutating it", () => {
    const initial = [5, 3, 8, 1, 4];
    const copy = [...initial];
    const h = new Heap(minCmp, initial);
    expect(initial).toEqual(copy); // original untouched
    expect(h.size).toBe(5);
    expect(h.peek()).toBe(1);
  });

  it("heapifies a single-element array", () => {
    const h = new Heap(minCmp, [42]);
    expect(h.peek()).toBe(42);
    expect(h.size).toBe(1);
  });

  it("heapifies a reversed array into a correct min-heap", () => {
    const h = new Heap(minCmp, [9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(drainAll(h)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

// ─── Min-heap basics ──────────────────────────────────────────────────────────

describe("min-heap", () => {
  it("peek returns the minimum without removing it", () => {
    const h = new Heap(minCmp, [3, 1, 2]);
    expect(h.peek()).toBe(1);
    expect(h.size).toBe(3);
  });

  it("pop returns items in ascending order", () => {
    const h = new Heap(minCmp, [4, 2, 7, 1, 9, 3]);
    expect(drainAll(h)).toEqual([1, 2, 3, 4, 7, 9]);
  });

  it("push then pop maintains heap order", () => {
    const h = new Heap<number>(minCmp);
    [5, 3, 8, 1].forEach((x) => h.push(x));
    expect(h.pop()).toBe(1);
    expect(h.pop()).toBe(3);
    h.push(2);
    expect(h.pop()).toBe(2);
    expect(h.pop()).toBe(5);
    expect(h.pop()).toBe(8);
  });

  it("pop from an empty heap returns undefined", () => {
    const h = new Heap<number>(minCmp);
    expect(h.pop()).toBeUndefined();
  });

  it("handles duplicate values", () => {
    const h = new Heap(minCmp, [3, 3, 1, 1, 2, 2]);
    expect(drainAll(h)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});

// ─── Max-heap basics ──────────────────────────────────────────────────────────

describe("max-heap", () => {
  it("peek returns the maximum", () => {
    const h = new Heap(maxCmp, [3, 1, 5, 2]);
    expect(h.peek()).toBe(5);
  });

  it("pop returns items in descending order", () => {
    const h = new Heap(maxCmp, [4, 2, 7, 1, 9, 3]);
    expect(drainAll(h)).toEqual([9, 7, 4, 3, 2, 1]);
  });
});

// ─── Custom comparator (objects) ──────────────────────────────────────────────

describe("custom comparator", () => {
  type Task = { name: string; priority: number };
  const taskCmp = (a: Task, b: Task) => a.priority - b.priority;

  it("orders tasks by priority (lowest first)", () => {
    const tasks: Task[] = [
      { name: "low", priority: 10 },
      { name: "high", priority: 1 },
      { name: "medium", priority: 5 },
    ];
    const h = new Heap(taskCmp, tasks);
    expect(h.pop()!.name).toBe("high");
    expect(h.pop()!.name).toBe("medium");
    expect(h.pop()!.name).toBe("low");
  });
});

// ─── pushPop ─────────────────────────────────────────────────────────────────

describe("pushPop", () => {
  it("returns the item itself when heap is empty", () => {
    const h = new Heap<number>(minCmp);
    expect(h.pushPop(7)).toBe(7);
    expect(h.size).toBe(0);
  });

  it("returns the item when it is smaller than the current top (min-heap)", () => {
    const h = new Heap(minCmp, [5, 6, 7]);
    // item=2 < top=5, so 2 is immediately returned and heap unchanged
    const result = h.pushPop(2);
    expect(result).toBe(2);
    expect(h.size).toBe(3);
    expect(h.peek()).toBe(5);
  });

  it("pushes the item and pops the old top when item > top", () => {
    const h = new Heap(minCmp, [1, 3, 5]);
    const result = h.pushPop(4);
    expect(result).toBe(1);
    expect(h.size).toBe(3);
    expect(drainAll(h)).toEqual([3, 4, 5]);
  });

  it("is equivalent to push then pop", () => {
    const items = [8, 3, 6, 1, 9, 2];
    const h1 = new Heap(minCmp, [4, 7, 10]);
    const h2 = new Heap(minCmp, [4, 7, 10]);

    for (const x of items) {
      h2.push(x);
      const expected = h2.pop()!;
      expect(h1.pushPop(x)).toBe(expected);
    }
  });
});

// ─── replace ─────────────────────────────────────────────────────────────────

describe("replace", () => {
  it("swaps the top item and returns the old top", () => {
    const h = new Heap(minCmp, [1, 3, 5]);
    const old = h.replace(2);
    expect(old).toBe(1);
    expect(h.size).toBe(3);
    expect(drainAll(h)).toEqual([2, 3, 5]);
  });

  it("throws when the heap is empty", () => {
    const h = new Heap<number>(minCmp);
    expect(() => h.replace(99)).toThrow("Heap is empty");
  });

  it("is equivalent to pop then push", () => {
    const items = [8, 3, 6, 1, 9, 2];
    const h1 = new Heap(minCmp, [4, 7, 10]);
    const h2 = new Heap(minCmp, [4, 7, 10]);

    for (const x of items) {
      const old1 = h1.replace(x);
      const old2 = h2.pop()!;
      h2.push(x);
      expect(old1).toBe(old2);
      expect(drainAll(new Heap(minCmp, [...h1.toSortedArray()]))).toEqual(
        drainAll(new Heap(minCmp, [...h2.toSortedArray()])),
      );
    }
  });
});

// ─── remove ──────────────────────────────────────────────────────────────────

describe("remove", () => {
  it("removes the first matching item and maintains heap invariant", () => {
    const h = new Heap(minCmp, [1, 2, 3, 4, 5]);
    const removed = h.remove((x) => x === 3);
    expect(removed).toBe(3);
    expect(h.size).toBe(4);
    expect(drainAll(h)).toEqual([1, 2, 4, 5]);
  });

  it("returns undefined when no item matches", () => {
    const h = new Heap(minCmp, [1, 2, 3]);
    expect(h.remove((x) => x === 99)).toBeUndefined();
    expect(h.size).toBe(3);
  });

  it("can remove the top item", () => {
    const h = new Heap(minCmp, [1, 2, 3]);
    const removed = h.remove((x) => x === 1);
    expect(removed).toBe(1);
    expect(h.peek()).toBe(2);
  });

  it("can remove the last item in the backing array", () => {
    const h = new Heap(minCmp, [1, 2, 3]);
    // Force a remove of whichever item sits last in the internal array.
    // After heapify [1,2,3] the backing store is [1,2,3]; last element is 3.
    const removed = h.remove((x) => x === 3);
    expect(removed).toBe(3);
    expect(h.size).toBe(2);
    expect(drainAll(h)).toEqual([1, 2]);
  });

  it("heap remains valid after multiple removes", () => {
    const h = new Heap(minCmp, [10, 4, 7, 1, 9, 3, 6, 2, 8, 5]);
    h.remove((x) => x === 5);
    h.remove((x) => x === 1);
    expect(drainAll(h)).toEqual([2, 3, 4, 6, 7, 8, 9, 10]);
  });
});

// ─── removeAll ───────────────────────────────────────────────────────────────

describe("removeAll", () => {
  it("removes all matching items", () => {
    const h = new Heap(minCmp, [1, 2, 3, 4, 5, 6]);
    const removed = h.removeAll((x) => x % 2 === 0);
    expect(removed.sort((a, b) => a - b)).toEqual([2, 4, 6]);
    expect(h.size).toBe(3);
    expect(drainAll(h)).toEqual([1, 3, 5]);
  });

  it("returns empty array when nothing matches", () => {
    const h = new Heap(minCmp, [1, 3, 5]);
    expect(h.removeAll((x) => x > 10)).toEqual([]);
    expect(h.size).toBe(3);
  });

  it("can remove all items", () => {
    const h = new Heap(minCmp, [1, 2, 3]);
    const removed = h.removeAll(() => true);
    expect(removed).toHaveLength(3);
    expect(h.isEmpty).toBe(true);
  });
});

// ─── clear ───────────────────────────────────────────────────────────────────

describe("clear", () => {
  it("empties the heap", () => {
    const h = new Heap(minCmp, [1, 2, 3]);
    h.clear();
    expect(h.size).toBe(0);
    expect(h.isEmpty).toBe(true);
    expect(h.peek()).toBeUndefined();
  });

  it("allows pushing after clear", () => {
    const h = new Heap(minCmp, [1, 2, 3]);
    h.clear();
    h.push(5);
    expect(h.peek()).toBe(5);
  });
});

// ─── pushAll ─────────────────────────────────────────────────────────────────

describe("pushAll", () => {
  it("adds items from an array and reheapifies", () => {
    const h = new Heap<number>(minCmp);
    h.pushAll([5, 3, 8, 1, 4]);
    expect(drainAll(h)).toEqual([1, 3, 4, 5, 8]);
  });

  it("adds items from a Set", () => {
    const h = new Heap<number>(minCmp);
    h.pushAll(new Set([9, 2, 6]));
    expect(drainAll(h)).toEqual([2, 6, 9]);
  });

  it("merges new items with existing heap items correctly", () => {
    const h = new Heap(minCmp, [10, 20]);
    h.pushAll([5, 15, 1]);
    expect(drainAll(h)).toEqual([1, 5, 10, 15, 20]);
  });
});

// ─── drain ───────────────────────────────────────────────────────────────────

describe("drain", () => {
  it("yields items in priority order and leaves heap empty", () => {
    const h = new Heap(minCmp, [3, 1, 2]);
    const result = [...h.drain()];
    expect(result).toEqual([1, 2, 3]);
    expect(h.isEmpty).toBe(true);
  });

  it("allows early break without draining everything", () => {
    const h = new Heap(minCmp, [5, 1, 4, 2, 3]);
    const result: number[] = [];
    for (const x of h.drain()) {
      result.push(x);
      if (result.length === 2) break;
    }
    expect(result).toEqual([1, 2]);
    expect(h.size).toBe(3); // remaining items still in heap
  });

  it("draining an empty heap yields nothing", () => {
    const h = new Heap<number>(minCmp);
    expect([...h.drain()]).toEqual([]);
  });
});

// ─── toSortedArray ───────────────────────────────────────────────────────────

describe("toSortedArray", () => {
  it("returns items in priority order without mutating the heap", () => {
    const h = new Heap(minCmp, [4, 2, 7, 1]);
    const sorted = h.toSortedArray();
    expect(sorted).toEqual([1, 2, 4, 7]);
    expect(h.size).toBe(4); // original heap unchanged
    expect(h.peek()).toBe(1);
  });

  it("returns an empty array for an empty heap", () => {
    const h = new Heap<number>(minCmp);
    expect(h.toSortedArray()).toEqual([]);
  });
});

// ─── Large / stress ──────────────────────────────────────────────────────────

describe("stress", () => {
  it("correctly orders 1 000 random integers (min-heap)", () => {
    const nums = Array.from({ length: 1000 }, () =>
      Math.floor(Math.random() * 10000),
    );
    const h = new Heap(minCmp, nums);
    const result = drainAll(h);
    const expected = [...nums].sort((a, b) => a - b);
    expect(result).toEqual(expected);
  });

  it("intermixed push / pop stays consistent", () => {
    const h = new Heap<number>(minCmp);
    const reference: number[] = [];

    for (let i = 0; i < 200; i++) {
      const v = Math.floor(Math.random() * 1000);
      h.push(v);
      reference.push(v);
    }

    reference.sort((a, b) => a - b);

    for (let i = 0; i < 100; i++) {
      expect(h.pop()).toBe(reference.shift());
    }

    // Push 50 more
    for (let i = 0; i < 50; i++) {
      const v = Math.floor(Math.random() * 1000);
      h.push(v);
      reference.push(v);
    }
    reference.sort((a, b) => a - b);

    // Drain the rest
    expect(drainAll(h)).toEqual(reference);
  });
});
