import { useSearchParams } from 'react-router-dom'

import * as api from '../api/client'
import { ContractorCard } from '../components/ContractorCard'
import { Button, EmptyState, ErrorNote, Select, Skeleton, TextInput } from '../components/ui'
import { cx, pluralise } from '../lib/format'
import { useAsync } from '../lib/useAsync'

const RATING_CHOICES = [
  { value: '', label: 'Any rating' },
  { value: '4', label: '4.0+' },
  { value: '4.5', label: '4.5+' },
  { value: '4.8', label: '4.8+' },
]

/**
 * The contractor directory.
 *
 * ⚠️ Filter state lives in the URL, not in `useState`, and that is the whole design of this page.
 * A `?category=plumbing&minRating=4.5` result list can be shared, bookmarked, and survives a
 * refresh and the Back button — none of which is true of component state. `useSearchParams` gives
 * the same ergonomics as `useState` for the cost of reading params instead of a variable.
 */
export function ContractorsPage() {
  const [params, setParams] = useSearchParams()

  const categorySlug = params.get('category') ?? ''
  const query = params.get('q') ?? ''
  const minRating = params.get('minRating') ?? ''

  const categories = useAsync(() => api.listCategories(), [])
  const results = useAsync(
    () =>
      api.listContractors({
        categorySlug: categorySlug || undefined,
        q: query || undefined,
        minRating: minRating ? Number(minRating) : undefined,
      }),
    [categorySlug, query, minRating],
  )

  /** Writes one param and drops it entirely when cleared, so the URL never accumulates `&q=`. */
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // `replace` so that typing in the search box does not push a history entry per keystroke —
    // otherwise Back has to be pressed once for every character the user typed.
    setParams(next, { replace: true })
  }

  const hasFilters = Boolean(categorySlug || query || minRating)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Browse contractors</h1>
      <p className="mt-1 text-sm text-slate-600">
        Every pro here has been rated by homeowners who actually hired them.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="q" className="sr-only">
            Search contractors
          </label>
          <TextInput
            id="q"
            value={query}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder="Search by name, trade or city"
          />
        </div>
        <div>
          <label htmlFor="minRating" className="sr-only">
            Minimum rating
          </label>
          <Select
            id="minRating"
            value={minRating}
            onChange={(e) => setParam('minRating', e.target.value)}
            className="sm:w-40"
          >
            {RATING_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </Select>
        </div>
        {hasFilters && (
          <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
            Clear
          </Button>
        )}
      </div>

      {/* Trade chips. A horizontal scroller rather than a wrapping block: with eight-plus trades a
          wrapping row becomes three lines tall on a phone and pushes the results off the screen. */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setParam('category', '')}
          className={cx(
            'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition',
            categorySlug ? 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50' : 'bg-brand-700 text-white',
          )}
        >
          All trades
        </button>
        {categories.data?.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setParam('category', category.slug)}
            className={cx(
              'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition',
              categorySlug === category.slug
                ? 'bg-brand-700 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50',
            )}
          >
            <span className="mr-1" aria-hidden="true">
              {category.icon}
            </span>
            {category.name}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {results.error && <ErrorNote>{results.error}</ErrorNote>}

        {results.loading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        )}

        {results.data && results.data.length === 0 && (
          <EmptyState
            icon="🔍"
            title="No pros match those filters"
            action={
              <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </Button>
            }
          >
            Try a wider trade, or drop the minimum rating — a new pro with no reviews yet is filtered
            out by any rating floor.
          </EmptyState>
        )}

        {results.data && results.data.length > 0 && (
          <>
            {/* `aria-live` so a screen reader hears the count change when a filter is applied.
                Without it the results silently swap underneath and nothing is announced. */}
            <p className="mb-4 text-sm text-slate-600" aria-live="polite">
              {pluralise(results.data.length, 'pro')} found
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.data.map((contractor) => (
                <ContractorCard key={contractor.id} contractor={contractor} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
