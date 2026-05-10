// ─────────────────────────────────────────────────────────────────────────────
// LRU Cache with TTL, size limit, auto GC, and peek.
//
// Interface design notes:
// 1. Event listeners - Not included as forseeable usage is very limited.
// 2. Cache hit/miss stats - Not included as these do not seem useful enough.
// 3. Peek - Included as there is no performance impact.
// 4. Max size - Seems like a common config needed for LRU caches, hence
//    included.
// 5. TTL - Seems useful because data could get stale, and having this avoids
//    requiring the user to implement this by themselves.
// 6. GC - Included because the GC is super efficient using timers. Users can
//    just ignore GC entirely and let it do its thing.
// 7. Map implementation - Uses the default Map implementation in ES, no need
//    to reinvent our own map here to save on a few nanoseconds (at best).
// ─────────────────────────────────────────────────────────────────────────────

/** All options are optional. */
export type LRUMapOptions = {
  /**
   * Maximum number of entries. Oldest entry is evicted when exceeded.
   * Defaults to no limit. 0 means "no max", not "no entries allowed".
   */
  maxSize?: number;

  /**
   * Time-to-live in milliseconds. Entries expire after this duration.
   * Defaults to no expiration. 0 means "no expiration", not
   * "expires immediately".
   */
  ttlMs?: number;
};

type Entry<K, V> = {
  key: K;
  value: V;
  /** Absolute expiry timestamp (ms), or undefined if no TTL. */
  expiryMs?: number;
  expiryTimeout?: ReturnType<typeof setTimeout>;
  prev?: Entry<K, V>;
  next?: Entry<K, V>;
};

/**
 * Strongly-typed LRU cache that implements the Map interface. You can also use
 * this as a size-limited map by setting maxSize.
 *
 * Values can be null, but cannot be undefined.
 */
export class LRUMap<K, V> implements Map<K, V> {
  private readonly options: LRUMapOptions;
  private readonly map = new Map<K, Entry<K, V>>();

  // Doubly-linked list — head.next = MRU, tail.prev = LRU
  // Sentinel nodes simplify edge cases.
  private readonly head = {} as Entry<K, V>;
  private readonly tail = {} as Entry<K, V>;

  public constructor(options?: LRUMapOptions) {
    this.options = { ...options }; // clone the argument
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  // ── Core API ───────────────────────────────────────────────────────────────

  /**
   * Store a value. Overwrites any existing entry for the key.
   * Note: Disallow setting a custom TTL because that will require us to do a
   * sorted insertion instead of an insert-at-front.
   */
  public set(key: K, value: V): this {
    const existingEntry = this.map.get(key);

    if (existingEntry) {
      existingEntry.value = value;
      this.setupExpiryTimeout(existingEntry);
      this.moveToFront(existingEntry);
    } else {
      // Evict LRU entry if over capacity.
      if (this.options.maxSize && this.map.size >= this.options.maxSize) {
        this.evictOldestEntry();
      }

      const entry: Entry<K, V> = { key, value };
      this.setupExpiryTimeout(entry);
      this.map.set(key, entry);
      this.insertAtFront(entry);
    }

    return this;
  }

  /**
   * Retrieve a value and mark it as recently used.
   * Returns `undefined` on miss or if the entry has expired.
   */
  public get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry || this.isExpired(entry)) {
      if (entry) this.deleteEntry(entry);
      return undefined;
    }

    // Don't renew expiration time on gets. If we do, stale entries might never
    // expire if we keep on reading them.
    this.moveToFront(entry);
    return entry.value;
  }

  /**
   * Read a value WITHOUT updating recency or hit/miss stats.
   * Useful for inspection or monitoring without polluting cache order.
   */
  public peek(key: K): V | undefined {
    return this.peekEntry(key)?.value;
  }

  /**
   * Get the existing value, or return a default value. Will not set the value
   * in the map.
   */
  public getOrDefault(key: K, defaultValue: V): V {
    const existingValue = this.get(key);
    if (existingValue !== undefined) {
      return existingValue;
    }

    return defaultValue;
  }

  /** Required by Map interface. */
  public getOrInsert(key: K, value: V): V {
    const existingValue = this.get(key);
    if (existingValue !== undefined) {
      return existingValue;
    }

    this.set(key, value);
    return value;
  }

  /** Required by Map interface. */
  public getOrInsertComputed(key: K, callback: (key: K) => V): V {
    const existingValue = this.get(key);
    if (existingValue !== undefined) {
      return existingValue;
    }

    const value = callback(key);
    this.set(key, value);
    return value;
  }

  /** Same as getOrInsertComputed, but async. */
  public async getOrInsertLoaded(
    key: K,
    loader: (key: K) => Promise<V>,
  ): Promise<V> {
    const existingValue = this.get(key);
    if (existingValue !== undefined) {
      return existingValue;
    }

    const loadedValue = await loader(key);
    this.set(key, loadedValue);
    return loadedValue;
  }

  /** Returns true if the key exists and has not expired. */
  public has(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.deleteEntry(entry);
      return false;
    }
    return true;
  }

  /** Remove a single entry. Returns true if the key existed. */
  public delete(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    this.deleteEntry(entry);
    return true;
  }

  /** Remove all entries. */
  public clear(): void {
    if (this.options.ttlMs) {
      for (const entry of this.map.values()) {
        if (entry.expiryTimeout) {
          clearTimeout(entry.expiryTimeout);
          delete entry.expiryTimeout;
        }
      }
    }

    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /** Number of entries currently in the cache (including expired ones). */
  public get size(): number {
    return this.map.size;
  }

  public get [Symbol.toStringTag](): string {
    return `LRUMap(${this.size})`;
  }

  // ── Iteration ──────────────────────────────────────────────────────────────

  /** Filter out expired entries. */
  public keys(): MapIterator<K> {
    return this.entries().map(([k]) => k);
  }

  /** Filter out expired entries. */
  public values(): MapIterator<V> {
    return this.entries().map(([, v]) => v);
  }

  /**
   * Iterate over [key, value] pairs (in insertion order), skipping expired
   * entries.
   * NOTE: Do not delete any entries, otherwise it will break the LRU data.
   */
  public entries(): MapIterator<[K, V]> {
    return this.map
      .entries()
      .filter(([, e]) => !this.isExpired(e))
      .map(([k, e]) => [k, e.value]);
  }

  /** NOTE: Do not delete any entries, otherwise it will break the LRU data. */
  public [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }

  /**
   * NOTE: Do not use the `map` argument as it will always be an empty Map.
   * The actual underlying map has a different value type.
   */
  public forEach(
    callbackFn: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: unknown,
  ): void {
    const tempMap = new Map<K, V>();

    this.map.forEach((entry, key) => {
      if (!this.isExpired(entry)) {
        callbackFn(entry.value, key, tempMap);
      }
    }, thisArg);
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private calcExpiry(): number | undefined {
    // When ttlMs=0, it means "no expiration", not "always expire".
    const ms = this.options.ttlMs;
    return ms ? Date.now() + ms : undefined;
  }

  private isExpired(entry: Entry<K, V>): boolean {
    // When expiryMs=0, it means "no expiration", not "already expired".
    return !!entry.expiryMs && Date.now() >= entry.expiryMs;
  }

  private peekEntry(key: K): Entry<K, V> | undefined {
    const entry = this.map.get(key);
    if (!entry || this.isExpired(entry)) {
      return undefined;
    }
    return entry;
  }

  private unrefTimer(t: ReturnType<typeof setTimeout>): void {
    const timer = t as unknown;

    if (
      timer &&
      typeof timer === "object" &&
      "unref" in timer &&
      typeof timer.unref === "function"
    ) {
      timer.unref();
    }
  }

  private setupExpiryTimeout(entry: Entry<K, V>) {
    if (!this.options.ttlMs) {
      return;
    }

    const expiryMs = (entry.expiryMs = this.calcExpiry());

    if (entry.expiryTimeout) {
      clearTimeout(entry.expiryTimeout);
    }

    entry.expiryTimeout = setTimeout(() => {
      if (entry.expiryMs === expiryMs) {
        this.deleteEntry(entry);
      }
    }, this.options.ttlMs);

    // NodeJS only: Allow process to exit before this timeout runs.
    this.unrefTimer(entry.expiryTimeout);
  }

  private insertAtFront(entry: Entry<K, V>): void {
    entry.prev = this.head;
    entry.next = this.head.next;
    this.head.next!.prev = entry;
    this.head.next = entry;
  }

  private removeFromList(entry: Entry<K, V>): void {
    entry.prev!.next = entry.next;
    entry.next!.prev = entry.prev;
  }

  private moveToFront(entry: Entry<K, V>): void {
    if (this.head.next === entry) return; // already MRU
    this.removeFromList(entry);
    this.insertAtFront(entry);
  }

  private evictOldestEntry(): void {
    const oldestEntry = this.tail.prev!;
    if (oldestEntry === this.head) return; // empty
    this.deleteEntry(oldestEntry);
  }

  private deleteEntry(entry: Entry<K, V>): void {
    if (entry.expiryTimeout) {
      clearTimeout(entry.expiryTimeout);
      delete entry.expiryTimeout;
    }

    this.removeFromList(entry);
    this.map.delete(entry.key);
  }
}
