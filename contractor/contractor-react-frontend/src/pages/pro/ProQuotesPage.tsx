import { useState } from 'react'
import { Link } from 'react-router-dom'

import * as api from '../../api/client'
import { ProjectStatusBadge, QuoteStatusBadge } from '../../components/badges'
import { Button, Card, EmptyState, ErrorNote, Skeleton } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { formatRelative, money, pluralise } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { useMyProfile } from '../../lib/useMyProfile'
import { ProjectStatus, QuoteStatus } from '../../types/domain'

/**
 * Every quote this pro has sent, and the jobs they won.
 *
 * This is also where the contractor half of the project lifecycle lives: rule 5 says only the
 * hired pro may move a project `hired → in_progress → completed`, and this is the only screen that
 * offers those buttons.
 */
export function ProQuotesPage() {
  const { user } = useAuth()
  const profile = useMyProfile()
  const proId = profile.data?.id

  const rows = useAsync(() => (proId ? api.listMyQuotes(proId) : Promise.resolve([])), [proId])

  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function advance(projectId: string, next: ProjectStatus) {
    setBusyId(projectId)
    setError(null)
    try {
      await api.advanceProjectStatus(user?.id ?? '', projectId, next)
      rows.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that project.')
    } finally {
      setBusyId(null)
    }
  }

  const loading = profile.loading || rows.loading

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">My quotes</h1>
      <p className="mt-1 text-sm text-slate-600">
        What you have bid on, and where each one stands.
      </p>

      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {loading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36" />)}

        {!loading && rows.data?.length === 0 && (
          <EmptyState
            icon="✍️"
            title="You have not quoted on anything yet"
            action={
              <Link to="/pro/leads">
                <Button size="lg">Find work</Button>
              </Link>
            }
          >
            Open projects in your trades show up under Find work. Quoting is free.
          </EmptyState>
        )}

        {rows.data?.map(({ quote, project }) => {
          const won = quote.status === QuoteStatus.ACCEPTED

          return (
            <Card key={quote.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span aria-hidden="true">{project.category.icon}</span>
                    {project.category.name}
                    <span aria-hidden="true">·</span>
                    <span>quoted {formatRelative(quote.createdAt)}</span>
                  </div>
                  <Link
                    to={`/pro/leads/${project.id}`}
                    className="mt-1 block text-lg font-semibold text-slate-900 hover:text-brand-700"
                  >
                    {project.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {project.city}, {project.state}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-slate-900">{money(quote.amount)}</p>
                  <p className="text-sm text-slate-600">{pluralise(quote.estimatedDays, 'day')}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <QuoteStatusBadge status={quote.status} />
                  {won && <ProjectStatusBadge status={project.status} />}
                </div>

                {/* Only the pro who won the job gets these, and only in the state where the move
                    is legal. The backend checks both again — this is the convenience half. */}
                {won && project.status === ProjectStatus.HIRED && (
                  <Button
                    size="sm"
                    loading={busyId === project.id}
                    onClick={() => advance(project.id, ProjectStatus.IN_PROGRESS)}
                  >
                    Start work
                  </Button>
                )}
                {won && project.status === ProjectStatus.IN_PROGRESS && (
                  <Button
                    size="sm"
                    loading={busyId === project.id}
                    onClick={() => advance(project.id, ProjectStatus.COMPLETED)}
                  >
                    Mark complete
                  </Button>
                )}
                {won && project.status === ProjectStatus.COMPLETED && (
                  <span className="text-sm text-slate-500">
                    Finished — waiting on their review.
                  </span>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
