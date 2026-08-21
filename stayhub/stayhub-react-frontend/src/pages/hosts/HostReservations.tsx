import { useCallback, useEffect, useState } from 'react'
import { SpinnerIcon } from '../../components/Icons'
import { useToast } from '../../context/ToastContext'
import { bookingApi } from '../../lib/api'
import { formatRange } from '../../lib/dates'
import { moneyExact } from '../../lib/money'
import type { Booking } from '../../types'

export function HostReservations() {
  const { toast } = useToast()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setBookings(await bookingApi.atMyPlaces())
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <SpinnerIcon className="h-7 w-7 text-brand-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-ink-900">Reservations</h1>
      <p className="mt-1 text-sm text-ink-600">Every stay booked across your listings.</p>

      {bookings.length === 0 ? (
        <p className="mt-8 rounded-card border border-ink-200 p-8 text-center text-sm text-ink-600">
          No reservations yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-ink-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Listing</th>
                <th className="px-4 py-3 font-semibold">Dates</th>
                <th className="px-4 py-3 font-semibold">Guests</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {bookings.map((b) => (
                <tr key={b.publicId}>
                  <td className="px-4 py-3 font-medium text-ink-900">{b.property?.title}</td>
                  <td className="px-4 py-3 text-ink-700">
                    {formatRange(b.checkIn, b.checkOut)}
                    <span className="block text-xs text-ink-500">
                      {b.nights} {b.nights === 1 ? 'night' : 'nights'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{b.guests}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">
                      {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink-900">
                    {moneyExact(b.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
