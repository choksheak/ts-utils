import { LocalStorageCache } from "./localStorageCache";

describe("LocalStorageCache", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    global.localStorage.clear();
    jest.useFakeTimers(); // Use fake timers to control Date.now
  });

  afterEach(() => {
    jest.useRealTimers(); // Restore real timers after each test
  });

  describe("set", () => {
    it("should store a value with an expiration time", () => {
      const key = "testKey";
      const value = "testValue";
      const expireDeltaMs = 1000; // 1 second

      LocalStorageCache.set(key, value, expireDeltaMs);

      const storedValue = JSON.parse(
        global.localStorage.getItem(key) as string,
      );
      expect(storedValue.value).toBe(value);
      expect(typeof storedValue.expireMs).toBe("number");
    });
  });

  describe("get", () => {
    it("should retrieve a stored value if not expired", () => {
      const key = "testKey";
      const value = "testValue";
      const expireDeltaMs = 1000; // 1 second

      LocalStorageCache.set(key, value, expireDeltaMs);

      expect(LocalStorageCache.get(key)).toBe(value);
    });

    it("should return undefined if the value has expired", () => {
      const key = "testKey";
      const value = "testValue";
      const expireDeltaMs = 1000; // 1 second

      LocalStorageCache.set(key, value, expireDeltaMs);

      // Advance time by 2 seconds to ensure expiration
      jest.advanceTimersByTime(2000);

      expect(LocalStorageCache.get(key)).toBeUndefined();
      expect(global.localStorage.getItem(key)).toBeNull(); // Ensure item is removed
    });

    it("should return undefined if the key does not exist", () => {
      expect(LocalStorageCache.get("nonexistentKey")).toBeUndefined();
    });

    it("should return undefined if the stored data is invalid and remove it from storage", () => {
      const consoleError = jest.spyOn(console, "error").mockReturnValue();

      const key = "testKey";
      // Set an invalid JSON format in localStorage
      global.localStorage.setItem(key, "invalidJSON");

      expect(LocalStorageCache.get(key)).toBeUndefined();
      expect(global.localStorage.getItem(key)).toBeNull(); // Ensure item is removed
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0][0]).toBe(
        "Found invalid storage value: testKey=invalidJSON:",
      );
    });

    it("should return undefined if stored data is missing required fields and remove it from storage", () => {
      const key = "testKey";
      // Set JSON with missing fields
      global.localStorage.setItem(
        key,
        JSON.stringify({ someOtherField: "data" }),
      );

      expect(LocalStorageCache.get(key)).toBeUndefined();
      expect(global.localStorage.getItem(key)).toBeNull(); // Ensure item is removed
    });

    it("should remove an item if remove was called", () => {
      const key = "testKey";
      LocalStorageCache.set<unknown>(key, { data: 1 }, 10000);
      expect(LocalStorageCache.get(key)).toEqual({ data: 1 });

      LocalStorageCache.remove(key);
      expect(LocalStorageCache.get(key)).toBeUndefined();
    });
  });
});
