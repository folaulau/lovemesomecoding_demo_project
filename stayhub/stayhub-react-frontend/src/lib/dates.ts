/** Date helpers.
 *
 * ⚠️ Everything here works in LOCAL time on purpose, and every date is a plain `YYYY-MM-DD`
 * string at the boundary — never an ISO timestamp.
 *
 * `new Date("2026-11-10")` parses as UTC MIDNIGHT. West of Greenwich that renders as the 9th, so
 * a guest in California picks the 10th and the app shows them the 9th. `new Date(2026, 10, 10)`
 * — the component form — is local and does not have this problem. Every parse below goes through
 * `parseISODate` for exactly that reason.
 */

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function today(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Half-open, matching the server: check-in counts, check-out does not. 1st → 2nd is ONE night. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = parseISODate(checkOut).getTime() - parseISODate(checkIn).getTime()
  return Math.round(ms / 86_400_000)
}

/** "10 Nov 2026" */
export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "10 – 13 Nov 2026", collapsing the month when both dates share one. */
export function formatRange(checkIn: string, checkOut: string): string {
  const a = parseISODate(checkIn)
  const b = parseISODate(checkOut)
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const left = a.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  const right = b.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${left} – ${right}`
}

/** Every date in [from, to) — used to mark booked days on the calendar. */
export function datesInRange(from: string, to: string): string[] {
  const out: string[] = []
  let cursor = parseISODate(from)
  const end = parseISODate(to)
  while (cursor < end) {
    out.push(toISODate(cursor))
    cursor = addDays(cursor, 1)
  }
  return out
}
