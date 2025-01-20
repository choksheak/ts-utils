/**
 * Simple local storage cache with support for auto-expiration.
 * Note that this works in the browser context only because nodejs does not
 * have local storage.
 */
export class LocalStorageCache {
  public static set<T>(key: string, value: T, expireDeltaMs: number) {
    const expireMs = Date.now() + expireDeltaMs;
    const valueStr = JSON.stringify({ value, expireMs });

    globalThis.localStorage.setItem(key, valueStr);
  }

  public static get<T>(key: string, logError = true): T | undefined {
    const jsonStr = globalThis.localStorage.getItem(key);

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
        globalThis.localStorage.removeItem(key);
        return undefined;
      }

      return obj.value;
    } catch (e) {
      if (logError) {
        console.error(`Found invalid storage value: ${key}=${jsonStr}:`, e);
      }
      globalThis.localStorage.removeItem(key);
      return undefined;
    }
  }

  public static remove(key: string) {
    globalThis.localStorage.removeItem(key);
  }
}

/** Same as above, but saves some config for reuse. */
export class LocalStorageCacheItem<T> {
  public constructor(
    public readonly key: string,
    public readonly expireDeltaMs: number,
    public readonly logError = true,
    defaultValue?: T,
  ) {
    if (defaultValue !== undefined) {
      if (this.get() === undefined) {
        this.set(defaultValue);
      }
    }
  }

  public set(value: T): void {
    LocalStorageCache.set(this.key, value, this.expireDeltaMs);
  }

  public get(): T | undefined {
    return LocalStorageCache.get(this.key, this.logError);
  }

  public remove(): void {
    return LocalStorageCache.remove(this.key);
  }
}
