/**
 * Local storage key-value store with support for auto-expirations.
 *
 * Why use this?
 * 1. Extremely simple interface to use local storage.
 * 2. Auto-expirations with GC frees you from worrying about data clean-up.
 * 3. Any serializable data type can be stored (except undefined).
 *
 * How to use?
 * Just use the `localStore` global constant like the local storage.
 *
 * Why not use the localStorage directly?
 * localStorage does not provide auto-expirations with GC. If you don't need
 * this (items never expire), then just use localStorage directly.
 */

import { Duration, durationOrMsToMs } from "./duration";
import {
  FullStorageAdapter,
  StorageAdapter,
  StoredObject,
} from "./storageAdapter";
import { MS_PER_DAY } from "./timeConstants";

/** Global defaults can be updated directly. */
export const LocalStoreConfig = {
  /** All items with the same store name will share the same storage space. */
  storeName: "ts-utils",

  /** 30 days in ms. */
  expiryMs: MS_PER_DAY * 30,

  /** Do GC once per day. */
  gcIntervalMs: MS_PER_DAY,
};

export type LocalStoreConfig = typeof LocalStoreConfig;

/** Convenience function to update global defaults. */
export function configureLocalStore(config: Partial<LocalStoreConfig>) {
  Object.assign(LocalStoreConfig, config);
}

/**
 * Parse a stored value string. Returns undefined if invalid or expired.
 * Throws an error if the string cannot be parsed as JSON.
 */
function validateStoredObject<T>(
  obj: StoredObject<T>,
): StoredObject<T> | undefined {
  if (
    !obj ||
    typeof obj !== "object" ||
    obj.value === undefined ||
    typeof obj.storedMs !== "number" ||
    typeof obj.expiryMs !== "number" ||
    Date.now() >= obj.expiryMs
  ) {
    return undefined;
  }

  return obj;
}

/**
 * You can create multiple LocalStores if you want, but most likely you will only
 * need to use the default `localStore` instance.
 */
// Using `any` because the store could store any type of data for each key,
// but the caller can specify a more specific type when calling each of the
// methods.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class LocalStore implements FullStorageAdapter<any> {
  /**
   * The prefix string for the local storage key which identifies items
   * belonging to this namespace.
   */
  public readonly keyPrefix: string;

  /** Local storage key name for the last GC completed timestamp. */
  public readonly gcMsStorageKey: string;

  public readonly defaultExpiryMs: number;
  public readonly gcIntervalMs: number;

  public constructor(
    public readonly storeName: string,
    options?: {
      defaultExpiryMs?: number | Duration;
      gcIntervalMs?: number | Duration;
    },
  ) {
    this.keyPrefix = storeName + ":";

    this.defaultExpiryMs = options?.defaultExpiryMs
      ? durationOrMsToMs(options.defaultExpiryMs)
      : LocalStoreConfig.expiryMs;

    this.gcIntervalMs = options?.gcIntervalMs
      ? durationOrMsToMs(options.gcIntervalMs)
      : LocalStoreConfig.gcIntervalMs;

    this.gcMsStorageKey = `__localStore:lastGcMs:${storeName}`;
  }

  /** Set a value in the store. */
  public set<T>(
    key: string,
    value: T,
    expiryDeltaMs: number | Duration = this.defaultExpiryMs,
  ): T {
    const nowMs = Date.now();
    const obj: StoredObject<T> = {
      value,
      storedMs: nowMs,
      expiryMs: nowMs + durationOrMsToMs(expiryDeltaMs),
    };

    localStorage.setItem(this.keyPrefix + key, JSON.stringify(obj));

    this.gc(); // check GC on every write

    return value;
  }

  /** Delete one or multiple keys. */
  public delete(key: string | string[]): void {
    if (typeof key === "string") {
      localStorage.removeItem(this.keyPrefix + key);
    } else {
      for (const k of key) {
        localStorage.removeItem(this.keyPrefix + k);
      }
    }
  }

  /** Mainly used to get the expiration timestamp of an object. */
  public getStoredObject<T>(key: string): StoredObject<T> | undefined {
    const k = this.keyPrefix + key;
    const stored = localStorage.getItem(k);

    if (!stored) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(stored);
      const obj = validateStoredObject(parsed);
      if (!obj) {
        this.delete(k);

        this.gc(); // check GC on every read of an expired key

        return undefined;
      }

      return obj as StoredObject<T>;
    } catch (e) {
      console.error(`Invalid local value: ${k}=${stored}:`, e);
      this.delete(k);

      this.gc(); // check GC on every read of an invalid key

      return undefined;
    }
  }

  /** Get a value by key, or undefined if it does not exist. */
  public get<T>(key: string): T | undefined {
    const obj = this.getStoredObject<T>(key);

    return obj?.value;
  }

  /** Generic way to iterate through all entries. */
  public forEach<T>(
    callback: (
      key: string,
      value: T,
      expiryMs: number,
      storedMs: number,
    ) => void,
  ): void {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(this.keyPrefix)) continue;

      const key = k.slice(this.keyPrefix.length);
      const obj = this.getStoredObject(key);

      if (!obj) continue;

      callback(key, obj.value as T, obj.expiryMs, obj.storedMs);
    }
  }

  /**
   * Returns the number of items in the store. Note that getting the size
   * requires iterating through the entire store because the items could expire
   * at any time, and hence the size is a dynamic number.
   */
  public size(): number {
    let count = 0;
    this.forEach(() => {
      count++;
    });
    return count;
  }

  /** Remove all items from the store. */
  public clear(): void {
    // Note that we don't need to use this.forEach() because we are just
    // going to delete all the items without checking for expiration.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(this.keyPrefix)) {
        localStorage.removeItem(key);
      }
    }
  }

  /**
   * Returns all items as map of key to value, mainly used for debugging dumps.
   * The type T is applied to all values, even though they might not be of type
   * T (in the case when you store different data types in the same store).
   */
  public asMap<T>(): Map<string, StoredObject<T>> {
    const map = new Map<string, StoredObject<T>>();
    this.forEach((key, value, expiryMs, storedMs) => {
      map.set(key, { value: value as T, expiryMs, storedMs });
    });
    return map;
  }

  /** Returns the ms timestamp for the last GC (garbage collection). */
  public get lastGcMs(): number {
    const lastGcMsStr = globalThis.localStorage.getItem(this.gcMsStorageKey);
    if (!lastGcMsStr) return 0;

    const ms = Number(lastGcMsStr);
    return isNaN(ms) ? 0 : ms;
  }

  /** Set the ms timestamp for the last GC (garbage collection). */
  public set lastGcMs(ms: number) {
    globalThis.localStorage.setItem(this.gcMsStorageKey, String(ms));
  }

  /** Perform garbage-collection if due, else do nothing. */
  public gc(): void {
    const lastGcMs = this.lastGcMs;

    // Set initial timestamp - no need GC now.
    if (!lastGcMs) {
      this.lastGcMs = Date.now();
      return;
    }

    if (Date.now() < lastGcMs + this.gcIntervalMs) {
      return; // not due for next GC yet
    }

    // GC is due now, so run it.
    this.gcNow();
  }

  /**
   * Perform garbage collection immediately without checking whether we are
   * due for the next GC or not.
   */
  public gcNow(): void {
    console.log(`Starting localStore GC on ${this.storeName}`);

    // Prevent concurrent GC runs.
    this.lastGcMs = Date.now();
    let count = 0;

    this.forEach((key: string, value: unknown, expiryMs: number) => {
      if (Date.now() >= expiryMs) {
        this.delete(key);
        count++;
      }
    });

    console.log(
      `Finished localStore GC on ${this.storeName} - deleted ${count} keys`,
    );

    // Mark the end time as last GC time.
    this.lastGcMs = Date.now();
  }

  /** Returns `this` casted into a StorageAdapter<T>. */
  public asStorageAdapter<T>(): StorageAdapter<T> {
    return this as StorageAdapter<T>;
  }
}

/**
 * Default local store ready for immediate use. You can create new instances if
 * you want, but most likely you will only need one store instance.
 */
export const localStore = new LocalStore(LocalStoreConfig.storeName);

/**
 * Class to represent one key in the store with a default expiration.
 */
export class LocalStoreItem<T> {
  public readonly defaultExpiryMs: number;

  public constructor(
    public readonly key: string,
    defaultExpiryMs: number | Duration = LocalStoreConfig.expiryMs,
    public readonly store = localStore,
  ) {
    this.defaultExpiryMs = defaultExpiryMs && durationOrMsToMs(defaultExpiryMs);
  }

  /** Set a value in the store. */
  public set(
    value: T,
    expiryDeltaMs: number | undefined = this.defaultExpiryMs,
  ): void {
    this.store.set(this.key, value, expiryDeltaMs);
  }

  /**
   * Example usage:
   *
   *   const { value, storedMs, expiryMs, storedMs } =
   *     await myLocalItem.getStoredObject();
   */
  public getStoredObject(): StoredObject<T> | undefined {
    return this.store.getStoredObject(this.key);
  }

  /** Get a value by key, or undefined if it does not exist. */
  public get(): T | undefined {
    return this.store.get(this.key);
  }

  /** Delete this key from the store. */
  public delete(): void {
    this.store.delete(this.key);
  }
}

/** Create a local store item with a key and a default expiration. */
export function localStoreItem<T>(
  key: string,
  expiryMs?: number | Duration,
  store = localStore,
): LocalStoreItem<T> {
  expiryMs = expiryMs && durationOrMsToMs(expiryMs);

  return new LocalStoreItem<T>(key, expiryMs, store);
}
