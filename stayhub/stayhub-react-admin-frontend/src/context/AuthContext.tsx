import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { adminApi, tokenStore, type AdminUser } from '../lib/api'
import { clearApollo } from '../lib/apollo'

interface AuthValue {
  user: AdminUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!tokenStore.get()) {
        setLoading(false)
        return
      }
      try {
        const me = await adminApi.me()
        // ⚠️ Re-checked on every boot, not just at login. A token minted before someone was
        // demoted still decodes perfectly — only the CURRENT role decides who gets in.
        if (!cancelled) setUser(me.role === 'ADMIN' ? me : null)
        if (me.role !== 'ADMIN') tokenStore.clear()
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
    const result = await adminApi.login(email, password)

    // ⚠️ The console refuses a valid non-staff login rather than letting them in and hiding the
    // buttons. Hiding UI is not a permission — and the API would refuse every action anyway, so
    // letting them in produces a console where nothing works and nothing says why.
    if (result.user.role !== 'ADMIN') {
      throw new Error('That account does not have staff access.')
    }

    tokenStore.set(result.accessToken)
    setUser(result.user)
    await clearApollo()
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    void clearApollo()
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
