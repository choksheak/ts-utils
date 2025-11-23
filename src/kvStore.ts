/**
 * Indexed DB key-value store with support for auto-expirations.
 *
 * Why use this?
 * 1. No need to worry about running out of storage.
 * 2. Extremely simple interface to use indexed DBs.
 * 3. Auto-expirations frees you from worrying about data clean-up.
 * 4. Any serializable data type can be stored (except undefined).
 *
 * How to use?
 * Just use the `kvStore` global constant like the local storage.
 */

import { Duration, durationOrMsToMs } from "./duration";
import { MS_PER_DAY } from "./timeConstants";

/** Global defaults can be updated directly. */
export const KvStoreConfig = {
  // Updating the DB name will cause all old entries to be gone.
  dbName: "KVStore",

  // Updating the version will cause all old entries to be gone.
  dbVersion: 1,

  // Use a constant store name to keep things simple.
  storeName: "kvStore",

  /** 30 days in ms. */
  expiryDeltaMs: MS_PER_DAY * 30,

  /** Do GC once per day. */
  gcIntervalMs: MS_PER_DAY,
};

export type KvStoreConfig = typeof KvStoreConfig;

/** Convenience function to update global defaults. */
export function configureKvStore(config: Partial<KvStoreConfig>) {
  Object.assign(KvStoreConfig, config);
}

export type KvStoredObject<T> = {
  // The key is required by the ObjectStore.
  key: string;
  value: T;
  storedMs: number;
  expiryMs: number;
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
    !("key" in obj) ||
    typeof obj.key !== "string" ||
    !("value" in obj) ||
    !("storedMs" in obj) ||
    typeof obj.storedMs !== "number" ||
    obj.value === undefined ||
    !("expiryMs" in obj) ||
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
export class KvStore {
  // We'll init the DB only on first use.
  private db: IDBDatabase | undefined;

  // Local storage key name for the last GC completed timestamp.
  public readonly gcMsStorageKey: string;

  public constructor(
    public readonly dbName: string,
    public readonly dbVersion: number,
    public readonly defaultExpiryDeltaMs = KvStoreConfig.expiryDeltaMs,
    public readonly storeName = KvStoreConfig.storeName,
  ) {
    this.gcMsStorageKey = `__kvStore:lastGcMs:${dbName}:v${dbVersion}:${storeName}`;
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

  public async set<T>(
    key: string,
    value: T,
    expiryDeltaMs: number | Duration = this.defaultExpiryDeltaMs,
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

  public async get<T>(key: string): Promise<T | undefined> {
    const obj = await this.getStoredObject<T>(key);

    return obj?.value;
  }

  public async forEach<T>(
    callback: (key: string, value: T, expiryMs: number) => void | Promise<void>,
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
              await callback(String(cursor.key), obj.value as T, obj.expiryMs);
            }
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  /** Cannot be a getter because this needs to be async. */
  public async size() {
    let count = 0;
    await this.forEach(() => {
      count++;
    });
    return count;
  }

  public async clear() {
    const keys: string[] = [];
    await this.forEach((key) => {
      keys.push(key);
    });

    await this.delete(keys);
  }

  /** Mainly for debugging dumps. */
  public async asMap(): Promise<Map<string, unknown>> {
    const map = new Map<string, unknown>();
    await this.forEach((key, value, expiryMs) => {
      map.set(key, { value, expiryMs });
    });
    return map;
  }

  public get lastGcMs(): number {
    const lastGcMsStr = globalThis.localStorage.getItem(this.gcMsStorageKey);
    if (!lastGcMsStr) return 0;

    const ms = Number(lastGcMsStr);
    return isNaN(ms) ? 0 : ms;
  }

  public set lastGcMs(ms: number) {
    globalThis.localStorage.setItem(this.gcMsStorageKey, String(ms));
  }

  /** Perform garbage-collection if due. */
  public async gc() {
    const lastGcMs = this.lastGcMs;

    // Set initial timestamp - no need GC now.
    if (!lastGcMs) {
      this.lastGcMs = Date.now();
      return;
    }

    if (Date.now() < lastGcMs + KvStoreConfig.gcIntervalMs) {
      return; // not due for next GC yet
    }

    // GC is due now, so run it.
    await this.gcNow();
  }

  /** Perform garbage-collection immediately without checking. */
  public async gcNow() {
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

  /** Get an independent store item with a locked key and value type. */
  public getItem<T>(
    key: string,
    defaultExpiryDeltaMs?: number,
  ): KvStoreItem<T> {
    return new KvStoreItem<T>(key, defaultExpiryDeltaMs, this);
  }
}

/**
 * Default KV store ready for immediate use. You can create new instances if
 * you want, but most likely you will only need one store instance.
 */
export const kvStore = new KvStore(
  KvStoreConfig.dbName,
  KvStoreConfig.dbVersion,
  KvStoreConfig.expiryDeltaMs,
);

/**
 * Class to represent one key in the store with a default expiration.
 */
export class KvStoreItem<T> {
  public constructor(
    public readonly key: string,
    public readonly defaultExpiryDeltaMs?: number,
    public readonly store = kvStore,
  ) {}

  /**
   * Example usage:
   *
   *   const { value, storedMs, expiryMs } = await myKvItem.getStoredObject();
   */
  public async getStoredObject(): Promise<KvStoredObject<T> | undefined> {
    return await this.store.getStoredObject(this.key);
  }

  public async get(): Promise<T | undefined> {
    return await this.store.get(this.key);
  }

  public async set(
    value: T,
    expiryDeltaMs: number | undefined = this.defaultExpiryDeltaMs,
  ): Promise<void> {
    await this.store.set(this.key, value, expiryDeltaMs);
  }

  public async delete(): Promise<void> {
    await this.store.delete(this.key);
  }
}

/**
 * Create a KV store item with a key and a default expiration. This is
 * basically similar to using `kvStore.getItem(key, defaultExpiration)`, but is
 * mostly a shorthand for usages using each key independently as a top level
 * object.
 */
export function kvStoreItem<T>(
  key: string,
  defaultExpiration?: number | Duration,
  store = kvStore,
): KvStoreItem<T> {
  const defaultExpiryDeltaMs =
    defaultExpiration !== undefined
      ? durationOrMsToMs(defaultExpiration)
      : undefined;

  return new KvStoreItem<T>(key, defaultExpiryDeltaMs, store);
}
