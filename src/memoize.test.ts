import { describe, expect, it, vi } from "vitest";

import { memoize } from "./memoize";

describe("memoize", () => {
  it("loads the value only once", async () => {
    const loader = vi.fn(async () => {
      return { value: 123 };
    });

    const getValue = memoize(loader);

    const a = await getValue();
    const b = await getValue();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("shares the same in-flight promise across concurrent callers", async () => {
    let resolve!: (value: string) => void;

    const loader = vi.fn(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        }),
    );

    const getValue = memoize(loader);

    const promiseA = getValue();
    const promiseB = getValue();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(promiseA).toBe(promiseB);

    resolve("hello");

    await expect(promiseA).resolves.toBe("hello");
    await expect(promiseB).resolves.toBe("hello");
  });

  it("retries after a failure", async () => {
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce("success");

    const getValue = memoize(loader);

    await expect(getValue()).rejects.toThrow("temporary failure");

    await expect(getValue()).resolves.toBe("success");

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("memoizes the successful result after retries", async () => {
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce("success");

    const getValue = memoize(loader);

    await expect(getValue()).rejects.toThrow();

    const a = await getValue();
    const b = await getValue();

    expect(loader).toHaveBeenCalledTimes(2);
    expect(a).toBe("success");
    expect(b).toBe("success");
  });

  it("does not cache rejected promises", async () => {
    const loader = vi.fn(async () => {
      throw new Error("always fails");
    });

    const getValue = memoize(loader);

    await expect(getValue()).rejects.toThrow("always fails");
    await expect(getValue()).rejects.toThrow("always fails");

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
