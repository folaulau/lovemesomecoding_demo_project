import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import * as api from '../api/client'
import { ContractorCard } from '../components/ContractorCard'
import { Button, Card, ErrorNote, Skeleton, TextInput } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'

const STEPS = [
  {
    icon: '📝',
    title: 'Describe the job',
    body: 'Tell us what needs doing, roughly what you want to spend, and when you would like it started.',
  },
  {
    icon: '💬',
    title: 'Compare quotes',
    body: 'Local pros who work in that trade send you a price and a timeline. No calls until you want one.',
  },
  {
    icon: '🤝',
    title: 'Hire the one you want',
    body: 'Accept a quote and the rest are declined automatically. Rate the work when it is finished.',
  },
]

export function HomePage() {
  const navigate = useNavigate()
  const { user, isContractor } = useAuth()
  const [query, setQuery] = useState('')

  const categories = useAsync(() => api.listCategories(), [])
  const featured = useAsync(() => api.listContractors(), [])

  function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    // The directory owns the search; the home page only decides what to hand it. Keeping the
    // filter state in the URL is what makes a result list shareable and survivable across a
    // refresh, which two-thirds of hand-rolled search UIs get wrong.
    navigate(query.trim() ? `/contractors?q=${encodeURIComponent(query.trim())}` : '/contractors')
  }

  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-800 to-brand-900">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Find a pro for anything your home needs
            </h1>
            <p className="mt-4 text-lg text-brand-100">
              Post the job once. Get real quotes from licensed local contractors. Hire whoever you
              like best — or nobody at all.
            </p>

            <form onSubmit={handleSearch} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <label htmlFor="home-search" className="sr-only">
                What do you need done?
              </label>
              <TextInput
                id="home-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Leaking water heater, roof inspection, repaint a room…"
                className="h-12 flex-1 text-base"
              />
              <Button type="submit" size="lg" className="bg-accent-500 text-slate-900 hover:bg-accent-400">
                Search pros
              </Button>
            </form>

            {!user && (
              <p className="mt-4 text-sm text-brand-200">
                Are you a contractor?{' '}
                <Link to="/signup" className="font-semibold text-white underline underline-offset-4">
                  List your business
                </Link>
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-bold text-slate-900">Browse by trade</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.loading &&
            // A fixed-length placeholder array is the standard way to render N skeletons. The key
            // is the index because these rows have no identity — they are literally interchangeable.
            Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}

          {categories.data?.map((category) => (
            <Link
              key={category.id}
              to={`/contractors?category=${category.slug}`}
              className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-400 hover:shadow-sm"
            >
              <span className="text-2xl" aria-hidden="true">
                {category.icon}
              </span>
              <p className="mt-2 font-semibold text-slate-900 group-hover:text-brand-700">
                {category.name}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-xl font-bold text-slate-900">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg"
                  aria-hidden="true"
                >
                  {step.icon}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900">Top-rated pros near you</h2>
          <Link to="/contractors" className="text-sm font-semibold text-brand-700 hover:underline">
            See all
          </Link>
        </div>

        {/* A failed read used to render as an empty section with no explanation — the loading
            flag was false and the data was null, so nothing matched either branch. An error state
            is the third case every fetch has, and leaving it out hides exactly the failures worth
            seeing. */}
        {featured.error && (
          <div className="mt-5">
            <ErrorNote>{featured.error}</ErrorNote>
          </div>
        )}

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.loading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-80" />)}
          {featured.data?.slice(0, 6).map((contractor) => (
            <ContractorCard key={contractor.id} contractor={contractor} />
          ))}
        </div>
      </section>

      {!isContractor && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <Card tone="dark" className="flex flex-col items-start justify-between gap-4 p-8 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold text-white">Know what you need doing?</h2>
              <p className="mt-1 text-sm text-slate-300">
                Post it in a couple of minutes and let the quotes come to you.
              </p>
            </div>
            <Button
              size="lg"
              className="bg-accent-500 text-slate-900 hover:bg-accent-400"
              onClick={() => navigate(user ? '/projects/new' : '/signup')}
            >
              Post a project
            </Button>
          </Card>
        </section>
      )}
    </>
  )
}
