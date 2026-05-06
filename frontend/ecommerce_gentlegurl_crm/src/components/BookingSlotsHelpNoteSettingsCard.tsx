'use client'

import { FormEvent, useEffect, useState } from 'react'

type Props = {
  canEdit: boolean
}

type SlotsHelpNoteSetting = {
  enabled: boolean
  text: string
}

const defaultSetting: SlotsHelpNoteSetting = {
  enabled: false,
  text: '',
}

export default function BookingSlotsHelpNoteSettingsCard({ canEdit }: Props) {
  const [setting, setSetting] = useState<SlotsHelpNoteSetting>(defaultSetting)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        setError(null)
        const res = await fetch('/api/ecommerce/shop-settings?type=booking', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch booking slots help note settings')
        const payload = await res.json()
        setSetting({
          enabled: Boolean(payload?.data?.booking_slots_help_note_enabled ?? defaultSetting.enabled),
          text: String(payload?.data?.booking_slots_help_note_text ?? defaultSetting.text),
        })
      } catch (e) {
        console.error(e)
        setError('Unable to load booking slots help note settings.')
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
      const [enabledRes, textRes] = await Promise.all([
        fetch('/api/ecommerce/shop-settings/booking_slots_help_note_enabled?type=booking', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'booking', value: setting.enabled }),
        }),
        fetch('/api/ecommerce/shop-settings/booking_slots_help_note_text?type=booking', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'booking', value: setting.text }),
        }),
      ])

      if (!enabledRes.ok || !textRes.ok) throw new Error('Failed to save booking slots help note settings')
      setMessage('Booking slots help note settings saved.')
    } catch (e) {
      console.error(e)
      setError('Unable to save booking slots help note settings.')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 2500)
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">Loading booking slots help note settings...</div>
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-semibold text-slate-900 mt-1">Booking Slots Help Note</h3>
      <p className="mt-2 text-sm text-slate-500">Configure the customer help note shown at the bottom of the booking slots page.</p>

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-slate-700">Enable Slots Help Note</span>
              <p className="text-xs text-slate-500 mt-0.5">Show a help note under the available slots or no-slots card.</p>
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
            <span className="text-sm font-medium text-slate-700">Slots Help Note</span>
            <textarea
              rows={5}
              value={setting.text}
              disabled={!canEdit}
              onChange={(event) => setSetting((prev) => ({ ...prev, text: event.target.value }))}
              placeholder="Leave empty to hide note text even when enabled."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
