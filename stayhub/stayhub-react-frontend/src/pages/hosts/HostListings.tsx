import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { SpinnerIcon } from '../../components/Icons'
import { ListingCard, type ListingCardData } from '../../components/ListingCard'
import { useToast } from '../../context/ToastContext'
import { ApiError, propertyApi } from '../../lib/api'
import type { Property } from '../../types'

export function HostListings() {
  const { toast } = useToast()
  const [listings, setListings] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setListings(await propertyApi.mine())
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(listing: Property) {
    setBusy(listing.publicId)
    try {
      const updated =
        listing.status === 'PUBLISHED'
          ? await propertyApi.unpublish(listing.publicId)
          : await propertyApi.publish(listing.publicId)

      setListings((current) =>
        current.map((p) => (p.publicId === updated.publicId ? updated : p)),
      )
      toast(
        updated.status === 'PUBLISHED'
          ? 'Published — it is in search now.'
          : 'Unpublished. Existing bookings are unaffected.',
        'success',
      )
    } catch (err) {
      // Publishing has entry requirements (a photo, a real description, a price). The server
      // states exactly what is missing — pass that through rather than a generic failure.
      toast(err instanceof ApiError ? err.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink-900">My listings</h1>
        <Link to="/hosts/listings/new">
          <Button>Add a listing</Button>
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="mt-10 rounded-card border border-ink-200 p-10 text-center">
          <p className="text-lg font-semibold text-ink-900">Nothing listed yet</p>
          <p className="mt-1 text-sm text-ink-600">
            Add a place and publish it — it appears in search straight away.
          </p>
          <Link to="/hosts/listings/new">
            <Button className="mt-5">Add your first listing</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => {
            const card: ListingCardData = {
              publicId: listing.publicId,
              title: listing.title,
              city: listing.city,
              state: listing.state,
              country: listing.country,
              roomType: listing.roomType,
              pricePerNight: listing.pricePerNight,
              ratingAverage: listing.ratingAverage,
              ratingCount: listing.ratingCount,
              bedrooms: listing.bedrooms,
              beds: listing.beds,
              coverUrl: listing.images.find((i) => i.isCover)?.url ?? listing.images[0]?.url ?? null,
              status: listing.status,
            }
            return (
              <div
                key={listing.publicId}
                // A stable hook for the e2e suite. Tests that select on Tailwind classes break
                // the moment a class changes for a purely visual reason — and `div.flex-col`
                // also matches every ancestor, so `.first()` silently grabs the page wrapper.
                data-testid="host-listing-card"
                className="flex flex-col gap-3"
              >
                <ListingCard listing={card} />
                <Button
                  size="sm"
                  variant={listing.status === 'PUBLISHED' ? 'secondary' : 'primary'}
                  loading={busy === listing.publicId}
                  onClick={() => toggle(listing)}
                >
                  {listing.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
