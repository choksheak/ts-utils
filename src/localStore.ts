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

export function createLocalStore(
  storeName: string,
  options?: {
    defaultExpiryMs?: number | Duration;
    gcIntervalMs?: number | Duration;
  },
) {
  const keyPrefix = storeName + ":";

  const defaultExpiryMs = options?.defaultExpiryMs
    ? durationOrMsToMs(options.defaultExpiryMs)
    : LocalStoreConfig.expiryMs;

  const gcIntervalMs = options?.gcIntervalMs
    ? durationOrMsToMs(options.gcIntervalMs)
    : LocalStoreConfig.gcIntervalMs;

  const gcMsStorageKey = `__localStore:lastGcMs:${storeName}`;

  const obj = {
    /** Input name for the store. */
    storeName,

    /**
     * The prefix string for the local storage key which identifies items
     * belonging to this namespace.
     */
    keyPrefix,

    /** Default expiry to use if not specified in set(). */
    defaultExpiryMs,

    /** Time interval for when GC's occur. */
    gcIntervalMs,

    /** Local storage key name for the last GC completed timestamp. */
    gcMsStorageKey,

    /** Set a value in the store. */
    set<T>(key: string, value: T, expiryDeltaMs?: number | Duration): T {
      const nowMs = Date.now();
      const stored: StoredObject<T> = {
        value,
        storedMs: nowMs,
        expiryMs: nowMs + durationOrMsToMs(expiryDeltaMs ?? defaultExpiryMs),
      };

      localStorage.setItem(keyPrefix + key, JSON.stringify(stored));

      obj.gc(); // check GC on every write

      return value;
    },

    /** Delete one or multiple keys. */
    delete(key: string | string[]): void {
      if (typeof key === "string") {
        localStorage.removeItem(keyPrefix + key);
      } else {
        for (const k of key) {
          localStorage.removeItem(keyPrefix + k);
        }
      }
    },

    /** Mainly used to get the expiration timestamp of an object. */
    getStoredObject<T>(key: string): StoredObject<T> | undefined {
      const k = keyPrefix + key;
      const stored = localStorage.getItem(k);

      if (!stored) {
        return undefined;
      }

      try {
        const parsed = JSON.parse(stored);
        const valid = validateStoredObject(parsed);
        if (!valid) {
          obj.delete(k);

          obj.gc(); // check GC on every read of an expired key

          return undefined;
        }

        return valid as StoredObject<T>;
      } catch (e) {
        console.error(`Invalid local value: ${k}=${stored}:`, e);
        obj.delete(k);

        obj.gc(); // check GC on every read of an invalid key

        return undefined;
      }
    },

    /** Get a value by key, or undefined if it does not exist. */
    get<T>(key: string): T | undefined {
      const stored = obj.getStoredObject<T>(key);

      return stored?.value;
    },

    /** Generic way to iterate through all entries. */
    forEach<T>(
      callback: (
        key: string,
        value: T,
        expiryMs: number,
        storedMs: number,
      ) => void,
    ): void {
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith(keyPrefix)) continue;

        const key = k.slice(keyPrefix.length);
        const stored = obj.getStoredObject(key);

        if (!stored) continue;

        callback(key, stored.value as T, stored.expiryMs, stored.storedMs);
      }
    },

    /**
     * Returns the number of items in the store. Note that getting the size
     * requires iterating through the entire store because the items could expire
     * at any time, and hence the size is a dynamic number.
     */
    size(): number {
      let count = 0;
      obj.forEach(() => {
        count++;
      });
      return count;
    },

    /** Remove all items from the store. */
    clear(): void {
      // Note that we don't need to use obj.forEach() because we are just
      // going to delete all the items without checking for expiration.
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(keyPrefix)) {
          localStorage.removeItem(key);
        }
      }
    },

    /**
     * Returns all items as map of key to value, mainly used for debugging dumps.
     * The type T is applied to all values, even though they might not be of type
     * T (in the case when you store different data types in the same store).
     */
    asMap<T>(): Map<string, StoredObject<T>> {
      const map = new Map<string, StoredObject<T>>();
      obj.forEach(
        (key: string, value: T, expiryMs: number, storedMs: number) => {
          map.set(key, { value: value as T, expiryMs, storedMs });
        },
      );
      return map;
    },

    /** Returns the ms timestamp for the last GC (garbage collection). */
    getLastGcMs(): number {
      const lastGcMsStr = localStorage.getItem(gcMsStorageKey);
      if (!lastGcMsStr) return 0;

      const ms = Number(lastGcMsStr);
      return isNaN(ms) ? 0 : ms;
    },

    /** Set the ms timestamp for the last GC (garbage collection). */
    setLastGcMs(ms: number) {
      localStorage.setItem(gcMsStorageKey, String(ms));
    },

    /** Perform garbage-collection if due, else do nothing. */
    gc(): void {
      const lastGcMs = obj.getLastGcMs();

      // Set initial timestamp - no need GC now.
      if (!lastGcMs) {
        obj.setLastGcMs(Date.now());
        return;
      }

      if (Date.now() < lastGcMs + gcIntervalMs) {
        return; // not due for next GC yet
      }

      // GC is due now, so run it.
      obj.gcNow();
    },

    /**
     * Perform garbage collection immediately without checking whether we are
     * due for the next GC or not.
     */
    gcNow(): void {
      console.log(`Starting localStore GC on ${storeName}`);

      // Prevent concurrent GC runs.
      obj.setLastGcMs(Date.now());
      let count = 0;

      obj.forEach((key: string, value: unknown, expiryMs: number) => {
        if (Date.now() >= expiryMs) {
          obj.delete(key);
          count++;
        }
      });

      console.log(
        `Finished localStore GC on ${storeName} - deleted ${count} keys`,
      );

      // Mark the end time as last GC time.
      obj.setLastGcMs(Date.now());
    },

    /** Returns `this` casted into a StorageAdapter<T>. */
    asStorageAdapter<T>(): StorageAdapter<T> {
      return obj as StorageAdapter<T>;
    },
  } as const;

  // Using `any` because the store could store any type of data for each key,
  // but the caller can specify a more specific type when calling each of the
  // methods.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return obj satisfies FullStorageAdapter<any>;
}

export type LocalStore = ReturnType<typeof createLocalStore>;

/**
 * Default local store ready for immediate use. You can create new instances if
 * you want, but most likely you will only need one store instance.
 */
export const localStore = createLocalStore(LocalStoreConfig.storeName);

/** Create a local store item with a key and a default expiration. */
export function localStoreItem<T>(
  key: string,
  expiryMs?: number | Duration,
  store: LocalStore = localStore,
) {
  const defaultExpiryMs = expiryMs && durationOrMsToMs(expiryMs);

  const obj = {
    key,
    defaultExpiryMs,
    store,

    /** Set a value in the store. */
    set(value: T, expiryDeltaMs?: number | undefined): void {
      store.set(key, value, expiryDeltaMs ?? defaultExpiryMs);
    },

    /**
     * Example usage:
     *
     *   const { value, storedMs, expiryMs, storedMs } =
     *     await myLocalItem.getStoredObject();
     */
    getStoredObject(): StoredObject<T> | undefined {
      return store.getStoredObject(key);
    },

    /** Get a value by key, or undefined if it does not exist. */
    get(): T | undefined {
      return store.get(key);
    },

    /** Delete this key from the store. */
    delete(): void {
      store.delete(key);
    },
  };

  return obj;
}

export type LocalStoreItem<T> = ReturnType<typeof localStoreItem<T>>;
