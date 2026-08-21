import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { ShieldIcon, SpinnerIcon } from '../components/Icons'
import { useToast } from '../context/ToastContext'
import { bookingApi, paymentApi } from '../lib/api'
import { formatDate, formatRange } from '../lib/dates'
import { moneyExact } from '../lib/money'
import { getStripe } from '../lib/stripe'
import type { Booking, PaymentIntentResponse } from '../types'

export function Checkout() {
  const { bookingId = '' } = useParams()
  const navigate = useNavigate()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [intent, setIntent] = useState<PaymentIntentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const b = await bookingApi.get(bookingId)
        if (cancelled) return
        setBooking(b)

        if (b.status === 'CONFIRMED') {
          navigate(`/trips?confirmed=${b.publicId}`, { replace: true })
          return
        }

        const created = await paymentApi.createIntent(bookingId)
        if (!cancelled) setIntent(created)
      } catch (err) {
        if (!cancelled) setSetupError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [bookingId, navigate])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <SpinnerIcon className="h-7 w-7 text-brand-500" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Booking not found</h1>
        <Button className="mt-6" onClick={() => navigate('/trips')}>
          My trips
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-ink-900">Confirm and pay</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          {setupError ? (
            <div className="rounded-card border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-base font-semibold text-amber-900">Payment is not set up</h2>
              <p className="mt-2 text-sm text-amber-800">{setupError}</p>
              <p className="mt-3 text-xs text-amber-700">
                Add <code className="font-mono">STAYHUB_STRIPE_SECRET_KEY</code> to the backend
                <code className="font-mono"> .env</code> and{' '}
                <code className="font-mono">VITE_STRIPE_PUBLISHABLE_KEY</code> to this app’s{' '}
                <code className="font-mono">.env.local</code>, then reload. The booking is already
                held — your dates are safe.
              </p>
              <Button variant="secondary" className="mt-4" onClick={() => navigate('/trips')}>
                View it in My trips
              </Button>
            </div>
          ) : intent ? (
            // ⚠️ `clientSecret` must be on <Elements>, not on the confirm call. Stripe reads it to
            // decide which payment methods this intent supports, so PaymentElement cannot render
            // without it — and the key prop forces a remount if the intent ever changes.
            <Elements
              key={intent.clientSecret}
              stripe={getStripe(intent.publishableKey)}
              options={{
                clientSecret: intent.clientSecret,
                appearance: { theme: 'stripe', variables: { colorPrimary: '#f4511e' } },
              }}
            >
              <PaymentForm booking={booking} onDone={() => navigate(`/trips?confirmed=${booking.publicId}`)} />
            </Elements>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-ink-200 p-5">
            {booking.property && (
              <div className="flex gap-3 border-b border-ink-200 pb-4">
                {booking.property.coverImageUrl && (
                  <img
                    src={booking.property.coverImageUrl}
                    alt=""
                    className="h-20 w-24 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-ink-900">{booking.property.title}</p>
                  <p className="text-xs text-ink-500">
                    {booking.property.city}, {booking.property.country}
                  </p>
                </div>
              </div>
            )}

            <p className="pt-4 text-sm text-ink-700">
              {formatRange(booking.checkIn, booking.checkOut)} · {booking.guests}{' '}
              {booking.guests === 1 ? 'guest' : 'guests'}
            </p>

            <dl className="mt-4 space-y-2.5 border-t border-ink-200 pt-4 text-sm">
              <Row
                label={`${moneyExact(booking.nightlyRate)} × ${booking.nights} nights`}
                value={moneyExact(booking.subtotal)}
              />
              <Row label="Cleaning fee" value={moneyExact(booking.cleaningFee)} />
              <Row label="Service fee" value={moneyExact(booking.serviceFee)} />
              <div className="flex justify-between border-t border-ink-200 pt-3 text-base font-bold text-ink-900">
                <dt>Total (USD)</dt>
                {/* These are the SERVER's figures, read back off the created booking. The
                    listing page showed a preview; this is the number that will be charged. */}
                <dd>{moneyExact(booking.total)}</dd>
              </div>
            </dl>

            <p className="mt-4 flex items-start gap-2 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
              <ShieldIcon className="h-4 w-4 shrink-0 text-ink-500" />
              Cancel free until {formatDate(booking.cancellationDeadline)}.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function PaymentForm({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    // Both are null until Stripe.js finishes loading. Submitting before then silently does
    // nothing, which reads to the user as a dead button.
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    const result = await stripe.confirmPayment({
      elements,
      // `if_required` keeps the user on this page for a card that needs no 3-D Secure step.
      // Without it Stripe always redirects, and the whole confirmation flow has to be rebuilt
      // around a return URL.
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/trips` },
    })

    if (result.error) {
      setError(result.error.message ?? 'That payment could not be completed.')
      setSubmitting(false)
      return
    }

    // ⚠️ Stripe saying "succeeded" is not our server saying the booking is CONFIRMED. The webhook
    // does that, and it may not have arrived yet — locally it may never arrive, since a webhook
    // needs a public URL. Poll our own API, which falls back to asking Stripe directly.
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const status = await paymentApi.status(booking.publicId)
        if (status.status === 'SUCCEEDED') {
          toast('Payment received — your stay is booked.', 'success')
          onDone()
          return
        }
      } catch {
        /* keep polling */
      }
      await new Promise((resolve) => setTimeout(resolve, 800))
    }

    // Paid, but not yet reflected. Say so honestly rather than showing a failure for money that
    // has genuinely left the account.
    toast('Payment went through — we are still confirming it.', 'info')
    onDone()
  }

  return (
    <form onSubmit={submit} className="rounded-card border border-ink-200 p-5">
      <h2 className="text-lg font-semibold text-ink-900">Pay with card</h2>
      <p className="mt-1 text-xs text-ink-500">
        Test mode — use <span className="font-mono">4242 4242 4242 4242</span>, any future expiry,
        any CVC.
      </p>

      {/* Stripe renders this in an IFRAME on its own domain. The card number never touches
          StayHub's JavaScript, which is what keeps this app out of PCI scope. */}
      <div className="mt-5">
        <PaymentElement />
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

      <Button type="submit" size="lg" className="mt-6 w-full" loading={submitting} disabled={!stripe}>
        Pay {moneyExact(booking.total)}
      </Button>
    </form>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-700">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
