import type { ApiErrorBody } from '../types';

/**
 * The single place the frontend talks to the backend.
 *
 * Everything goes through `request()` so there is exactly one implementation of: where the API
 * lives, how the auth token is attached, and how an error response becomes a thrown Error. Calling
 * `fetch` directly from components would scatter all three.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8085';

const TOKEN_KEY = 'pizza.token';

/**
 * The JWT lives in localStorage.
 *
 * ⚠️ localStorage is readable by any JavaScript on the page, so a single XSS bug leaks the token.
 * It is used here because it is simple, survives a refresh, and works identically for the React
 * and Angular builds. A production app would prefer an HttpOnly cookie, which JavaScript cannot
 * read at all — at the cost of needing a CSRF story.
 */
export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** An error carrying the API's structured body, so callers can show field-level messages. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(status: number, message: string, body: ApiErrorBody | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  /** Field errors as a lookup, for rendering next to inputs. */
  fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const sub of this.body?.errors ?? []) {
      if (sub.field) result[sub.field] = sub.message;
    }
    return result;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the bearer token. Public endpoints (the menu, guest checkout) do not need it. */
  auth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  // 204 No Content has no body to parse — reading it as JSON would throw.
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const errorBody = parsed as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      errorBody?.message ?? `Request failed with ${response.status}`,
      errorBody,
    );
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

export { BASE_URL };
