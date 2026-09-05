import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import * as api from '../../api/client'
import {
  Button,
  Card,
  ErrorNote,
  Field,
  Skeleton,
  StarRating,
  TextArea,
  TextInput,
} from '../../components/ui'
import { mediaUrl } from '../../lib/config'
import { cx } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { useMyProfile } from '../../lib/useMyProfile'

const EMPTY_FORM = {
  businessName: '',
  bio: '',
  yearsInBusiness: '',
  licenseNumber: '',
  city: '',
  state: '',
  zip: '',
  serviceRadiusMiles: '',
  hourlyRateMin: '',
  hourlyRateMax: '',
}

/** The contractor's own profile: business details, trades, and the portfolio uploader. */
export function ProProfilePage() {
  const profile = useMyProfile()
  const categories = useAsync(() => api.listCategories(), [])

  const [form, setForm] = useState(EMPTY_FORM)
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // ⚠️ The form is seeded from the loaded profile ONCE, keyed on the profile id. Without the
  // `profile.data?.id` dependency this re-runs on every render of the parent and overwrites what
  // the user is currently typing — a bug that looks like "the form keeps resetting itself".
  useEffect(() => {
    const p = profile.data
    if (!p) return
    setForm({
      businessName: p.businessName,
      bio: p.bio,
      yearsInBusiness: String(p.yearsInBusiness),
      licenseNumber: p.licenseNumber ?? '',
      city: p.city,
      state: p.state,
      zip: p.zip,
      serviceRadiusMiles: String(p.serviceRadiusMiles),
      hourlyRateMin: String(p.hourlyRateMin),
      hourlyRateMax: String(p.hourlyRateMax),
    })
    setCategoryIds(p.categories.map((c) => c.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data?.id])

  function update(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setSaved(false)
  }

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setSaved(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.updateContractorProfile(profile.data?.id ?? '', {
        businessName: form.businessName,
        bio: form.bio,
        yearsInBusiness: Number(form.yearsInBusiness) || 0,
        licenseNumber: form.licenseNumber,
        city: form.city,
        state: form.state,
        zip: form.zip,
        serviceRadiusMiles: Number(form.serviceRadiusMiles) || 0,
        hourlyRateMin: Number(form.hourlyRateMin) || 0,
        hourlyRateMax: Number(form.hourlyRateMax) || 0,
        categoryIds,
      })
      setSaved(true)
      profile.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setBusy(false)
    }
  }

  if (profile.loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!profile.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorNote>
          This account has no contractor profile. That should not happen — a profile is created with
          every contractor sign-up.
        </ErrorNote>
      </div>
    )
  }

  const pro = profile.data

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My profile</h1>
          <p className="mt-1 text-sm text-slate-600">
            This is what homeowners see before they pick who to hire.
          </p>
        </div>
        {pro.businessName && (
          <Link
            to={`/contractors/${pro.id}`}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            View public profile →
          </Link>
        )}
      </div>

      {pro.reviewCount > 0 && (
        <Card className="mt-6 flex items-center gap-4 p-4">
          <StarRating rating={pro.ratingAverage} reviewCount={pro.reviewCount} />
          {/* ⚠️ Read-only, and there is no field for it anywhere in this form on purpose. The
              rating is derived from review rows by the backend; a profile form that could set it
              would be the first thing anyone tried. */}
          <span className="text-xs text-slate-500">Calculated from your reviews</span>
        </Card>
      )}

      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {error && <ErrorNote>{error}</ErrorNote>}
          {saved && (
            <p role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
              Profile saved.
            </p>
          )}

          <Field label="Business name" htmlFor="businessName" required>
            <TextInput
              id="businessName"
              name="businessName"
              required
              value={form.businessName}
              onChange={update}
              placeholder="Rivera Plumbing Co."
            />
          </Field>

          <Field
            label="About your business"
            htmlFor="bio"
            hint="What you do, how long you have done it, and what makes your work different."
          >
            <TextArea id="bio" name="bio" rows={5} value={form.bio} onChange={update} />
          </Field>

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-slate-800">
              Trades you work in
              <span className="ml-0.5 text-rose-600" aria-hidden="true">
                *
              </span>
            </legend>
            <p className="mb-2 text-xs text-slate-500">
              You only see leads in the trades you pick here.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {categories.data?.map((category) => {
                const on = categoryIds.includes(category.id)
                return (
                  <label
                    key={category.id}
                    className={cx(
                      'cursor-pointer rounded-lg border px-3 py-3 text-center transition',
                      on
                        ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20'
                        : 'border-slate-300 hover:border-slate-400',
                    )}
                  >
                    {/* Checkboxes, not radios — a pro can work in several trades, and this is the
                        one difference between this control and the identical-looking one on the
                        post-a-project form. */}
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleCategory(category.id)}
                      className="sr-only"
                    />
                    <span className="block text-xl" aria-hidden="true">
                      {category.icon}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-slate-800">
                      {category.name}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Years in business" htmlFor="yearsInBusiness">
              <TextInput
                id="yearsInBusiness"
                name="yearsInBusiness"
                type="number"
                min={0}
                value={form.yearsInBusiness}
                onChange={update}
              />
            </Field>
            <Field label="Licence number" htmlFor="licenseNumber" hint="Leave blank if not licensed.">
              <TextInput
                id="licenseNumber"
                name="licenseNumber"
                value={form.licenseNumber}
                onChange={update}
                placeholder="TX-PL-44219"
              />
            </Field>
          </div>

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
                className="uppercase"
                value={form.state}
                onChange={update}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="ZIP" htmlFor="zip" required>
              <TextInput id="zip" name="zip" required value={form.zip} onChange={update} />
            </Field>
            <Field label="Travels (mi)" htmlFor="serviceRadiusMiles">
              <TextInput
                id="serviceRadiusMiles"
                name="serviceRadiusMiles"
                type="number"
                min={0}
                value={form.serviceRadiusMiles}
                onChange={update}
              />
            </Field>
            <Field label="Rate from" htmlFor="hourlyRateMin">
              <TextInput
                id="hourlyRateMin"
                name="hourlyRateMin"
                type="number"
                min={0}
                value={form.hourlyRateMin}
                onChange={update}
              />
            </Field>
            <Field label="Rate to" htmlFor="hourlyRateMax">
              <TextInput
                id="hourlyRateMax"
                name="hourlyRateMax"
                type="number"
                min={0}
                value={form.hourlyRateMax}
                onChange={update}
              />
            </Field>
          </div>

          <Button type="submit" size="lg" loading={busy}>
            Save profile
          </Button>
        </form>
      </Card>

      <PortfolioSection contractorId={pro.id} images={pro.portfolio} onChange={profile.reload} />
    </div>
  )
}

function PortfolioSection({
  contractorId,
  images,
  onChange,
}: {
  contractorId: string
  images: Array<{ id: string; url: string; caption: string | null }>
  onChange: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setBusy(true)
    setError(null)
    try {
      await api.uploadPortfolioImage(contractorId, file, caption)
      setCaption('')
      // ⚠️ Clearing the input matters: a file input keeps its value, so choosing the SAME file
      // twice in a row fires no `change` event the second time and the upload silently does
      // nothing. Resetting it after each upload is what makes a retry work.
      if (fileRef.current) fileRef.current.value = ''
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that image.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(imageId: string) {
    setError(null)
    try {
      await api.deletePortfolioImage(contractorId, imageId)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that image.')
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">Portfolio</h2>
      <p className="mt-1 text-sm text-slate-600">
        Photos of finished work. The first one is used as your cover image.
      </p>

      <Card className="mt-4 p-5">
        {error && (
          <div className="mb-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {images.map((image) => (
            <figure key={image.id} className="overflow-hidden rounded-lg border border-slate-200">
              <img src={mediaUrl(image.url)} alt={image.caption ?? ''} className="aspect-[3/2] w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-xs text-slate-600">{image.caption}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(image.id)}
                  className="shrink-0 text-xs font-semibold text-rose-700 hover:underline"
                >
                  Remove
                </button>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
          <Field label="Caption for the next photo" htmlFor="caption">
            <TextInput
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tankless water heater install"
            />
          </Field>

          <input
            ref={fileRef}
            id="portfolio-file"
            type="file"
            // A hint to the file picker, not a check. The real validation is server-side and looks
            // at the file's BYTES — `accept` is trivially bypassed by choosing "All files".
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            disabled={busy}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-800"
          />
          <p className="text-xs text-slate-500">JPEG, PNG or WebP, up to 5 MB.</p>
        </div>
      </Card>
    </section>
  )
}
