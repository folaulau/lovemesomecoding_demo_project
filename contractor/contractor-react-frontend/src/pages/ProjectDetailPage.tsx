import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import * as api from '../api/client'
import { ProjectStatusBadge, QuoteStatusBadge } from '../components/badges'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Skeleton,
  StarPicker,
  StarRating,
  TextArea,
} from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDate, formatRelative, money, moneyRange, pluralise } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import type { Quote } from '../types/domain'
import { ProjectStatus, QuoteStatus } from '../types/domain'
import { NotFoundPage } from './NotFoundPage'

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const { user } = useAuth()

  const project = useAsync(() => api.getProject(projectId), [projectId])

  // Mutation state is separate from load state: accepting a quote must disable that one button
  // without blanking the page the user is reading.
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (project.loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  // A project belonging to someone else comes back as null, not as a 403 — see the note in
  // `client.ts`. So "not mine" and "does not exist" land on the same page, which is the point.
  if (!project.data) return <NotFoundPage />

  const p = project.data
  const acceptedQuote = p.quotes.find((q) => q.status === QuoteStatus.ACCEPTED)
  const stillOpen = p.status === ProjectStatus.OPEN || p.status === ProjectStatus.QUOTED
  const pendingQuotes = p.quotes.filter((q) => q.status === QuoteStatus.PENDING)

  async function handleAccept(quoteId: string) {
    setAcceptingId(quoteId)
    setActionError(null)
    try {
      await api.acceptQuote(user?.id ?? '', projectId, quoteId)
      // Refetch rather than patching local state. Accepting one quote declines all the others
      // server-side, so the response the UI needs is the whole project — reconstructing that
      // cascade in the client is how the two copies drift apart.
      project.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not accept that quote.')
    } finally {
      setAcceptingId(null)
    }
  }

  async function handleCancel() {
    setActionError(null)
    try {
      await api.advanceProjectStatus(user?.id ?? '', projectId, ProjectStatus.CANCELLED)
      project.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not cancel this project.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/projects" className="text-sm font-semibold text-brand-700 hover:underline">
        ← All projects
      </Link>

      <Card className="mt-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span aria-hidden="true">{p.category.icon}</span>
              {p.category.name}
              <span aria-hidden="true">·</span>
              <span>posted {formatRelative(p.createdAt)}</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{p.title}</h1>
          </div>
          <ProjectStatusBadge status={p.status} />
        </div>

        <p className="mt-4 whitespace-pre-line text-slate-700">{p.description}</p>

        <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Budget</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {moneyRange(p.budgetMin, p.budgetMax)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Preferred start</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {formatDate(p.preferredStartDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Location</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {p.city}, {p.state} {p.zip}
            </dd>
          </div>
        </dl>

        {stillOpen && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-700 hover:bg-rose-50">
              Cancel this project
            </Button>
          </div>
        )}
      </Card>

      {actionError && (
        <div className="mt-4">
          <ErrorNote>{actionError}</ErrorNote>
        </div>
      )}

      {acceptedQuote && <HiredPanel quote={acceptedQuote} status={p.status} />}

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">
          Quotes {p.quotes.length > 0 && <span className="text-slate-500">({p.quotes.length})</span>}
        </h2>

        {stillOpen && pendingQuotes.length > 0 && (
          <p className="mt-1 text-sm text-slate-600">
            Accepting one quote declines the others automatically.
          </p>
        )}

        <div className="mt-4 space-y-4">
          {p.quotes.length === 0 && (
            <EmptyState icon="⏳" title="No quotes yet">
              Pros in {p.category.name.toLowerCase()} can see this project now. Most jobs get their
              first quote within a day.
            </EmptyState>
          )}

          {/* Pending first while the project is still open — the decisions the homeowner has to
              make belong above the ones already settled. */}
          {[...p.quotes]
            .sort((a, b) => rankQuote(a) - rankQuote(b))
            .map((quote) => (
              <QuoteRow
                key={quote.id}
                quote={quote}
                canAccept={stillOpen && quote.status === QuoteStatus.PENDING}
                accepting={acceptingId === quote.id}
                disabled={acceptingId !== null}
                onAccept={() => handleAccept(quote.id)}
              />
            ))}
        </div>
      </section>

      {p.status === ProjectStatus.COMPLETED && (
        <ReviewSection project={p} onReviewed={project.reload} />
      )}
    </div>
  )
}

/** Accepted, then pending, then everything settled. */
function rankQuote(quote: Quote): number {
  if (quote.status === QuoteStatus.ACCEPTED) return 0
  if (quote.status === QuoteStatus.PENDING) return 1
  return 2
}

function HiredPanel({ quote, status }: { quote: Quote; status: ProjectStatus }) {
  const pro = quote.contractor
  return (
    <Card tone="brand" className="mt-6 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">
        {status === ProjectStatus.COMPLETED ? 'Completed by' : 'You hired'}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar src={pro.user.avatarUrl} name={pro.businessName} className="h-11 w-11" />
          <div>
            <Link
              to={`/contractors/${pro.id}`}
              className="font-semibold text-slate-900 hover:text-brand-700"
            >
              {pro.businessName}
            </Link>
            <p className="text-sm text-slate-600">
              {money(quote.amount)} · {pluralise(quote.estimatedDays, 'day')}
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          {status === ProjectStatus.HIRED && 'Waiting for the pro to start.'}
          {status === ProjectStatus.IN_PROGRESS && 'Work is under way.'}
        </p>
      </div>
    </Card>
  )
}

function QuoteRow({
  quote,
  canAccept,
  accepting,
  disabled,
  onAccept,
}: {
  quote: Quote
  canAccept: boolean
  accepting: boolean
  disabled: boolean
  onAccept: () => void
}) {
  const pro = quote.contractor

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar src={pro.user.avatarUrl} name={pro.businessName} className="h-11 w-11 shrink-0" />
          <div className="min-w-0">
            <Link
              to={`/contractors/${pro.id}`}
              className="font-semibold text-slate-900 hover:text-brand-700"
            >
              {pro.businessName}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {pro.reviewCount > 0 ? (
                <StarRating rating={pro.ratingAverage} reviewCount={pro.reviewCount} size="sm" />
              ) : (
                <span className="text-xs text-slate-500">New to Contractor</span>
              )}
              <span className="text-xs text-slate-500">
                {pluralise(pro.yearsInBusiness, 'year')} in business
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xl font-bold text-slate-900">{money(quote.amount)}</p>
          <p className="text-sm text-slate-600">{pluralise(quote.estimatedDays, 'day')} of work</p>
        </div>
      </div>

      {quote.message && <p className="mt-4 whitespace-pre-line text-slate-700">{quote.message}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-3">
          <QuoteStatusBadge status={quote.status} />
          <span className="text-xs text-slate-500">quoted {formatRelative(quote.createdAt)}</span>
        </div>

        {canAccept && (
          <Button
            onClick={onAccept}
            loading={accepting}
            // Every accept button is disabled while any one of them is in flight. Without this,
            // an impatient double-click on two different quotes fires two accepts and the second
            // one comes back 409 — a confusing error for something the UI should have prevented.
            disabled={disabled && !accepting}
          >
            Accept this quote
          </Button>
        )}
      </div>
    </Card>
  )
}

/** Rule 6: the review, available only once the work is marked complete, and only once. */
function ReviewSection({
  project,
  onReviewed,
}: {
  project: NonNullable<Awaited<ReturnType<typeof api.getProject>>>
  onReviewed: () => void
}) {
  const { user } = useAuth()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (project.review) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Your review</h2>
        <Card className="mt-4 p-5">
          <StarRating rating={project.review.rating} />
          <p className="mt-3 text-slate-700">{project.review.comment}</p>
          <p className="mt-3 text-xs text-slate-500">
            Left {formatRelative(project.review.createdAt)}
          </p>
        </Card>
      </section>
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.createReview(user?.id ?? '', { projectId: project.id, rating, comment })
      onReviewed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your review.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">How did it go?</h2>
      <p className="mt-1 text-sm text-slate-600">
        Your rating is what the next homeowner sees. It cannot be edited once submitted.
      </p>

      <Card className="mt-4 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorNote>{error}</ErrorNote>}

          <StarPicker value={rating} onChange={setRating} />

          <Field label="What should other homeowners know?" htmlFor="comment">
            <TextArea
              id="comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Turned up when they said they would, cleaned up afterwards…"
            />
          </Field>

          <Button type="submit" loading={busy}>
            Submit review
          </Button>
        </form>
      </Card>
    </section>
  )
}
