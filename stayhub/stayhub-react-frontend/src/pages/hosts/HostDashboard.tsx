import { useQuery } from '@apollo/client/react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useAuth } from '../../context/AuthContext'
import { GET_MY_LISTINGS, GET_RESERVATIONS_AT_MY_PLACES } from '../../graphql/queries'
import type { GetMyListingsResult, GetReservationsResult } from '../../graphql/results'
import { formatRange } from '../../lib/dates'
import { moneyExact } from '../../lib/money'

export function HostDashboard() {
  const { user } = useAuth()
  const hostId = user?.publicId

  // ⚠️ Both queries run as the `host` Hasura role, which comes from the token's DEFAULT role —
  // FastAPI sets it to `host` for anyone with is_host = true. No `x-hasura-role` header needed.
  const listings = useQuery<GetMyListingsResult>(GET_MY_LISTINGS, {
    variables: { hostId },
    skip: !hostId,
  })
  const reservations = useQuery<GetReservationsResult>(GET_RESERVATIONS_AT_MY_PLACES, {
    variables: { hostId },
    skip: !hostId,
  })

  const allListings = listings.data?.properties ?? []
  const published = allListings.filter((p) => p.status === 'PUBLISHED').length
  const bookings = reservations.data?.bookings ?? []
  const upcoming = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING')
  const earned = bookings
    .filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED')
    .reduce((sum, b) => sum + Number(b.total), 0)

  // The dashboard is a "what needs my attention" view, so cancellations are filtered out — a
  // panel headed "reservations" that lists only cancelled stays tells a host nothing. The full
  // history, cancellations included, is on /hosts/reservations.
  const live = bookings.filter((b) => b.status !== 'CANCELLED')

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Hosting dashboard</h1>
          <p className="mt-1 text-sm text-ink-600">Welcome back, {user?.firstName}.</p>
        </div>
        <Link to="/hosts/listings/new">
          <Button>Add a listing</Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Listings" value={String(allListings.length)} />
        <Stat label="Published" value={String(published)} />
        <Stat label="Upcoming stays" value={String(upcoming.length)} />
        {/* Summed in the browser from rows Hasura already returned — fine for a host's own small
            set. A staff-wide figure would be a database aggregate instead. */}
        <Stat label="Booked value" value={moneyExact(earned)} />
      </div>

      <h2 className="mt-10 text-lg font-semibold text-ink-900">Upcoming reservations</h2>
      {live.length === 0 ? (
        <p className="mt-3 rounded-card border border-ink-200 p-6 text-sm text-ink-600">
          Nothing on the calendar. Publish a listing and it appears in search immediately.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-200 rounded-card border border-ink-200">
          {live.slice(0, 6).map((b) => (
            <li key={b.publicId} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">{b.property?.title}</p>
                <p className="text-xs text-ink-500">
                  {/* `guest` resolves through a row permission that only lets a host read guests
                      who booked one of THEIR places. A null here would mean that rule is wrong. */}
                  {b.guest?.firstName ?? 'Guest'} · {formatRange(b.checkIn, b.checkOut)} ·{' '}
                  {b.guests} {b.guests === 1 ? 'guest' : 'guests'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-ink-900">{moneyExact(b.total)}</p>
                <p className="text-xs text-ink-500">{b.status.toLowerCase()}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-ink-200 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink-900">{value}</p>
    </div>
  )
}
