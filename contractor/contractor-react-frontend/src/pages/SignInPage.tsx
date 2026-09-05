import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Button, Card, ErrorNote, Field, TextInput } from '../components/ui'
import { useAuth } from '../lib/auth'
import { UserRole } from '../types/domain'

/** Where each role belongs after signing in. A pro landing on "my projects" — a page that will
 *  always be empty for them — is a small thing that makes an app feel like it was not built for
 *  you. */
function landingFor(role: string): string {
  return role === UserRole.CONTRACTOR ? '/pro/leads' : '/projects'
}

export function SignInPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Already signed in? There is nothing for this page to do. `replace` keeps it out of history so
  // Back does not land on a form that immediately redirects again.
  if (user) return <Navigate to={landingFor(user.role)} replace />

  // Set by the nav's Sign in button and by RequireAuth, so an interrupted click resumes.
  const from = (location.state as { from?: string } | null)?.from

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const signedIn = await signIn(email, password)
      navigate(from ?? landingFor(signedIn.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in.')
    } finally {
      // `finally` rather than after the navigate: on the success path the component unmounts, and
      // on the failure path the button has to become clickable again. One line covers both.
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-600">Sign in to manage your projects and quotes.</p>

      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <ErrorNote>{error}</ErrorNote>}

          <Field label="Email" htmlFor="email" required>
            <TextInput
              id="email"
              type="email"
              // `username` rather than `email` is what password managers look for on a login form;
              // `email` is for the sign-up form. It is a small difference and it decides whether
              // autofill works.
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password" htmlFor="password" required>
            <TextInput
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Button type="submit" size="lg" loading={busy} className="w-full">
            Sign in
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-slate-600">
        New here?{' '}
        <Link to="/signup" className="font-semibold text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>

      {/* Throwaway local fixtures — see the note in the footer. */}
      <Card tone="muted" className="mt-8 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>
            <button
              type="button"
              className="font-mono text-xs text-brand-700 hover:underline"
              onClick={() => {
                setEmail('maya@contractor.test')
                setPassword('maya123')
              }}
            >
              maya@contractor.test / maya123
            </button>{' '}
            — homeowner with three projects
          </li>
          <li>
            <button
              type="button"
              className="font-mono text-xs text-brand-700 hover:underline"
              onClick={() => {
                setEmail('luis@contractor.test')
                setPassword('luis123')
              }}
            >
              luis@contractor.test / luis123
            </button>{' '}
            — plumbing and HVAC contractor
          </li>
        </ul>
      </Card>
    </div>
  )
}
