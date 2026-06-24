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

export default function BookingSettingsPage() {
  const [form, setForm] = useState<BookingVoucherSetting>(initialForm)
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(0)

  useEffect(() => {
    fetch('/api/proxy/admin/booking/settings/notified-cancellation-voucher', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setForm(j.data ?? initialForm))

    fetch('/api/ecommerce/shop-settings/booking_max_advance_days?type=booking', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setMaxAdvanceDays(Number(j.data?.value ?? 0)))
      .catch(() => setMaxAdvanceDays(0))
  }, [])

  const save = async () => {
    await Promise.all([
      fetch('/api/proxy/admin/booking/settings/notified-cancellation-voucher', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }),
      fetch('/api/ecommerce/shop-settings/booking_max_advance_days?type=booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: maxAdvanceDays }),
      }),
    ])
    alert('Saved')
  }

  return <div className="space-y-5 p-4"><h1 className="text-xl font-semibold">Booking Settings</h1>
    <section className="space-y-2 rounded border bg-white p-4">
      <h2 className="font-semibold">Customer Booking Limits</h2>
      <label className="block">Maximum Advance Booking Days
        <input
          className="ml-2 border px-2 py-1"
          type="number"
          min={0}
          value={maxAdvanceDays}
          onChange={(e) => setMaxAdvanceDays(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>
      <p className="text-sm text-slate-500">Customers can book from today through today + this number of days. Use 0 for no advance limit.</p>
    </section>

    <section className="space-y-3 rounded border bg-white p-4">
      <h2 className="font-semibold">Booking Voucher Settings</h2>
      <label className="block">Enabled <input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /></label>
      <label className="block">Type <select value={form.reward_type} onChange={(e) => setForm({ ...form, reward_type: e.target.value as 'PERCENT' | 'FIXED' })}><option>PERCENT</option><option>FIXED</option></select></label>
      <label className="block">Value <input className="border" value={form.reward_value ?? ''} onChange={(e) => setForm({ ...form, reward_value: Number(e.target.value) })} /></label>
      <label className="block">Expiry days <input className="border" value={form.expiry_days ?? ''} onChange={(e) => setForm({ ...form, expiry_days: Number(e.target.value) })} /></label>
    </section>
    <button onClick={save} className="rounded bg-black px-3 py-1 text-white">Save</button>
  </div>
}
