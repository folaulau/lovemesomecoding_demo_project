import { API_BASE_URL } from './config';
import { ApiError, NetworkError } from './apiError';
import { tokenStore } from '@/storage';
import type { ApiErrorBody } from '@/types';

/**
 * The single place this app talks to the backend.
 *
 * <p>Everything goes through {@link request} so there is exactly one implementation of: where the
 * API lives, how the auth token is attached, how a timeout is enforced, and how an error response
 * becomes a thrown Error. Calling `fetch` from a screen would scatter all four.
 *
 * <p>Two things differ from the web app's `lib/api.ts`:
 *
 * <ol>
 *   <li><b>Reading the token is async.</b> It lives in the keychain, so it must be awaited. On the
 *       web it came out of `localStorage` synchronously.</li>
 *   <li><b>There is a timeout.</b> A phone on a weak signal does not fail fast — `fetch` will
 *       happily hang for minutes, leaving a spinner spinning. `AbortSignal` gives it a deadline.</li>
 * </ol>
 */

/** Long enough for a cold Spring Boot start, short enough that a dead network is obvious. */
const DEFAULT_TIMEOUT_MS = 15_000;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Send the bearer token. Public endpoints (the menu, guest checkout) do not need it. */
  auth?: boolean;
  /** A caller's own abort signal — used to cancel in-flight work when a screen unmounts. */
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Combines the caller's abort signal with a timeout.
 *
 * <p>`AbortSignal.any` does exist in modern runtimes, but Hermes does not ship it, so the two
 * signals are wired together by hand. Returning the cleanup matters: without clearing the timer, a
 * fast response still holds a 15-second handle open, and hundreds of those is a real leak.
 */
function withTimeout(
  timeoutMs: number,
  external?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void; didTimeOut: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const forwardAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', forwardAbort);
  }

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', forwardAbort);
    },
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = await tokenStore.get();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const timeout = withTimeout(timeoutMs, signal);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeout.signal,
    });
  } catch (error) {
    /*
     * A caller-initiated abort is not a failure — it means the screen unmounted. Rethrow it
     * untouched so `error.name === 'AbortError'` still identifies it upstream.
     */
    if (signal?.aborted) throw error;

    if (timeout.didTimeOut()) {
      throw new NetworkError('The server took too long to respond. Check your connection.');
    }
    throw new NetworkError(
      `Could not reach the server at ${API_BASE_URL}. Is the backend running?`,
      error,
    );
  } finally {
    timeout.cleanup();
  }

  // 204 No Content has no body to parse — reading it as JSON would throw.
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      /*
       * Not JSON. This happens when a proxy or a crashed server returns an HTML error page, and
       * letting JSON.parse throw would surface "Unexpected token <" to the customer.
       */
      if (!response.ok) {
        throw new ApiError(response.status, `Request failed with ${response.status}`, null);
      }
      throw new NetworkError('The server returned a response this app could not read.');
    }
  }

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

export const apiClient = {
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
