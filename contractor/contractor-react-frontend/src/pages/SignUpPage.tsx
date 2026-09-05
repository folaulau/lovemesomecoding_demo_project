import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { Button, Card, ErrorNote, Field, TextInput } from '../components/ui'
import { useAuth } from '../lib/auth'
import { cx } from '../lib/format'
import { UserRole } from '../types/domain'

type SignUpRole = Exclude<(typeof UserRole)[keyof typeof UserRole], 'staff'>

const ROLE_CHOICES: Array<{ value: SignUpRole; icon: string; title: string; body: string }> = [
  {
    value: UserRole.HOMEOWNER,
    icon: '🏡',
    title: "I'm a homeowner",
    body: 'Post projects and collect quotes from local pros.',
  },
  {
    value: UserRole.CONTRACTOR,
    icon: '🔧',
    title: "I'm a contractor",
    body: 'Find work, quote on jobs and build a public profile.',
  },
]

export function SignUpPage() {
  const { user, signUp } = useAuth()
  const navigate = useNavigate()

  const [role, setRole] = useState<SignUpRole>(UserRole.HOMEOWNER)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={user.role === UserRole.CONTRACTOR ? '/pro/leads' : '/projects'} replace />

  // One handler for every text field. `name` on the input picks the key, which keeps this page
  // from growing five nearly identical `onChange` closures.
  function update(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (form.password.length < 8) {
      setError('Use a password of at least 8 characters.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await signUp({ ...form, role })
      // A brand new contractor has an empty profile and cannot be found by anyone until it is
      // filled in, so they go to the edit form rather than to an empty lead feed.
      navigate(role === UserRole.CONTRACTOR ? '/pro/profile' : '/projects/new', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">One account, whichever side of the job you are on.</p>

      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {error && <ErrorNote>{error}</ErrorNote>}

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-slate-800">
              What brings you here?
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {ROLE_CHOICES.map((choice) => (
                // The whole card is the label, so clicking anywhere in it selects the radio. The
                // input itself is visually hidden but still focusable, which is what keeps arrow-key
                // navigation and the focus ring working.
                <label
                  key={choice.value}
                  className={cx(
                    'cursor-pointer rounded-xl border p-4 transition',
                    role === choice.value
                      ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20'
                      : 'border-slate-300 hover:border-slate-400',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={choice.value}
                    checked={role === choice.value}
                    onChange={() => setRole(choice.value)}
                    className="sr-only"
                  />
                  <span className="text-xl" aria-hidden="true">
                    {choice.icon}
                  </span>
                  <p className="mt-1 font-semibold text-slate-900">{choice.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{choice.body}</p>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="firstName" required>
              <TextInput
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                required
                value={form.firstName}
                onChange={update}
              />
            </Field>
            <Field label="Last name" htmlFor="lastName" required>
              <TextInput
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                required
                value={form.lastName}
                onChange={update}
              />
            </Field>
          </div>

          <Field label="Email" htmlFor="email" required>
            <TextInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={update}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Phone" htmlFor="phone" hint="Only shared with a pro once you hire them.">
            <TextInput
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={update}
              placeholder="512-555-0100"
            />
          </Field>

          <Field label="Password" htmlFor="password" hint="At least 8 characters." required>
            <TextInput
              id="password"
              name="password"
              type="password"
              // `new-password` is what tells a password manager to OFFER to generate one. Using
              // `current-password` here instead is why some sign-up forms autofill the user's
              // existing password for a completely different site.
              autoComplete="new-password"
              required
              value={form.password}
              onChange={update}
            />
          </Field>

          <Button type="submit" size="lg" loading={busy} className="w-full">
            Create account
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/signin" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
