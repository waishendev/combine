'use client'

import { FormEvent, useEffect, useState } from 'react'

type Props = {
  canEdit: boolean
}

type BookingPolicy = {
  reschedule: {
    enabled: boolean
    max_changes: number
    cutoff_hours: number
  }
  cancel: {
    customer_cancel_allowed: boolean
    deposit_refundable: boolean
  }
}

const defaultPolicy: BookingPolicy = {
  reschedule: {
    enabled: true,
    max_changes: 1,
    cutoff_hours: 72,
  },
  cancel: {
    customer_cancel_allowed: false,
    deposit_refundable: false,
  },
}

export default function BookingPolicySettingsCard({ canEdit }: Props) {
  const [policy, setPolicy] = useState<BookingPolicy>(defaultPolicy)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        setError(null)
        const res = await fetch('/api/ecommerce/shop-settings?type=booking', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch booking policy settings')
        const payload = await res.json()
        const incoming = payload?.data?.booking_policy
        if (incoming) {
          setPolicy({
            reschedule: {
              enabled: Boolean(incoming?.reschedule?.enabled ?? defaultPolicy.reschedule.enabled),
              max_changes: Number(incoming?.reschedule?.max_changes ?? defaultPolicy.reschedule.max_changes),
              cutoff_hours: Number(incoming?.reschedule?.cutoff_hours ?? defaultPolicy.reschedule.cutoff_hours),
            },
            cancel: {
              customer_cancel_allowed: Boolean(incoming?.cancel?.customer_cancel_allowed ?? defaultPolicy.cancel.customer_cancel_allowed),
              deposit_refundable: Boolean(incoming?.cancel?.deposit_refundable ?? defaultPolicy.cancel.deposit_refundable),
            },
          })
        }
      } catch (e) {
        console.error(e)
        setError('Unable to load booking policy settings.')
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
      const res = await fetch('/api/ecommerce/shop-settings/booking_policy?type=booking', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'booking',
          ...policy,
        }),
      })
      if (!res.ok) throw new Error('Failed to save booking policy settings')
      setMessage('Booking policy settings saved.')
    } catch (e) {
      console.error(e)
      setError('Unable to save booking policy settings.')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 2500)
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">Loading booking policy...</div>
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-semibold text-slate-900 mt-1">Booking Policy</h3>
      <p className="mt-2 text-sm text-slate-500">Configure customer reschedule and cancellation behavior.</p>

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Reschedule Settings</p>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Enable Reschedule</span>
            <input
              type="checkbox"
              checked={policy.reschedule.enabled}
              disabled={!canEdit}
              onChange={(e) =>
                setPolicy((prev) => ({ ...prev, reschedule: { ...prev.reschedule, enabled: e.target.checked } }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-slate-700">Max Reschedule Count</span>
            <input
              type="number"
              min={0}
              value={policy.reschedule.max_changes}
              disabled={!canEdit}
              onChange={(e) =>
                setPolicy((prev) => ({ ...prev, reschedule: { ...prev.reschedule, max_changes: Number(e.target.value) } }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-slate-700">Reschedule Cutoff Hours</span>
            <input
              type="number"
              min={0}
              value={policy.reschedule.cutoff_hours}
              disabled={!canEdit}
              onChange={(e) =>
                setPolicy((prev) => ({ ...prev, reschedule: { ...prev.reschedule, cutoff_hours: Number(e.target.value) } }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Cancel Policy</p>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Allow Customer Cancel</span>
            <input
              type="checkbox"
              checked={policy.cancel.customer_cancel_allowed}
              disabled={!canEdit}
              onChange={(e) =>
                setPolicy((prev) => ({
                  ...prev,
                  cancel: { ...prev.cancel, customer_cancel_allowed: e.target.checked },
                }))
              }
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Deposit Refundable</span>
            <input
              type="checkbox"
              checked={policy.cancel.deposit_refundable}
              disabled={!canEdit}
              onChange={(e) =>
                setPolicy((prev) => ({ ...prev, cancel: { ...prev.cancel, deposit_refundable: e.target.checked } }))
              }
            />
          </label>
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
