import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FieldProps {
  label: string
  error?: string
  hint?: string
}

/** A labelled input that wires up the accessibility attributes correctly.
 *
 * `useId` generates an id stable across server and client renders — the reason not to reach for
 * `Math.random()` here. It is what connects the <label> to the input, and the error message to
 * the input via `aria-describedby`, so a screen reader announces "Email, invalid entry, <message>"
 * rather than reading a red sentence floating on its own.
 */
export function Field({
  label,
  error,
  hint,
  ...input
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-800">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'rounded-lg border px-3 py-2.5 text-sm outline-none transition',
          'focus:ring-2 focus:ring-brand-200',
          error ? 'border-red-400 focus:border-red-500' : 'border-ink-300 focus:border-brand-400',
        ].join(' ')}
        {...input}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
    </div>
  )
}

export function TextArea({
  label,
  error,
  hint,
  ...input
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-800">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'rounded-lg border px-3 py-2.5 text-sm outline-none transition',
          'focus:ring-2 focus:ring-brand-200',
          error ? 'border-red-400 focus:border-red-500' : 'border-ink-300 focus:border-brand-400',
        ].join(' ')}
        {...input}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
    </div>
  )
}
