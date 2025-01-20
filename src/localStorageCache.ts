import { Duration, durationToMs } from "./duration";

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
 * expires - Either a number in milliseconds, or a Duration object
 */
export function storeItem<T>(
  key: string,
  expires: number | Duration,
  logError = true,
  defaultValue?: T,
) {
  const expireDeltaMs =
    typeof expires === "number" ? expires : durationToMs(expires);

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
    defaultValue: T | undefined,
  ) {
    if (defaultValue !== undefined) {
      if (this.get() === undefined) {
        this.set(defaultValue);
      }
    }
  }

  /**
   * Set the value of this item with auto-expiration.
   */
  public set(value: T): void {
    const expireMs = Date.now() + this.expireDeltaMs;
    const valueStr = JSON.stringify({ value, expireMs });

    globalThis.localStorage.setItem(this.key, valueStr);
  }

  /**
   * Get the value of this item, or undefined if value is not set or expired.
   */
  public get(): T | undefined {
    const jsonStr = globalThis.localStorage.getItem(this.key);

    if (!jsonStr || typeof jsonStr !== "string") {
      return undefined;
    }

    try {
      const obj: { value: T; expireMs: number } | undefined =
        JSON.parse(jsonStr);
      if (
        !obj ||
        typeof obj !== "object" ||
        !("value" in obj) ||
        !("expireMs" in obj) ||
        typeof obj.expireMs !== "number" ||
        Date.now() >= obj.expireMs
      ) {
        globalThis.localStorage.removeItem(this.key);
        return undefined;
      }

      return obj.value;
    } catch (e) {
      if (this.logError) {
        console.error(
          `Found invalid storage value: ${this.key}=${jsonStr}:`,
          e,
        );
      }
      globalThis.localStorage.removeItem(this.key);
      return undefined;
    }
  }

  /**
   * Remove the value of this item.
   */
  public remove(): void {
    globalThis.localStorage.removeItem(this.key);
  }
}
