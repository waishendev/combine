'use client'

import { useCallback, useEffect, useState } from 'react'

type ClaimHistoryRow = {
  id: number
  claimed_at?: string | null
  product?: string | null
  sku?: string | null
  qty: number
}

const extractRows = <T,>(json: unknown): T[] => {
  if (!json || typeof json !== 'object') return []
  const data = (json as { data?: unknown }).data
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: T[] }).data
  }
  return []
}

export default function StaffConsumableHistoryPageContent() {
  const [rows, setRows] = useState<ClaimHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/admin/staff-consumables/my-history?limit=50', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to load your consumable history.')
      setRows(extractRows<ClaimHistoryRow>(json))
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Unable to load your consumable history.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Staff Consumables</p>
        <h1 className="text-3xl font-semibold text-slate-900">My Consumable History</h1>
        <p className="mt-1 text-sm text-slate-500">Your own staff-free consumable claims. Global staff logs remain under Logs for admins.</p>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date/time</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading your consumable history...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No consumable claims found for your staff account.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-slate-600">{row.claimed_at ?? '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.product ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.sku ?? '-'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{row.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
