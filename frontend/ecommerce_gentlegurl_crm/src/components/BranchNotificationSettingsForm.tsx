'use client'

import { FormEvent, useEffect, useState } from 'react'

import { useBranch } from '@/contexts/BranchContext'
import {
  getBranchNotificationSettings,
  saveBranchNotificationSettings,
  type BranchNotificationSettings,
} from '@/lib/branchNotificationSettings'

const parseRecipients = (value: string) => [
  ...new Set(value.split(/[\n,]+/).map((email) => email.trim().toLowerCase()).filter(Boolean)),
]

type BooleanKey = 'booking_reminder_enabled' | 'booking_feedback_enabled' | 'booking_payment_proof_enabled' | 'daily_order_summary_enabled' | 'daily_low_stock_enabled'
type TimeKey = 'booking_reminder_send_at' | 'booking_feedback_send_at' | 'daily_order_summary_send_at' | 'daily_low_stock_send_at'
type RecipientKey = 'booking_payment_proof_recipients' | 'daily_order_summary_recipients' | 'daily_low_stock_recipients'

type SettingCardProps = {
  title: string
  description: string
  enabled: boolean
  enabledLabel: string
  canEdit: boolean
  onEnabledChange: (enabled: boolean) => void
  sendAt?: string
  onSendAtChange?: (value: string) => void
  recipients?: string[]
  onRecipientsChange?: (recipients: string[]) => void
}

function SettingCard({
  title,
  description,
  enabled,
  enabledLabel,
  canEdit,
  onEnabledChange,
  sendAt,
  onSendAtChange,
  recipients,
  onRecipientsChange,
}: SettingCardProps) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>

      <label className="flex items-center justify-between gap-4">
        <div>
          <span className="text-sm font-medium text-slate-700">{enabledLabel}</span>
          <p className="mt-0.5 text-xs text-slate-500">Turn this setting on or off for the selected Branch.</p>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!canEdit}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
        />
      </label>

      {sendAt !== undefined && onSendAtChange ? (
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Send Time</span>
          <p className="text-xs text-slate-500">Uses the application timezone and runs independently for this Branch.</p>
          <input
            type="time"
            value={sendAt}
            disabled={!canEdit || !enabled}
            onChange={(event) => onSendAtChange(event.target.value)}
            className="w-full max-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
      ) : null}

      {recipients !== undefined && onRecipientsChange ? (
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Recipients</span>
          <p className="text-xs text-slate-500">Enter one email per line, or separate multiple emails with commas.</p>
          <textarea
            rows={3}
            value={recipients.join('\n')}
            disabled={!canEdit || !enabled}
            onChange={(event) => onRecipientsChange(parseRecipients(event.target.value))}
            placeholder="notifications@example.com"
            className="w-full max-w-2xl resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
      ) : null}
    </div>
  )
}

export default function BranchNotificationSettingsForm({ canEdit }: { canEdit: boolean }) {
  const { selectedBranchId, selectedBranch, loading: branchLoading } = useBranch()
  const [form, setForm] = useState<BranchNotificationSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setForm(null)
    setMessage(null)
    setError(null)

    if (!selectedBranchId) {
      setLoading(false)
      return () => controller.abort()
    }

    setLoading(true)
    getBranchNotificationSettings(selectedBranchId, controller.signal)
      .then((response) => {
        if (response.data) setForm(response.data)
        else setError(response.message || 'Settings are not initialized for this Branch.')
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load notification settings.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [selectedBranchId])

  const setBoolean = (key: BooleanKey, value: boolean) => setForm((current) => current ? { ...current, [key]: value } : current)
  const setTime = (key: TimeKey, value: string) => setForm((current) => current ? { ...current, [key]: value } : current)
  const setRecipients = (key: RecipientKey, value: string[]) => setForm((current) => current ? { ...current, [key]: value } : current)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit || !selectedBranchId || !form) return

    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const response = await saveBranchNotificationSettings(selectedBranchId, form)
      if (response.data) setForm(response.data)
      setMessage(response.message || 'Branch email and notification settings saved.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save notification settings.')
    } finally {
      setSaving(false)
    }
  }

  if (branchLoading || loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading email and notification settings...</div>
  }

  if (!selectedBranchId || !selectedBranch) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        Select a specific Branch in the Header to view its settings. All Branches cannot own operational notification settings.
      </div>
    )
  }

  if (!form) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error || 'Settings are not initialized for this Branch.'}</div>
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Selected Branch</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{selectedBranch.name}</p>
        <p className="mt-2 text-sm text-blue-900">
          Email sender settings are managed globally. Branch-specific settings on this page control booking schedules and operational notification recipients.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Booking Emails</h2>
        <p className="mt-2 text-sm text-slate-500">Control scheduled customer emails for appointments at {selectedBranch.name}.</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SettingCard title="Booking Reminder" description="Sent to customers the day before a confirmed appointment." enabled={form.booking_reminder_enabled} enabledLabel="Enable Reminder Email" canEdit={canEdit} onEnabledChange={(value) => setBoolean('booking_reminder_enabled', value)} sendAt={form.booking_reminder_send_at} onSendAtChange={(value) => setTime('booking_reminder_send_at', value)} />
          <SettingCard title="Booking Feedback" description="Sent to customers the day after an appointment is completed." enabled={form.booking_feedback_enabled} enabledLabel="Enable Feedback Email" canEdit={canEdit} onEnabledChange={(value) => setBoolean('booking_feedback_enabled', value)} sendAt={form.booking_feedback_send_at} onSendAtChange={(value) => setTime('booking_feedback_send_at', value)} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Internal Notifications</h2>
        <p className="mt-2 text-sm text-slate-500">Choose which operational alerts are sent and who receives them for this Branch.</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SettingCard title="Booking Payment Proof" description="Notifies the configured recipients when a booking payment proof is uploaded or re-uploaded." enabled={form.booking_payment_proof_enabled} enabledLabel="Enable Payment Proof Notification" canEdit={canEdit} onEnabledChange={(value) => setBoolean('booking_payment_proof_enabled', value)} recipients={form.booking_payment_proof_recipients} onRecipientsChange={(value) => setRecipients('booking_payment_proof_recipients', value)} />
          <SettingCard title="Daily Order Summary" description="Summarizes pending Branch bookings and Ecommerce fulfilment participation." enabled={form.daily_order_summary_enabled} enabledLabel="Enable Daily Summary" canEdit={canEdit} onEnabledChange={(value) => setBoolean('daily_order_summary_enabled', value)} sendAt={form.daily_order_summary_send_at} onSendAtChange={(value) => setTime('daily_order_summary_send_at', value)} recipients={form.daily_order_summary_recipients} onRecipientsChange={(value) => setRecipients('daily_order_summary_recipients', value)} />
          <SettingCard title="Daily Low Stock" description="Contains only low-stock inventory rows belonging to this Branch." enabled={form.daily_low_stock_enabled} enabledLabel="Enable Low Stock Notification" canEdit={canEdit} onEnabledChange={(value) => setBoolean('daily_low_stock_enabled', value)} sendAt={form.daily_low_stock_send_at} onSendAtChange={(value) => setTime('daily_low_stock_send_at', value)} recipients={form.daily_low_stock_recipients} onRecipientsChange={(value) => setRecipients('daily_low_stock_recipients', value)} />
        </div>
      </section>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <div className="flex justify-end">
        <button type="submit" disabled={!canEdit || saving} className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
