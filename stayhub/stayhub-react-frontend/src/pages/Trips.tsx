import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { CheckIcon, SpinnerIcon } from '../components/Icons'
import { useToast } from '../context/ToastContext'
import { ApiError, bookingApi } from '../lib/api'
import { formatDate, formatRange } from '../lib/dates'
import { moneyExact } from '../lib/money'
import type { Booking, BookingStatus } from '../types'

const STATUS_STYLE: Record<BookingStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  CONFIRMED: 'bg-emerald-100 text-emerald-900',
  CANCELLED: 'bg-ink-100 text-ink-600',
  COMPLETED: 'bg-sky-100 text-sky-900',
}

export function Trips() {
  const [params, setParams] = useSearchParams()
  const { toast } = useToast()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const justConfirmed = params.get('confirmed')

  /* Read through FastAPI rather than Hasura here, deliberately: `isCancellable` and
     `cancellationDeadline` are computed by the server from today's date, and a GraphQL column
     query cannot produce them. Reading the same rows either way is fine — this is the one that
     carries the policy. */
  const load = useCallback(async () => {
    try {
      setBookings(await bookingApi.mine())
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function cancel(booking: Booking) {
    setCancelling(booking.publicId)
    try {
      const updated = await bookingApi.cancel(booking.publicId, 'Cancelled from My trips')
      setBookings((current) =>
        current.map((b) => (b.publicId === updated.publicId ? updated : b)),
      )
      toast('Booking cancelled.', 'success')
    } catch (err) {
      // The server re-checks the deadline even though the button is hidden past it — a hidden
      // button is a courtesy, not a permission. This is what that refusal looks like.
      toast(err instanceof ApiError ? err.message : 'Could not cancel that booking.', 'error')
      void load()
    } finally {
      setCancelling(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <SpinnerIcon className="h-7 w-7 text-brand-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-ink-900">My trips</h1>

      {justConfirmed && (
        <div className="mt-5 flex items-start gap-3 rounded-card border border-emerald-200 bg-emerald-50 p-4">
          <CheckIcon className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900">You’re booked</p>
            <p className="text-xs text-emerald-800">A confirmation is on its way.</p>
          </div>
          <button
            type="button"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
            className="text-xs font-medium text-emerald-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="mt-10 rounded-card border border-ink-200 p-10 text-center">
          <p className="text-lg font-semibold text-ink-900">No trips yet</p>
          <p className="mt-1 text-sm text-ink-600">Time to go somewhere.</p>
          <Link to="/">
            <Button className="mt-5">Find a stay</Button>
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {bookings.map((booking) => (
            <li
              key={booking.publicId}
              // Identifies THIS booking, so a test can act on the row it created rather than
              // whichever row happens to match a title first — a guest may have several stays at
              // the same place, including cancelled ones.
              data-testid={`trip-${booking.publicId}`}
              className="flex flex-col gap-4 rounded-card border border-ink-200 p-4 sm:flex-row"
            >
              {booking.property?.coverImageUrl && (
                <img
                  src={booking.property.coverImageUrl}
                  alt=""
                  loading="lazy"
                  className="h-32 w-full shrink-0 rounded-lg object-cover sm:w-44"
                />
              )}

              <div className="flex flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-ink-900">
                    {booking.property?.title ?? 'Listing removed'}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[booking.status]}`}
                  >
                    {booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
                  </span>
                </div>

                <p className="mt-0.5 text-sm text-ink-500">
                  {booking.property?.city}, {booking.property?.country}
                </p>
                <p className="mt-2 text-sm text-ink-700">
                  {formatRange(booking.checkIn, booking.checkOut)} · {booking.nights}{' '}
                  {booking.nights === 1 ? 'night' : 'nights'} · {booking.guests}{' '}
                  {booking.guests === 1 ? 'guest' : 'guests'}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink-900">
                  {moneyExact(booking.total)}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                  {booking.status === 'PENDING' && (
                    <Link to={`/checkout/${booking.publicId}`}>
                      <Button size="sm">Complete payment</Button>
                    </Link>
                  )}

                  {booking.isCancellable ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={cancelling === booking.publicId}
                        onClick={() => cancel(booking)}
                      >
                        Cancel booking
                      </Button>
                      <span className="text-xs text-ink-500">
                        Free until {formatDate(booking.cancellationDeadline)}
                      </span>
                    </>
                  ) : (
                    booking.status !== 'CANCELLED' && (
                      <span className="text-xs text-ink-500">
                        Cancellation window closed on {formatDate(booking.cancellationDeadline)}
                      </span>
                    )
                  )}

                  {booking.cancelledAt && (
                    <span className="text-xs text-ink-500">
                      Cancelled {formatDate(booking.cancelledAt.slice(0, 10))}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
