import { DEFAULT_EXPIRY_DELTA_MS, GC_INTERVAL_MS, kvStore } from "./kvStore";

globalThis.structuredClone = (val) => {
  return JSON.parse(JSON.stringify(val));
};

describe("KVStore", () => {
  beforeEach(async () => {
    await kvStore.clear();
  });

  afterAll(async () => {
    await kvStore.clear();
  });

  test("get, set, delete", async () => {
    expect(await kvStore.get("hi")).toBe(undefined);
    expect(await kvStore.set("hi", 1)).toBe(1);
    expect(await kvStore.get("hi")).toBe(1);
    expect(await kvStore.delete("hi")).toBe(undefined);
    expect(await kvStore.get("hi")).toBe(undefined);
  });

  test("get and set objects", async () => {
    expect(await kvStore.set("hi", "ho")).toBe("ho");
    expect(await kvStore.get("hi")).toBe("ho");

    expect(await kvStore.set("hi", true)).toBe(true);
    expect(await kvStore.get("hi")).toBe(true);

    expect(await kvStore.set("hi", null)).toBe(null);
    expect(await kvStore.get("hi")).toBe(null);

    expect(await kvStore.set("hi", undefined)).toBe(undefined);
    expect(await kvStore.get("hi")).toBe(undefined);

    // jest bug: Received: serializes to the same string
    expect(JSON.stringify(await kvStore.set("hi", { a: 1 }))).toBe(
      JSON.stringify({ a: 1 }),
    );
    expect(JSON.stringify(await kvStore.get("hi"))).toBe(
      JSON.stringify({ a: 1 }),
    );
  });

  test("forEach", async () => {
    const fn = jest.fn();
    kvStore.forEach(fn);
    expect(fn).toHaveBeenCalledTimes(0);

    let startMs = Date.now();
    await kvStore.set("hi", 1);
    let endMs = Date.now();
    await kvStore.forEach(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBe("hi");
    expect(fn.mock.calls[0][1]).toBe(1);

    const expireMs = fn.mock.calls[0][2];
    expect(expireMs).toBeGreaterThanOrEqual(startMs + DEFAULT_EXPIRY_DELTA_MS);
    expect(expireMs).toBeLessThanOrEqual(endMs + DEFAULT_EXPIRY_DELTA_MS);

    // Should not be able to add duplicate keys.
    fn.mockClear();

    startMs = Date.now();
    await kvStore.set("hi", 2);
    endMs = Date.now();
    await kvStore.forEach(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBe("hi");
    expect(fn.mock.calls[0][1]).toBe(2);

    const expireMs2 = fn.mock.calls[0][2];
    expect(expireMs2).toBeGreaterThanOrEqual(expireMs);
    expect(expireMs2).toBeGreaterThanOrEqual(startMs + DEFAULT_EXPIRY_DELTA_MS);
    expect(expireMs2).toBeLessThanOrEqual(endMs + DEFAULT_EXPIRY_DELTA_MS);

    // Add a new key.
    fn.mockClear();

    startMs = Date.now();
    await kvStore.set("ho", { b: 2 });
    endMs = Date.now();
    await kvStore.forEach(fn);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[0][0]).toBe("hi");
    expect(fn.mock.calls[0][1]).toBe(2);
    expect(fn.mock.calls[1][0]).toBe("ho");
    expect(JSON.stringify(fn.mock.calls[1][1])).toBe(JSON.stringify({ b: 2 }));
  });

  test("size", async () => {
    expect(await kvStore.size()).toBe(0);

    await kvStore.set("hi", 1);

    expect(await kvStore.size()).toBe(1);

    await kvStore.set("hi", 2);

    expect(await kvStore.size()).toBe(1);

    await kvStore.set("ho", { b: 3 });

    expect(await kvStore.size()).toBe(2);
  });

  describe("gc", () => {
    let gcNow: jest.SpyInstance;

    beforeAll(() => {
      gcNow = jest.spyOn(kvStore, "gcNow").mockResolvedValue();
    });

    beforeEach(() => {
      globalThis.localStorage.removeItem(kvStore.gcMsStorageKey);
    });

    afterAll(() => {
      globalThis.localStorage.removeItem(kvStore.gcMsStorageKey);
      gcNow.mockRestore();
    });

    test("set initial timestamp", async () => {
      const startMs = Date.now();
      await kvStore.gc();
      const endMs = Date.now();

      const lastGcMs = kvStore.lastGcMs;
      expect(lastGcMs).toBeGreaterThanOrEqual(startMs);
      expect(lastGcMs).toBeLessThanOrEqual(endMs);

      expect(gcNow).toHaveBeenCalledTimes(0);
    });

    test("not due yet", async () => {
      globalThis.localStorage.setItem(
        kvStore.gcMsStorageKey,
        String(Date.now() - GC_INTERVAL_MS / 2),
      );

      await kvStore.gc();

      expect(gcNow).toHaveBeenCalledTimes(0);
    });

    test("due to run", async () => {
      globalThis.localStorage.setItem(
        kvStore.gcMsStorageKey,
        String(Date.now() - GC_INTERVAL_MS),
      );

      await kvStore.gc();

      expect(gcNow).toHaveBeenCalledTimes(1);
    });
  });

  describe("gcNow", () => {
    // Silence logs.
    let consoleLogSpy: jest.SpyInstance;

    beforeAll(() => {
      consoleLogSpy = jest.spyOn(console, "log").mockReturnValue();
    });

    beforeEach(() => {
      globalThis.localStorage.removeItem(kvStore.gcMsStorageKey);
    });

    afterAll(() => {
      globalThis.localStorage.removeItem(kvStore.gcMsStorageKey);
      consoleLogSpy.mockRestore();
    });

    test("no items in DB", async () => {
      const startMs = Date.now();
      await kvStore.gcNow();
      const endMs = Date.now();

      const lastGcMs = kvStore.lastGcMs;
      expect(lastGcMs).toBeGreaterThanOrEqual(startMs);
      expect(lastGcMs).toBeLessThanOrEqual(endMs);
    });

    test("nothing to purge", async () => {
      await kvStore.set("hi", 1);
      await kvStore.set("ho", "hello");

      await kvStore.gcNow();

      expect(await kvStore.size()).toBe(2);
    });

    test("purge expired items", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2024-01-01"));

      await kvStore.set("hi", 1);
      await kvStore.set("ho", "hello");

      jest.setSystemTime(new Date("2024-03-01"));

      await kvStore.gcNow();

      expect(await kvStore.size()).toBe(0);
    });
  });
});
