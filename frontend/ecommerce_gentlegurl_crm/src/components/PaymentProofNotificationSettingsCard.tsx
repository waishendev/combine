'use client'

import { FormEvent, useEffect, useState } from 'react'

type Props = {
  canEdit: boolean
  settingKey: 'booking_payment_proof_notification' | 'ecommerce_payment_proof_notification'
  settingType: 'booking' | 'ecommerce'
  title: string
  description: string
}

type NotificationSetting = {
  enabled: boolean
  email: string
}

const defaultSetting: NotificationSetting = {
  enabled: true,
  email: '',
}

export default function PaymentProofNotificationSettingsCard({
  canEdit,
  settingKey,
  settingType,
  title,
  description,
}: Props) {
  const [setting, setSetting] = useState<NotificationSetting>(defaultSetting)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        setError(null)
        const res = await fetch(`/api/ecommerce/shop-settings?type=${settingType}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch')
        const payload = await res.json()
        const incoming = payload?.data?.[settingKey]
        if (incoming) {
          setSetting({
            enabled: Boolean(incoming.enabled ?? defaultSetting.enabled),
            email: String(incoming.email ?? defaultSetting.email),
          })
        }
      } catch (e) {
        console.error(e)
        setError('Unable to load notification settings.')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [settingKey, settingType])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit) return

    if (setting.enabled && !setting.email.trim()) {
      setError('Please enter an email address to receive notifications.')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch(`/api/ecommerce/shop-settings/${settingKey}?type=${settingType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setting),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        const msg = data?.message || 'Failed to save'
        throw new Error(msg)
      }
      setMessage('Notification settings saved.')
    } catch (e: unknown) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Unable to save notification settings.')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 2500)
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">Loading notification settings...</div>
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-semibold text-slate-900 mt-1">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-700">Enable Notification</span>
              <p className="text-xs text-slate-500 mt-0.5">
                When enabled, the specified email will receive a notification each time a customer uploads or re-uploads a manual transfer payment slip.
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
            <span className="text-sm font-medium text-slate-700">Notification Email</span>
            <p className="text-xs text-slate-500">
              The admin email address that will receive the notification.
            </p>
            <input
              type="email"
              value={setting.email}
              disabled={!canEdit || !setting.enabled}
              onChange={(e) => setSetting((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="admin@example.com"
              className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
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
