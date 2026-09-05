import { Link } from 'react-router-dom'

import { mediaUrl } from '../lib/config'
import { money } from '../lib/format'
import type { ContractorProfile } from '../types/domain'
import { Avatar, Badge, Card, StarRating } from './ui'

/**
 * One pro, as they appear in a list.
 *
 * Used by the home page and the directory. The rule for a card like this is that everything on it
 * is something you would use to decide whether to click: trades, rating, rate, location. The bio
 * is clamped to two lines rather than omitted, because the first sentence of a bio is usually the
 * one thing that distinguishes two 4.8-star plumbers.
 */
export function ContractorCard({ contractor }: { contractor: ContractorProfile }) {
  const displayName = `${contractor.user.firstName} ${contractor.user.lastName}`
  const cover = contractor.portfolio[0]

  return (
    <Card className="group overflow-hidden transition hover:shadow-md">
      <Link to={`/contractors/${contractor.id}`} className="block">
        {cover ? (
          <img
            src={mediaUrl(cover.url)}
            alt=""
            // `aspect-[3/2]` plus `object-cover` keeps every card the same height whatever the
            // uploaded image's dimensions are. Without it one portrait photo staggers the grid.
            className="aspect-[3/2] w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-[3/2] w-full items-center justify-center bg-slate-100 text-4xl">
            <span aria-hidden="true">{contractor.categories[0]?.icon ?? '🔧'}</span>
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start gap-3">
            <Avatar src={contractor.user.avatarUrl} name={displayName} className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1">
              {/* `truncate` needs a width constraint to do anything, which is what `min-w-0` on the
                  flex child provides — flex items default to `min-width: auto` and refuse to
                  shrink below their content, so a long business name would blow out the card. */}
              <h3 className="truncate font-semibold text-slate-900 group-hover:text-brand-700">
                {contractor.businessName}
              </h3>
              <p className="truncate text-sm text-slate-500">
                {contractor.city}, {contractor.state}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            {contractor.reviewCount > 0 ? (
              <StarRating rating={contractor.ratingAverage} reviewCount={contractor.reviewCount} size="sm" />
            ) : (
              <span className="text-xs font-medium text-slate-500">New to Contractor</span>
            )}
            <span className="text-sm font-semibold text-slate-800">
              {money(contractor.hourlyRateMin)}
              <span className="font-normal text-slate-500">/hr</span>
            </span>
          </div>

          <p className="mt-3 line-clamp-2 text-sm text-slate-600">{contractor.bio}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {contractor.categories.map((category) => (
              <Badge key={category.id} className="bg-brand-50 text-brand-800">
                <span className="mr-1" aria-hidden="true">
                  {category.icon}
                </span>
                {category.name}
              </Badge>
            ))}
          </div>
        </div>
      </Link>
    </Card>
  )
}
