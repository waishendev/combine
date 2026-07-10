'use client'

import { FormEvent, useEffect, useState } from 'react'

import { parsePosAvailabilityVerifyMode, type PosAvailabilityVerifyMode } from '@/components/pos/posAvailabilityMessages'

type Props = {
  canEdit: boolean
}

const MODE_OPTIONS: Array<{ value: PosAvailabilityVerifyMode; label: string; description: string }> = [
  {
    value: 'holiday_only',
    label: 'Holiday / leave only (recommended)',
    description: 'CRM POS only blocks staff off-day, approved leave, or inactive staff. Schedule conflicts and double-booking are allowed.',
  },
  {
    value: 'full',
    label: 'Full verification',
    description: 'CRM POS enforces staff schedule, breaks, booking conflicts, and blocked times (walk-in override still applies where supported).',
  },
]

export default function PosAvailabilityVerifyModeSettingsCard({ canEdit }: Props) {
  const [verifyMode, setVerifyMode] = useState<PosAvailabilityVerifyMode>('holiday_only')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        setError(null)
        const res = await fetch('/api/ecommerce/shop-settings?type=booking', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch POS availability verify mode')
        const payload = await res.json()
        setVerifyMode(parsePosAvailabilityVerifyMode(payload?.data?.pos_availability_verify_mode))
      } catch (e) {
        console.error(e)
        setError('Unable to load POS availability verification setting.')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/ecommerce/shop-settings/pos_availability_verify_mode?type=booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'booking', value: verifyMode }),
      })
      if (!res.ok) throw new Error('Failed to save POS availability verify mode')
      setMessage('POS availability verification setting saved.')
    } catch (e) {
      console.error(e)
      setError('Unable to save POS availability verification setting.')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 2500)
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">Loading POS availability verification setting...</div>
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-semibold text-slate-900 mt-1">CRM POS Availability Verification</h3>
      <p className="mt-2 text-sm text-slate-500 max-w-3xl">
        Controls how strictly CRM POS checks staff availability when creating appointments, rescheduling, editing settlement, or adding services to cart.
        This does <span className="font-medium text-slate-700">not</span> affect customer self-booking on the Booking Website.
      </p>

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <div className="space-y-3">
          {MODE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition ${
                verifyMode === option.value
                  ? 'border-blue-300 bg-blue-50/60'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              } ${!canEdit ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <input
                type="radio"
                name="pos_availability_verify_mode"
                value={option.value}
                checked={verifyMode === option.value}
                disabled={!canEdit}
                onChange={() => setVerifyMode(option.value)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                <span className="mt-1 block text-sm text-slate-600">{option.description}</span>
              </span>
            </label>
          ))}
        </div>

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
