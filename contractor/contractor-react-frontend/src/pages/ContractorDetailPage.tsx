import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import * as api from '../api/client'
import { Avatar, Badge, Button, Card, EmptyState, Skeleton, StarRating } from '../components/ui'
import { useAuth } from '../lib/auth'
import { mediaUrl } from '../lib/config'
import { formatRelative, money, pluralise } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { NotFoundPage } from './NotFoundPage'

export function ContractorDetailPage() {
  const { contractorId = '' } = useParams()
  const { user, isContractor } = useAuth()
  const [lightbox, setLightbox] = useState<number | null>(null)

  const profile = useAsync(() => api.getContractor(contractorId), [contractorId])
  const reviews = useAsync(() => api.listContractorReviews(contractorId), [contractorId])

  if (profile.loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  // `loading === false && data === null` is a genuine 404, and it has to be checked in that order.
  // Rendering "not found" while the request is still in flight is the classic version of this bug.
  if (!profile.data) return <NotFoundPage />

  const pro = profile.data
  const displayName = `${pro.user.firstName} ${pro.user.lastName}`

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Card className="overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-brand-800 to-brand-600" />
        <div className="px-6 pb-6">
          {/* Pulling the avatar up over the banner is a `-mt` on the row, not absolute positioning
              — it keeps the element in flow so the text below it still spaces itself correctly. */}
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar
                src={pro.user.avatarUrl}
                name={displayName}
                className="h-20 w-20 ring-4 ring-white"
              />
              <div className="pb-1">
                <h1 className="text-2xl font-bold text-slate-900">{pro.businessName}</h1>
                <p className="text-sm text-slate-600">
                  {displayName} · {pro.city}, {pro.state}
                </p>
              </div>
            </div>

            {/* A pro looking at another pro has nothing to do here, so they are not offered a
                button that would fail. Homeowners get the call to action. */}
            {/* A <Link> styled as a button rather than a <Button> wrapping a <Link>. Nesting an
                anchor inside a button is invalid HTML and browsers disagree about what it does —
                this way the element that navigates is the element that looks clickable. */}
            {!isContractor && (
              <Link
                to={user ? '/projects/new' : '/signup'}
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg bg-brand-700 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-brand-800"
              >
                Request a quote
              </Link>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-slate-100 py-4">
            <div>
              {pro.reviewCount > 0 ? (
                <StarRating rating={pro.ratingAverage} reviewCount={pro.reviewCount} />
              ) : (
                <span className="text-sm font-medium text-slate-500">No reviews yet</span>
              )}
            </div>
            <Stat label="Rate" value={`${money(pro.hourlyRateMin)}–${money(pro.hourlyRateMax)}/hr`} />
            <Stat label="Experience" value={pluralise(pro.yearsInBusiness, 'year')} />
            <Stat label="Travels" value={`${pro.serviceRadiusMiles} miles`} />
            {pro.licenseNumber && <Stat label="Licence" value={pro.licenseNumber} />}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {pro.categories.map((category) => (
              <Badge key={category.id} className="bg-brand-50 text-brand-800">
                <span className="mr-1" aria-hidden="true">
                  {category.icon}
                </span>
                {category.name}
              </Badge>
            ))}
          </div>

          {pro.bio && <p className="mt-5 whitespace-pre-line text-slate-700">{pro.bio}</p>}
        </div>
      </Card>

      {pro.portfolio.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-slate-900">Recent work</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {pro.portfolio.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setLightbox(index)}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left"
              >
                <img
                  src={mediaUrl(image.url)}
                  alt={image.caption ?? `Work by ${pro.businessName}`}
                  className="aspect-[3/2] w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                />
                {image.caption && (
                  <p className="px-3 py-2 text-sm text-slate-700">{image.caption}</p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">
          Reviews {pro.reviewCount > 0 && <span className="text-slate-500">({pro.reviewCount})</span>}
        </h2>

        <div className="mt-4 space-y-4">
          {reviews.loading && <Skeleton className="h-28" />}

          {reviews.data?.length === 0 && (
            <EmptyState icon="⭐" title="No reviews yet">
              Reviews appear here once a homeowner rates a completed job.
            </EmptyState>
          )}

          {reviews.data?.map((review) => (
            <Card key={review.id} className="p-5">
              <div className="flex items-start gap-3">
                <Avatar
                  src={review.homeowner.avatarUrl}
                  name={review.homeowner.firstName}
                  className="h-9 w-9"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold text-slate-900">
                      {review.homeowner.firstName} {review.homeowner.lastName[0]}.
                    </span>
                    <StarRating rating={review.rating} size="sm" />
                    <span className="text-xs text-slate-500">{formatRelative(review.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">{review.projectTitle}</p>
                  <p className="mt-2 text-slate-700">{review.comment}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {lightbox !== null && pro.portfolio[lightbox] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={pro.portfolio[lightbox].caption ?? 'Portfolio image'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          // Escape closes it. A modal that can only be dismissed with the mouse is a trap for
          // anyone navigating by keyboard.
          onKeyDown={(e) => e.key === 'Escape' && setLightbox(null)}
          tabIndex={-1}
          ref={(node) => node?.focus()}
        >
          <figure className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={mediaUrl(pro.portfolio[lightbox].url)}
              alt={pro.portfolio[lightbox].caption ?? ''}
              className="max-h-[75vh] w-full rounded-xl object-contain"
            />
            <figcaption className="mt-3 flex items-center justify-between gap-4 text-sm text-white">
              <span>{pro.portfolio[lightbox].caption}</span>
              <Button variant="secondary" size="sm" onClick={() => setLightbox(null)}>
                Close
              </Button>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}
