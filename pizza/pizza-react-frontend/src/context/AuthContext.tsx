import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';

/* ==========================================================================
 * REACT CONCEPT: a second Context
 *
 * Auth is deliberately a separate context from the cart. If they shared one, every cart change
 * would re-render everything that only cares about the logged-in user, and vice versa. Splitting
 * contexts by how often they change is the standard way to avoid that.
 *
 * Phase 2 note: this is a MOCK. It accepts two hard-coded demo accounts and issues no real token.
 * Phase 4 replaces the body of login() with a POST to /api/auth/login; the interface consumers
 * see does not change.
 * ========================================================================== */

const STORAGE_KEY = 'pizza.auth';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Mock accounts, matching the backend's seeded users. */
const MOCK_ACCOUNTS: Array<{ password: string; user: User }> = [
  {
    password: 'admin123',
    user: { id: 1, email: 'admin@pizza.test', fullName: 'Demo Admin', role: 'ADMIN' },
  },
  {
    password: 'pizza123',
    user: { id: 2, email: 'customer@pizza.test', fullName: 'Demo Customer', role: 'CUSTOMER' },
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  /*
   * REACT CONCEPT: lazy initial state
   * Passing a FUNCTION to useState means it runs only on the first render. Reading localStorage
   * is synchronous I/O; without the function form it would run on every single render and be
   * thrown away.
   */
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as User;
    } catch {
      // Corrupt or stale value — treat as logged out rather than crashing the whole app.
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /*
   * REACT CONCEPT: useEffect for synchronising with something OUTSIDE React.
   * localStorage is external state, so keeping it in step with the user belongs in an effect.
   * Note this is NOT used to derive React state from other React state — that is the classic
   * misuse of useEffect and causes an extra render every time.
   */
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    // Simulated latency so the loading state is actually visible while building the UI.
    await new Promise((resolve) => setTimeout(resolve, 400));

    const match = MOCK_ACCOUNTS.find(
      (account) =>
        account.user.email.toLowerCase() === email.trim().toLowerCase() &&
        account.password === password,
    );

    setLoading(false);

    if (!match) {
      setError('Incorrect email or password.');
      // Throwing lets the calling form await login() and react to failure.
      throw new Error('Invalid credentials');
    }

    setUser(match.user);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isAdmin: user?.role === 'ADMIN',
      login,
      logout,
      error,
      loading,
    }),
    [user, login, logout, error, loading],
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
