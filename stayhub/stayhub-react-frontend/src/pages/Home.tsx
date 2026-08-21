import { useQuery } from '@apollo/client/react'
import { Link } from 'react-router-dom'
import { ListingCard, ListingCardSkeleton, type ListingCardData } from '../components/ListingCard'
import { SearchBar } from '../components/SearchBar'
import { GET_FEATURED_LISTINGS } from '../graphql/queries'
import type { GetFeaturedListingsResult } from '../graphql/results'

const DESTINATIONS = [
  { city: 'San Francisco', blurb: 'Lofts and hills' },
  { city: 'Austin', blurb: 'Music and tacos' },
  { city: 'Joshua Tree', blurb: 'Desert and stars' },
  { city: 'Lake Tahoe', blurb: 'Lake and slopes' },
  { city: 'Brooklyn', blurb: 'Brownstones' },
  { city: 'Maui', blurb: 'Oceanfront' },
]

export function Home() {
  // A Hasura read. Note there is no `where: { status: PUBLISHED }` — the anonymous role's row
  // permission already restricts this to published, non-deleted listings. A filter that cannot be
  // forgotten beats one that can.
  const { data, loading, error } = useQuery<GetFeaturedListingsResult>(GET_FEATURED_LISTINGS, {
    variables: { limit: 12 },
  })

  const listings: ListingCardData[] = (data?.properties ?? []).map((p) => ({
    publicId: p.publicId,
    title: p.title,
    city: p.city,
    state: p.state,
    country: p.country,
    roomType: p.roomType,
    pricePerNight: p.pricePerNight,
    ratingAverage: p.ratingAverage,
    ratingCount: p.ratingCount,
    bedrooms: p.bedrooms,
    beds: p.beds,
    coverUrl: p.images?.[0]?.url ?? null,
  }))

  return (
    <>
      <section className="border-b border-ink-200 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
            Find a place that feels like <span className="text-brand-500">somewhere</span>
          </h1>
          <p className="max-w-xl text-base text-ink-600">
            Cabins, lofts and whole houses, booked in a few clicks.
          </p>
          <SearchBar />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-ink-900">Browse by destination</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {DESTINATIONS.map((d) => (
            <Link
              key={d.city}
              to={`/search?q=${encodeURIComponent(d.city)}`}
              className="rounded-card border border-ink-200 p-4 transition hover:border-brand-300 hover:bg-brand-50"
            >
              <p className="text-sm font-semibold text-ink-900">{d.city}</p>
              <p className="mt-0.5 text-xs text-ink-500">{d.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-ink-900">Top rated stays</h2>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Could not load listings — is Hasura running on :8081? ({error.message})
          </p>
        )}

        <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Skeletons rather than a spinner: they occupy the same space the real cards will, so
              the page does not jump when the data arrives. */}
          {loading && listings.length === 0
            ? Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)
            : listings.map((listing) => <ListingCard key={listing.publicId} listing={listing} />)}
        </div>
      </section>
    </>
  )
}
