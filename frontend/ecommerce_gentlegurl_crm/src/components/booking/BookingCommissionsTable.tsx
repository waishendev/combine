'use client'

import { useEffect, useState } from 'react'

type CommissionRow = {
  id: number
  year: number
  month: number
  total_sales: string | number
  booking_count: number
  tier_percent: string | number
  commission_amount: string | number
  is_overridden: boolean
  override_amount?: string | number | null
  staff?: { id: number; name: string }
}

export default function BookingCommissionsTable() {
  const [rows, setRows] = useState<CommissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/admin/booking/commissions?per_page=100', { cache: 'no-store' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error('Failed')
      const data = Array.isArray(payload?.data?.data) ? payload.data.data : Array.isArray(payload?.data) ? payload.data : []
      setRows(data)
    } catch {
      setRows([])
      setError('Failed to load commissions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const override = async (row: CommissionRow) => {
    const nextAmount = window.prompt('Enter override commission amount', String(row.override_amount ?? row.commission_amount ?? 0))
    if (nextAmount == null) return

    const amount = Number(nextAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Invalid amount.')
      return
    }

    const res = await fetch(`/api/proxy/admin/booking/commissions/${row.id}/override`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_overridden: true, override_amount: amount }),
    })

    if (!res.ok) {
      setError('Failed to override commission.')
      return
    }

    await load()
  }

  return (
    <div className="rounded border bg-white p-4">
      {error ? <p className="text-red-600 text-sm mb-3">{error}</p> : null}
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Staff</th>
            <th className="py-2">Month</th>
            <th className="py-2">Sales</th>
            <th className="py-2">Booking Count</th>
            <th className="py-2">Tier %</th>
            <th className="py-2">Commission</th>
            <th className="py-2">Override Commission</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan={7} className="py-3 text-gray-500">Loading...</td></tr> : null}
          {!loading && rows.length === 0 ? <tr><td colSpan={7} className="py-3 text-gray-500">No records found.</td></tr> : null}
          {!loading && rows.map((row) => (
            <tr className="border-b" key={row.id}>
              <td className="py-2">{row.staff?.name ?? '-'}</td>
              <td className="py-2">{row.year}-{String(row.month).padStart(2, '0')}</td>
              <td className="py-2">{Number(row.total_sales).toFixed(2)}</td>
              <td className="py-2">{row.booking_count}</td>
              <td className="py-2">{Number(row.tier_percent).toFixed(2)}%</td>
              <td className="py-2">{Number(row.commission_amount).toFixed(2)}</td>
              <td className="py-2">
                <button className="text-blue-600" onClick={() => void override(row)}>
                  {row.is_overridden ? 'Edit Override' : 'Override'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
