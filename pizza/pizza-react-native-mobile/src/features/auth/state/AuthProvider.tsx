import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, ApiError, toUserMessage } from '@/api';
import { tokenStore } from '@/storage';
import type { AuthenticationResponse, User } from '@/types';

/* ==========================================================================
 * Auth, in its own context.
 *
 * Deliberately separate from the cart and the menu. If they shared one context, every cart change
 * would re-render everything that only cares about the signed-in user, and vice versa. Splitting
 * contexts by how often they change is the standard way to avoid that.
 *
 * WHAT DIFFERS FROM THE WEB APP: `initialising`.
 *
 * On the web the token comes out of localStorage synchronously, so the very first render already
 * knows whether anyone is signed in. Here the token is in the keychain and reading it is async, so
 * for a few frames the app genuinely does not know. Rendering the signed-out UI during that gap
 * makes the app flash "Sign in" and then swap — and worse, a route guard would bounce a signed-in
 * customer to the login screen. `initialising` is what the splash screen waits on.
 * ========================================================================== */

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  /** Field-level messages from the API, keyed by field name — for rendering under an input. */
  fieldErrors: Record<string, string>;
  loading: boolean;
  /** True until the stored token has been read AND checked against the API. */
  initialising: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);

  /*
   * On launch a token may still be in the keychain from a previous session — but it could be
   * expired or revoked. The only way to know is to ask the API, so /api/auth/me is the source of
   * truth rather than the mere presence of a token.
   */
  useEffect(() => {
    const controller = new AbortController();

    async function restoreSession() {
      try {
        const token = await tokenStore.get();
        if (!token) return;

        const me = await authApi.me(controller.signal);
        if (!controller.signal.aborted) setUser(me);
      } catch {
        // Expired, revoked, or the backend is unreachable. Drop it rather than leaving a dead
        // token that makes every authenticated call fail with a confusing 401.
        if (!controller.signal.aborted) await tokenStore.clear();
      } finally {
        if (!controller.signal.aborted) setInitialising(false);
      }
    }

    void restoreSession();
    return () => controller.abort();
  }, []);

  /** Shared by login and register — the only difference is which endpoint is called. */
  const authenticate = useCallback(async (call: () => Promise<AuthenticationResponse>) => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await call();
      await tokenStore.set(response.token);
      setUser(response.user);
    } catch (err) {
      setError(toUserMessage(err, 'Could not reach the server. Is the API running?'));
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors());
      // Rethrow so the calling screen knows not to navigate away.
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    (email: string, password: string) => authenticate(() => authApi.login(email, password)),
    [authenticate],
  );

  const register = useCallback(
    (email: string, password: string, fullName: string) =>
      authenticate(() => authApi.register(email, password, fullName)),
    [authenticate],
  );

  const logout = useCallback(async () => {
    // Nothing to call server-side: JWTs are stateless, so "logging out" is forgetting the token.
    // That is also the trade-off — the token stays valid until it expires.
    await tokenStore.clear();
    setUser(null);
    setError(null);
    setFieldErrors({});
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      error,
      fieldErrors,
      loading,
      initialising,
    }),
    [user, login, register, logout, error, fieldErrors, loading, initialising],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return context;
}
