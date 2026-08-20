import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiError } from './api-error';
import { tokenStore } from './storage';

/* ==========================================================================
 * ANGULAR CONCEPT: a functional HTTP interceptor
 *
 * An interceptor is a function every outgoing request passes through. It is Angular's answer to
 * the `request()` wrapper the React app hand-writes around `fetch`: one place that knows where the
 * API lives, how the token is attached, and how a failure becomes a typed error.
 *
 * The difference is reach. React's wrapper only helps code that remembers to call it — nothing
 * stops a component from calling `fetch` directly and skipping all three. An interceptor is wired
 * into `HttpClient` itself, so there is no way to make a request that bypasses it.
 *
 * `HttpInterceptorFn` is the modern form. The old one was a class implementing `HttpInterceptor`,
 * registered through the `HTTP_INTERCEPTORS` multi-provider; a plain function needs neither, and
 * can use `inject()` if it wants a service.
 *
 * ⚠️ `HttpRequest` is IMMUTABLE. `req.url = ...` does nothing at all — silently. Every change goes
 * through `req.clone()`, which is why both edits below are made in a single clone call.
 * ========================================================================== */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  // Only touch our own API. A request for an asset, or to Stripe, must pass through untouched —
  // sending our bearer token to a third party would be a credential leak.
  const isOurApi = req.url.startsWith('/api/');
  if (!isOurApi) return next(req);

  const token = tokenStore.get();

  /*
   * The token is attached whenever one exists, rather than per-call as the React app does with its
   * `auth: true` flag. The behaviour is the same — a guest has no token to send — and it removes a
   * whole class of bug where a protected endpoint is called without the flag and 401s.
   *
   * Guest checkout still works: POST /api/orders is deliberately open, and the server simply
   * associates the order with the account when a valid token happens to be present.
   */
  const authorised = req.clone({
    url: `${environment.apiBaseUrl}${req.url}`,
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return next(authorised).pipe(
    catchError((error: HttpErrorResponse) =>
      /*
       * Convert once, here. Every caller downstream — a component, a service, an NgRx effect —
       * then handles exactly one error type and can read `fieldErrors()` off it without first
       * unpicking Angular's transport wrapper.
       */
      throwError(() => ApiError.from(error)),
    ),
  );
};
