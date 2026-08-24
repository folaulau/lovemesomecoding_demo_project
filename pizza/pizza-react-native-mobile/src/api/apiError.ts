import type { ApiErrorBody } from '@/types';

/** An error carrying the API's structured body, so callers can show field-level messages. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(status: number, message: string, body: ApiErrorBody | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;

    /*
     * Restores the prototype chain so `err instanceof ApiError` is true.
     *
     * Subclassing a built-in (Error) breaks `instanceof` when the code is transpiled down to ES5,
     * which Metro still does for some targets. Every branch in this app that distinguishes an API
     * failure from a network failure depends on that check, so it is worth the one line.
     */
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
}

/** Thrown when the request never reached the server at all. */
export class NetworkError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * The message to actually show a customer.
 *
 * <p>Centralised so that no screen has to repeat the `err instanceof ApiError ? … : …` ladder, and
 * so that "could not reach the server" says something useful on a phone — where the cause is
 * usually a lost signal, not a backend that is down.
 */
export function toUserMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof NetworkError) return error.message;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}
