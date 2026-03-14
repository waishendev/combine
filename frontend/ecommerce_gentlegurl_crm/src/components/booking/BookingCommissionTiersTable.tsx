'use client'

import { useEffect, useState } from 'react'

type Tier = {
  id: number
  min_sales: string | number
  commission_percent: string | number
}

export default function BookingCommissionTiersTable() {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ min_sales: '0', commission_percent: '0' })
  const [editingId, setEditingId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/admin/booking/commission-tiers', { cache: 'no-store' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error('Failed')
      const data = Array.isArray(payload?.data) ? payload.data : []
      setTiers(data)
    } catch {
      setError('Failed to load commission tiers.')
      setTiers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const save = async () => {
    setError(null)
    const minSales = Number(form.min_sales)
    const percent = Number(form.commission_percent)
    if (!Number.isFinite(minSales) || minSales < 0 || !Number.isFinite(percent) || percent < 0) {
      setError('Please enter valid values.')
      return
    }

    const url = editingId
      ? `/api/proxy/admin/booking/commission-tiers/${editingId}`
      : '/api/proxy/admin/booking/commission-tiers'

    const method = editingId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ min_sales: minSales, commission_percent: percent }),
    })

    if (!res.ok) {
      setError('Failed to save tier.')
      return
    }

    setForm({ min_sales: '0', commission_percent: '0' })
    setEditingId(null)
    await load()
  }

  const remove = async (id: number) => {
    if (!window.confirm('Delete this tier?')) return
    const res = await fetch(`/api/proxy/admin/booking/commission-tiers/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('Failed to delete tier.')
      return
    }
    await load()
  }

  return (
    <div className="rounded border bg-white p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <input className="border rounded px-3 py-2" placeholder="Min Sales" value={form.min_sales} onChange={(e) => setForm((p) => ({ ...p, min_sales: e.target.value }))} />
        <input className="border rounded px-3 py-2" placeholder="Commission %" value={form.commission_percent} onChange={(e) => setForm((p) => ({ ...p, commission_percent: e.target.value }))} />
        <button className="bg-black text-white rounded px-4 py-2" onClick={() => void save()}>{editingId ? 'Update Tier' : 'Create Tier'}</button>
        {editingId ? <button className="border rounded px-4 py-2" onClick={() => { setEditingId(null); setForm({ min_sales: '0', commission_percent: '0' }) }}>Cancel</button> : null}
      </div>
      {error ? <p className="text-red-600 text-sm mb-3">{error}</p> : null}
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Min Sales</th>
            <th className="py-2">Commission %</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan={3} className="py-3 text-gray-500">Loading...</td></tr> : null}
          {!loading && tiers.length === 0 ? <tr><td colSpan={3} className="py-3 text-gray-500">No tiers found.</td></tr> : null}
          {!loading && tiers.map((tier) => (
            <tr key={tier.id} className="border-b">
              <td className="py-2">{Number(tier.min_sales).toFixed(2)}</td>
              <td className="py-2">{Number(tier.commission_percent).toFixed(2)}%</td>
              <td className="py-2 flex gap-2">
                <button className="text-blue-600" onClick={() => { setEditingId(tier.id); setForm({ min_sales: String(tier.min_sales), commission_percent: String(tier.commission_percent) }) }}>Edit</button>
                <button className="text-red-600" onClick={() => void remove(tier.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
