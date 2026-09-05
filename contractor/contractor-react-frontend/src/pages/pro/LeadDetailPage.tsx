import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import * as api from '../../api/client'
import { ProjectStatusBadge, QuoteStatusBadge } from '../../components/badges'
import { Button, Card, ErrorNote, Field, Skeleton, TextArea, TextInput } from '../../components/ui'
import { formatDate, formatRelative, money, moneyRange, pluralise } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { useMyProfile } from '../../lib/useMyProfile'
import { QUOTABLE_STATUSES } from '../../types/domain'
import { NotFoundPage } from '../NotFoundPage'

/** One lead, and the form to bid on it. */
export function LeadDetailPage() {
  const { projectId = '' } = useParams()
  const profile = useMyProfile()
  const project = useAsync(() => api.getProject(projectId), [projectId])

  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('1')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (project.loading || profile.loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!project.data) return <NotFoundPage />

  const p = project.data
  const pro = profile.data

  // ⚠️ Only the pro's OWN quote is visible. A contractor must never see what their competitors
  // bid — a marketplace where the last pro to quote can undercut the others by a dollar is one
  // nobody quotes on twice. In phase 4 this is enforced by a Hasura permission on `quotes`, not by
  // this line; the filter here only decides what to render out of what the API already returned.
  const myQuote = pro ? p.quotes.find((q) => q.contractor.id === pro.id) : undefined

  const worksInTrade = pro?.categories.some((c) => c.id === p.category.id) ?? false
  const acceptingQuotes = QUOTABLE_STATUSES.includes(p.status)
  const canQuote = Boolean(pro) && worksInTrade && acceptingQuotes && !myQuote

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsedAmount = Number(amount)
    const parsedDays = Number(days)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter the amount you would charge, in whole dollars.')
      return
    }
    if (!Number.isInteger(parsedDays) || parsedDays < 1) {
      setError('Estimate the job in whole days, at least one.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await api.submitQuote(pro?.id ?? '', {
        projectId,
        amount: parsedAmount,
        estimatedDays: parsedDays,
        message,
      })
      setSubmitted(true)
      project.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your quote.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/pro/leads" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to leads
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
            <p className="mt-1 text-sm text-slate-600">
              Posted by {p.homeowner.firstName} {p.homeowner.lastName[0]}. ·{' '}
              {/* Only the city and state. The street address is not the pro's business until the
                  homeowner has actually hired them. */}
              {p.city}, {p.state} {p.zip}
            </p>
          </div>
          <ProjectStatusBadge status={p.status} />
        </div>

        <p className="mt-4 whitespace-pre-line text-slate-700">{p.description}</p>

        <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Their budget</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {moneyRange(p.budgetMin, p.budgetMax)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Wants to start</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {formatDate(p.preferredStartDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Competition</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {pluralise(p.quotes.length, 'quote')} in
            </dd>
          </div>
        </dl>
      </Card>

      <section className="mt-8">
        {myQuote ? (
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">Your quote</h2>
              <QuoteStatusBadge status={myQuote.status} />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{money(myQuote.amount)}</p>
            <p className="text-sm text-slate-600">
              {pluralise(myQuote.estimatedDays, 'day')} · sent {formatRelative(myQuote.createdAt)}
            </p>
            {myQuote.message && (
              <p className="mt-4 whitespace-pre-line text-slate-700">{myQuote.message}</p>
            )}
            {submitted && (
              <p className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
                Quote sent. The homeowner will see it on their project straight away.
              </p>
            )}
          </Card>
        ) : (
          <Card className="p-6">
            <h2 className="text-lg font-bold text-slate-900">Send a quote</h2>

            {!worksInTrade && (
              <div className="mt-4">
                <ErrorNote>
                  You do not work in {p.category.name.toLowerCase()} yet.{' '}
                  <Link to="/pro/profile" className="font-semibold underline">
                    Add it to your profile
                  </Link>{' '}
                  to quote on jobs like this.
                </ErrorNote>
              </div>
            )}

            {worksInTrade && !acceptingQuotes && (
              <p className="mt-3 text-sm text-slate-600">
                This project is no longer accepting quotes.
              </p>
            )}

            {canQuote && (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
                {error && <ErrorNote>{error}</ErrorNote>}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Your price"
                    htmlFor="amount"
                    hint={`They budgeted ${moneyRange(p.budgetMin, p.budgetMax)}.`}
                    required
                  >
                    <TextInput
                      id="amount"
                      type="number"
                      min={1}
                      step={25}
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="2450"
                    />
                  </Field>
                  <Field label="Days of work" htmlFor="days" required>
                    <TextInput
                      id="days"
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                    />
                  </Field>
                </div>

                <Field
                  label="Message"
                  htmlFor="message"
                  hint="What the price covers, and anything you would need from them. This is the part that wins the job."
                >
                  <TextArea
                    id="message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Price covers a 50-gallon gas unit, new expansion tank, drain pan and permit…"
                  />
                </Field>

                <Button type="submit" size="lg" loading={busy}>
                  Send quote
                </Button>
              </form>
            )}
          </Card>
        )}
      </section>
    </div>
  )
}
