/**
 * Indexed DB key-value store with support for auto-expirations.
 *
 * Why use this?
 * 1. Extremely simple interface to use indexed DBs.
 * 2. Auto-expirations with GC frees you from worrying about data clean-up.
 * 3. Any serializable data type can be stored (except undefined).
 *
 * How to use?
 * Just use the `kvStore` global constant like the local storage, but with
 * async interface functions as required by indexed DB.
 *
 * Why not use the indexed DB directly?
 * It will require you to write a lot of code to reinvent the wheel.
 */

import { Duration, durationOrMsToMs } from "./duration";
import {
  FullStorageAdapter,
  StorageAdapter,
  StoredObject,
} from "./storageAdapter";
import { MS_PER_DAY } from "./timeConstants";

/** Global defaults can be updated directly. */
export const KvStoreConfig = {
  /**
   * Name of the DB in the indexed DB.
   * Updating the DB name will cause all old entries to be gone.
   */
  dbName: "KVStore",

  /**
   * Version of the DB schema. Most likely you will never want to change this.
   * Updating the version will cause all old entries to be gone.
   */
  dbVersion: 1,

  /**
   * Name of the store within the indexed DB. Each DB can have multiple stores.
   * In practice, it doesn't matter what you name this to be.
   */
  storeName: "kvStore",

  /** 30 days in ms. */
  expiryMs: MS_PER_DAY * 30,

  /** Do GC once per day. */
  gcIntervalMs: MS_PER_DAY,
};

export type KvStoreConfig = typeof KvStoreConfig;

/** Convenience function to update global defaults. */
export function configureKvStore(config: Partial<KvStoreConfig>) {
  Object.assign(KvStoreConfig, config);
}

/** Type to represent a full object with metadata stored in the store. */
export type KvStoredObject<T> = StoredObject<T> & {
  // The key is required by the ObjectStore.
  key: string;
};

/**
 * Parse a stored value string. Returns undefined if invalid or expired.
 * Throws an error if the string cannot be parsed as JSON.
 */
function validateStoredObject<T>(
  obj: KvStoredObject<T>,
): KvStoredObject<T> | undefined {
  if (
    !obj ||
    typeof obj !== "object" ||
    typeof obj.key !== "string" ||
    obj.value === undefined ||
    typeof obj.storedMs !== "number" ||
    typeof obj.expiryMs !== "number" ||
    Date.now() >= obj.expiryMs
  ) {
    return undefined;
  }

  return obj;
}

/** Add an `onerror` handler to the request. */
function withOnError<T extends IDBRequest | IDBTransaction>(
  request: T,
  reject: (reason?: unknown) => void,
): T {
  request.onerror = (event) => {
    reject(event);
  };

  return request;
}

/**
 * You can create multiple KvStores if you want, but most likely you will only
 * need to use the default `kvStore` instance.
 */
export function createKvStore(
  dbName: string,
  options?: {
    dbVersion?: number;
    storeName?: string;
    defaultExpiryMs?: number | Duration;
    gcIntervalMs?: number | Duration;
  },
) {
  /** We'll init the DB only on first use. */
  let db: IDBDatabase | undefined;

  const dbVersion = options?.dbVersion ?? KvStoreConfig.dbVersion;
  const storeName = options?.storeName ?? KvStoreConfig.storeName;

  const defaultExpiryMs = options?.defaultExpiryMs
    ? durationOrMsToMs(options.defaultExpiryMs)
    : KvStoreConfig.expiryMs;

  const gcIntervalMs = options?.gcIntervalMs
    ? durationOrMsToMs(options.gcIntervalMs)
    : KvStoreConfig.gcIntervalMs;

  const gcMsStorageKey = `__kvStore:lastGcMs:${dbName}:v${dbVersion}:${storeName}`;

  async function getOrCreateDb() {
    if (!db) {
      db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = withOnError(indexedDB.open(dbName, dbVersion), reject);

        request.onupgradeneeded = (event) => {
          const db = (event.target as unknown as { result: IDBDatabase })
            .result;

          // Create the store on DB init.
          const objectStore = db.createObjectStore(storeName, {
            keyPath: "key",
          });

          objectStore.createIndex("key", "key", {
            unique: true,
          });
        };

        request.onsuccess = (event) => {
          const db = (event.target as unknown as { result: IDBDatabase })
            .result;
          resolve(db);
        };
      });
    }

    return db;
  }

  async function transact<T>(
    mode: IDBTransactionMode,
    callback: (
      objectStore: IDBObjectStore,
      resolve: (t: T) => void,
      reject: (reason?: unknown) => void,
    ) => void,
  ): Promise<T> {
    const db = await getOrCreateDb();

    return await new Promise<T>((resolve, reject) => {
      const transaction = withOnError(db.transaction(storeName, mode), reject);

      transaction.onabort = (event) => {
        reject(event);
      };

      const objectStore = transaction.objectStore(storeName);

      callback(objectStore, resolve, reject);
    });
  }

  const obj = {
    /** Input name for the DB. */
    dbName,

    /** Input version for the DB. */
    dbVersion,

    /** Input name for the DB store. */
    storeName,

    /** Default expiry to use if not specified in set(). */
    defaultExpiryMs,

    /** Time interval for when GC's occur. */
    gcIntervalMs,

    /** Local storage key name for the last GC completed timestamp. */
    gcMsStorageKey,

    /** Set a value in the store. */
    async set<T>(
      key: string,
      value: T,
      expiryDeltaMs?: number | Duration,
    ): Promise<T> {
      const nowMs = Date.now();
      const stored: KvStoredObject<T> = {
        key,
        value,
        storedMs: nowMs,
        expiryMs: nowMs + durationOrMsToMs(expiryDeltaMs ?? defaultExpiryMs),
      };

      return await transact<T>("readwrite", (objectStore, resolve, reject) => {
        const request = withOnError(objectStore.put(stored), reject);

        request.onsuccess = () => {
          resolve(value);

          obj.gc(); // check GC on every write
        };
      });
    },

    /** Delete one or multiple keys. */
    async delete(key: string | string[]): Promise<void> {
      return await transact<void>(
        "readwrite",
        (objectStore, resolve, reject) => {
          objectStore.transaction.oncomplete = () => {
            resolve();
          };

          if (typeof key === "string") {
            withOnError(objectStore.delete(key), reject);
          } else {
            for (const k of key) {
              withOnError(objectStore.delete(k), reject);
            }
          }
        },
      );
    },

    /** Mainly used to get the expiration timestamp of an object. */
    async getStoredObject<T>(
      key: string,
    ): Promise<KvStoredObject<T> | undefined> {
      const stored = await transact<KvStoredObject<T> | undefined>(
        "readonly",
        (objectStore, resolve, reject) => {
          const request = withOnError(objectStore.get(key), reject);

          request.onsuccess = () => {
            resolve(request.result);
          };
        },
      );

      if (!stored) {
        return undefined;
      }

      try {
        const valid = validateStoredObject(stored);
        if (!valid) {
          await obj.delete(key);

          obj.gc(); // check GC on every read of an expired key

          return undefined;
        }

        return valid;
      } catch (e) {
        console.error(`Invalid kv value: ${key}=${JSON.stringify(stored)}:`, e);
        await obj.delete(key);

        obj.gc(); // check GC on every read of an invalid key

        return undefined;
      }
    },

    /** Get a value by key, or undefined if it does not exist. */
    async get<T>(key: string): Promise<T | undefined> {
      const stored = await obj.getStoredObject<T>(key);

      return stored?.value;
    },

    /** Generic way to iterate through all entries. */
    async forEach<T>(
      callback: (
        key: string,
        value: T,
        expiryMs: number,
        storedMs: number,
      ) => void | Promise<void>,
    ): Promise<void> {
      await transact<void>("readonly", (objectStore, resolve, reject) => {
        const request = withOnError(objectStore.openCursor(), reject);

        request.onsuccess = async (event) => {
          const cursor = (
            event.target as unknown as { result: IDBCursorWithValue }
          ).result;

          if (cursor) {
            if (cursor.key) {
              const valid = validateStoredObject(cursor.value);
              if (valid !== undefined) {
                await callback(
                  String(cursor.key),
                  valid.value as T,
                  valid.expiryMs,
                  valid.storedMs,
                );
              }
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
    },

    /**
     * Returns the number of items in the store. Note that getting the size
     * requires iterating through the entire store because the items could expire
     * at any time, and hence the size is a dynamic number.
     */
    async size(): Promise<number> {
      let count = 0;
      await obj.forEach(() => {
        count++;
      });
      return count;
    },

    /** Remove all items from the store. */
    async clear(): Promise<void> {
      await transact<void>("readwrite", (objectStore, resolve, reject) => {
        const request = withOnError(objectStore.clear(), reject);

        request.onsuccess = () => {
          resolve();
        };
      });
    },

    /**
     * Returns all items as map of key to value, mainly used for debugging dumps.
     * The type T is applied to all values, even though they might not be of type
     * T (in the case when you store different data types in the same store).
     */
    async asMap<T>(): Promise<Map<string, StoredObject<T>>> {
      const map = new Map<string, StoredObject<T>>();
      await obj.forEach((key, value, expiryMs, storedMs) => {
        map.set(key, { value: value as T, expiryMs, storedMs });
      });
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
    async gc(): Promise<void> {
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
      await obj.gcNow();
    },

    /**
     * Perform garbage collection immediately without checking whether we are
     * due for the next GC or not.
     */
    async gcNow(): Promise<void> {
      console.log(`Starting kvStore GC on ${dbName} v${dbVersion}...`);

      // Prevent concurrent GC runs.
      obj.setLastGcMs(Date.now());

      const keysToDelete: string[] = [];
      await obj.forEach(
        async (key: string, value: unknown, expiryMs: number) => {
          if (value === undefined || Date.now() >= expiryMs) {
            keysToDelete.push(key);
          }
        },
      );

      if (keysToDelete.length) {
        await obj.delete(keysToDelete);
      }

      console.log(
        `Finished kvStore GC on ${dbName} v${dbVersion} ` +
          `- deleted ${keysToDelete.length} keys`,
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

export type KvStore = ReturnType<typeof createKvStore>;

/**
 * Default KV store ready for immediate use. You can create new instances if
 * you want, but most likely you will only need one store instance.
 */
export const kvStore = createKvStore(KvStoreConfig.dbName);

/** Create a KV store item with a key and a default expiration. */
export function kvStoreItem<T>(
  key: string,
  expiryMs?: number | Duration,
  store: KvStore = kvStore,
) {
  const defaultExpiryMs = expiryMs && durationOrMsToMs(expiryMs);

  const obj = {
    key,
    defaultExpiryMs,
    store,

    /** Set a value in the store. */
    async set(value: T, expiryDeltaMs?: number | undefined): Promise<void> {
      await store.set(key, value, expiryDeltaMs ?? defaultExpiryMs);
    },

    /**
     * Example usage:
     *
     *   const { value, storedMs, expiryMs, storedMs } =
     *     await myKvItem.getStoredObject();
     */
    async getStoredObject(): Promise<KvStoredObject<T> | undefined> {
      return await store.getStoredObject(key);
    },

    /** Get a value by key, or undefined if it does not exist. */
    async get(): Promise<T | undefined> {
      return await store.get(key);
    },

    /** Delete this key from the store. */
    async delete(): Promise<void> {
      await store.delete(key);
    },
  } as const;

  return obj;
}

/** Class to represent one key in the store with a default expiration. */
export type KvStoreItem<T> = ReturnType<typeof kvStoreItem<T>>;
