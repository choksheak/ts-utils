/***************************************************************************/

import { sleep } from "./sleep";

export class HttpError extends Error {
  constructor(
    public status: number,
    message?: string,
  ) {
    super(message ?? `HTTP ${status} error`);
  }
}

export async function safeGetJson(
  response: Response,
): Promise<unknown | undefined> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function safeGetErrorMessage(response: Response): Promise<string> {
  const s = `HTTP ${response.status}: ${response.statusText}`;

  let text = "";
  try {
    text = await response.text();
  } catch {
    // Ignore
  }

  return s + (text ? `: text=${text}` : "");
}

export async function throwIfError(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new HttpError(response.status, await safeGetErrorMessage(response));
  }

  return response;
}

/***************************************************************************/

export type HttpMiddleware = (
  request: Request,
  next: (req: Request) => Promise<Response>,
) => Promise<Response>;

/** JSON body serialization. */
export const jsonBody: HttpMiddleware = async (request, next) => {
  let newRequest = request;

  // Automatically stringify object bodies as JSON
  if (request.body) {
    let newHeaders = request.headers;

    if (!newHeaders.has("Content-Type")) {
      newHeaders = new Headers(newHeaders);
      newHeaders.set("Content-Type", "application/json");
    }

    newRequest = new Request(request, {
      headers: newHeaders,
      body: JSON.stringify(request.body),
    });
  }

  return await next(newRequest);
};

/** Throw on non-OK responses. */
export const throwOnError: HttpMiddleware = async (request, next) => {
  const response = await next(request);
  return await throwIfError(response);
};

/** Add retries. */
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

  return async (
    request: Request,
    next: (req: Request) => Promise<Response>,
  ) => {
    let response: Response | undefined;
    let error: unknown;
    let ms = delayMs;

    for (let i = 0; i < maxTries; i++, ms *= backoffMultiplier) {
      try {
        response = await next(request);

        if (response.status >= 500 && response.status <= 599) {
          await sleep(ms);
          continue;
        }

        return response;
      } catch (e) {
        error = e;

        if (e instanceof HttpError) {
          if (e.status >= 500 && e.status <= 599) {
            await sleep(ms);
            continue;
          }
        }

        throw e;
      }
    }

    if (!response) {
      throw error;
    }

    return response;
  };
};

/***************************************************************************/

export class HttpFetch {
  public constructor(private readonly middlewares: HttpMiddleware[] = []) {}

  /** Add a middleware to the chain. */
  public use(middleware: HttpMiddleware): HttpFetch {
    return new HttpFetch([...this.middlewares, middleware]);
  }

  /** Main fetch method with middleware support. */
  public async fetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const request = new Request(input, init);

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
    init?: RequestInit,
  ): Promise<Response> {
    return this.fetch(input, init);
  }

  public async post(
    input: RequestInfo | URL,
    body?: BodyInit | null | undefined,
    init?: RequestInit,
  ): Promise<Response> {
    return this.fetch(input, { ...init, method: "POST", body });
  }

  public async put(
    input: RequestInfo | URL,
    body?: BodyInit | null | undefined,
    init?: RequestInit,
  ): Promise<Response> {
    return this.fetch(input, { ...init, method: "PUT", body });
  }

  public async patch(
    input: RequestInfo | URL,
    body?: BodyInit | null | undefined,
    init?: RequestInit,
  ): Promise<Response> {
    return this.fetch(input, { ...init, method: "PATCH", body });
  }

  public async delete(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    return this.fetch(input, { ...init, method: "DELETE" });
  }

  public async head(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    return this.fetch(input, { ...init, method: "HEAD" });
  }
}

/** Exclude retries by default, but can be added using `http.use(retries())`. */
export const http = new HttpFetch([jsonBody, throwOnError]);
