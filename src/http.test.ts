import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  http,
  HttpError,
  HttpFetch,
  normalizeBody,
  retries,
  safeGetErrorMessage,
  safeGetJson,
  safeGetText,
  throwIfError,
  throwOnError,
} from "./http";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeResponse(
  status: number,
  body?: string,
  headers?: Record<string, string>,
): Response {
  return new Response(body ?? null, {
    status,
    statusText: statusTextFor(status),
    headers,
  });
}

function statusTextFor(status: number): string {
  const map: Record<number, string> = {
    200: "OK",
    201: "Created",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    500: "Internal Server Error",
    503: "Service Unavailable",
  };
  return map[status] ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// HttpError
// ─────────────────────────────────────────────────────────────────────────────

describe("HttpError", () => {
  it("uses default message when none provided", () => {
    const err = new HttpError(404);
    expect(err.message).toBe("HTTP 404 error");
    expect(err.status).toBe(404);
  });

  it("uses provided message", () => {
    const err = new HttpError(500, "Something went wrong");
    expect(err.message).toBe("Something went wrong");
    expect(err.status).toBe(500);
  });

  it("is an instance of Error", () => {
    expect(new HttpError(400)).toBeInstanceOf(Error);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeGetJson
// ─────────────────────────────────────────────────────────────────────────────

describe("safeGetJson", () => {
  it("parses valid JSON", async () => {
    const res = makeResponse(200, JSON.stringify({ a: 1 }), {
      "Content-Type": "application/json",
    });
    expect(await safeGetJson(res)).toEqual({ a: 1 });
  });

  it("returns undefined for invalid JSON", async () => {
    const res = makeResponse(200, "not json");
    expect(await safeGetJson(res)).toBeUndefined();
  });

  it("returns undefined for empty body", async () => {
    const res = makeResponse(200);
    expect(await safeGetJson(res)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeGetText
// ─────────────────────────────────────────────────────────────────────────────

describe("safeGetText", () => {
  it("returns text body", async () => {
    const res = makeResponse(200, "hello");
    expect(await safeGetText(res)).toBe("hello");
  });

  it("returns empty string for empty body", async () => {
    const res = makeResponse(200, "");
    expect(await safeGetText(res)).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeGetErrorMessage
// ─────────────────────────────────────────────────────────────────────────────

describe("safeGetErrorMessage", () => {
  it("includes status, statusText, and body text", async () => {
    const res = makeResponse(500, "boom");
    const msg = await safeGetErrorMessage(res);
    expect(msg).toBe("HTTP 500: Internal Server Error: text=boom");
  });

  it("omits text section when body is empty", async () => {
    const res = makeResponse(404, "");
    const msg = await safeGetErrorMessage(res);
    expect(msg).toBe("HTTP 404: Not Found");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// throwIfError
// ─────────────────────────────────────────────────────────────────────────────

describe("throwIfError", () => {
  it("returns response for 2xx", async () => {
    const res = makeResponse(200, "ok");
    await expect(throwIfError(res)).resolves.toBe(res);
  });

  it("throws HttpError for 4xx", async () => {
    const res = makeResponse(400, "bad request");
    await expect(throwIfError(res)).rejects.toBeInstanceOf(HttpError);
  });

  it("throws HttpError with correct status for 5xx", async () => {
    const res = makeResponse(503, "unavailable");
    const err = await throwIfError(res).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(503);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeBody
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeBody", () => {
  it("passes through undefined", () => {
    const result = normalizeBody(undefined);
    expect(result.body).toBeUndefined();
    expect(result.headers).toBeUndefined();
  });

  it("passes through null", () => {
    const result = normalizeBody(null);
    expect(result.body).toBeNull();
    expect(result.headers).toBeUndefined();
  });

  it("passes through a string", () => {
    const result = normalizeBody("hello");
    expect(result.body).toBe("hello");
    expect(result.headers).toBeUndefined();
  });

  it("passes through FormData", () => {
    const fd = new FormData();
    const result = normalizeBody(fd);
    expect(result.body).toBe(fd);
    expect(result.headers).toBeUndefined();
  });

  it("passes through URLSearchParams", () => {
    const usp = new URLSearchParams({ a: "1" });
    const result = normalizeBody(usp);
    expect(result.body).toBe(usp);
    expect(result.headers).toBeUndefined();
  });

  it("passes through Blob", () => {
    const blob = new Blob(["data"]);
    const result = normalizeBody(blob);
    expect(result.body).toBe(blob);
    expect(result.headers).toBeUndefined();
  });

  it("passes through ArrayBuffer", () => {
    const buf = new ArrayBuffer(8);
    const result = normalizeBody(buf);
    expect(result.body).toBe(buf);
    expect(result.headers).toBeUndefined();
  });

  it("passes through ArrayBufferView (Uint8Array)", () => {
    const view = new Uint8Array([1, 2, 3]);
    const result = normalizeBody(view);
    expect(result.body).toBe(view);
    expect(result.headers).toBeUndefined();
  });

  it("serializes plain objects to JSON", () => {
    const result = normalizeBody({ foo: "bar" });
    expect(result.body).toBe(JSON.stringify({ foo: "bar" }));
    expect(result.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("serializes nested objects to JSON", () => {
    const obj = { a: { b: [1, 2, 3] } };
    const result = normalizeBody(obj);
    expect(result.body).toBe(JSON.stringify(obj));
    expect(result.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("serializes arrays to JSON", () => {
    const result = normalizeBody([1, 2, 3]);
    expect(result.body).toBe("[1,2,3]");
    expect(result.headers).toEqual({ "Content-Type": "application/json" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// throwOnError middleware
// ─────────────────────────────────────────────────────────────────────────────

describe("throwOnError", () => {
  const dummyRequest = new Request("https://example.com");

  it("passes through successful responses", async () => {
    const res = makeResponse(200);
    const next = vi.fn().mockResolvedValue(res);
    await expect(throwOnError(dummyRequest, next)).resolves.toBe(res);
  });

  it("throws on 4xx", async () => {
    const next = vi.fn().mockResolvedValue(makeResponse(404));
    await expect(throwOnError(dummyRequest, next)).rejects.toBeInstanceOf(
      HttpError,
    );
  });

  it("throws on 5xx", async () => {
    const next = vi.fn().mockResolvedValue(makeResponse(500));
    const err = await throwOnError(dummyRequest, next).catch((e) => e);
    expect(err.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// retries middleware
// ─────────────────────────────────────────────────────────────────────────────

describe("retries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const dummyRequest = new Request("https://example.com");

  it("throws on invalid maxTries", () => {
    expect(() => retries({ maxTries: 0 })).toThrow("Invalid maxTries=0");
  });

  it("returns response immediately on success", async () => {
    const res = makeResponse(200);
    const next = vi.fn().mockResolvedValue(res);
    const middleware = retries({ maxTries: 3, delayMs: 0 });
    await expect(middleware(dummyRequest, next)).resolves.toBe(res);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx and returns eventual success", async () => {
    const fail = makeResponse(500);
    const success = makeResponse(200);
    const next = vi
      .fn()
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(success);

    const middleware = retries({
      maxTries: 4,
      delayMs: 0,
      backoffMultiplier: 1,
    });

    const promise = middleware(dummyRequest, next);
    // Drain all timers for each sleep() call
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(success);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it("returns last 5xx response after exhausting all tries", async () => {
    const fail = makeResponse(500);
    const next = vi.fn().mockResolvedValue(fail);
    const middleware = retries({
      maxTries: 3,
      delayMs: 0,
      backoffMultiplier: 1,
    });

    const promise = middleware(dummyRequest, next);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(500);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it("does not retry on 4xx", async () => {
    const res = makeResponse(400);
    const next = vi.fn().mockResolvedValue(res);
    const middleware = retries({ maxTries: 3, delayMs: 0 });

    const promise = middleware(dummyRequest, next);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(400);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("propagates thrown errors without retrying", async () => {
    const next = vi.fn().mockRejectedValue(new TypeError("Network error"));
    const middleware = retries({ maxTries: 3, delayMs: 0 });

    await expect(middleware(dummyRequest, next)).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does not sleep after the last failed attempt", async () => {
    const sleepSpy = vi.spyOn(await import("./sleep"), "sleep");
    const fail = makeResponse(500);
    const next = vi.fn().mockResolvedValue(fail);
    const middleware = retries({
      maxTries: 3,
      delayMs: 100,
      backoffMultiplier: 1,
    });

    const promise = middleware(dummyRequest, next);
    await vi.runAllTimersAsync();
    await promise;

    // 3 tries → 2 sleeps (not 3)
    expect(sleepSpy).toHaveBeenCalledTimes(2);
  });

  it("clones the request on each attempt", async () => {
    const fail = makeResponse(500);
    const success = makeResponse(200);
    const next = vi
      .fn()
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(success);

    const cloneSpy = vi.spyOn(dummyRequest, "clone");
    const middleware = retries({
      maxTries: 3,
      delayMs: 0,
      backoffMultiplier: 1,
    });

    const promise = middleware(dummyRequest, next);
    await vi.runAllTimersAsync();
    await promise;

    expect(cloneSpy).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HttpFetch
// ─────────────────────────────────────────────────────────────────────────────

describe("HttpFetch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(makeResponse(200, "ok"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetch()", () => {
    it("makes a basic GET request", async () => {
      const client = new HttpFetch();
      await client.fetch("https://example.com");
      expect(fetchSpy).toHaveBeenCalledOnce();
      const req: Request = fetchSpy.mock.calls[0][0];
      expect(req.url).toBe("https://example.com/");
    });

    it("serializes plain object body to JSON", async () => {
      const client = new HttpFetch();
      await client.fetch("https://example.com", {
        method: "POST",
        body: { hello: "world" },
      });
      const req: Request = fetchSpy.mock.calls[0][0];
      expect(req.headers.get("Content-Type")).toBe("application/json");
      expect(await req.text()).toBe(JSON.stringify({ hello: "world" }));
    });

    it("lets caller Content-Type override the auto-detected one", async () => {
      const client = new HttpFetch();
      await client.fetch("https://example.com", {
        method: "POST",
        body: { x: 1 },
        headers: { "Content-Type": "application/vnd.api+json" },
      });
      const req: Request = fetchSpy.mock.calls[0][0];
      expect(req.headers.get("Content-Type")).toBe("application/vnd.api+json");
    });

    it("runs middlewares in registration order", async () => {
      const order: number[] = [];
      const m1 = vi.fn(
        async (req: Request, next: (r: Request) => Promise<Response>) => {
          order.push(1);
          return next(req);
        },
      );
      const m2 = vi.fn(
        async (req: Request, next: (r: Request) => Promise<Response>) => {
          order.push(2);
          return next(req);
        },
      );

      const client = new HttpFetch().use(m1).use(m2);
      await client.fetch("https://example.com");
      expect(order).toEqual([1, 2]);
    });

    it("use() returns a new instance and does not mutate original", async () => {
      const base = new HttpFetch();
      const withMiddleware = base.use(throwOnError);
      expect(base).not.toBe(withMiddleware);

      // Base should succeed even for error responses
      fetchSpy.mockResolvedValue(makeResponse(500));
      await expect(base.fetch("https://example.com")).resolves.toBeDefined();
    });
  });

  describe("convenience methods", () => {
    it("get() uses GET method", async () => {
      await http.get("https://example.com");
      const req: Request = fetchSpy.mock.calls[0][0];
      expect(req.method).toBe("GET");
    });

    it("post() uses POST method and sends body", async () => {
      await http.post("https://example.com", { key: "value" });
      const req: Request = fetchSpy.mock.calls[0][0];
      expect(req.method).toBe("POST");
      expect(await req.json()).toEqual({ key: "value" });
    });

    it("put() uses PUT method", async () => {
      await http.put("https://example.com", { a: 1 });
      const req: Request = fetchSpy.mock.calls[0][0];
      expect(req.method).toBe("PUT");
    });

    it("patch() uses PATCH method", async () => {
      await http.patch("https://example.com", { a: 1 });
      const req: Request = fetchSpy.mock.calls[0][0];
      expect(req.method).toBe("PATCH");
    });

    it("delete() uses DELETE method", async () => {
      await http.delete("https://example.com");
      const req: Request = fetchSpy.mock.calls[0][0];
      expect(req.method).toBe("DELETE");
    });

    it("head() uses HEAD method", async () => {
      await http.head("https://example.com");
      const req: Request = fetchSpy.mock.calls[0][0];
      expect(req.method).toBe("HEAD");
    });
  });

  describe("middleware integration", () => {
    it("throwOnError + retries: retries before throwing", async () => {
      fetchSpy
        .mockResolvedValueOnce(makeResponse(500))
        .mockResolvedValueOnce(makeResponse(500))
        .mockResolvedValueOnce(makeResponse(200));

      vi.useFakeTimers();
      const client = new HttpFetch()
        .use(throwOnError)
        .use(retries({ maxTries: 3, delayMs: 0, backoffMultiplier: 1 }));

      const promise = client.get("https://example.com");
      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });

    it("throwOnError alone throws on 4xx without retrying", async () => {
      fetchSpy.mockResolvedValue(makeResponse(403));
      const client = new HttpFetch().use(throwOnError);

      await expect(client.get("https://example.com")).rejects.toBeInstanceOf(
        HttpError,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
