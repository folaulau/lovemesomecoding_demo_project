/**
 * The shared primitives.
 *
 * Small, unopinionated, and gathered here so that "what does a button look like" has exactly one
 * answer. A Tailwind project without a file like this drifts within a week: four shades of primary
 * button, three border radii, and no single place to change any of them.
 */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

import { cx, formatRating } from '../lib/format'
import { mediaUrl } from '../lib/config'
import { placeholderAvatar } from '../lib/placeholder'

/* ------------------------------------------------------------------------------------------- */
/* Button                                                                                        */
/* ------------------------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
  secondary: 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner and disables the button. Pass the mutation's in-flight flag. */
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // ⚠️ `type` defaults to "submit" inside a form, which is why a "Cancel" button in a form
      // submits it. Defaulting to "button" here and opting in to submit is the safer way round.
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx('animate-spin', className ?? 'h-5 w-5')}
      viewBox="0 0 24 24"
      fill="none"
      // Decorative: the surrounding text already says what is happening, and a screen reader
      // announcing "image" here adds nothing.
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------------------------------- */
/* Surfaces                                                                                      */
/* ------------------------------------------------------------------------------------------- */

type CardTone = 'default' | 'muted' | 'brand' | 'dark'

/**
 * ⚠️ The background is a TONE, not something you pass in `className`, and this is the single most
 * common Tailwind trap.
 *
 * `<Card className="bg-slate-900">` looks like it should win — it is written last, and in plain CSS
 * a later declaration beats an earlier one. But `bg-white` and `bg-slate-900` are two classes of
 * EQUAL specificity, and which one applies is decided by their order in the generated stylesheet,
 * not by their order in the `class` attribute. Tailwind emits them in its own order, so the
 * override silently loses — and the symptom is a card that is simply the wrong colour, with
 * nothing in the markup to explain why. It cost this project two visibly broken panels.
 *
 * `tailwind-merge` exists to solve exactly this by stripping conflicting utilities before they are
 * emitted. A fixed set of tones is the version that needs no dependency and, for a component with
 * four looks, says more about the design system than an arbitrary string would.
 */
const CARD_TONES: Record<CardTone, string> = {
  default: 'border-slate-200 bg-white',
  muted: 'border-slate-200 bg-slate-50',
  brand: 'border-brand-200 bg-brand-50',
  dark: 'border-slate-800 bg-slate-900',
}

export function Card({
  tone = 'default',
  className,
  children,
}: {
  tone?: CardTone
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cx('rounded-xl border shadow-sm', CARD_TONES[tone], className)}>{children}</div>
  )
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        className ?? 'bg-slate-100 text-slate-700',
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------------------------------- */
/* Form fields                                                                                   */
/* ------------------------------------------------------------------------------------------- */

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 ' +
  'disabled:bg-slate-100 disabled:text-slate-500'

interface FieldProps {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

/** Label, control, hint and error in the order a screen reader should meet them. */
export function Field({ label, htmlFor, hint, error, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
        {required && (
          <span className="ml-0.5 text-rose-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {/* `role="alert"` so the message is announced when it appears, rather than only being
          noticed by someone who happens to be looking at that part of the form. */}
      {error && (
        <p role="alert" className="text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD_CLASS, className)} {...rest} />
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(FIELD_CLASS, className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(FIELD_CLASS, className)} {...rest}>
      {children}
    </select>
  )
}

/* ------------------------------------------------------------------------------------------- */
/* Ratings                                                                                       */
/* ------------------------------------------------------------------------------------------- */

/**
 * Read-only star display.
 *
 * The stars are `aria-hidden` and the real rating is given as text to assistive technology —
 * "★★★★☆" announced star by star is noise, "Rated 4.8 out of 5" is the information.
 */
export function StarRating({
  rating,
  reviewCount,
  size = 'md',
}: {
  rating: number
  reviewCount?: number
  size?: 'sm' | 'md'
}) {
  const rounded = Math.round(rating)
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cx('text-accent-500', size === 'sm' ? 'text-xs' : 'text-sm')}>
        {'★'.repeat(rounded)}
        <span className="text-slate-300">{'★'.repeat(5 - rounded)}</span>
      </span>
      <span className={cx('font-semibold text-slate-800', size === 'sm' ? 'text-xs' : 'text-sm')}>
        {formatRating(rating)}
      </span>
      {reviewCount !== undefined && (
        <span className={cx('text-slate-500', size === 'sm' ? 'text-xs' : 'text-sm')}>
          ({reviewCount})
        </span>
      )}
      <span className="sr-only">
        Rated {formatRating(rating)} out of 5
        {reviewCount !== undefined ? ` from ${reviewCount} reviews` : ''}
      </span>
    </span>
  )
}

/**
 * The interactive version, for the review form.
 *
 * ⚠️ Radio inputs under the stars, not `<div onClick>`. A radio group is keyboard-navigable with
 * the arrow keys, announces "3 of 5" on its own, and submits with the form — all of which has to
 * be rebuilt by hand the moment you reach for a div.
 */
export function StarPicker({
  value,
  onChange,
  name = 'rating',
}: {
  value: number
  onChange: (rating: number) => void
  name?: string
}) {
  return (
    <fieldset className="flex items-center gap-1">
      <legend className="sr-only">Rating out of 5</legend>
      {[1, 2, 3, 4, 5].map((star) => (
        <label
          key={star}
          className="cursor-pointer text-3xl leading-none transition hover:scale-110"
          title={`${star} star${star === 1 ? '' : 's'}`}
        >
          <input
            type="radio"
            name={name}
            value={star}
            checked={value === star}
            onChange={() => onChange(star)}
            className="sr-only"
          />
          <span className={star <= value ? 'text-accent-500' : 'text-slate-300'}>★</span>
          <span className="sr-only">
            {star} star{star === 1 ? '' : 's'}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

/* ------------------------------------------------------------------------------------------- */
/* States                                                                                        */
/* ------------------------------------------------------------------------------------------- */

/** The grey blocks shown while a list loads. Sized to roughly match the real content, because a
 *  skeleton of the wrong height causes a layout jump the moment the data lands. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-slate-200', className)} aria-hidden="true" />
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: string
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="text-4xl" aria-hidden="true">
        {icon}
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {children}
    </div>
  )
}

export function Avatar({
  src,
  name,
  className,
}: {
  src: string | null
  name: string
  className?: string
}) {
  const size = className ?? 'h-10 w-10'
  // Nobody in the seed data has uploaded a photo, so most avatars take this branch. A generated
  // monogram beats a grey silhouette and needs no network — see `lib/placeholder.ts`.
  const resolved = src ? mediaUrl(src) : placeholderAvatar(name)

  // The alt text is empty on purpose: every avatar in this app sits next to the person's name in
  // text, so describing it again just makes a screen reader say the name twice.
  return <img src={resolved} alt="" className={cx(size, 'rounded-full object-cover')} />
}
