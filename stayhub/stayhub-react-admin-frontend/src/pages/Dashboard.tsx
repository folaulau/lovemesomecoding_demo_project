import { useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { Button, Card, EmptyState, PageHeader, Spinner, Stat, StatusPill } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { GET_DASHBOARD } from '../graphql/queries'
import type { GetDashboardResult } from '../graphql/results'
import { adminApi } from '../lib/api'
import { formatDate, money } from '../lib/format'

export function Dashboard() {
  const { data, loading, error, refetch } = useQuery<GetDashboardResult>(GET_DASHBOARD)
  const { toast } = useToast()
  const [reindexing, setReindexing] = useState(false)

  async function reindex() {
    setReindexing(true)
    try {
      const result = await adminApi.reindex()
      toast(result.message, 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setReindexing(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 text-sm text-red-700">
        Could not load the dashboard: {error.message}
      </Card>
    )
  }

  const count = (node: { aggregate: { count: number } | null } | undefined) =>
    node?.aggregate?.count ?? 0

  const gross = data?.confirmedAggregate?.aggregate?.sum?.total ?? 0

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Every figure is a Postgres aggregate computed by Hasura — no rows are counted in the browser."
        action={
          <Button variant="secondary" loading={reindexing} onClick={reindex}>
            Rebuild search index
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Listings"
          value={String(count(data?.propertiesAggregate))}
          hint={`${count(data?.publishedAggregate)} published`}
        />
        <Stat
          label="Users"
          value={String(count(data?.usersAggregate))}
          hint={`${count(data?.hostsAggregate)} are hosts`}
        />
        <Stat
          label="Bookings"
          value={String(count(data?.bookingsAggregate))}
          hint={`${count(data?.cancelledAggregate)} cancelled`}
        />
        <Stat
          label="Confirmed value"
          value={money(gross)}
          hint={`${count(data?.confirmedAggregate)} confirmed stays`}
        />
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink-900">Latest bookings</h2>
      {(data?.recentBookings ?? []).length === 0 ? (
        <EmptyState message="No bookings yet." />
      ) : (
        <Card className="divide-y divide-ink-100">
          {data?.recentBookings.map((booking) => (
            <div key={booking.publicId} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {booking.property?.title ?? 'Listing removed'}
                </p>
                <p className="text-xs text-ink-500">
                  {booking.guest ? `${booking.guest.firstName} ${booking.guest.lastName}` : 'Guest removed'}{' '}
                  · {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-ink-900">{money(booking.total)}</span>
                <StatusPill status={booking.status} />
              </div>
            </div>
          ))}
        </Card>
      )}

      <button
        type="button"
        onClick={() => void refetch()}
        className="mt-4 text-xs font-medium text-ink-500 underline hover:text-ink-800"
      >
        Refresh
      </button>
    </>
  )
}
