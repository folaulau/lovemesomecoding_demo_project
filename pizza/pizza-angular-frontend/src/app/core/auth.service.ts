import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ApiError, errorMessage } from './api-error';
import { tokenStore } from './storage';
import type { AuthenticationResponse, User } from './models';

/* ==========================================================================
 * ANGULAR CONCEPT: computed()
 *
 * `isAuthenticated` and `isAdmin` are DERIVED from `user`. They are computed rather than stored,
 * so there is exactly one source of truth and no way for the three to disagree.
 *
 * A computed is lazy and cached: the function only runs when something reads it AND one of the
 * signals it read has changed since. That is `useMemo` without a dependency array to get wrong —
 * Angular discovers the dependencies by watching which signals the function actually reads.
 * ========================================================================== */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  private readonly _user = signal<User | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _loading = signal(false);

  readonly user = this._user.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');
  /** What to show in the navbar: a name if we have one, an email otherwise. */
  readonly displayName = computed(() => this._user()?.fullName ?? this._user()?.email ?? 'Account');

  /**
   * Resolves once the stored token has been checked against the API.
   *
   * <p>The React app exposes an `initialising` flag and every guard renders a spinner while it is
   * true — without that, refreshing on /admin renders one frame where `isAuthenticated` is still
   * false and bounces a perfectly valid admin to the login screen.
   *
   * <p>Angular's router can simply WAIT. A `CanActivateFn` may return a promise, so the guards
   * await this before deciding and the "logged out for one frame" problem never arises. The flag
   * is still useful for the navbar, which renders before the answer is known.
   */
  private readonly ready: Promise<void>;
  private readonly _initialising = signal(true);
  readonly initialising = this._initialising.asReadonly();

  constructor() {
    this.ready = this.restoreSession();
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  /*
   * A token may already be in localStorage from a previous session — but it could be expired or
   * revoked. The only way to know is to ask the API, so /api/auth/me is the source of truth rather
   * than anything cached in the browser.
   */
  private async restoreSession(): Promise<void> {
    if (!tokenStore.get()) {
      this._initialising.set(false);
      return;
    }

    try {
      this._user.set(await firstValueFrom(this.api.get<User>('/api/auth/me')));
    } catch {
      // Expired or invalid — drop it rather than leaving a dead token around.
      tokenStore.clear();
    } finally {
      this._initialising.set(false);
    }
  }

  login(email: string, password: string): Promise<void> {
    return this.authenticate('/api/auth/login', { email, password });
  }

  register(email: string, password: string, fullName: string): Promise<void> {
    return this.authenticate('/api/auth/register', { email, password, fullName });
  }

  /** Both flows are the same request with a different path, so they are one method. */
  private async authenticate(path: string, body: unknown): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const response = await firstValueFrom(
        this.api.post<AuthenticationResponse>(path, body),
      );
      tokenStore.set(response.token);
      this._user.set(response.user);
    } catch (err) {
      this._error.set(
        err instanceof ApiError
          ? err.message
          : errorMessage(err, 'Could not reach the server. Is the API running?'),
      );
      // Rethrow so the calling form can react to failure (e.g. keep the user on the page).
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  logout(): void {
    // Nothing to call server-side: JWTs are stateless, so "logging out" is simply forgetting the
    // token. That is also the trade-off — the token stays valid until it expires.
    tokenStore.clear();
    this._user.set(null);
    this._error.set(null);
  }

  /** Clears a stale message so it does not greet the user on their next visit to the form. */
  clearError(): void {
    this._error.set(null);
  }
}
