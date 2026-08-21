import { useMemo, useState } from 'react'
import { addDays, datesInRange, parseISODate, toISODate, today } from '../lib/dates'
import { ChevronLeft, ChevronRight } from './Icons'

interface Props {
  checkIn: string | null
  checkOut: string | null
  onChange: (checkIn: string | null, checkOut: string | null) => void
  /** Ranges already booked, from GET /bookings/availability/{id}. Half-open, like everything else. */
  unavailable?: { from: string; to: string }[]
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function DateRangePicker({ checkIn, checkOut, onChange, unavailable = [] }: Props) {
  const [cursor, setCursor] = useState(() => {
    const base = checkIn ? parseISODate(checkIn) : today()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  // A Set, not an array. This is checked once per rendered day cell — around 70 across two months
  // — and `Array.includes` inside that loop is the difference between O(n) and O(n·m).
  const blocked = useMemo(() => {
    const set = new Set<string>()
    for (const range of unavailable) {
      // datesInRange is half-open, so a stay ending on the 5th does NOT block the 5th. That is
      // what lets a new guest check in the day the last one leaves.
      for (const day of datesInRange(range.from, range.to)) set.add(day)
    }
    return set
  }, [unavailable])

  const minDate = today()

  function pick(iso: string) {
    // Starting fresh: either nothing is chosen, or a complete range is, or the click is before
    // the current check-in (which reads as "actually, start here instead").
    if (!checkIn || (checkIn && checkOut) || iso <= checkIn) {
      onChange(iso, null)
      return
    }

    // ⚠️ A range is only valid if nothing between the two ends is booked. Without this check a
    // guest can select AROUND a booked week — both endpoints free, the middle taken — and the
    // server rejects it only at submit time, after they have filled in everything else.
    const spans = datesInRange(checkIn, iso)
    if (spans.some((day) => blocked.has(day))) {
      onChange(iso, null)
      return
    }
    onChange(checkIn, iso)
  }

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="rounded-full p-2 text-ink-600 transition hover:bg-ink-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-ink-900">
          {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="rounded-full p-2 text-ink-600 transition hover:bg-ink-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1 text-xs font-medium text-ink-500">
            {day}
          </span>
        ))}

        {/* Blank cells so the 1st lands under the right weekday. */}
        {Array.from({ length: cursor.getDay() }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}

        {Array.from({
          // Day 0 of the NEXT month is the last day of this one — the standard trick that gets
          // February and leap years right without a table.
          length: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate(),
        }).map((_, index) => {
          const date = new Date(cursor.getFullYear(), cursor.getMonth(), index + 1)
          const iso = toISODate(date)
          const isPast = date < minDate
          const isBlocked = blocked.has(iso)
          const isStart = iso === checkIn
          const isEnd = iso === checkOut
          const isBetween = !!checkIn && !!checkOut && iso > checkIn && iso < checkOut
          const disabled = isPast || (isBlocked && !isStart)

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => pick(iso)}
              aria-label={date.toDateString()}
              aria-pressed={isStart || isEnd}
              className={[
                'mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition',
                disabled && 'cursor-not-allowed text-ink-300 line-through',
                !disabled && !isStart && !isEnd && !isBetween && 'text-ink-800 hover:bg-ink-100',
                isBetween && 'bg-brand-100 text-brand-800',
                (isStart || isEnd) && 'bg-brand-500 font-semibold text-white',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {index + 1}
            </button>
          )
        })}
      </div>

      {checkIn && !checkOut && (
        <p className="mt-3 text-xs text-ink-500">Now pick a check-out date.</p>
      )}
      <button
        type="button"
        onClick={() => onChange(null, null)}
        className="mt-3 text-xs font-medium text-ink-600 underline hover:text-ink-900"
      >
        Clear dates
      </button>
    </div>
  )
}

/** Sensible defaults so the booking panel is never empty on first load. */
export function defaultDates(): { checkIn: string; checkOut: string } {
  const start = addDays(today(), 14)
  return { checkIn: toISODate(start), checkOut: toISODate(addDays(start, 3)) }
}
