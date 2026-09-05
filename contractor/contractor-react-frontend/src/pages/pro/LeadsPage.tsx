import { Link } from 'react-router-dom'

import * as api from '../../api/client'
import { ProjectStatusBadge } from '../../components/badges'
import { Badge, Button, Card, EmptyState, ErrorNote, Skeleton } from '../../components/ui'
import { formatDate, formatRelative, moneyRange, pluralise } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { useMyProfile } from '../../lib/useMyProfile'
import { QuoteStatus } from '../../types/domain'

/**
 * The contractor's lead feed.
 *
 * ⚠️ The list is filtered by the pro's own trades on the SERVER, not here. In phase 4 that filter
 * is a Hasura row-level permission, so a plumber cannot read a roofing job even by writing the
 * GraphQL query by hand. Filtering in the component would mean every open project in the database
 * was already on the wire before being hidden — which is not a filter, it is a curtain.
 */
export function LeadsPage() {
  const profile = useMyProfile()
  const proId = profile.data?.id

  const leads = useAsync(
    () => (proId ? api.listLeadsForContractor(proId) : Promise.resolve([])),
    [proId],
  )
  const myQuotes = useAsync(() => (proId ? api.listMyQuotes(proId) : Promise.resolve([])), [proId])

  // Which leads this pro has already quoted on. A Set because this is checked once per rendered
  // row, and `array.some()` inside a map turns a 40-row list into 1,600 comparisons for no reason.
  const quotedProjectIds = new Set(
    myQuotes.data
      ?.filter((row) => row.quote.status !== QuoteStatus.WITHDRAWN)
      .map((row) => row.project.id),
  )

  const loading = profile.loading || leads.loading

  // A profile with no trades selected can never match a lead, so the empty feed would be a mystery.
  // Naming the cause and linking to the fix is the difference between an empty state and a dead end.
  if (!profile.loading && profile.data && profile.data.categories.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Find work</h1>
        <div className="mt-6">
          <EmptyState
            icon="🧰"
            title="Pick your trades first"
            action={
              <Link to="/pro/profile">
                <Button size="lg">Complete my profile</Button>
              </Link>
            }
          >
            You will only see projects in trades you have added to your profile. Add at least one
            and the matching jobs show up here.
          </EmptyState>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Find work</h1>
          <p className="mt-1 text-sm text-slate-600">
            Open projects in your trades, newest first.
          </p>
        </div>
        {profile.data && (
          <div className="flex flex-wrap gap-1.5">
            {profile.data.categories.map((category) => (
              <Badge key={category.id} className="bg-brand-50 text-brand-800">
                <span className="mr-1" aria-hidden="true">
                  {category.icon}
                </span>
                {category.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 space-y-4">
        {leads.error && <ErrorNote>{leads.error}</ErrorNote>}
        {loading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36" />)}

        {!loading && leads.data?.length === 0 && (
          <EmptyState icon="📭" title="No open projects right now">
            Nothing in your trades is looking for quotes at the moment. New projects appear here as
            soon as they are posted.
          </EmptyState>
        )}

        {leads.data?.map((project) => {
          const alreadyQuoted = quotedProjectIds.has(project.id)

          return (
            <Card key={project.id} className="transition hover:shadow-md">
              <Link to={`/pro/leads/${project.id}`} className="block p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span aria-hidden="true">{project.category.icon}</span>
                      {project.category.name}
                      <span aria-hidden="true">·</span>
                      <span>{formatRelative(project.createdAt)}</span>
                    </div>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{project.title}</h2>
                  </div>
                  {alreadyQuoted ? (
                    <Badge className="bg-brand-100 text-brand-800">You quoted</Badge>
                  ) : (
                    <ProjectStatusBadge status={project.status} />
                  )}
                </div>

                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{project.description}</p>

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
                  <span>
                    Budget{' '}
                    <span className="font-semibold text-slate-900">
                      {moneyRange(project.budgetMin, project.budgetMax)}
                    </span>
                  </span>
                  <span>
                    Start{' '}
                    <span className="font-semibold text-slate-900">
                      {formatDate(project.preferredStartDate)}
                    </span>
                  </span>
                  <span>
                    {project.city}, {project.state}
                  </span>
                  <span className="text-slate-500">
                    {pluralise(project.quotes.length, 'quote')} so far
                  </span>
                </div>
              </Link>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
