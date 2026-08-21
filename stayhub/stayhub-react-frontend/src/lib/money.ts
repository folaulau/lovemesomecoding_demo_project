/** Money formatting.
 *
 * ⚠️ Prices cross the wire as STRINGS ("215.00"), not numbers. That is deliberate on both sides:
 * Postgres NUMERIC and Python Decimal are exact, and JSON numbers are IEEE 754 doubles — the
 * moment a total becomes a JS number, `0.1 + 0.2` arithmetic is back on the table.
 *
 * So: parse a string only to DISPLAY it, and never to compute a total the user will be charged.
 * The server owns every figure; the browser's arithmetic is a preview.
 */

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const usdCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "$215" — for prices in listing cards, where cents are noise. */
export function money(value: string | number): string {
  return usd.format(Number(value))
}

/** "$475.08" — for anything a guest is actually charged. Always show the cents there. */
export function moneyExact(value: string | number): string {
  return usdCents.format(Number(value))
}

/** "$215 night" — the listing-card idiom. */
export function perNight(value: string | number): string {
  return `${money(value)} night`
}

export function rating(value: string | number): string {
  const n = Number(value)
  return n > 0 ? n.toFixed(2) : 'New'
}
