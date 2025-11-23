/**
 * Local storage key-value store with support for auto-expirations.
 *
 * Why use this?
 * 1. No need to worry about running out of storage.
 * 2. Extremely simple interface to use local storage.
 * 3. Auto-expirations frees you from worrying about data clean-up.
 * 4. Any serializable data type can be stored (except undefined).
 *
 * How to use?
 * Just use the `localStore` global constant like the local storage.
 */

import { Duration, durationOrMsToMs } from "./duration";
import { MS_PER_DAY } from "./timeConstants";

/** Global defaults can be updated directly. */
export const LocalStoreConfig = {
  /** All items with the same store name will share the same storage space. */
  storeName: "ts-utils",

  /** 30 days in ms. */
  expiryDeltaMs: MS_PER_DAY * 30,

  /** Do GC once per day. */
  gcIntervalMs: MS_PER_DAY,
};

export type LocalStoreConfig = typeof LocalStoreConfig;

/** Convenience function to update global defaults. */
export function configureLocalStore(config: Partial<LocalStoreConfig>) {
  Object.assign(LocalStoreConfig, config);
}

export type LocalStoredObject<T> = {
  value: T;
  storedMs: number;
  expiryMs: number;
};

/**
 * Parse a stored value string. Returns undefined if invalid or expired.
 * Throws an error if the string cannot be parsed as JSON.
 */
function validateStoredObject<T>(
  obj: LocalStoredObject<T>,
): LocalStoredObject<T> | undefined {
  if (
    !obj ||
    typeof obj !== "object" ||
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

/**
 * You can create multiple LocalStores if you want, but most likely you will only
 * need to use the default `localStore` instance.
 */
export class LocalStore {
  /**
   * The prefix string for the local storage key which identifies items
   * belonging to this namespace.
   */
  public readonly keyPrefix: string;

  /** Local storage key name for the last GC completed timestamp. */
  public readonly gcMsStorageKey: string;

  public constructor(
    public readonly storeName: string,
    public readonly defaultExpiryDeltaMs = LocalStoreConfig.expiryDeltaMs,
  ) {
    this.keyPrefix = storeName + ":";
    this.gcMsStorageKey = `__localStore:lastGcMs:${storeName}`;
  }

  public set<T>(
    key: string,
    value: T,
    expiryDeltaMs: number | Duration = this.defaultExpiryDeltaMs,
  ): T {
    const nowMs = Date.now();
    const obj: LocalStoredObject<T> = {
      value,
      storedMs: nowMs,
      expiryMs: nowMs + durationOrMsToMs(expiryDeltaMs),
    };

    localStorage.setItem(this.keyPrefix + key, JSON.stringify(obj));

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
  public getStoredObject<T>(key: string): LocalStoredObject<T> | undefined {
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

      return obj as LocalStoredObject<T>;
    } catch (e) {
      console.error(`Invalid local value: ${k}=${JSON.stringify(stored)}:`, e);
      this.delete(k);

      this.gc(); // check GC on every read of an invalid key

      return undefined;
    }
  }

  public get<T>(key: string): T | undefined {
    const obj = this.getStoredObject<T>(key);

    return obj?.value;
  }

  public async forEach<T>(
    callback: (key: string, value: T, expiryMs: number) => void,
  ): Promise<void> {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(this.keyPrefix)) continue;

      const v = localStorage.getItem(k);
      if (!v) continue;

      const parsed = JSON.parse(v);
      const obj = validateStoredObject(parsed);
      if (obj === undefined) {
        localStorage.removeItem(k);
        continue;
      }

      callback(k.slice(this.keyPrefix.length), obj.value as T, obj.expiryMs);
    }
  }

  public size(): number {
    let count = 0;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(this.keyPrefix)) {
        count++;
      }
    }
    return count;
  }

  public clear(): void {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(this.keyPrefix)) {
        localStorage.removeItem(key);
      }
    }
  }

  /** Mainly for debugging dumps. */
  public asMap(): Map<string, unknown> {
    const map = new Map<string, unknown>();
    this.forEach((key, value, expiryMs) => {
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
  public gc() {
    const lastGcMs = this.lastGcMs;

    // Set initial timestamp - no need GC now.
    if (!lastGcMs) {
      this.lastGcMs = Date.now();
      return;
    }

    if (Date.now() < lastGcMs + LocalStoreConfig.gcIntervalMs) {
      return; // not due for next GC yet
    }

    // GC is due now, so run it.
    this.gcNow();
  }

  /** Perform garbage-collection immediately without checking. */
  public gcNow() {
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

  /** Get an independent store item with a locked key and value type. */
  public getItem<T>(
    key: string,
    defaultExpiryDeltaMs?: number,
  ): LocalStoreItem<T> {
    return new LocalStoreItem<T>(key, defaultExpiryDeltaMs, this);
  }
}

/**
 * Default local store ready for immediate use. You can create new instances if
 * you want, but most likely you will only need one store instance.
 */
export const localStore = new LocalStore(
  LocalStoreConfig.storeName,
  LocalStoreConfig.expiryDeltaMs,
);

/**
 * Class to represent one key in the store with a default expiration.
 */
export class LocalStoreItem<T> {
  public constructor(
    public readonly key: string,
    public readonly defaultExpiryDeltaMs?: number,
    public readonly store = localStore,
  ) {}

  /**
   * Example usage:
   *
   *   const { value, storedMs, expiryMs } = await myLocalItem.getStoredObject();
   */
  public getStoredObject(): LocalStoredObject<T> | undefined {
    return this.store.getStoredObject(this.key);
  }

  public get(): T | undefined {
    return this.store.get(this.key);
  }

  public set(
    value: T,
    expiryDeltaMs: number | undefined = this.defaultExpiryDeltaMs,
  ): void {
    this.store.set(this.key, value, expiryDeltaMs);
  }

  public delete(): void {
    this.store.delete(this.key);
  }
}

/**
 * Create a local store item with a key and a default expiration. This is
 * basically similar to using `localStore.getItem(key, defaultExpiration)`, but is
 * mostly a shorthand for usages using each key independently as a top level
 * object.
 */
export function localStoreItem<T>(
  key: string,
  defaultExpiration?: number | Duration,
  store = localStore,
): LocalStoreItem<T> {
  const defaultExpiryDeltaMs =
    defaultExpiration !== undefined
      ? durationOrMsToMs(defaultExpiration)
      : undefined;

  return new LocalStoreItem<T>(key, defaultExpiryDeltaMs, store);
}
