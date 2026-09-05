/**
 * Who is signed in.
 *
 * Context rather than Redux, and that is a considered choice rather than a shortcut. The session is
 * a small value that almost every page reads and that changes twice in a visit — at sign-in and at
 * sign-out. Redux earns its keep when many components write to overlapping state; here nothing
 * writes but the two auth calls, so a reducer would be ceremony around a `useState`.
 *
 * Server data does NOT live here. That is Apollo's cache's job (phase 4), and duplicating rows into
 * a global store is how two parts of a screen end up disagreeing about the same project.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import * as api from '../api/client'
import { clearApolloCache } from './apollo'
import type { Session, SignUpInput } from '../api/client'
import type { User } from '../types/domain'
import { UserRole } from '../types/domain'

const STORAGE_KEY = 'contractor.session'

interface AuthValue {
  user: User | null
  token: string | null
  /** False for the one tick before `localStorage` has been read. Without it every guarded route
   *  redirects to sign-in on a hard refresh, because the first render has no user yet. */
  ready: boolean
  isHomeowner: boolean
  isContractor: boolean
  signIn: (email: string, password: string) => Promise<User>
  signUp: (input: SignUpInput) => Promise<User>
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    // Private mode, cleared site data, or a half-written value from an older shape of this object.
    // None of those are worth crashing the app over — an unreadable session is just a signed-out
    // one, and the `catch` is what turns a white screen into a login page.
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSession(readStoredSession())
    setReady(true)
  }, [])

  const persist = useCallback((next: Session | null) => {
    setSession(next)
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage being unavailable costs the user a re-login on refresh. It must not cost them the
      // sign-in they just completed, so the in-memory session above stands either way.
    }
  }, [])

  const doSignIn = useCallback(
    async (email: string, password: string) => {
      const next = await api.signIn(email, password)
      persist(next)
      return next.user
    },
    [persist],
  )

  const doSignUp = useCallback(
    async (input: SignUpInput) => {
      const next = await api.signUp(input)
      persist(next)
      return next.user
    },
    [persist],
  )

  const signOut = useCallback(() => {
    persist(null)
    /**
     * ⚠️ Emptying Apollo's cache is not housekeeping — it is a permission boundary.
     *
     * Hasura returns different rows for different roles, so a cache left populated across a
     * sign-out can hand the NEXT person to use this browser rows the previous one was allowed to
     * see. It looks exactly like a broken permission and is entirely client-side.
     *
     * Not awaited: sign-out must be instant, and a failed cache clear should not block it.
     */
    void clearApolloCache()
  }, [persist])

  // ⚠️ Memoised, and it matters more than it looks. This object is the context value, so a fresh
  // identity on every render re-renders every consumer — which here is most of the app.
  const value = useMemo<AuthValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      ready,
      isHomeowner: session?.user.role === UserRole.HOMEOWNER,
      isContractor: session?.user.role === UserRole.CONTRACTOR,
      signIn: doSignIn,
      signUp: doSignUp,
      signOut,
    }),
    [session, ready, doSignIn, doSignUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  // Throwing beats returning a default. A component rendered outside the provider would otherwise
  // look permanently signed out, and you would go hunting through the auth code for a bug that is
  // really a missing wrapper in `main.tsx`.
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
