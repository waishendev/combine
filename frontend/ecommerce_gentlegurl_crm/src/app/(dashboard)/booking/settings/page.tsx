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

  useEffect(() => {
    fetch('/api/proxy/admin/booking/settings/notified-cancellation-voucher', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setForm(j.data ?? initialForm))
  }, [])

  const save = async () => {
    await fetch('/api/proxy/admin/booking/settings/notified-cancellation-voucher', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    alert('Saved')
  }

  return <div className="space-y-3 p-4"><h1 className="text-xl font-semibold">Booking Voucher Settings</h1>
    <label className="block">Enabled <input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /></label>
    <label className="block">Type <select value={form.reward_type} onChange={(e) => setForm({ ...form, reward_type: e.target.value as 'PERCENT' | 'FIXED' })}><option>PERCENT</option><option>FIXED</option></select></label>
    <label className="block">Value <input className="border" value={form.reward_value ?? ''} onChange={(e) => setForm({ ...form, reward_value: Number(e.target.value) })} /></label>
    <label className="block">Expiry days <input className="border" value={form.expiry_days ?? ''} onChange={(e) => setForm({ ...form, expiry_days: Number(e.target.value) })} /></label>
    <button onClick={save} className="rounded bg-black px-3 py-1 text-white">Save</button>
  </div>
}
