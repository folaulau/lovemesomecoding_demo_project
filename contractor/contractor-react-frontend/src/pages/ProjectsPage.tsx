import { Link } from 'react-router-dom'

import * as api from '../api/client'
import { ProjectStatusBadge } from '../components/badges'
import { Button, Card, EmptyState, ErrorNote, Skeleton } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDate, formatRelative, moneyRange, pluralise } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { QuoteStatus } from '../types/domain'

/** The homeowner's dashboard: every project they have posted, and what needs their attention. */
export function ProjectsPage() {
  const { user } = useAuth()
  // The guard in App.tsx guarantees a user here, but TypeScript does not know that. `?? ''` keeps
  // the hook unconditional — bailing out early with a `return` before `useAsync` would break the
  // rules of hooks the moment the user signs out while this page is mounted.
  const projects = useAsync(() => api.listMyProjects(user?.id ?? ''), [user?.id])

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My projects</h1>
          <p className="mt-1 text-sm text-slate-600">
            Everything you have posted, and the quotes waiting on you.
          </p>
        </div>
        <Link to="/projects/new">
          <Button size="lg">Post a project</Button>
        </Link>
      </div>

      <div className="mt-8 space-y-4">
        {projects.error && <ErrorNote>{projects.error}</ErrorNote>}
        {projects.loading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36" />)}

        {projects.data?.length === 0 && (
          <EmptyState
            icon="🏡"
            title="No projects yet"
            action={
              <Link to="/projects/new">
                <Button size="lg">Post your first project</Button>
              </Link>
            }
          >
            Describe what needs doing and local pros will send you quotes. It takes about two
            minutes and costs nothing.
          </EmptyState>
        )}

        {projects.data?.map((project) => {
          const pending = project.quotes.filter((q) => q.status === QuoteStatus.PENDING).length

          return (
            <Card key={project.id} className="transition hover:shadow-md">
              <Link to={`/projects/${project.id}`} className="block p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span aria-hidden="true">{project.category.icon}</span>
                      {project.category.name}
                      <span aria-hidden="true">·</span>
                      <span>posted {formatRelative(project.createdAt)}</span>
                    </div>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{project.title}</h2>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </div>

                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{project.description}</p>

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="text-slate-600">
                    Budget{' '}
                    <span className="font-semibold text-slate-900">
                      {moneyRange(project.budgetMin, project.budgetMax)}
                    </span>
                  </span>
                  <span className="text-slate-600">
                    Start{' '}
                    <span className="font-semibold text-slate-900">
                      {formatDate(project.preferredStartDate)}
                    </span>
                  </span>

                  {/* The one number on this card worth colouring. "3 quotes waiting" is the reason
                      a homeowner opens this page at all, so it gets the accent treatment and
                      everything else stays grey. */}
                  {pending > 0 ? (
                    <span className="rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
                      {pluralise(pending, 'quote')} waiting
                    </span>
                  ) : (
                    <span className="text-slate-500">{pluralise(project.quotes.length, 'quote')}</span>
                  )}
                </div>
              </Link>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
