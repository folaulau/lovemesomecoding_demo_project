/** Who is signed in, for the whole app.
 *
 * Context rather than Redux: this is one small, rarely-changing value that almost every page
 * reads. A store would add a reducer, an action and a selector to express "the current user",
 * which is not a state machine — it is a value.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi, tokenStore } from '../lib/api'
import { resetApolloAfterAuthChange } from '../lib/apollo'
import type { User } from '../types'

interface AuthValue {
  user: User | null
  /** True until the token in storage has been checked. Gate redirects on this — see below. */
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (payload: {
    email: string
    password: string
    firstName: string
    lastName: string
    becomeHost?: boolean
  }) => Promise<User>
  becomeHost: (hostBio?: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Revive the session on boot. A token in localStorage is a claim, not proof — it may have
  // expired, or the account may be gone — so it is verified against /auth/me rather than trusted.
  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!tokenStore.get()) {
        setLoading(false)
        return
      }
      try {
        const me = await authApi.me()
        // ⚠️ The cancelled guard matters in React 18+ StrictMode, which mounts every effect
        // twice in development. Without it the slower of the two responses can overwrite the
        // faster one, and a logout during the request can be undone by its own reply.
        if (!cancelled) setUser(me)
      } catch {
        tokenStore.clear()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    tokenStore.set(result.accessToken)
    setUser(result.user)
    await resetApolloAfterAuthChange(true)
    return result.user
  }, [])

  const register = useCallback(
    async (payload: {
      email: string
      password: string
      firstName: string
      lastName: string
      becomeHost?: boolean
    }) => {
      const result = await authApi.register(payload)
      tokenStore.set(result.accessToken)
      setUser(result.user)
      await resetApolloAfterAuthChange(true)
      return result.user
    },
    [],
  )

  const becomeHost = useCallback(async (hostBio?: string) => {
    const result = await authApi.becomeHost(hostBio)
    // ⚠️ Storing the NEW token is mandatory. The old one carries
    // `allowed_roles: [customer, anonymous]`, so keeping it means every /hosts GraphQL query is
    // denied — and the error blames Hasura permissions rather than the stale token.
    tokenStore.set(result.accessToken)
    setUser(result.user)
    await resetApolloAfterAuthChange(true)
    return result.user
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    // Emptying the Apollo cache is not optional: without it the next visitor to this browser sees
    // the previous user's bookings served from cache, with no request to notice.
    void resetApolloAfterAuthChange(false)
  }, [])

  // useMemo so the context VALUE is stable. Without it every render of the provider creates a new
  // object and re-renders every consumer in the app — which for an auth context is all of it.
  const value = useMemo<AuthValue>(
    () => ({ user, loading, login, register, becomeHost, logout }),
    [user, loading, login, register, becomeHost, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  // Throwing beats returning null: the failure then names the real problem — a component outside
  // the provider — instead of surfacing as "cannot read property 'user' of null" somewhere else.
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
