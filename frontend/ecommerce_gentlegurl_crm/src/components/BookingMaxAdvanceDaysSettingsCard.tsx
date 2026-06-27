'use client'

import { FormEvent, useEffect, useState } from 'react'

type Props = {
  canEdit: boolean
}

const DEFAULT_MAX_ADVANCE_DAYS = 365

export default function BookingMaxAdvanceDaysSettingsCard({ canEdit }: Props) {
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(DEFAULT_MAX_ADVANCE_DAYS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        setError(null)
        const res = await fetch('/api/ecommerce/shop-settings?type=booking', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch booking advance days setting')
        const payload = await res.json()
        const value = Number(payload?.data?.booking_max_advance_days ?? DEFAULT_MAX_ADVANCE_DAYS)
        setMaxAdvanceDays(Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_MAX_ADVANCE_DAYS)
      } catch (e) {
        console.error(e)
        setError('Unable to load maximum advance booking days setting.')
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
      const res = await fetch('/api/ecommerce/shop-settings/booking_max_advance_days?type=booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'booking', value: maxAdvanceDays }),
      })
      if (!res.ok) throw new Error('Failed to save maximum advance booking days setting')
      setMessage('Maximum advance booking days saved.')
    } catch (e) {
      console.error(e)
      setError('Unable to save maximum advance booking days setting.')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 2500)
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">Loading maximum advance booking days...</div>
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-semibold text-slate-900 mt-1">Maximum Advance Booking Days</h3>
      <p className="mt-2 text-sm text-slate-500">
        Controls how far ahead customers can book on the Booking Website. Staff manual bookings are not restricted.
      </p>

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <label className="block max-w-sm space-y-1">
          <span className="text-sm font-medium text-slate-700">Days ahead</span>
          <input
            type="number"
            min={0}
            max={3650}
            value={maxAdvanceDays}
            disabled={!canEdit}
            onChange={(e) => setMaxAdvanceDays(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <span className="block text-xs text-slate-500">
            Example: 60 means customers can book from today up to 60 days ahead.
          </span>
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
