import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Field, TextArea } from '../../components/Field'
import { useToast } from '../../context/ToastContext'
import { ApiError, propertyApi } from '../../lib/api'
import type { Amenity } from '../../types'

const PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'CABIN', 'CONDO', 'LOFT', 'VILLA']
const ROOM_TYPES = [
  { value: 'ENTIRE_PLACE', label: 'Entire place' },
  { value: 'PRIVATE_ROOM', label: 'Private room' },
  { value: 'SHARED_ROOM', label: 'Shared room' },
]

const emptyForm = {
  title: '',
  description: '',
  propertyType: 'HOUSE',
  roomType: 'ENTIRE_PLACE',
  addressLine1: '',
  city: '',
  state: '',
  country: 'United States',
  postalCode: '',
  pricePerNight: '150',
  cleaningFee: '50',
  maxGuests: 4,
  bedrooms: 2,
  beds: 2,
  bathrooms: '1',
}

export function NewListing() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [form, setForm] = useState(emptyForm)
  const [amenities, setAmenities] = useState<Amenity[]>([])
  const [chosen, setChosen] = useState<string[]>(['wifi', 'kitchen'])
  const [photos, setPhotos] = useState<string[]>([''])
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    propertyApi.amenities().then(setAmenities).catch(() => setAmenities([]))
  }, [])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const urls = photos.map((p) => p.trim()).filter(Boolean)

    try {
      const created = await propertyApi.create({
        ...form,
        maxGuests: Number(form.maxGuests),
        bedrooms: Number(form.bedrooms),
        beds: Number(form.beds),
        amenitySlugs: chosen,
        images: urls.map((url, index) => ({ url, isCover: index === 0 })),
      })

      // Two steps on purpose: a listing is created as a DRAFT, and publishing is a separate,
      // deliberate act with its own entry requirements. Nobody should go live halfway through
      // writing a description.
      try {
        await propertyApi.publish(created.publicId)
        toast('Listed and published — it is in search now.', 'success')
      } catch (publishError) {
        // The listing IS saved. Say that clearly instead of showing a failure for work that
        // was not lost.
        toast(
          `Saved as a draft. ${publishError instanceof ApiError ? publishError.message : ''}`,
          'info',
        )
      }
      navigate('/hosts/listings')
    } catch (err) {
      setError(err as Error)
      toast(err instanceof ApiError ? err.message : 'Could not save that listing.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const fieldError = (name: string) => (error instanceof ApiError ? error.fieldError(name) : undefined)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-ink-900">Add a listing</h1>
      <p className="mt-1 text-sm text-ink-600">
        Saved as a draft, then published if it has everything it needs.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
        <Field
          label="Title"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          error={fieldError('title')}
          hint="At least 5 characters."
          placeholder="Sunlit loft with a view of the bridge"
          required
        />

        <TextArea
          label="Description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          error={fieldError('description')}
          rows={5}
          hint="At least 20 characters to publish."
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-800">Property type</span>
            <select
              value={form.propertyType}
              onChange={(e) => set('propertyType', e.target.value)}
              className="rounded-lg border border-ink-300 px-3 py-2.5 text-sm"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-800">Room type</span>
            <select
              value={form.roomType}
              onChange={(e) => set('roomType', e.target.value)}
              className="rounded-lg border border-ink-300 px-3 py-2.5 text-sm"
            >
              {ROOM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Field
          label="Street address"
          value={form.addressLine1}
          onChange={(e) => set('addressLine1', e.target.value)}
          error={fieldError('addressLine1')}
          // Worth stating on the form itself, because it explains why the field is asked for at
          // all: the API never returns it on a public listing.
          hint="Only shown to guests after they book — never on the public listing."
        />

        <div className="grid grid-cols-3 gap-4">
          <Field label="City" value={form.city} onChange={(e) => set('city', e.target.value)} error={fieldError('city')} required />
          <Field label="State" value={form.state} onChange={(e) => set('state', e.target.value)} />
          <Field label="Postal code" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Price per night (USD)"
            type="number"
            min="1"
            step="0.01"
            value={form.pricePerNight}
            onChange={(e) => set('pricePerNight', e.target.value)}
            error={fieldError('pricePerNight')}
            required
          />
          <Field
            label="Cleaning fee (USD)"
            type="number"
            min="0"
            step="0.01"
            value={form.cleaningFee}
            onChange={(e) => set('cleaningFee', e.target.value)}
            error={fieldError('cleaningFee')}
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="Sleeps" type="number" min="1" value={form.maxGuests} onChange={(e) => set('maxGuests', Number(e.target.value))} />
          <Field label="Bedrooms" type="number" min="0" value={form.bedrooms} onChange={(e) => set('bedrooms', Number(e.target.value))} />
          <Field label="Beds" type="number" min="0" value={form.beds} onChange={(e) => set('beds', Number(e.target.value))} />
          <Field label="Baths" type="number" min="0" step="0.5" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-ink-800">Amenities</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {amenities.map((a) => {
              const active = chosen.includes(a.slug)
              return (
                <button
                  key={a.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setChosen((current) =>
                      current.includes(a.slug)
                        ? current.filter((s) => s !== a.slug)
                        : [...current, a.slug],
                    )
                  }
                  className={[
                    'rounded-full border px-3 py-1.5 text-sm transition',
                    active
                      ? 'border-ink-900 bg-ink-900 text-white'
                      : 'border-ink-300 text-ink-700 hover:border-ink-900',
                  ].join(' ')}
                >
                  {a.name}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-ink-800">Photos</legend>
          <p className="mt-1 text-xs text-ink-500">
            Image URLs — the first is the cover. At least one is needed to publish. (A real app
            would upload files to S3 and store a key; URLs keep the demo simple.)
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {photos.map((url, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) =>
                    setPhotos((current) => current.map((p, i) => (i === index ? e.target.value : p)))
                  }
                  placeholder="https://images.unsplash.com/photo-…"
                  aria-label={`Photo URL ${index + 1}`}
                  className="flex-1 rounded-lg border border-ink-300 px-3 py-2 text-sm"
                />
                {photos.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            <Button variant="secondary" size="sm" className="self-start" onClick={() => setPhotos((c) => [...c, ''])}>
              Add another photo
            </Button>
          </div>
        </fieldset>

        <Button type="submit" size="lg" loading={saving}>
          Save and publish
        </Button>
      </form>
    </div>
  )
}
