import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui'

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-ink-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <svg className="h-7 w-7 text-brand-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2.6c-.7 0-1.3.4-1.6 1L3.2 17.9c-.7 1.4.3 3 1.9 3h13.8c1.6 0 2.6-1.6 1.9-3L13.6 3.6a1.8 1.8 0 0 0-1.6-1zm0 4.2 5.6 11.4H6.4z" />
          </svg>
          <span className="text-lg font-extrabold tracking-tight">
            stayhub <span className="font-semibold text-brand-500">admin</span>
          </span>
        </div>

        <p className="mt-1 text-sm text-ink-500">Staff sign-in.</p>

        <label className="mt-6 flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="rounded-lg border border-ink-300 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
        </label>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-700">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="rounded-lg border border-ink-300 px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
        </label>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

        <Button type="submit" loading={loading} className="mt-6 w-full !py-2.5">
          Sign in
        </Button>

        <p className="mt-6 rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
          Demo staff account: <span className="font-mono">admin@stayhub.test / admin123</span>
        </p>
      </form>
    </div>
  )
}
