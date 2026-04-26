'use client'

import { FormEvent, useEffect, useState } from 'react'

type Props = {
  canEdit: boolean
}

type ReminderSetting = {
  enabled: boolean
  send_at: string
}

const defaultSetting: ReminderSetting = {
  enabled: true,
  send_at: '10:00',
}

export default function BookingReminderEmailSettingsCard({ canEdit }: Props) {
  const [setting, setSetting] = useState<ReminderSetting>(defaultSetting)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        setError(null)
        const res = await fetch('/api/ecommerce/shop-settings?type=booking', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch')
        const payload = await res.json()
        const incoming = payload?.data?.booking_reminder_email
        if (incoming) {
          setSetting({
            enabled: Boolean(incoming.enabled ?? defaultSetting.enabled),
            send_at: String(incoming.send_at ?? defaultSetting.send_at),
          })
        }
      } catch (e) {
        console.error(e)
        setError('Unable to load booking reminder settings.')
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
      const res = await fetch('/api/ecommerce/shop-settings/booking_reminder_email?type=booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setting),
      })
      if (!res.ok) throw new Error('Failed to save')
      setMessage('Reminder email settings saved.')
    } catch (e) {
      console.error(e)
      setError('Unable to save reminder email settings.')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 2500)
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">Loading reminder email settings...</div>
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-semibold text-slate-900 mt-1">Booking Reminder Email</h3>
      <p className="mt-2 text-sm text-slate-500">
        Send a reminder email to customers the day before their scheduled appointment.
      </p>

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-700">Enable Reminder Email</span>
              <p className="text-xs text-slate-500 mt-0.5">
                When enabled, customers with confirmed bookings for the next day will receive a reminder email.
              </p>
            </div>
            <input
              type="checkbox"
              checked={setting.enabled}
              disabled={!canEdit}
              onChange={(e) => setSetting((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Send At</span>
            <p className="text-xs text-slate-500">
              Choose the time of day when reminder emails are sent (the day before the appointment).
            </p>
            <input
              type="time"
              value={setting.send_at}
              disabled={!canEdit || !setting.enabled}
              onChange={(e) => setSetting((prev) => ({ ...prev, send_at: e.target.value }))}
              className="w-full max-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
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
