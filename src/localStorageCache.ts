/**
 * Simple local storage cache with support for auto-expiration.
 * Note that this works in the browser context only because nodejs does not
 * have local storage.
 */
export class LocalStorageCache {
  public static setValue<T>(key: string, value: T, expireDeltaMs: number) {
    const expireMs = Date.now() + expireDeltaMs;
    const valueStr = JSON.stringify({ value, expireMs });

    globalThis.localStorage.setItem(key, valueStr);
  }

  public static getValue<T>(key: string, logError = true): T | undefined {
    const jsonStr = globalThis.localStorage.getItem(key);
    if (!jsonStr) return undefined;

    try {
      const obj: { value: T; expireMs: number } | undefined =
        JSON.parse(jsonStr);
      if (
        !obj ||
        typeof obj !== "object" ||
        !("value" in obj) ||
        !("expireMs" in obj)
      ) {
        globalThis.localStorage.removeItem(key);
        return undefined;
      }

      if (Date.now() >= obj.expireMs) {
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
}
