import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './Button'
import { SearchIcon, UsersIcon } from './Icons'

interface Props {
  initialQuery?: string
  initialGuests?: number
  compact?: boolean
}

export function SearchBar({ initialQuery = '', initialGuests = 1, compact = false }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState(initialQuery)
  const [guests, setGuests] = useState(initialGuests)

  // Keep the input in step when the URL changes underneath — e.g. the browser Back button. A
  // useState initialiser only runs on mount, so without this the box keeps the old text after a
  // history navigation.
  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (guests > 1) params.set('guests', String(guests))
    navigate(`/search?${params.toString()}`)
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className={[
        'flex items-center gap-1 rounded-full border border-ink-300 bg-white p-1.5 shadow-sm',
        compact ? 'max-w-xl' : 'w-full max-w-3xl shadow-lg',
      ].join(' ')}
    >
      <label className="flex flex-1 flex-col px-4 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-700">Where</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search destinations"
          className="bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
        />
      </label>

      <div className="h-8 w-px bg-ink-200" />

      <label className="flex flex-col px-4 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-700">Who</span>
        <span className="flex items-center gap-2 text-sm text-ink-900">
          <UsersIcon className="h-4 w-4 text-ink-500" />
          <input
            type="number"
            min={1}
            max={50}
            value={guests}
            onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Number of guests"
            className="w-12 bg-transparent outline-none"
          />
        </span>
      </label>

      <Button type="submit" className="!rounded-full !px-4 !py-3" aria-label="Search">
        <SearchIcon className="h-4 w-4" />
        {!compact && <span>Search</span>}
      </Button>
    </form>
  )
}
