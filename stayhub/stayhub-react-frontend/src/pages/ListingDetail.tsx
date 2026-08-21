import { useQuery } from '@apollo/client/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { DateRangePicker, defaultDates } from '../components/DateRangePicker'
import { BathIcon, BedIcon, CheckIcon, ShieldIcon, StarIcon, UsersIcon } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { GET_LISTING } from '../graphql/queries'
import type { GetListingResult } from '../graphql/results'
import { ApiError, bookingApi } from '../lib/api'
import { formatRange, nightsBetween } from '../lib/dates'
import { money, moneyExact, rating } from '../lib/money'
import type { AvailabilityResponse, PriceBreakdown } from '../types'

export function ListingDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  // The listing itself comes from Hasura…
  const { data, loading, error } = useQuery<GetListingResult>(GET_LISTING, {
    variables: { publicId: id },
  })
  const listing = data?.properties?.[0]

  // …but availability and pricing come from FastAPI, because both depend on bookings and on
  // pricing rules rather than on a row anyone may read.
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [dates, setDates] = useState<{ checkIn: string | null; checkOut: string | null }>(defaultDates)
  const [guests, setGuests] = useState(1)
  const [quote, setQuote] = useState<PriceBreakdown | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)

  useEffect(() => {
    if (!id) return
    bookingApi.availability(id).then(setAvailability).catch(() => setAvailability(null))
  }, [id])

  const { checkIn, checkOut } = dates
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0

  // Re-quote whenever the stay changes. ⚠️ This asks the SERVER for the price rather than
  // multiplying in the browser. The two would usually agree — until a rounding rule or the
  // service-fee rate changes, and then the panel promises a number the booking will not honour.
  useEffect(() => {
    if (!id || !checkIn || !checkOut) {
      setQuote(null)
      return
    }
    let cancelled = false
    setQuoteError(null)

    bookingApi
      .quote(id, checkIn, checkOut, guests)
      .then((result) => {
        if (!cancelled) setQuote(result)
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setQuote(null)
          setQuoteError(err.message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [id, checkIn, checkOut, guests])

  const handleDates = useCallback((nextIn: string | null, nextOut: string | null) => {
    setDates({ checkIn: nextIn, checkOut: nextOut })
  }, [])

  const amenities = useMemo(
    () =>
      (listing?.propertyAmenities ?? []).map((row) => row.amenity),
    [listing],
  )

  async function reserve() {
    if (!checkIn || !checkOut) return
    if (!user) {
      navigate('/login', { state: { from: `/listings/${id}` } })
      return
    }

    setBooking(true)
    try {
      const created = await bookingApi.create(id, checkIn, checkOut, guests)
      navigate(`/checkout/${created.publicId}`)
    } catch (err) {
      // A 409 is the interesting one: someone else took these dates between the page loading and
      // this click. Refresh availability so the calendar immediately shows why.
      const message = err instanceof ApiError ? err.message : 'Could not create that booking.'
      toast(message, 'error')
      if (err instanceof ApiError && err.status === 409) {
        bookingApi.availability(id).then(setAvailability).catch(() => {})
        setDates({ checkIn: null, checkOut: null })
      }
    } finally {
      setBooking(false)
    }
  }

  if (loading && !listing) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="skeleton h-8 w-2/3 rounded" />
        <div className="skeleton mt-6 aspect-[2/1] w-full rounded-card" />
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-ink-900">This listing is not available</h1>
        <p className="mt-2 text-sm text-ink-600">
          It may have been unpublished, or the link may be wrong.
        </p>
        <Button className="mt-6" onClick={() => navigate('/')}>
          Back to stays
        </Button>
      </div>
    )
  }

  const images = listing.images ?? []
  // Cover + up to four more. Anything past five has nowhere to go in the mosaic.
  const gallery = images.slice(0, 5)
  const location = [listing.city, listing.state, listing.country].filter(Boolean).join(', ')

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{listing.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-700">
        {listing.ratingCount > 0 && (
          <>
            <StarIcon className="h-4 w-4" />
            <span className="font-semibold">{rating(listing.ratingAverage)}</span>
            <span className="text-ink-500">· {listing.ratingCount} reviews ·</span>
          </>
        )}
        <span className="underline">{location}</span>
      </div>

      {/* A 1-large + N-small mosaic on desktop, one photo on mobile — the Airbnb gallery idiom.
          ⚠️ The column count follows the number of PHOTOS. A fixed 4-column grid looks right only
          with exactly five; with three it leaves a visible hole in the bottom-right, because the
          cover spans 2×2 and there are four cells left for two images. */}
      <div
        className={[
          'mt-5 grid gap-2 overflow-hidden rounded-card sm:grid-rows-2',
          gallery.length >= 5 ? 'sm:grid-cols-4' : gallery.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        ].join(' ')}
      >
        {gallery.map((image, index) => (
          <img
            key={image.url}
            src={image.url}
            alt={image.altText ?? listing.title}
            // The cover is the largest thing on the page and the first thing anyone looks at, so
            // it loads eagerly; the rest can wait until they are scrolled toward.
            loading={index === 0 ? 'eager' : 'lazy'}
            className={[
              'h-full w-full bg-ink-100 object-cover',
              index === 0
                ? 'aspect-[4/3] sm:col-span-2 sm:row-span-2 sm:aspect-auto'
                : 'hidden aspect-[4/3] sm:block',
            ].join(' ')}
          />
        ))}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="border-b border-ink-200 pb-6">
            <h2 className="text-xl font-semibold text-ink-900">
              {ROOM_LABEL[listing.roomType] ?? listing.roomType} hosted by {listing.host?.firstName}
            </h2>
            <p className="mt-1 text-sm text-ink-600">
              {listing.maxGuests} guests · {listing.bedrooms} bedrooms · {listing.beds} beds ·{' '}
              {listing.bathrooms} baths
            </p>
          </div>

          <div className="grid gap-4 border-b border-ink-200 py-6 sm:grid-cols-3">
            <Fact icon={<UsersIcon className="h-5 w-5" />} label={`Sleeps ${listing.maxGuests}`} />
            <Fact icon={<BedIcon className="h-5 w-5" />} label={`${listing.beds} beds`} />
            <Fact icon={<BathIcon className="h-5 w-5" />} label={`${listing.bathrooms} bathrooms`} />
          </div>

          <div className="border-b border-ink-200 py-6">
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-800">
              {listing.description}
            </p>
          </div>

          {amenities.length > 0 && (
            <div className="border-b border-ink-200 py-6">
              <h3 className="text-lg font-semibold text-ink-900">What this place offers</h3>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {amenities.map((a) => (
                  <li key={a.slug} className="flex items-center gap-3 text-sm text-ink-800">
                    <CheckIcon className="h-4 w-4 text-ink-500" />
                    {a.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {listing.host?.hostBio && (
            <div className="py-6">
              <h3 className="text-lg font-semibold text-ink-900">
                About {listing.host.firstName}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{listing.host.hostBio}</p>
            </div>
          )}
        </div>

        {/* `sticky` keeps the booking panel in view while the description scrolls. `top-24`
            clears the sticky navbar; without the offset it hides underneath it. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-ink-200 p-5 shadow-lg">
            <p className="text-lg text-ink-900">
              <span className="font-bold">{money(listing.pricePerNight)}</span>
              <span className="text-ink-600"> night</span>
            </p>

            <div className="mt-4 rounded-lg border border-ink-200 p-3">
              <DateRangePicker
                checkIn={checkIn}
                checkOut={checkOut}
                onChange={handleDates}
                unavailable={availability?.unavailableRanges ?? []}
              />
            </div>

            <label className="mt-4 flex items-center justify-between rounded-lg border border-ink-200 px-3 py-2.5">
              <span className="text-sm text-ink-700">Guests</span>
              <input
                type="number"
                min={1}
                max={listing.maxGuests}
                value={guests}
                onChange={(e) =>
                  setGuests(Math.min(listing.maxGuests, Math.max(1, Number(e.target.value) || 1)))
                }
                aria-label="Number of guests"
                className="w-14 text-right text-sm font-medium text-ink-900 outline-none"
              />
            </label>

            <Button
              className="mt-4 w-full"
              size="lg"
              loading={booking}
              disabled={!quote || !!quoteError}
              onClick={reserve}
            >
              {user ? 'Reserve' : 'Sign in to reserve'}
            </Button>

            {quoteError && <p className="mt-3 text-sm text-red-600">{quoteError}</p>}

            {quote && !quoteError && (
              <>
                <p className="mt-4 text-center text-xs text-ink-500">You won’t be charged yet</p>
                <dl className="mt-4 space-y-2.5 border-t border-ink-200 pt-4 text-sm">
                  <Row
                    label={`${money(quote.nightlyRate)} × ${quote.nights} ${quote.nights === 1 ? 'night' : 'nights'}`}
                    value={moneyExact(quote.subtotal)}
                  />
                  <Row label="Cleaning fee" value={moneyExact(quote.cleaningFee)} />
                  <Row label="StayHub service fee" value={moneyExact(quote.serviceFee)} />
                  <div className="flex justify-between border-t border-ink-200 pt-3 text-base font-bold text-ink-900">
                    <dt>Total</dt>
                    <dd>{moneyExact(quote.total)}</dd>
                  </div>
                </dl>
                {checkIn && checkOut && (
                  <p className="mt-3 text-center text-xs text-ink-500">
                    {formatRange(checkIn, checkOut)} · {nights} {nights === 1 ? 'night' : 'nights'}
                  </p>
                )}
              </>
            )}

            <p className="mt-4 flex items-start gap-2 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
              <ShieldIcon className="h-4 w-4 shrink-0 text-ink-500" />
              Free cancellation until 2 days before check-in.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

const ROOM_LABEL: Record<string, string> = {
  ENTIRE_PLACE: 'Entire place',
  PRIVATE_ROOM: 'Private room',
  SHARED_ROOM: 'Shared room',
}

function Fact({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-ink-800">
      <span className="text-ink-500">{icon}</span>
      {label}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-700">
      <dt className="underline decoration-ink-300">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
