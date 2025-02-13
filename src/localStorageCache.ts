import { Duration, durationOrMsToMs } from "./duration";

export type StoredItem<T> = { value: T; expireMs: number };

/**
 * Simple local storage cache with support for auto-expiration.
 * Note that this works in the browser context only because nodejs does not
 * have local storage.
 *
 * Create a cache item accessor object with auto-expiration. The value will
 * always be stored as a string by applying JSON.stringify(), and will be
 * returned in the same object type by applying JSON.parse().
 *
 * In order to provide proper type-checking, please always specify the T
 * type parameter. E.g. const item = storeItem<string>("name", 10_000);
 *
 * @param key The store key in local storage.
 * @param expires Either a number in milliseconds, or a Duration object
 * @param logError Log an error if we found an invalid object in the store.
 *   The invalid object is usually a string that cannot be parsed as JSON.
 * @param defaultValue Specify a default value to use for the object. Defaults
 *   to undefined.
 */
export function storeItem<T>(
  key: string,
  expires: number | Duration,
  logError = true,
  defaultValue?: T,
) {
  const expireDeltaMs = durationOrMsToMs(expires);

  return new CacheItem<T>(key, expireDeltaMs, logError, defaultValue);
}

class CacheItem<T> {
  /**
   * Create a cache item accessor object with auto-expiration.
   */
  public constructor(
    public readonly key: string,
    public readonly expireDeltaMs: number,
    public readonly logError: boolean,
    public readonly defaultValue: T | undefined,
  ) {}

  /**
   * Set the value of this item with auto-expiration.
   */
  public set(value: T): void {
    const expireMs = Date.now() + this.expireDeltaMs;
    const toStore: StoredItem<T> = { value, expireMs };
    const valueStr = JSON.stringify(toStore);

    globalThis.localStorage.setItem(this.key, valueStr);
  }

  /**
   * Get the value of this item, or undefined if value is not set or expired.
   */
  public get(): T | undefined {
    const jsonStr = globalThis.localStorage.getItem(this.key);

    if (!jsonStr) {
      return this.defaultValue;
    }

    try {
      const obj: StoredItem<T> | undefined = JSON.parse(jsonStr);

      if (
        !obj ||
        typeof obj !== "object" ||
        !("value" in obj) ||
        !("expireMs" in obj) ||
        typeof obj.expireMs !== "number" ||
        Date.now() >= obj.expireMs
      ) {
        this.remove();
        return this.defaultValue;
      }

      return obj.value;
    } catch (e) {
      if (this.logError) {
        console.error(
          `Found invalid storage value: ${this.key}=${jsonStr}:`,
          e,
        );
      }
      this.remove();
      return this.defaultValue;
    }
  }

  /**
   * Remove the value of this item.
   */
  public remove(): void {
    globalThis.localStorage.removeItem(this.key);
  }
}
