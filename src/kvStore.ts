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
import { FullStorageAdapter, StoredObject } from "./storageAdapter";
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
// Using `any` because the store could store any type of data for each key,
// but the caller can specify a more specific type when calling each of the
// methods.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class KvStore implements FullStorageAdapter<any> {
  /** We'll init the DB only on first use. */
  private db: IDBDatabase | undefined;

  /** Local storage key name for the last GC completed timestamp. */
  public readonly gcMsStorageKey: string;

  public readonly dbVersion: number;
  public readonly storeName: string;
  public readonly defaultExpiryMs: number;
  public readonly gcIntervalMs: number;

  public constructor(
    public readonly dbName: string,
    options?: {
      dbVersion?: number;
      storeName?: string;
      defaultExpiryMs?: number | Duration;
      gcIntervalMs?: number | Duration;
    },
  ) {
    this.dbVersion = options?.dbVersion ?? KvStoreConfig.dbVersion;
    this.storeName = options?.storeName ?? KvStoreConfig.storeName;

    this.defaultExpiryMs = options?.defaultExpiryMs
      ? durationOrMsToMs(options.defaultExpiryMs)
      : KvStoreConfig.expiryMs;

    this.gcIntervalMs = options?.gcIntervalMs
      ? durationOrMsToMs(options.gcIntervalMs)
      : KvStoreConfig.gcIntervalMs;

    this.gcMsStorageKey = `__kvStore:lastGcMs:${dbName}:v${this.dbVersion}:${this.storeName}`;
  }

  private async getOrCreateDb() {
    if (!this.db) {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = withOnError(
          globalThis.indexedDB.open(this.dbName, this.dbVersion),
          reject,
        );

        request.onupgradeneeded = (event) => {
          const db = (event.target as unknown as { result: IDBDatabase })
            .result;

          // Create the store on DB init.
          const objectStore = db.createObjectStore(this.storeName, {
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

    return this.db;
  }

  private async transact<T>(
    mode: IDBTransactionMode,
    callback: (
      objectStore: IDBObjectStore,
      resolve: (t: T) => void,
      reject: (reason?: unknown) => void,
    ) => void,
  ): Promise<T> {
    const db = await this.getOrCreateDb();

    return await new Promise<T>((resolve, reject) => {
      const transaction = withOnError(
        db.transaction(this.storeName, mode),
        reject,
      );

      transaction.onabort = (event) => {
        reject(event);
      };

      const objectStore = transaction.objectStore(this.storeName);

      callback(objectStore, resolve, reject);
    });
  }

  /** Set a value in the store. */
  public async set<T>(
    key: string,
    value: T,
    expiryDeltaMs: number | Duration = this.defaultExpiryMs,
  ): Promise<T> {
    const nowMs = Date.now();
    const obj: KvStoredObject<T> = {
      key,
      value,
      storedMs: nowMs,
      expiryMs: nowMs + durationOrMsToMs(expiryDeltaMs),
    };

    return await this.transact<T>(
      "readwrite",
      (objectStore, resolve, reject) => {
        const request = withOnError(objectStore.put(obj), reject);

        request.onsuccess = () => {
          resolve(value);

          this.gc(); // check GC on every write
        };
      },
    );
  }

  /** Delete one or multiple keys. */
  public async delete(key: string | string[]): Promise<void> {
    return await this.transact<void>(
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
  }

  /** Mainly used to get the expiration timestamp of an object. */
  public async getStoredObject<T>(
    key: string,
  ): Promise<KvStoredObject<T> | undefined> {
    const stored = await this.transact<KvStoredObject<T> | undefined>(
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
      const obj = validateStoredObject(stored);
      if (!obj) {
        await this.delete(key);

        this.gc(); // check GC on every read of an expired key

        return undefined;
      }

      return obj;
    } catch (e) {
      console.error(`Invalid kv value: ${key}=${JSON.stringify(stored)}:`, e);
      await this.delete(key);

      this.gc(); // check GC on every read of an invalid key

      return undefined;
    }
  }

  /** Get a value by key, or undefined if it does not exist. */
  public async get<T>(key: string): Promise<T | undefined> {
    const obj = await this.getStoredObject<T>(key);

    return obj?.value;
  }

  /** Generic way to iterate through all entries. */
  public async forEach<T>(
    callback: (
      key: string,
      value: T,
      expiryMs: number,
      storedMs: number,
    ) => void | Promise<void>,
  ): Promise<void> {
    await this.transact<void>("readonly", (objectStore, resolve, reject) => {
      const request = withOnError(objectStore.openCursor(), reject);

      request.onsuccess = async (event) => {
        const cursor = (
          event.target as unknown as { result: IDBCursorWithValue }
        ).result;

        if (cursor) {
          if (cursor.key) {
            const obj = validateStoredObject(cursor.value);
            if (obj !== undefined) {
              await callback(
                String(cursor.key),
                obj.value as T,
                obj.expiryMs,
                obj.storedMs,
              );
            }
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  /**
   * Returns the number of items in the store. Note that getting the size
   * requires iterating through the entire store because the items could expire
   * at any time, and hence the size is a dynamic number.
   */
  public async size(): Promise<number> {
    let count = 0;
    await this.forEach(() => {
      count++;
    });
    return count;
  }

  /** Remove all items from the store. */
  public async clear(): Promise<void> {
    const keys: string[] = [];
    await this.forEach((key) => {
      keys.push(key);
    });

    await this.delete(keys);
  }

  /**
   * Returns all items as map of key to value, mainly used for debugging dumps.
   * The type T is applied to all values, even though they might not be of type
   * T (in the case when you store different data types in the same store).
   */
  public async asMap<T>(): Promise<Map<string, StoredObject<T>>> {
    const map = new Map<string, StoredObject<T>>();
    await this.forEach((key, value, expiryMs, storedMs) => {
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
  public async gc(): Promise<void> {
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
    await this.gcNow();
  }

  /**
   * Perform garbage collection immediately without checking whether we are
   * due for the next GC or not.
   */
  public async gcNow(): Promise<void> {
    console.log(`Starting kvStore GC on ${this.dbName} v${this.dbVersion}...`);

    // Prevent concurrent GC runs.
    this.lastGcMs = Date.now();

    const keysToDelete: string[] = [];
    await this.forEach(
      async (key: string, value: unknown, expiryMs: number) => {
        if (value === undefined || Date.now() >= expiryMs) {
          keysToDelete.push(key);
        }
      },
    );

    if (keysToDelete.length) {
      await this.delete(keysToDelete);
    }

    console.log(
      `Finished kvStore GC on ${this.dbName} v${this.dbVersion} ` +
        `- deleted ${keysToDelete.length} keys`,
    );

    // Mark the end time as last GC time.
    this.lastGcMs = Date.now();
  }
}

/**
 * Default KV store ready for immediate use. You can create new instances if
 * you want, but most likely you will only need one store instance.
 */
export const kvStore = new KvStore(KvStoreConfig.dbName);

/**
 * Class to represent one key in the store with a default expiration.
 */
export class KvStoreItem<T> {
  public readonly defaultExpiryMs: number;

  public constructor(
    public readonly key: string,
    defaultExpiryMs: number | Duration = KvStoreConfig.expiryMs,
    public readonly store = kvStore,
  ) {
    this.defaultExpiryMs = defaultExpiryMs && durationOrMsToMs(defaultExpiryMs);
  }

  /** Set a value in the store. */
  public async set(
    value: T,
    expiryDeltaMs: number | undefined = this.defaultExpiryMs,
  ): Promise<void> {
    await this.store.set(this.key, value, expiryDeltaMs);
  }

  /**
   * Example usage:
   *
   *   const { value, storedMs, expiryMs, storedMs } =
   *     await myKvItem.getStoredObject();
   */
  public async getStoredObject(): Promise<KvStoredObject<T> | undefined> {
    return await this.store.getStoredObject(this.key);
  }

  /** Get a value by key, or undefined if it does not exist. */
  public async get(): Promise<T | undefined> {
    return await this.store.get(this.key);
  }

  /** Delete this key from the store. */
  public async delete(): Promise<void> {
    await this.store.delete(this.key);
  }
}

/** Create a KV store item with a key and a default expiration. */
export function kvStoreItem<T>(
  key: string,
  expiryMs?: number | Duration,
  store = kvStore,
): KvStoreItem<T> {
  expiryMs = expiryMs && durationOrMsToMs(expiryMs);

  return new KvStoreItem<T>(key, expiryMs, store);
}
