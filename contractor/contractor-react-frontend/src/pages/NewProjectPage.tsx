import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import * as api from '../api/client'
import { Button, Card, ErrorNote, Field, Skeleton, TextArea, TextInput } from '../components/ui'
import { useAuth } from '../lib/auth'
import { cx } from '../lib/format'
import { useAsync } from '../lib/useAsync'

/** Today in `YYYY-MM-DD`, for the date input's `min`. Built from local parts rather than
 *  `toISOString().slice(0,10)`, which returns the UTC day and is therefore wrong all evening for
 *  anyone west of Greenwich. */
function todayLocal(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const EMPTY = {
  categoryId: '',
  title: '',
  description: '',
  city: '',
  state: '',
  zip: '',
  budgetMin: '',
  budgetMax: '',
  preferredStartDate: '',
}

export function NewProjectPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const categories = useAsync(() => api.listCategories(), [])

  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // ⚠️ Money is held as a STRING while the user types, and parsed once on submit. Binding a number
  // input straight to a number state makes the field un-clearable — deleting the last digit yields
  // `NaN`, which React renders as an empty value it then immediately fights the user over.
  function update(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const budgetMin = Number(form.budgetMin)
    const budgetMax = Number(form.budgetMax)
    if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax)) {
      setError('Enter a budget range in whole dollars.')
      return
    }
    if (budgetMax < budgetMin) {
      setError('The top of your budget cannot be below the bottom of it.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const created = await api.createProject(user?.id ?? '', {
        ...form,
        budgetMin,
        budgetMax,
      })
      navigate(`/projects/${created.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your project.')
    } finally {
      setBusy(false)
    }
  }

  const selected = categories.data?.find((c) => c.id === form.categoryId)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Post a project</h1>
      <p className="mt-1 text-sm text-slate-600">
        The more specific you are, the more useful the quotes. Pros can only see projects in trades
        they actually work in.
      </p>

      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {error && <ErrorNote>{error}</ErrorNote>}

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-slate-800">
              What kind of work is it?
              <span className="ml-0.5 text-rose-600" aria-hidden="true">
                *
              </span>
            </legend>

            {categories.loading && <Skeleton className="h-24" />}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {categories.data?.map((category) => (
                <label
                  key={category.id}
                  className={cx(
                    'cursor-pointer rounded-lg border px-3 py-3 text-center transition',
                    form.categoryId === category.id
                      ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20'
                      : 'border-slate-300 hover:border-slate-400',
                  )}
                >
                  <input
                    type="radio"
                    name="categoryId"
                    value={category.id}
                    checked={form.categoryId === category.id}
                    onChange={update}
                    className="sr-only"
                    required
                  />
                  <span className="block text-xl" aria-hidden="true">
                    {category.icon}
                  </span>
                  <span className="mt-1 block text-xs font-medium text-slate-800">
                    {category.name}
                  </span>
                </label>
              ))}
            </div>

            {selected && <p className="mt-2 text-xs text-slate-500">{selected.description}</p>}
          </fieldset>

          <Field
            label="Title"
            htmlFor="title"
            hint="One line a contractor can scan in their feed."
            required
          >
            <TextInput
              id="title"
              name="title"
              required
              maxLength={120}
              value={form.title}
              onChange={update}
              placeholder="Replace leaking 50-gallon water heater"
            />
          </Field>

          <Field
            label="Describe the job"
            htmlFor="description"
            hint="Age of the house, access, what you have already tried — anything that changes the price."
            required
          >
            <TextArea
              id="description"
              name="description"
              required
              rows={6}
              value={form.description}
              onChange={update}
              placeholder="The water heater in the garage is weeping from the base…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="City" htmlFor="city" required>
                <TextInput id="city" name="city" required value={form.city} onChange={update} />
              </Field>
            </div>
            <Field label="State" htmlFor="state" required>
              <TextInput
                id="state"
                name="state"
                required
                maxLength={2}
                // `uppercase` is a CSS transform, so the state shows as "TX" while the user types
                // "tx". The value is normalised again on the server — display formatting is never
                // a substitute for storing it consistently.
                className="uppercase"
                value={form.state}
                onChange={update}
                placeholder="TX"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="ZIP" htmlFor="zip" required>
              <TextInput
                id="zip"
                name="zip"
                required
                inputMode="numeric"
                maxLength={10}
                value={form.zip}
                onChange={update}
                placeholder="78704"
              />
            </Field>
            <Field label="Budget from" htmlFor="budgetMin" required>
              <TextInput
                id="budgetMin"
                name="budgetMin"
                type="number"
                min={0}
                step={50}
                required
                value={form.budgetMin}
                onChange={update}
                placeholder="1800"
              />
            </Field>
            <Field label="Budget to" htmlFor="budgetMax" required>
              <TextInput
                id="budgetMax"
                name="budgetMax"
                type="number"
                min={0}
                step={50}
                required
                value={form.budgetMax}
                onChange={update}
                placeholder="3500"
              />
            </Field>
          </div>

          <Field
            label="Preferred start date"
            htmlFor="preferredStartDate"
            hint="A rough date is fine — it tells pros whether they can fit you in."
            required
          >
            <TextInput
              id="preferredStartDate"
              name="preferredStartDate"
              type="date"
              required
              min={todayLocal()}
              value={form.preferredStartDate}
              onChange={update}
            />
          </Field>

          <div className="flex gap-3">
            <Button type="submit" size="lg" loading={busy}>
              Post project
            </Button>
            <Button type="button" variant="secondary" size="lg" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
