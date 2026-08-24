/**
 * Every identifier the API accepts or returns is a UUID string.
 *
 * <p>The backend keeps a numeric primary key internally but never publishes it: sequential ids
 * would let anyone walk /api/orders/1, /2, /3 and read other people's orders. This alias exists so
 * the intent is obvious at every use site — it is a UUID, not "some string".
 */
export type UUID = string;

/** Spring's paginated envelope, trimmed to what the app uses. */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/** One invalid field, from the API's ApiSubError. */
export interface ApiSubError {
  field: string | null;
  message: string;
}

/** The single error envelope every endpoint returns. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
  errors?: ApiSubError[];
}
