import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from './models';

/**
 * An error carrying the API's structured body, so callers can show field-level messages.
 *
 * <p>Angular's `HttpClient` already rejects with an `HttpErrorResponse`, so why a second class?
 * Because `HttpErrorResponse` is an Angular transport detail: it says "a request failed" and hands
 * back an untyped `error` blob. `ApiError` says what OUR API said — the message the server wrote,
 * and the per-field validation errors — and it is the only shape components ever have to handle.
 * The interceptor converts one into the other in exactly one place.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(status: number, message: string, body: ApiErrorBody | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;

    // TypeScript compiling to ES5 breaks `instanceof` for subclassed built-ins. This app targets
    // ES2022 so it is not strictly needed, but it costs one line and removes a nasty trap.
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /** Field errors as a lookup, for rendering next to inputs. */
  fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const sub of this.body?.errors ?? []) {
      if (sub.field) result[sub.field] = sub.message;
    }
    return result;
  }

  /** Build one from whatever Angular threw. */
  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error;

    if (error instanceof HttpErrorResponse) {
      // status 0 means the request never reached the server at all — the API is down, or CORS
      // rejected it. Saying so beats "Http failure response for ...: 0 Unknown Error".
      if (error.status === 0) {
        return new ApiError(0, 'Could not reach the server. Is the API running?', null);
      }

      const body = (error.error ?? null) as ApiErrorBody | null;
      return new ApiError(
        error.status,
        body?.message ?? `Request failed with ${error.status}`,
        body,
      );
    }

    return new ApiError(0, error instanceof Error ? error.message : 'Something went wrong.', null);
  }
}

/** Reads a message out of any thrown value, with a fallback so a user never sees "undefined". */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}
