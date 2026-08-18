import { ApiError } from '../lib/api';

/* ==========================================================================
 * REDUX CONCEPT: rejections have to be SERIALISABLE
 *
 * A thunk that simply throws lands in `rejected` with `action.error`, which Redux Toolkit builds by
 * running the Error through `miniSerializeError`. That keeps `name`, `message` and `stack` — and
 * throws everything else away.
 *
 * Everything else is exactly what these screens need. `ApiError` carries the API's structured body,
 * and `fieldErrors()` is what puts "already registered" underneath the right input rather than in a
 * generic banner at the top of the form. An ApiError that reaches a reducer is no longer an
 * ApiError; it is a plain object that has forgotten its class and its body.
 *
 * So failures are converted HERE, at the edge, into a plain object that survives the trip, and
 * handed to `rejectWithValue`. That also keeps the store serialisable — the dev-mode check that
 * warns about class instances in state is worth keeping quiet honestly.
 * ========================================================================== */

/** A request failure, flattened into something safe to put in a Redux action. */
export interface ApiFailure {
  message: string;
  /** Empty unless the server returned field-level validation errors. */
  fieldErrors: Record<string, string>;
}

export function toApiFailure(err: unknown, fallback: string): ApiFailure {
  if (err instanceof ApiError) {
    return { message: err.message, fieldErrors: err.fieldErrors() };
  }
  return { message: err instanceof Error ? err.message : fallback, fieldErrors: {} };
}

/**
 * Reads a message back out of whatever `unwrap()` threw.
 *
 * A rejected thunk can carry either our {@link ApiFailure} (via rejectWithValue) or a serialised
 * Error (if something threw unexpectedly), and a component that only handles one of the two will
 * eventually show "undefined" to a user.
 */
export function failureMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}
