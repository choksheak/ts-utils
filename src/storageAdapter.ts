import { Duration } from "./duration";

/**
 * Most basic interface for a storage implementation. This is designed to be
 * quite easily implemented by users to plug in any new underlying storage.
 */
export type StorageAdapter<T> = {
  set: (key: string, value: T) => Promise<void> | void;
  get: (key: string) => Promise<T | undefined> | T | undefined;
  delete: (key: string) => Promise<void> | void;
  clear: () => Promise<void> | void;
};

/** Most basic interface for stored object. */
export type StoredObject<T> = {
  value: T;
  storedMs: number;
  expiryMs: number;
};

/**
 * Full interface for a storage implementation. Each method can be either sync
 * or async, and the interface works with either implementation scheme.
 */
export type FullStorageAdapter<T> = StorageAdapter<T> & {
  // Redefining `set()`, but with an optional expiration parameter.
  set: (
    key: string,
    value: T,
    expiryDeltaMs?: number | Duration,
  ) => Promise<void> | void;

  getStoredObject: (
    key: string,
  ) => Promise<StoredObject<T> | undefined> | StoredObject<T> | undefined;

  forEach(
    callback: (
      key: string,
      value: T,
      expiryMs: number,
      storedMs: number,
    ) => void | Promise<void>,
  ): Promise<void> | void;

  size(): Promise<number> | number;

  asMap<T>():
    | Promise<Map<string, StoredObject<T>>>
    | Map<string, StoredObject<T>>;

  gc: () => Promise<void> | void;

  gcNow: () => Promise<void> | void;
};
