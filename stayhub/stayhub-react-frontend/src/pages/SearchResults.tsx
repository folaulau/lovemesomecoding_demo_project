import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ListingCard, ListingCardSkeleton, type ListingCardData } from '../components/ListingCard'
import { SearchBar } from '../components/SearchBar'
import { searchApi } from '../lib/api'
import type { SearchResponse } from '../types'

const AMENITY_FILTERS = [
  { slug: 'wifi', label: 'Wifi' },
  { slug: 'kitchen', label: 'Kitchen' },
  { slug: 'pool', label: 'Pool' },
  { slug: 'hot-tub', label: 'Hot tub' },
  { slug: 'free-parking', label: 'Free parking' },
  { slug: 'pets-allowed', label: 'Pets allowed' },
  { slug: 'fireplace', label: 'Fireplace' },
  { slug: 'beach-access', label: 'Beach access' },
]

const PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'CABIN', 'CONDO', 'LOFT', 'VILLA']

const SORTS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
]

/** The Elasticsearch-backed page — the one read that does NOT come from Hasura. */
export function SearchResults() {
  const [params, setParams] = useSearchParams()
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const q = params.get('q') ?? ''
  const guests = Number(params.get('guests') ?? 0) || undefined
  const maxPrice = Number(params.get('maxPrice') ?? 0) || undefined
  const propertyType = params.get('propertyType') ?? undefined
  const sort = params.get('sort') ?? 'relevance'
  // useMemo so this array is referentially stable — it is a dependency of the fetch effect below,
  // and a fresh array every render would re-run the search on every render, forever.
  const amenities = useMemo(() => params.getAll('amenities'), [params])

  // A monotonically increasing request id. ⚠️ Without it, two searches in flight can resolve out
  // of order and the SLOWER, older response overwrites the newer one — the user sees results for
  // a query they already changed. This is the race an AbortController would also solve; a counter
  // is simpler and does not need the request cancelled to be correct.
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)

    searchApi
      .search({ q, guests, maxPrice, propertyType, amenities, sort, pageSize: 24 })
      .then((data) => {
        if (id === requestId.current) setResult(data)
      })
      .catch((err: Error) => {
        if (id === requestId.current) setError(err.message)
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [q, guests, maxPrice, propertyType, amenities, sort])

  function update(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params)
    mutate(next)
    // The URL is the state. A filter change is a navigation, so it is shareable and the Back
    // button undoes it — neither is true if filters live only in component state.
    setParams(next, { replace: true })
  }

  function toggleAmenity(slug: string) {
    update((next) => {
      const current = next.getAll('amenities')
      next.delete('amenities')
      const wanted = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug]
      wanted.forEach((s) => next.append('amenities', s))
    })
  }

  const listings: ListingCardData[] = (result?.hits ?? []).map((hit) => ({
    publicId: hit.publicId,
    title: hit.title,
    city: hit.city,
    state: hit.state,
    country: hit.country,
    roomType: hit.roomType,
    pricePerNight: hit.pricePerNight,
    ratingAverage: hit.ratingAverage,
    ratingCount: hit.ratingCount,
    bedrooms: hit.bedrooms,
    beds: hit.beds,
    coverUrl: hit.coverImageUrl,
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex justify-center">
        <SearchBar initialQuery={q} initialGuests={guests ?? 1} compact />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {AMENITY_FILTERS.map((a) => {
          const active = amenities.includes(a.slug)
          return (
            <button
              key={a.slug}
              type="button"
              onClick={() => toggleAmenity(a.slug)}
              aria-pressed={active}
              className={[
                'rounded-full border px-3.5 py-1.5 text-sm transition',
                active
                  ? 'border-ink-900 bg-ink-900 text-white'
                  : 'border-ink-300 text-ink-700 hover:border-ink-900',
              ].join(' ')}
            >
              {a.label}
            </button>
          )
        })}

        <select
          value={propertyType ?? ''}
          onChange={(e) => update((n) => (e.target.value ? n.set('propertyType', e.target.value) : n.delete('propertyType')))}
          aria-label="Property type"
          className="rounded-full border border-ink-300 px-3.5 py-1.5 text-sm text-ink-700"
        >
          <option value="">Any type</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ')}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => update((n) => n.set('sort', e.target.value))}
          aria-label="Sort results"
          className="rounded-full border border-ink-300 px-3.5 py-1.5 text-sm text-ink-700"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {(amenities.length > 0 || propertyType || q) && (
          <button
            type="button"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
            className="text-sm font-medium text-ink-600 underline hover:text-ink-900"
          >
            Clear all
          </button>
        )}
      </div>

      <p className="mt-6 text-sm text-ink-600" aria-live="polite">
        {loading
          ? 'Searching…'
          : result
            ? `${result.total} ${result.total === 1 ? 'stay' : 'stays'}${q ? ` for “${q}”` : ''} · ${result.tookMs} ms`
            : ''}
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
          <p className="mt-1 text-xs text-red-600">
            Search runs on Elasticsearch — check it is up on :9200, then reindex from the admin app.
          </p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && listings.length === 0
          ? Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)
          : listings.map((listing) => <ListingCard key={listing.publicId} listing={listing} />)}
      </div>

      {!loading && !error && listings.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-lg font-semibold text-ink-900">No stays match those filters</p>
          <p className="mt-1 text-sm text-ink-600">Try removing a filter or searching a wider area.</p>
        </div>
      )}
    </div>
  )
}
