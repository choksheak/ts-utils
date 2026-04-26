import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  http,
  HttpError,
  HttpFetch,
  jsonBody,
  retries,
  safeGetErrorMessage,
  safeGetJson,
  throwIfError,
  throwOnError,
} from "./http";
import { sleep } from "./sleep";

vi.mock("./sleep", () => ({
  sleep: vi.fn(() => Promise.resolve()),
}));

function requestWithObjectBody(
  body: Record<string, unknown>,
  init?: { headers?: HeadersInit },
): Request {
  const request = new Request("https://example.test/api", {
    method: "POST",
    headers: init?.headers ?? {},
  });
  Object.defineProperty(request, "body", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: body,
  });
  return request;
}

describe("HttpError", () => {
  test("default message includes status", () => {
    const err = new HttpError(404);
    expect(err.message).toBe("HTTP 404 error");
    expect(err.status).toBe(404);
  });

  test("custom message", () => {
    const err = new HttpError(500, "boom");
    expect(err.message).toBe("boom");
    expect(err.status).toBe(500);
  });
});

describe("safeGetJson", () => {
  test("returns parsed JSON", async () => {
    const res = new Response(JSON.stringify({ a: 1 }));
    await expect(safeGetJson(res)).resolves.toEqual({ a: 1 });
  });

  test("returns undefined when body is not JSON", async () => {
    const res = new Response("not json");
    await expect(safeGetJson(res)).resolves.toBeUndefined();
  });
});

describe("safeGetErrorMessage", () => {
  test("includes status, statusText, and body text", async () => {
    const res = new Response("oops", {
      status: 400,
      statusText: "Bad Request",
    });
    await expect(safeGetErrorMessage(res)).resolves.toBe(
      "HTTP 400: Bad Request: text=oops",
    );
  });

  test("omits text segment when body is empty", async () => {
    const res = new Response("", { status: 400, statusText: "Bad Request" });
    await expect(safeGetErrorMessage(res)).resolves.toBe(
      "HTTP 400: Bad Request",
    );
  });
});

describe("throwIfError", () => {
  test("returns response when ok", async () => {
    const res = new Response("ok", { status: 200 });
    await expect(throwIfError(res)).resolves.toBe(res);
  });

  test("throws HttpError with message when not ok", async () => {
    const res = new Response("nope", {
      status: 422,
      statusText: "Unprocessable",
    });
    await expect(throwIfError(res)).rejects.toMatchObject({
      constructor: HttpError,
      status: 422,
      message: "HTTP 422: Unprocessable: text=nope",
    });
  });
});

describe("jsonBody", () => {
  test("stringifies object body and sets Content-Type when missing", async () => {
    const incoming = requestWithObjectBody({ hello: "world" });
    let seen: Request | undefined;

    await jsonBody(incoming, async (req) => {
      seen = req;
      return new Response(null, { status: 200 });
    });

    expect(seen).toBeDefined();
    expect(seen!.headers.get("Content-Type")).toBe("application/json");
    await expect(seen!.text()).resolves.toBe(
      JSON.stringify({ hello: "world" }),
    );
  });

  test("does not override existing Content-Type", async () => {
    const incoming = requestWithObjectBody(
      { a: 1 },
      { headers: { "Content-Type": "application/vnd.api+json" } },
    );
    let seen: Request | undefined;

    await jsonBody(incoming, async (req) => {
      seen = req;
      return new Response(null, { status: 200 });
    });

    expect(seen!.headers.get("Content-Type")).toBe("application/vnd.api+json");
  });

  test("passes request through when body is absent", async () => {
    const incoming = new Request("https://example.test/", { method: "GET" });
    let seen: Request | undefined;

    await jsonBody(incoming, async (req) => {
      seen = req;
      return new Response(null, { status: 200 });
    });

    expect(seen).toBe(incoming);
  });
});

describe("throwOnError", () => {
  test("returns response when ok", async () => {
    const ok = new Response(null, { status: 200 });
    await expect(
      throwOnError(new Request("https://x"), async () => ok),
    ).resolves.toBe(ok);
  });

  test("throws HttpError when downstream response is not ok", async () => {
    const bad = new Response("fail", { status: 503, statusText: "Down" });
    await expect(
      throwOnError(new Request("https://x"), async () => bad),
    ).rejects.toMatchObject({
      constructor: HttpError,
      status: 503,
    });
  });
});

describe("retries", () => {
  beforeEach(() => {
    vi.mocked(sleep).mockClear();
  });

  test("retries on 5xx response then returns success", async () => {
    const responses = [
      new Response(null, { status: 502 }),
      new Response(null, { status: 503 }),
      new Response("ok", { status: 200 }),
    ];
    let i = 0;
    const mw = retries({ maxTries: 5, delayMs: 10, backoffMultiplier: 2 });

    const result = await mw(new Request("https://x"), async () => {
      return responses[i++]!;
    });

    expect(result.status).toBe(200);
    expect(await result.text()).toBe("ok");
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test("retries on HttpError 5xx then succeeds", async () => {
    let calls = 0;
    const mw = retries({ maxTries: 4, delayMs: 1, backoffMultiplier: 1 });

    const result = await mw(new Request("https://x"), async () => {
      calls++;
      if (calls < 3) {
        throw new HttpError(502, "bad");
      }
      return new Response(null, { status: 200 });
    });

    expect(result.status).toBe(200);
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test("does not retry on HttpError below 500", async () => {
    const mw = retries({ maxTries: 4, delayMs: 1, backoffMultiplier: 1 });

    await expect(
      mw(new Request("https://x"), async () => {
        throw new HttpError(404);
      }),
    ).rejects.toMatchObject({ status: 404 });

    expect(sleep).not.toHaveBeenCalled();
  });

  test("does not retry on non-HttpError throw", async () => {
    const mw = retries({ maxTries: 4, delayMs: 1, backoffMultiplier: 1 });

    await expect(
      mw(new Request("https://x"), async () => {
        throw new Error("network");
      }),
    ).rejects.toThrow("network");

    expect(sleep).not.toHaveBeenCalled();
  });

  test("returns last 5xx response after exhausting tries", async () => {
    const mw = retries({ maxTries: 2, delayMs: 1, backoffMultiplier: 1 });
    const last = new Response("gone", { status: 503, statusText: "Nope" });

    const result = await mw(new Request("https://x"), async () => last);

    expect(result).toBe(last);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});

describe("HttpFetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("runs middleware in registration order before fetch", async () => {
    const order: string[] = [];
    const client = new HttpFetch([
      async (req, next) => {
        order.push("a");
        return next(req);
      },
      async (req, next) => {
        order.push("b");
        return next(req);
      },
    ]);

    globalThis.fetch = vi.fn(async () => new Response(null, { status: 200 }));

    await client.fetch("https://example.test/");

    expect(order).toEqual(["a", "b"]);
  });

  test("use returns new instance with appended middleware", async () => {
    const seen: string[] = [];
    const base = new HttpFetch([
      async (req, next) => {
        seen.push("first");
        return next(req);
      },
    ]);
    const extended = base.use(async (req, next) => {
      seen.push("second");
      return next(req);
    });

    expect(base).not.toBe(extended);

    globalThis.fetch = vi.fn(async () => new Response(null, { status: 200 }));

    await extended.fetch("https://example.test/");
    expect(seen).toEqual(["first", "second"]);
  });

  test("post sets method and body", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const client = new HttpFetch([]);
    await client.post("https://example.test/", "payload");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const first = fetchMock.mock.calls[0] as unknown as [Request];
    expect(first[0]).toBeInstanceOf(Request);
    expect(first[0].method).toBe("POST");
    await expect(first[0].text()).resolves.toBe("payload");
  });

  test("default http applies jsonBody and throwOnError", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 200 }));
    await http.get("https://example.test/");
    expect(globalThis.fetch).toHaveBeenCalled();

    globalThis.fetch = vi.fn(async () => new Response("err", { status: 500 }));
    await expect(http.get("https://example.test/")).rejects.toBeInstanceOf(
      HttpError,
    );
  });
});
