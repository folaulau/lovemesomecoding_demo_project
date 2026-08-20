import { ApiError } from '../../core/api-error';

/* ==========================================================================
 * NGRX CONCEPT: everything in an action must be SERIALISABLE
 *
 * NgRx's runtime checks refuse a class instance in an action or in state, and they are right to.
 * An action is meant to be a plain description of what happened — loggable, replayable, and safe to
 * send to the DevTools time-travel debugger. A live `ApiError` with a prototype and a `fieldErrors()`
 * method is none of those things.
 *
 * The React app hits the identical wall from the other side: Redux Toolkit runs a thrown Error
 * through `miniSerializeError`, which keeps `name`, `message` and `stack` and silently discards the
 * rest — including the API's field errors, which is the part these forms need to put "already
 * exists" under the right input rather than in a generic banner.
 *
 * The fix is the same in both apps and is worth noticing: flatten at the EDGE, before the failure
 * ever becomes an action. What survives is a plain object.
 * ========================================================================== */

/** A request failure, flattened into something safe to put in an action. */
export interface ApiFailure {
  message: string;
  /** Empty unless the server returned field-level validation errors. */
  fieldErrors: Record<string, string>;
}

export function toApiFailure(err: unknown, fallback: string): ApiFailure {
  if (err instanceof ApiError) {
    return { message: err.message || fallback, fieldErrors: err.fieldErrors() };
  }
  return { message: err instanceof Error ? err.message : fallback, fieldErrors: {} };
}

/** An empty failure, for the rare place that needs one without an error to convert. */
export const NO_FIELD_ERRORS: Record<string, string> = {};
