import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { TextArea } from '../components/Field'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export function BecomeHost() {
  const { user, becomeHost } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!user) {
      navigate('/register', { state: { from: '/become-a-host' } })
      return
    }
    setLoading(true)
    try {
      await becomeHost(bio || undefined)
      toast('You’re a host now — add your first listing.', 'success')
      navigate('/hosts/listings/new')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
        StayHub your home
      </h1>
      <p className="mt-3 text-ink-600">
        Hosting on StayHub is a mode of the account you already have — the same login books stays
        and lists them.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ['List it', 'Photos, a price, how many it sleeps.'],
          ['Publish it', 'It goes live and into search straight away.'],
          ['Get booked', 'Reservations land in your dashboard.'],
        ].map(([title, blurb]) => (
          <li key={title} className="rounded-card border border-ink-200 p-4">
            <p className="text-sm font-semibold text-ink-900">{title}</p>
            <p className="mt-1 text-sm text-ink-600">{blurb}</p>
          </li>
        ))}
      </ul>

      {user?.isHost ? (
        <div className="mt-10 rounded-card border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-900">You’re already a host.</p>
          <Button className="mt-4" onClick={() => navigate('/hosts/dashboard')}>
            Go to your dashboard
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-10 flex flex-col gap-4">
          <TextArea
            label="Tell guests a bit about you"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={1000}
            hint="Optional. It shows on your listings."
            placeholder="I've lived here fifteen years and know every good coffee shop."
          />
          <Button type="submit" size="lg" loading={loading}>
            {user ? 'Become a host' : 'Sign up and start hosting'}
          </Button>
        </form>
      )}
    </div>
  )
}
