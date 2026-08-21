import { useQuery } from '@apollo/client/react'
import { useMemo, useState } from 'react'
import { EmptyState, PageHeader, Spinner, StatusPill, TableShell } from '../components/ui'
import { GET_ALL_BOOKINGS } from '../graphql/queries'
import type { GetAllBookingsResult } from '../graphql/results'
import { formatDate, money, titleCase } from '../lib/format'

const FILTERS = ['ALL', 'PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] as const

export function Bookings() {
  const { data, loading, error } = useQuery<GetAllBookingsResult>(GET_ALL_BOOKINGS)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')

  const bookings = useMemo(() => {
    const all = data?.bookings ?? []
    return filter === 'ALL' ? all : all.filter((b) => b.status === filter)
  }, [data, filter])

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    )
  }

  if (error) return <EmptyState message={`Could not load bookings: ${error.message}`} />

  return (
    <>
      <PageHeader title="Bookings" subtitle="Every stay across the platform." />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
            className={[
              'rounded-full border px-3 py-1.5 text-sm transition',
              filter === option
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-ink-300 bg-white text-ink-700 hover:border-ink-900',
            ].join(' ')}
          >
            {titleCase(option)}
            <span className="ml-1.5 text-xs opacity-70">
              {option === 'ALL'
                ? (data?.bookings ?? []).length
                : (data?.bookings ?? []).filter((b) => b.status === option).length}
            </span>
          </button>
        ))}
      </div>

      {bookings.length === 0 ? (
        <EmptyState message="No bookings match that filter." />
      ) : (
        <TableShell headers={['Listing', 'Guest', 'Dates', 'Nights', 'Status', 'Total']}>
          {bookings.map((booking) => (
            <tr key={booking.publicId}>
              <td className="px-4 py-3">
                <p className="font-medium text-ink-900">{booking.property?.title ?? '—'}</p>
                <p className="text-xs text-ink-500">{booking.property?.city}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-700">
                {booking.guest ? `${booking.guest.firstName} ${booking.guest.lastName}` : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-700">
                {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}
              </td>
              <td className="px-4 py-3 text-ink-700">{booking.nights}</td>
              <td className="px-4 py-3">
                <StatusPill status={booking.status} />
                {booking.cancelledAt && (
                  <p className="mt-0.5 text-xs text-ink-400">
                    {formatDate(booking.cancelledAt)}
                  </p>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink-900">
                {money(booking.total)}
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      {/* Worth saying out loud on the page: payment CARD metadata is visible to staff in the
          database, but this table deliberately does not show it. Nothing here needs it. */}
      <p className="mt-4 text-xs text-ink-500">
        Read entirely from Hasura as the <span className="font-mono">staff</span> role — no
        bespoke admin read endpoint was needed for any of this.
      </p>
    </>
  )
}
