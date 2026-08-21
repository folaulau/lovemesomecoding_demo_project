import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [loading, setLoading] = useState(false)

  // Where the guard sent them from. Falling back to "/" matters — landing on the login page
  // directly leaves `state` undefined, and reading `.from` off it would throw.
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      // `replace` so Back does not return to the login form they just completed.
      navigate(from, { replace: true })
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }

  const fieldError = (name: string) => (error instanceof ApiError ? error.fieldError(name) : undefined)

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-bold text-ink-900">Log in to StayHub</h1>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError('email')}
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError('password')}
          autoComplete="current-password"
          required
        />

        {error && !fieldError('email') && !fieldError('password') && (
          // The server answers "Email or password is incorrect" for BOTH a wrong password and an
          // unknown address — on purpose. Saying which was wrong turns this form into a way to
          // discover who has an account.
          <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error.message}</p>
        )}

        <Button type="submit" size="lg" loading={loading} className="mt-1">
          Log in
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-600">
        New here?{' '}
        <Link to="/register" className="font-semibold text-brand-600 underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8 rounded-lg bg-ink-50 p-4 text-xs text-ink-600">
        <p className="font-semibold text-ink-800">Demo accounts</p>
        <ul className="mt-1.5 space-y-0.5 font-mono">
          <li>guest@stayhub.test / guest123</li>
          <li>host@stayhub.test / host123</li>
        </ul>
      </div>
    </div>
  )
}
