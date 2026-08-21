import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { SpinnerIcon } from './Icons'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-300',
  secondary: 'bg-white text-ink-900 ring-1 ring-ink-300 hover:bg-ink-50 disabled:text-ink-400',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100 disabled:text-ink-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      // Disabling while loading is what stops a double-submit creating two bookings. The guard
      // matters more here than the spinner does.
      disabled={disabled || loading}
      // Buttons inside a <form> default to type="submit", which submits and reloads the page.
      // Callers that want a submit button pass it explicitly.
      type={rest.type ?? 'button'}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && <SpinnerIcon className="h-4 w-4" />}
      {children}
    </button>
  )
}
