const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export const money = (value: string | number | null | undefined) => usd.format(Number(value ?? 0))

export const compactMoney = (value: string | number | null | undefined) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value ?? 0))

export function formatDate(iso: string): string {
  if (!iso) return '—'
  // A plain date (YYYY-MM-DD) is parsed as UTC midnight by `new Date`, which renders as the
  // PREVIOUS day west of Greenwich. Splitting it into components keeps it local.
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  DRAFT: 'bg-amber-100 text-amber-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  CANCELLED: 'bg-ink-200 text-ink-600',
  COMPLETED: 'bg-sky-100 text-sky-800',
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
