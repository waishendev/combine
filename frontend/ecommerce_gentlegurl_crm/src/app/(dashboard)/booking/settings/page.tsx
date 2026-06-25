'use client'

import { useEffect, useState } from 'react'

type BookingVoucherSetting = {
  enabled: boolean
  reward_type: 'PERCENT' | 'FIXED'
  reward_value: number
  base_amount_source: 'DEPOSIT' | 'SERVICE_PRICE'
  expiry_days: number
  non_combinable: boolean
  min_spend?: number | null
  usage_limit?: number | null
}

const initialForm: BookingVoucherSetting = {
  enabled: false,
  reward_type: 'PERCENT',
  reward_value: 10,
  base_amount_source: 'DEPOSIT',
  expiry_days: 45,
  non_combinable: true,
  usage_limit: 1,
}

const DEFAULT_MAX_ADVANCE_DAYS = 365

export default function BookingSettingsPage() {
  const [form, setForm] = useState<BookingVoucherSetting>(initialForm)
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(DEFAULT_MAX_ADVANCE_DAYS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/proxy/admin/booking/settings/notified-cancellation-voucher', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setForm(j.data ?? initialForm))

    fetch('/api/proxy/ecommerce/shop-settings/booking_max_advance_days?type=booking', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const value = Number(j.data?.value ?? DEFAULT_MAX_ADVANCE_DAYS)
        setMaxAdvanceDays(Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_MAX_ADVANCE_DAYS)
      })
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        fetch('/api/proxy/admin/booking/settings/notified-cancellation-voucher', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }),
        fetch('/api/proxy/ecommerce/shop-settings/booking_max_advance_days?type=booking', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: maxAdvanceDays }),
        }),
      ])
      alert('Saved')
    } finally {
      setSaving(false)
    }
  }

  return <div className="space-y-6 p-4">
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h1 className="text-xl font-semibold">Booking Settings</h1>
      <label className="block max-w-sm">
        <span className="block text-sm font-medium text-slate-700">Maximum Advance Booking Days</span>
        <input
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          type="number"
          min={0}
          max={3650}
          value={maxAdvanceDays}
          onChange={(e) => setMaxAdvanceDays(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        />
        <span className="mt-1 block text-xs text-slate-500">
          Customers on the Booking Website can book from today up to this many days ahead. Staff/admin manual bookings are not restricted.
        </span>
      </label>
    </section>

    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-xl font-semibold">Booking Voucher Settings</h2>
      <label className="block">Enabled <input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /></label>
      <label className="block">Type <select value={form.reward_type} onChange={(e) => setForm({ ...form, reward_type: e.target.value as 'PERCENT' | 'FIXED' })}><option>PERCENT</option><option>FIXED</option></select></label>
      <label className="block">Value <input className="border" value={form.reward_value ?? ''} onChange={(e) => setForm({ ...form, reward_value: Number(e.target.value) })} /></label>
      <label className="block">Expiry days <input className="border" value={form.expiry_days ?? ''} onChange={(e) => setForm({ ...form, expiry_days: Number(e.target.value) })} /></label>
    </section>

    <button disabled={saving} onClick={save} className="rounded bg-black px-3 py-1 text-white disabled:opacity-50">
      {saving ? 'Saving…' : 'Save'}
    </button>
  </div>
}
