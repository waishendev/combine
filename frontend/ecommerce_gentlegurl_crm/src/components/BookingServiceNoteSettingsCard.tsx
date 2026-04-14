'use client'

import { FormEvent, useEffect, useState } from 'react'

type Props = {
  canEdit: boolean
}

export default function BookingServiceNoteSettingsCard({ canEdit }: Props) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        setError(null)
        const res = await fetch('/api/ecommerce/shop-settings/booking_service_deposit_note?type=booking', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch booking service note setting')
        const payload = await res.json()
        setValue(typeof payload?.data?.value === 'string' ? payload.data.value : '')
      } catch (e) {
        console.error(e)
        setError('Unable to load booking service note setting.')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/ecommerce/shop-settings/booking_service_deposit_note?type=booking', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'booking',
          value,
        }),
      })
      if (!res.ok) throw new Error('Failed to save booking service note setting')
      setMessage('Booking service note setting saved.')
    } catch (e) {
      console.error(e)
      setError('Unable to save booking service note setting.')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 2500)
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">Loading booking service note...</div>
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-semibold text-slate-900 mt-1">Booking Service Note</h3>
      <p className="mt-2 text-sm text-slate-500">Configure the note shown on booking service detail pages.</p>

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Service note text</span>
          <textarea
            rows={4}
            value={value}
            disabled={!canEdit}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Leave empty to hide note on booking service page."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canEdit || saving}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  )
}
