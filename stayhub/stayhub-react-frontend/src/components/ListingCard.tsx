import { memo } from 'react'
import { Link } from 'react-router-dom'
import { money, rating } from '../lib/money'
import { StarIcon } from './Icons'

export interface ListingCardData {
  publicId: string
  title: string
  city: string
  state?: string | null
  country: string
  roomType: string
  pricePerNight: string | number
  ratingAverage: string | number
  ratingCount: number
  bedrooms: number
  beds: number
  coverUrl: string | null
  status?: string
}

const ROOM_LABEL: Record<string, string> = {
  ENTIRE_PLACE: 'Entire place',
  PRIVATE_ROOM: 'Private room',
  SHARED_ROOM: 'Shared room',
}

/** `memo` earns its place here: a search page renders 20+ of these, and the filter panel above
 *  re-renders on every keystroke. Without it, typing in the price box re-renders every card. */
export const ListingCard = memo(function ListingCard({ listing }: { listing: ListingCardData }) {
  const location = [listing.city, listing.state ?? listing.country].filter(Boolean).join(', ')

  return (
    <Link
      to={`/listings/${listing.publicId}`}
      className="group flex flex-col gap-2.5 rounded-card focus-visible:outline-2"
    >
      <div className="relative aspect-[20/19] overflow-hidden rounded-card bg-ink-100">
        {listing.coverUrl ? (
          <img
            src={listing.coverUrl}
            alt={listing.title}
            // `lazy` so a page of 20 cards does not fetch 20 large photos up front, and async
            // decoding so a slow decode cannot block scrolling.
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-400">
            No photo yet
          </div>
        )}
        {listing.status && listing.status !== 'PUBLISHED' && (
          <span className="absolute left-3 top-3 rounded-full bg-ink-900/85 px-2.5 py-1 text-xs font-semibold text-white">
            {listing.status === 'DRAFT' ? 'Draft' : 'Suspended'}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-2">
        {/* `line-clamp-1` keeps a long title from pushing the price out of the row and breaking
            the grid alignment across cards. */}
        <h3 className="line-clamp-1 text-[15px] font-semibold text-ink-900">{listing.title}</h3>
        {listing.ratingCount > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-sm text-ink-800">
            <StarIcon className="h-3.5 w-3.5" />
            {rating(listing.ratingAverage)}
          </span>
        )}
      </div>

      <p className="-mt-1.5 text-sm text-ink-500">{location}</p>
      <p className="-mt-1.5 text-sm text-ink-500">
        {ROOM_LABEL[listing.roomType] ?? listing.roomType} · {listing.beds}{' '}
        {listing.beds === 1 ? 'bed' : 'beds'}
      </p>

      <p className="text-[15px] text-ink-900">
        <span className="font-semibold">{money(listing.pricePerNight)}</span>
        <span className="text-ink-600"> night</span>
      </p>
    </Link>
  )
})

export function ListingCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="skeleton aspect-[20/19] rounded-card" />
      <div className="skeleton h-4 w-3/4 rounded" />
      <div className="skeleton h-3.5 w-1/2 rounded" />
      <div className="skeleton h-3.5 w-1/3 rounded" />
    </div>
  )
}
