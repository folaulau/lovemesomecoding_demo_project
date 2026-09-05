/**
 * Formatting helpers.
 *
 * Every one of these wraps `Intl`, which ships in the browser and knows more about dates and
 * currencies than any hand-rolled helper ever will. Pulling in a date library to print "3 days ago"
 * is a common reflex and rarely worth the bytes.
 */

// ⚠️ Constructed once at module load, not per call. `new Intl.NumberFormat(...)` is genuinely
// expensive — it builds locale data — and a table of 40 quotes that constructs one per cell is a
// measurable stall. Reusing the formatter is the entire optimisation.
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const usdPrecise = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** `$2,450` — whole dollars, which is the granularity every price in this app is quoted at. */
export function money(amount: number): string {
  return usd.format(amount)
}

export function moneyPrecise(amount: number): string {
  return usdPrecise.format(amount)
}

/** `$1,800 – $3,500`, collapsing to a single figure when both ends match. */
export function moneyRange(min: number, max: number): string {
  return min === max ? money(min) : `${money(min)} – ${money(max)}`
}

const longDate = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export function formatDate(iso: string): string {
  return longDate.format(parseIso(iso))
}

export function formatShortDate(iso: string): string {
  return shortDate.format(parseIso(iso))
}

const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })

/** "3 days ago", "yesterday", "in 2 weeks". `numeric: 'auto'` is what produces "yesterday"
 *  instead of "1 day ago", and it is the reason this is worth doing with `Intl` at all. */
export function formatRelative(iso: string): string {
  const then = parseIso(iso).getTime()
  const seconds = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(seconds)

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]

  for (const [unit, size] of units) {
    if (abs >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

/**
 * ⚠️ A bare `preferredStartDate` is `"2026-09-10"` — a date with no time and no zone. Passed
 * straight to `new Date()`, the spec says to read that as UTC midnight, so anyone west of
 * Greenwich renders it as the day before. The fix is to pin it to local noon, which is far enough
 * from both midnights that no zone can push it across a day boundary.
 *
 * Full ISO timestamps (everything with a `T` in it) already carry a zone and are left alone.
 */
function parseIso(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d, 12)
  }
  return new Date(iso)
}

/** `4.8` → `"4.8"`, `5` → `"5.0"`. A rating that renders as a bare `5` next to a `4.8` looks
 *  like a different kind of number; the trailing zero keeps the column aligned. */
export function formatRating(rating: number): string {
  return rating.toFixed(1)
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Joins class names and drops the falsy ones, so `cx('a', cond && 'b')` reads cleanly in JSX.
 *  This is the two-line version of the `clsx` package — worth knowing before installing it. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
