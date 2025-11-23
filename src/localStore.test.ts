import "mock-local-storage";

import { Mock, vi } from "vitest";

import { localStore, LocalStoreConfig } from "./localStore";

describe("localStore", () => {
  beforeEach(() => {
    localStore.clear();
  });

  afterAll(() => {
    localStore.clear();
  });

  test("get, set, delete", async () => {
    expect(localStore.get("hi")).toBe(undefined);
    expect(localStore.set("hi", 1)).toBe(1);
    expect(localStore.get("hi")).toBe(1);
    expect(localStore.delete("hi")).toBe(undefined);
    expect(localStore.get("hi")).toBe(undefined);
  });

  test("get and set objects", async () => {
    expect(localStore.set("hi", "ho")).toBe("ho");
    expect(localStore.get("hi")).toBe("ho");

    expect(localStore.set("hi", true)).toBe(true);
    expect(localStore.get("hi")).toBe(true);

    expect(localStore.set("hi", null)).toBe(null);
    expect(localStore.get("hi")).toBe(null);

    expect(localStore.set("hi", undefined)).toBe(undefined);
    expect(localStore.get("hi")).toBe(undefined);

    const ms1 = Date.now();

    expect(localStore.set("hi", { a: 1 })).toEqual({ a: 1 });
    expect(localStore.get("hi")).toEqual({ a: 1 });

    const stored = localStore.getStoredObject("hi");
    const ms2 = Date.now();

    expect(stored?.value).toEqual({ a: 1 });
    expect(stored?.storedMs).toBeGreaterThanOrEqual(ms1);
    expect(stored?.storedMs).toBeLessThanOrEqual(ms2);
  });

  test("forEach", async () => {
    const fn = vi.fn();
    localStore.forEach(fn);
    expect(fn).toHaveBeenCalledTimes(0);

    let startMs = Date.now();
    localStore.set("hi", 1);
    let endMs = Date.now();
    localStore.forEach(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBe("hi");
    expect(fn.mock.calls[0][1]).toBe(1);

    const expireMs = fn.mock.calls[0][2];
    expect(expireMs).toBeGreaterThanOrEqual(
      startMs + LocalStoreConfig.expiryMs,
    );
    expect(expireMs).toBeLessThanOrEqual(endMs + LocalStoreConfig.expiryMs);

    // Should not be able to add duplicate keys.
    fn.mockClear();

    startMs = Date.now();
    localStore.set("hi", 2);
    endMs = Date.now();
    localStore.forEach(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBe("hi");
    expect(fn.mock.calls[0][1]).toBe(2);

    const expireMs2 = fn.mock.calls[0][2];
    expect(expireMs2).toBeGreaterThanOrEqual(expireMs);
    expect(expireMs2).toBeGreaterThanOrEqual(
      startMs + LocalStoreConfig.expiryMs,
    );
    expect(expireMs2).toBeLessThanOrEqual(endMs + LocalStoreConfig.expiryMs);

    // Add a new key.
    fn.mockClear();

    startMs = Date.now();
    localStore.set("ho", { b: 2 });
    endMs = Date.now();
    localStore.forEach(fn);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[0][0]).toBe("hi");
    expect(fn.mock.calls[0][1]).toBe(2);
    expect(fn.mock.calls[1][0]).toBe("ho");
    expect(fn.mock.calls[1][1]).toEqual({ b: 2 });
  });

  test("size", async () => {
    expect(localStore.size()).toBe(0);

    localStore.set("hi", 1);

    expect(localStore.size()).toBe(1);

    localStore.set("hi", 2);

    expect(localStore.size()).toBe(1);

    localStore.set("ho", { b: 3 });

    expect(localStore.size()).toBe(2);
  });

  describe("gc", () => {
    let gcNow: Mock;

    beforeAll(() => {
      gcNow = vi.spyOn(localStore, "gcNow").mockResolvedValue();
    });

    beforeEach(() => {
      globalThis.localStorage.removeItem(localStore.gcMsStorageKey);
    });

    afterAll(() => {
      globalThis.localStorage.removeItem(localStore.gcMsStorageKey);
      gcNow.mockRestore();
    });

    test("set initial timestamp", async () => {
      const startMs = Date.now();
      localStore.gc();
      const endMs = Date.now();

      const lastGcMs = localStore.lastGcMs;
      expect(lastGcMs).toBeGreaterThanOrEqual(startMs);
      expect(lastGcMs).toBeLessThanOrEqual(endMs);

      expect(gcNow).toHaveBeenCalledTimes(0);
    });

    test("not due yet", async () => {
      globalThis.localStorage.setItem(
        localStore.gcMsStorageKey,
        String(Date.now() - LocalStoreConfig.gcIntervalMs / 2),
      );

      localStore.gc();

      expect(gcNow).toHaveBeenCalledTimes(0);
    });

    test("due to run", async () => {
      globalThis.localStorage.setItem(
        localStore.gcMsStorageKey,
        String(Date.now() - LocalStoreConfig.gcIntervalMs),
      );

      localStore.gc();

      expect(gcNow).toHaveBeenCalledTimes(1);
    });
  });

  describe("gcNow", () => {
    beforeEach(() => {
      globalThis.localStorage.removeItem(localStore.gcMsStorageKey);
    });

    afterAll(() => {
      globalThis.localStorage.removeItem(localStore.gcMsStorageKey);
    });

    test("no items in DB", async () => {
      const startMs = Date.now();
      localStore.gcNow();
      const endMs = Date.now();

      const lastGcMs = localStore.lastGcMs;
      expect(lastGcMs).toBeGreaterThanOrEqual(startMs);
      expect(lastGcMs).toBeLessThanOrEqual(endMs);
    });

    test("nothing to purge", async () => {
      localStore.set("hi", 1);
      localStore.set("ho", "hello");

      expect(localStore.size()).toBe(2);

      localStore.gcNow();

      expect(localStore.size()).toBe(2);
    });
  });
});
