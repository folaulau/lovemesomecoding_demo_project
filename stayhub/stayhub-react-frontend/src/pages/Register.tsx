import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    becomeHost: false,
  })
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [loading, setLoading] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const user = await register(form)
      navigate(user.isHost ? '/hosts/dashboard' : '/', { replace: true })
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }

  const fieldError = (name: string) => (error instanceof ApiError ? error.fieldError(name) : undefined)

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-bold text-ink-900">Create your account</h1>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="First name"
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            error={fieldError('firstName')}
            autoComplete="given-name"
            required
          />
          <Field
            label="Last name"
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            error={fieldError('lastName')}
            autoComplete="family-name"
            required
          />
        </div>
        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          error={fieldError('email')}
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          error={fieldError('password')}
          hint="At least 8 characters. Length beats punctuation."
          autoComplete="new-password"
          minLength={8}
          required
        />

        <label className="flex items-start gap-3 rounded-lg border border-ink-200 p-3">
          <input
            type="checkbox"
            checked={form.becomeHost}
            onChange={(e) => set('becomeHost', e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-500"
          />
          <span className="text-sm text-ink-700">
            <span className="font-medium text-ink-900">I want to host too</span>
            <br />
            {/*
              This checkbox is safe to honour because hosting is a MODE, not a privilege level.
              The `role` field is NOT in this form and never should be — a role taken from a
              registration body is how an API hands out admin accounts.
            */}
            You can list a place straight after signing up. You can also turn this on later.
          </span>
        </label>

        {error && Object.keys(error instanceof ApiError ? error.fieldErrors : {}).length === 0 && (
          <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error.message}</p>
        )}

        <Button type="submit" size="lg" loading={loading} className="mt-1">
          Sign up
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-600 underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
