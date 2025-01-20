/**
 * Simple local storage cache with support for auto-expiration.
 * Note that this works in the browser context only because nodejs does not
 * have local storage.
 */
export function storeSet<T>(key: string, value: T, expireDeltaMs: number) {
  const expireMs = Date.now() + expireDeltaMs;
  const valueStr = JSON.stringify({ value, expireMs });

  globalThis.localStorage.setItem(key, valueStr);
}

export function storeGet<T>(key: string, logError = true): T | undefined {
  const jsonStr = globalThis.localStorage.getItem(key);

  if (!jsonStr || typeof jsonStr !== "string") {
    return undefined;
  }

  try {
    const obj: { value: T; expireMs: number } | undefined = JSON.parse(jsonStr);
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

export function storeRemove(key: string) {
  globalThis.localStorage.removeItem(key);
}

// Use static class to do the same thing.
export class LocalStorageCache {
  public static set<T>(key: string, value: T, expireDeltaMs: number) {
    return storeSet(key, value, expireDeltaMs);
  }

  public static get<T>(key: string, logError = true): T | undefined {
    return storeGet(key, logError);
  }

  public static remove(key: string) {
    return storeRemove(key);
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
    return storeSet(this.key, value, this.expireDeltaMs);
  }

  public get(): T | undefined {
    return storeGet(this.key, this.logError);
  }

  public remove(): void {
    return storeRemove(this.key);
  }
}

/** Same as LocalStorageCacheItem, but as a function. */
export function storeItem<T>(
  key: string,
  expireDeltaMs: number,
  logError = true,
  defaultValue?: T,
) {
  return new LocalStorageCacheItem<T>(
    key,
    expireDeltaMs,
    logError,
    defaultValue,
  );
}
