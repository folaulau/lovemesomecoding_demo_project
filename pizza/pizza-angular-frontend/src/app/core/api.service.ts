import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/* ==========================================================================
 * ANGULAR CONCEPT: a service, and `inject()`
 *
 * `providedIn: 'root'` registers this with the root injector and makes it tree-shakable: if
 * nothing injects it, it is not in the bundle. It is also a SINGLETON, which is what lets the
 * stateful services built on top of it (auth, cart, menu) share one instance across every
 * component without a Provider component wrapping the tree — the job `<AuthProvider>` and friends
 * do in the React app.
 *
 * `inject()` replaces the constructor parameter. It works in field initialisers, in functional
 * guards and in interceptors, none of which have a constructor to put a parameter in.
 *
 * This wrapper stays deliberately thin. The base URL, the bearer token and the error mapping all
 * live in the interceptor, so all this adds is a typed shorthand — `api.get<Product[]>('/api/products')`
 * instead of repeating the generic and the options object at every call site.
 * ========================================================================== */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(path);
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(path, body ?? null);
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<T>(path, body ?? null);
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(path, body ?? null);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(path);
  }
}
