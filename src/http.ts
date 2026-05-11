// ─────────────────────────────────────────────────────────────────────────────
// Simplified HTTP fetch interface
//
// Inspired by axios, but having just the basic functionality, which seems
// sufficient for the vast majority of fetch use cases.
// ─────────────────────────────────────────────────────────────────────────────

import { sleep } from "./sleep";

export class HttpError extends Error {
  constructor(
    public status: number,
    message?: string,
  ) {
    super(message ?? `HTTP ${status} error`);
  }
}

/** Consumes the response body. */
export async function safeGetJson(
  response: Response,
): Promise<unknown | undefined> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Consumes the response text. */
export async function safeGetText(
  response: Response,
): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

/** Consumes the response body. */
export async function safeGetErrorMessage(response: Response): Promise<string> {
  const s = `HTTP ${response.status}: ${response.statusText}`;
  const text = await safeGetText(response);

  return s + (text ? `: text=${text}` : "");
}

export async function throwIfError(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new HttpError(response.status, await safeGetErrorMessage(response));
  }

  return response;
}

export type HttpBodyInit = BodyInit | object | null;

export type RequestInitNoBody = Omit<RequestInit, "body">;

export type HttpRequestInit = RequestInitNoBody & {
  body?: HttpBodyInit;
};

export function normalizeBody(body: HttpBodyInit | undefined): {
  body?: BodyInit | null;
  headers?: Record<string, string>;
} {
  if (
    body &&
    typeof body === "object" &&
    !(
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      body instanceof FormData ||
      body instanceof URLSearchParams ||
      body instanceof ReadableStream ||
      ArrayBuffer.isView(body)
    )
  ) {
    return {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    };
  }

  return { body: body as BodyInit | null | undefined };
}

// ─────────────────────────────────────────────────────────────────────────────

export type HttpMiddleware = (
  request: Request,
  next: (req: Request) => Promise<Response>,
) => Promise<Response>;

/** Throw on non-OK responses. */
export const throwOnError: HttpMiddleware = async (request, next) => {
  const response = await next(request);
  return await throwIfError(response);
};

/**
 * Add retries. If you also use throwOnError, the sequence should be
 * `http.use(throwOnError).use(retries())` so that throwOnError runs outside of
 * the retry loops.
 */
export const retries: (options?: {
  maxTries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}) => HttpMiddleware = (options?: {
  maxTries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}) => {
  const maxTries = options?.maxTries ?? 4;
  const delayMs = options?.delayMs ?? 1000;
  const backoffMultiplier = options?.backoffMultiplier ?? 1.5;

  if (maxTries < 1) {
    throw new Error(`Invalid maxTries=${maxTries}`);
  }

  return async (
    request: Request,
    next: (req: Request) => Promise<Response>,
  ) => {
    let ms = delayMs;

    for (let i = 1; i <= maxTries; i++, ms *= backoffMultiplier) {
      // Don't catch errors. Once thrown, the retry loop will end.
      const response = await next(request.clone());

      if (i < maxTries && response.status >= 500 && response.status <= 599) {
        const jitterMs = (Math.random() - 0.5) * 200;
        await sleep(ms + jitterMs);
        continue;
      }

      return response;
    }

    throw new Error(`Unreachable code in retries`);
  };
};

// ─────────────────────────────────────────────────────────────────────────────

export class HttpFetch {
  public constructor(private readonly middlewares: HttpMiddleware[] = []) {}

  /** Add a middleware to the chain. */
  public use(middleware: HttpMiddleware): HttpFetch {
    return new HttpFetch([...this.middlewares, middleware]);
  }

  /**
   * Main fetch method with middleware support. Supports auto-conversion of
   * JSON bodies to JSON strings, and adding the JSON Content-Type.
   */
  public async fetch(
    input: RequestInfo | URL,
    init?: HttpRequestInit,
  ): Promise<Response> {
    // This applies to every request and hence is not built as a middleware.
    const { body, headers } = normalizeBody(init?.body);

    // The caller-specified headers will take priority.
    const newHeaders = new Headers(headers);
    const callerHeaders = new Headers(init?.headers);

    for (const [k, v] of callerHeaders.entries()) {
      newHeaders.set(k, v);
    }

    const newInit: RequestInit = {
      ...init,
      body,
      headers: newHeaders,
    };

    const request = new Request(input, newInit);

    // Build middleware chain from last to first (so first added runs first)
    let handler = async (req: Request): Promise<Response> => {
      return fetch(req);
    };

    // Apply middlewares in reverse order
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const currentMiddleware = this.middlewares[i];
      const nextHandler = handler;
      handler = (req) => currentMiddleware(req, nextHandler);
    }

    return handler(request);
  }

  // Convenience methods
  public async get(
    input: RequestInfo | URL,
    init?: HttpRequestInit,
  ): Promise<Response> {
    return this.fetch(input, init);
  }

  public async post(
    input: RequestInfo | URL,
    // A POST request should almost always have a body.
    body?: HttpBodyInit,
    // Don't allow specifying the body in the RequestInit.
    init?: RequestInitNoBody,
  ): Promise<Response> {
    return this.fetch(input, { ...init, method: "POST", body });
  }

  public async put(
    input: RequestInfo | URL,
    // A PUT request should almost always have a body.
    body?: HttpBodyInit,
    // Don't allow specifying the body in the RequestInit.
    init?: RequestInitNoBody,
  ): Promise<Response> {
    return this.fetch(input, { ...init, method: "PUT", body });
  }

  public async patch(
    input: RequestInfo | URL,
    // A PATCH request should almost always have a body.
    body?: HttpBodyInit,
    // Don't allow specifying the body in the RequestInit.
    init?: RequestInitNoBody,
  ): Promise<Response> {
    return this.fetch(input, { ...init, method: "PATCH", body });
  }

  public async delete(
    input: RequestInfo | URL,
    init?: HttpRequestInit,
  ): Promise<Response> {
    return this.fetch(input, { ...init, method: "DELETE" });
  }

  public async head(
    input: RequestInfo | URL,
    init?: HttpRequestInit,
  ): Promise<Response> {
    return this.fetch(input, { ...init, method: "HEAD" });
  }
}

/**
 * Standard http instance that can be used for most purposes.
 * - To add retries, use `http.use(retries())`
 * - To throw on errors, use `http.use(throwOnError)`
 * - To do both, use `http.use(throwOnError).use(retries())`
 */
export const http = new HttpFetch();
