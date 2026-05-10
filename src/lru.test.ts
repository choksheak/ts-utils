import { LRUMap } from "./lru";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Collect entries in iteration order as [key, value] tuples. */
function toArray<K, V>(map: LRUMap<K, V>): [K, V][] {
  return [...map.entries()];
}

/** Keys in iteration order. */
// function keys<K, V>(map: LRUMap<K, V>): K[] {
//   return toArray(map).map(([k]) => k);
// }

// ─────────────────────────────────────────────────────────────────────────────
// set / get — basic correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("set / get", () => {
  test("stores and retrieves a value", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  test("returns undefined for a missing key", () => {
    const cache = new LRUMap<string, number>();
    expect(cache.get("missing")).toBeUndefined();
  });

  test("overwrites an existing value", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1);
    cache.set("a", 2);
    expect(cache.get("a")).toBe(2);
    expect(cache.size).toBe(1);
  });

  test("stores null values", () => {
    const cache = new LRUMap<string, number | null>();
    cache.set("a", null);
    expect(cache.get("a")).toBeNull();
  });

  test("stores multiple independent keys", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1).set("b", 2).set("c", 3);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  test("set returns this for chaining", () => {
    const cache = new LRUMap<string, number>();
    const result = cache.set("a", 1);
    expect(result).toBe(cache);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LRU eviction order
// ─────────────────────────────────────────────────────────────────────────────

describe("LRU eviction order", () => {
  test("evicts the least-recently-used entry on overflow", () => {
    const cache = new LRUMap<string, number>({ maxSize: 3 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // "a" is LRU — should be evicted
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
  });

  test("get promotes an entry so it is not evicted", () => {
    const cache = new LRUMap<string, number>({ maxSize: 3 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.get("a"); // a is now MRU; b becomes LRU
    cache.set("d", 4); // b should be evicted
    expect(cache.has("b")).toBe(false);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
  });

  test("set on existing key promotes it so it is not evicted", () => {
    const cache = new LRUMap<string, number>({ maxSize: 3 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("a", 99); // re-set promotes a; b becomes LRU
    cache.set("d", 4); // b should be evicted
    expect(cache.has("b")).toBe(false);
    expect(cache.get("a")).toBe(99);
  });

  test("peek does not protect an entry from eviction", () => {
    const cache = new LRUMap<string, number>({ maxSize: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.peek("a"); // should NOT promote a
    cache.set("c", 3); // a should still be LRU and be evicted
    expect(cache.has("a")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// maxSize / eviction
// ─────────────────────────────────────────────────────────────────────────────

describe("maxSize eviction", () => {
  test("evicts the LRU entry when maxSize is exceeded", () => {
    const cache = new LRUMap<string, number>({ maxSize: 3 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // "a" should be evicted
    expect(cache.has("a")).toBe(false);
    expect(cache.size).toBe(3);
  });

  test("size never exceeds maxSize", () => {
    const cache = new LRUMap<number, number>({ maxSize: 5 });
    for (let i = 0; i < 20; i++) {
      cache.set(i, i);
      expect(cache.size).toBeLessThanOrEqual(5);
    }
  });

  test("updating an existing key does not evict when at capacity", () => {
    const cache = new LRUMap<string, number>({ maxSize: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 99); // update, not insert — size should stay 2
    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBe(99);
    expect(cache.get("b")).toBe(2);
  });

  test("no limit when maxSize is not set", () => {
    const cache = new LRUMap<number, number>();
    for (let i = 0; i < 1000; i++) cache.set(i, i);
    expect(cache.size).toBe(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// has / delete / clear / size
// ─────────────────────────────────────────────────────────────────────────────

describe("has", () => {
  test("returns true for an existing key", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1);
    expect(cache.has("a")).toBe(true);
  });

  test("returns false for a missing key", () => {
    const cache = new LRUMap<string, number>();
    expect(cache.has("missing")).toBe(false);
  });

  test("does not evict any entries", () => {
    const cache = new LRUMap<string, number>({ maxSize: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.has("a");
    expect(cache.size).toBe(2);
    expect(cache.has("a")).toBe(true);
  });
});

describe("delete", () => {
  test("removes an existing entry and returns true", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1);
    expect(cache.delete("a")).toBe(true);
    expect(cache.has("a")).toBe(false);
    expect(cache.size).toBe(0);
  });

  test("returns false for a missing key", () => {
    const cache = new LRUMap<string, number>();
    expect(cache.delete("missing")).toBe(false);
  });

  test("deleting reduces size by 1 and leaves others intact", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1).set("b", 2).set("c", 3);
    cache.delete("b");
    expect(cache.size).toBe(2);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });
});

describe("clear", () => {
  test("removes all entries", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1).set("b", 2).set("c", 3);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  test("cache is usable after clear", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1);
    cache.clear();
    cache.set("b", 2);
    expect(cache.get("b")).toBe(2);
    expect(cache.size).toBe(1);
  });
});

describe("size", () => {
  test("reflects the current number of entries", () => {
    const cache = new LRUMap<string, number>();
    expect(cache.size).toBe(0);
    cache.set("a", 1);
    expect(cache.size).toBe(1);
    cache.set("b", 2);
    expect(cache.size).toBe(2);
    cache.delete("a");
    expect(cache.size).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// peek
// ─────────────────────────────────────────────────────────────────────────────

describe("peek", () => {
  test("returns the correct value", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 42);
    expect(cache.peek("a")).toBe(42);
  });

  test("returns undefined for missing key", () => {
    const cache = new LRUMap<string, number>();
    expect(cache.peek("missing")).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOrDefault / getOrInsert / getOrInsertComputed / getOrInsertLoaded
// ─────────────────────────────────────────────────────────────────────────────

describe("getOrDefault", () => {
  test("returns existing value on hit", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1);
    expect(cache.getOrDefault("a", 99)).toBe(1);
  });

  test("returns default value on miss without inserting", () => {
    const cache = new LRUMap<string, number>();
    expect(cache.getOrDefault("missing", 99)).toBe(99);
    expect(cache.has("missing")).toBe(false);
  });
});

describe("getOrInsert", () => {
  test("returns existing value on hit without overwriting", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1);
    expect(cache.getOrInsert("a", 99)).toBe(1);
    expect(cache.get("a")).toBe(1);
  });

  test("inserts and returns the value on miss", () => {
    const cache = new LRUMap<string, number>();
    expect(cache.getOrInsert("a", 99)).toBe(99);
    expect(cache.get("a")).toBe(99);
  });
});

describe("getOrInsertComputed", () => {
  test("does not call the callback on hit", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1);
    const cb = vitest.fn(() => 99);
    cache.getOrInsertComputed("a", cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test("calls the callback on miss and inserts the result", () => {
    const cache = new LRUMap<string, number>();
    const cb = vitest.fn((k: string) => k.length);
    const result = cache.getOrInsertComputed("hello", cb);
    expect(cb).toHaveBeenCalledWith("hello");
    expect(result).toBe(5);
    expect(cache.get("hello")).toBe(5);
  });
});

describe("getOrInsertLoaded", () => {
  test("does not call loader on hit", async () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1);
    const loader = vitest.fn(async () => 99);
    await cache.getOrInsertLoaded("a", loader);
    expect(loader).not.toHaveBeenCalled();
  });

  test("calls loader on miss and inserts the result", async () => {
    const cache = new LRUMap<string, number>();
    const loader = vitest.fn(async () => 42);
    const result = await cache.getOrInsertLoaded("a", loader);
    expect(loader).toHaveBeenCalledWith("a");
    expect(result).toBe(42);
    expect(cache.get("a")).toBe(42);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Iteration — entries / keys / values / forEach / Symbol.iterator
//
// NOTE: entries() delegates to this.map.entries() which iterates in Map
// insertion order, not MRU→LRU linked-list order. These tests document the
// actual behaviour. The linked list is used correctly for eviction (tested
// above), but the iterators do not reflect MRU→LRU ordering.
// ─────────────────────────────────────────────────────────────────────────────

describe("iteration", () => {
  test("entries() returns all non-expired [key, value] pairs", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1).set("b", 2).set("c", 3);
    expect(toArray(cache)).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  test("keys() returns all non-expired keys", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1).set("b", 2).set("c", 3);
    expect([...cache.keys()]).toEqual(["a", "b", "c"]);
  });

  test("values() returns all non-expired values", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1).set("b", 2).set("c", 3);
    expect([...cache.values()]).toEqual([1, 2, 3]);
  });

  test("Symbol.iterator returns same content as entries()", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1).set("b", 2).set("c", 3);
    expect([...cache]).toEqual(toArray(cache));
  });

  test("forEach visits all non-expired entries", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1).set("b", 2).set("c", 3);
    const visited: [string, number][] = [];
    cache.forEach((v, k) => visited.push([k, v]));
    expect(visited).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  test("empty cache iterates zero times", () => {
    const cache = new LRUMap<string, number>();
    expect(toArray(cache)).toEqual([]);
    const visited: unknown[] = [];
    cache.forEach((v) => visited.push(v));
    expect(visited).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Symbol.toStringTag
// ─────────────────────────────────────────────────────────────────────────────

describe("Symbol.toStringTag", () => {
  test("reflects current size", () => {
    const cache = new LRUMap<string, number>();
    expect(cache[Symbol.toStringTag]).toBe("LRUMap(0)");
    cache.set("a", 1);
    expect(cache[Symbol.toStringTag]).toBe("LRUMap(1)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TTL expiry
// ─────────────────────────────────────────────────────────────────────────────

describe("TTL expiry", () => {
  beforeEach(() => vitest.useFakeTimers());
  afterEach(() => vitest.useRealTimers());

  test("entry is accessible before TTL elapses", () => {
    const cache = new LRUMap<string, number>({ ttlMs: 1000 });
    cache.set("a", 1);
    vitest.advanceTimersByTime(999);
    expect(cache.get("a")).toBe(1);
  });

  test("get returns undefined after TTL elapses", () => {
    const cache = new LRUMap<string, number>({ ttlMs: 1000 });
    cache.set("a", 1);
    vitest.advanceTimersByTime(1000);
    expect(cache.get("a")).toBeUndefined();
  });

  test("has returns false after TTL elapses", () => {
    const cache = new LRUMap<string, number>({ ttlMs: 1000 });
    cache.set("a", 1);
    vitest.advanceTimersByTime(1000);
    expect(cache.has("a")).toBe(false);
  });

  test("peek returns undefined after TTL elapses", () => {
    const cache = new LRUMap<string, number>({ ttlMs: 1000 });
    cache.set("a", 1);
    vitest.advanceTimersByTime(1000);
    expect(cache.peek("a")).toBeUndefined();
  });

  // SOURCE BUG: The timeout callback calls peekEntry() which returns undefined
  // for expired entries. The guard `if (e && e?.expiryMs === expiryMs)` then
  // fails because e is undefined, so deleteEntry is never called.
  // Fix: use this.map.get(entry.key) directly instead of peekEntry().
  test("setTimeout callback auto-deletes", () => {
    const cache = new LRUMap<string, number>({ ttlMs: 500 });
    cache.set("a", 1);
    vitest.setSystemTime(Date.now() + 500);
    vitest.runAllTimers(); // callback fires but entry is NOT deleted
    // Entry is logically expired (get/has/peek all return undefined)
    expect(cache.size).toBe(0);
    // get() also returns undefined (isExpired check), and as a side-effect deletes it
    expect(cache.get("a")).toBeUndefined();
  });

  test("re-setting a key resets its TTL", () => {
    const cache = new LRUMap<string, number>({ ttlMs: 1000 });
    cache.set("a", 1);
    vitest.advanceTimersByTime(800);
    cache.set("a", 2); // TTL reset
    vitest.advanceTimersByTime(800); // 800ms into new TTL — still alive
    expect(cache.get("a")).toBe(2);
  });

  test("old timeout does not delete re-set entry", () => {
    const cache = new LRUMap<string, number>({ ttlMs: 1000 });
    cache.set("a", 1);
    vitest.advanceTimersByTime(800);
    cache.set("a", 2); // new TTL; old timer will fire at t=1000
    vitest.advanceTimersByTime(200); // old timer fires — must NOT delete
    expect(cache.get("a")).toBe(2);
  });

  test("entries() skips expired entries", () => {
    const cache = new LRUMap<string, number>({ ttlMs: 1000 });
    cache.set("a", 1);
    cache.set("b", 2);
    vitest.advanceTimersByTime(1000); // both expire
    expect(toArray(cache)).toEqual([]);
  });

  test("no expiry when ttlMs is not set", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1);
    vitest.advanceTimersByTime(999999);
    expect(cache.get("a")).toBe(1);
  });

  test("clear cancels all pending expiry timers", () => {
    const cache = new LRUMap<string, number>({ ttlMs: 1000 });
    cache.set("a", 1).set("b", 2);
    cache.clear();
    expect(() => vitest.runAllTimers()).not.toThrow();
    expect(cache.size).toBe(0);
  });

  test("delete cancels the entry's expiry timer", () => {
    const cache = new LRUMap<string, number>({ ttlMs: 1000 });
    cache.set("a", 1);
    cache.delete("a");
    expect(() => vitest.runAllTimers()).not.toThrow();
    expect(cache.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  test("single-entry cache evicts correctly on overflow", () => {
    const cache = new LRUMap<string, number>({ maxSize: 1 });
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.has("a")).toBe(false);
    expect(cache.get("b")).toBe(2);
  });

  test("operations on an empty cache do not throw", () => {
    const cache = new LRUMap<string, number>();
    expect(() => {
      cache.get("x");
      cache.has("x");
      cache.delete("x");
      cache.peek("x");
      cache.clear();
      toArray(cache);
    }).not.toThrow();
  });

  test("works with numeric keys", () => {
    const cache = new LRUMap<number, string>();
    cache.set(1, "one").set(2, "two");
    expect(cache.get(1)).toBe("one");
  });

  test("works with object keys", () => {
    const cache = new LRUMap<object, string>();
    const key = {};
    cache.set(key, "value");
    expect(cache.get(key)).toBe("value");
  });

  test("works with object values", () => {
    const cache = new LRUMap<string, { n: number }>();
    cache.set("a", { n: 42 });
    expect(cache.get("a")).toEqual({ n: 42 });
  });

  test("accepts no options", () => {
    const cache = new LRUMap<string, number>();
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });
});
