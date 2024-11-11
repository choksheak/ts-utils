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

// Updating the DB name will cause all old entries to be gone.
const DEFAULT_DB_NAME = "KVStore";

// Updating the version will cause all old entries to be gone.
const DEFAULT_DB_VERSION = 1;

// Use a constant store name to keep things simple.
const STORE_NAME = "kvStore";

/** One day in milliseconds. */
export const MILLIS_PER_DAY = 86_400_000;

/** 30 days in ms. */
export const DEFAULT_EXPIRY_DELTA_MS = MILLIS_PER_DAY * 30;

/** Do GC once per day. */
export const GC_INTERVAL_MS = MILLIS_PER_DAY;

type StoredObject<T> = {
  key: string;
  value: T;
  expireMs: number;
};

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
    !("key" in obj) ||
    typeof obj.key !== "string" ||
    !("value" in obj) ||
    obj.value === undefined ||
    !("expireMs" in obj) ||
    typeof obj.expireMs !== "number" ||
    Date.now() >= obj.expireMs
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

export class KVStoreField<T> {
  public constructor(
    public readonly store: KVStore,
    public readonly key: string,
  ) {}

  public get(): Promise<T | undefined> {
    return this.store.get(this.key);
  }

  public set(t: T): Promise<T> {
    return this.store.set(this.key, t);
  }

  public delete(): Promise<void> {
    return this.store.delete(this.key);
  }
}

/**
 * You can create multiple KVStores if you want, but most likely you will only
 * need to use the default `kvStore` instance.
 */
export class KVStore {
  // We'll init the DB only on first use.
  private db: IDBDatabase | undefined;

  // Local storage key name for the last GC completed timestamp.
  public readonly gcMsStorageKey: string;

  public constructor(
    public readonly dbName: string,
    public readonly dbVersion: number,
    public readonly defaultExpiryDeltaMs: number,
  ) {
    this.gcMsStorageKey = `__kvStore:lastGcMs:${dbName}:v${dbVersion}:${STORE_NAME}`;
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
          const objectStore = db.createObjectStore(STORE_NAME, {
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
      const transaction = withOnError(db.transaction(STORE_NAME, mode), reject);

      transaction.onabort = (event) => {
        reject(event);
      };

      const objectStore = transaction.objectStore(STORE_NAME);

      callback(objectStore, resolve, reject);
    });
  }

  public async set<T>(
    key: string,
    value: T,
    expireDeltaMs: number = this.defaultExpiryDeltaMs,
  ): Promise<T> {
    const obj = {
      key,
      value,
      expireMs: Date.now() + expireDeltaMs,
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

  public async get<T>(key: string): Promise<T | undefined> {
    const stored = await this.transact<StoredObject<T> | undefined>(
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

      return obj.value;
    } catch (e) {
      console.error(`Invalid kv value: ${key}=${JSON.stringify(stored)}:`, e);
      await this.delete(key);

      this.gc(); // check GC on every read of an invalid key

      return undefined;
    }
  }

  public async forEach(
    callback: (
      key: string,
      value: unknown,
      expireMs: number,
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
            if (obj) {
              await callback(String(cursor.key), obj.value, obj.expireMs);
            } else {
              await callback(String(cursor.key), undefined, 0);
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
    await this.forEach((key, value, expireMs) => {
      map.set(key, { value, expireMs });
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

    if (Date.now() < lastGcMs + GC_INTERVAL_MS) {
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
      async (key: string, value: unknown, expireMs: number) => {
        if (value === undefined || Date.now() >= expireMs) {
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
  public field<T>(key: string) {
    return new KVStoreField<T>(this, key);
  }
}

/**
 * Default KV store ready for immediate use. You can create new instances if
 * you want, but most likely you will only need one store instance.
 */
export const kvStore = new KVStore(
  DEFAULT_DB_NAME,
  DEFAULT_DB_VERSION,
  DEFAULT_EXPIRY_DELTA_MS,
);
