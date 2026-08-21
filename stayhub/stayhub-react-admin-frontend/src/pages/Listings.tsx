import { useQuery } from '@apollo/client/react'
import { useMemo, useState } from 'react'
import { Button, EmptyState, PageHeader, Spinner, StatusPill, TableShell } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { GET_ALL_LISTINGS } from '../graphql/queries'
import type { GetAllListingsResult } from '../graphql/results'
import { adminApi } from '../lib/api'
import { formatDate, money, titleCase } from '../lib/format'

const FILTERS = ['ALL', 'PUBLISHED', 'DRAFT', 'SUSPENDED'] as const

export function Listings() {
  // Staff see EVERY listing — drafts and suspended ones included. No `where` clause does that;
  // the staff role's row permission has an empty filter, so the same query returns everything.
  const { data, loading, error, refetch } = useQuery<GetAllListingsResult>(GET_ALL_LISTINGS)
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')

  const listings = useMemo(() => {
    const all = data?.properties ?? []
    return filter === 'ALL' ? all : all.filter((p) => p.status === filter)
  }, [data, filter])

  async function toggleSuspend(publicId: string, currentStatus: string) {
    setBusy(publicId)
    try {
      if (currentStatus === 'SUSPENDED') {
        await adminApi.unsuspendProperty(publicId)
        toast('Listing restored and reindexed.', 'success')
      } else {
        await adminApi.suspendProperty(publicId)
        toast('Listing suspended and removed from search.', 'success')
      }
      // Refetch rather than patching the cache by hand: the write went through FastAPI, so Apollo
      // has no idea anything changed and nothing would invalidate on its own.
      await refetch()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    )
  }

  if (error) return <EmptyState message={`Could not load listings: ${error.message}`} />

  return (
    <>
      <PageHeader
        title="Listings"
        subtitle="Drafts and suspended listings are visible here and nowhere else."
      />

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
                ? (data?.properties ?? []).length
                : (data?.properties ?? []).filter((p) => p.status === option).length}
            </span>
          </button>
        ))}
      </div>

      {listings.length === 0 ? (
        <EmptyState message="No listings match that filter." />
      ) : (
        <TableShell headers={['Listing', 'Host', 'Status', 'Price', 'Bookings', 'Added', '']}>
          {listings.map((listing) => (
            <tr key={listing.publicId} data-testid={`listing-${listing.publicId}`}>
              <td className="px-4 py-3">
                <p className="font-medium text-ink-900">{listing.title}</p>
                <p className="text-xs text-ink-500">
                  {listing.city}
                  {listing.state ? `, ${listing.state}` : ''} · {titleCase(listing.propertyType)}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-700">
                {listing.host ? `${listing.host.firstName} ${listing.host.lastName}` : '—'}
              </td>
              <td className="px-4 py-3">
                <StatusPill status={listing.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-700">
                {money(listing.pricePerNight)}
              </td>
              <td className="px-4 py-3 text-ink-700">
                {listing.bookingsAggregate?.aggregate?.count ?? 0}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-500">
                {formatDate(listing.createdAt)}
              </td>
              <td className="px-4 py-3 text-right">
                {listing.status === 'DRAFT' ? (
                  <span className="text-xs text-ink-400">Not live</span>
                ) : (
                  <Button
                    variant={listing.status === 'SUSPENDED' ? 'secondary' : 'danger'}
                    loading={busy === listing.publicId}
                    onClick={() => toggleSuspend(listing.publicId, listing.status)}
                  >
                    {listing.status === 'SUSPENDED' ? 'Restore' : 'Suspend'}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      <p className="mt-4 text-xs text-ink-500">
        Suspending removes a listing from Elasticsearch immediately. Existing bookings are
        deliberately left alone — pulling a listing must not cancel stays people have paid for.
      </p>
    </>
  )
}
