import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, api, tokenStore } from '../lib/api';
import type { AuthenticationResponse, User } from '../types';

/* ==========================================================================
 * REACT CONCEPT: a second Context
 *
 * Auth is deliberately separate from the cart and the menu. If they shared one context, every cart
 * change would re-render everything that only cares about the logged-in user, and vice versa.
 * Splitting contexts by how often they change is the standard way to avoid that.
 * ========================================================================== */

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  loading: boolean;
  /** True until the stored token has been checked against the API on first load. */
  initialising: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);

  /*
   * On first load, a token may already be in localStorage from a previous session — but it could
   * be expired or revoked. The only way to know is to ask the API, so /api/auth/me is the source
   * of truth rather than anything cached in the browser.
   */
  useEffect(() => {
    const controller = new AbortController();

    async function restoreSession() {
      if (!tokenStore.get()) {
        setInitialising(false);
        return;
      }
      try {
        const me = await api.get<User>('/api/auth/me', { auth: true, signal: controller.signal });
        setUser(me);
      } catch {
        // Expired or invalid — drop it rather than leaving a dead token around.
        if (!controller.signal.aborted) tokenStore.clear();
      } finally {
        if (!controller.signal.aborted) setInitialising(false);
      }
    }

    void restoreSession();
    return () => controller.abort();
  }, []);

  const authenticate = useCallback(
    async (path: string, body: unknown) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.post<AuthenticationResponse>(path, body);
        tokenStore.set(response.token);
        setUser(response.user);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Could not reach the server. Is the API running?';
        setError(message);
        // Rethrow so the calling form can react to failure (e.g. keep the user on the page).
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const login = useCallback(
    (email: string, password: string) => authenticate('/api/auth/login', { email, password }),
    [authenticate],
  );

  const register = useCallback(
    (email: string, password: string, fullName: string) =>
      authenticate('/api/auth/register', { email, password, fullName }),
    [authenticate],
  );

  const logout = useCallback(() => {
    // Nothing to call server-side: JWTs are stateless, so "logging out" is simply forgetting the
    // token. That is also the trade-off — the token stays valid until it expires.
    tokenStore.clear();
    setUser(null);
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
      error,
      loading,
      initialising,
    }),
    [user, login, register, logout, error, loading, initialising],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return context;
}
