'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type CashShiftRow = {
  id: number
  opening_amount: number
  opened_by_name?: string | null
  opened_staff_name?: string | null
  opened_at?: string | null
  closing_amount?: number | null
  closed_by_name?: string | null
  closed_staff_name?: string | null
  closed_at?: string | null
  status: 'OPEN' | 'CLOSED'
  remark?: string | null
  cash_sales: number
  expected_cash: number
  difference?: number | null
}

const currency = (value: number | null | undefined) => `RM ${Number(value ?? 0).toFixed(2)}`
const formatDateTime = (value?: string | null) => (value ? new Date(value.replace(' ', 'T')).toLocaleString() : '—')
const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : '—')

function defaultDateRange() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
  return { from: local, to: local }
}

export default function CashShiftReportPage() {
  const defaults = useMemo(() => defaultDateRange(), [])
  const [filters, setFilters] = useState({ date_from: defaults.from, date_to: defaults.to, status: '', staff_id: '', user_id: '' })
  const [rows, setRows] = useState<CashShiftRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)

  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ page: String(targetPage), per_page: '20' })
      if (filters.date_from) qs.set('date_from', filters.date_from)
      if (filters.date_to) qs.set('date_to', filters.date_to)
      if (filters.status) qs.set('status', filters.status)
      if (filters.staff_id) qs.set('staff_id', filters.staff_id)
      if (filters.user_id) qs.set('user_id', filters.user_id)

      const res = await fetch(`/api/proxy/ecommerce/reports/cash-shifts?${qs.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to load cash shift report.')

      const payload = json?.data ?? {}
      setRows(Array.isArray(payload.data) ? payload.data : [])
      setPage(Number(payload.current_page ?? targetPage))
      setLastPage(Number(payload.last_page ?? 1))
      setTotal(Number(payload.total ?? 0))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load cash shift report.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void loadData(1)
  }, [loadData])

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-6">
          <label className="text-sm font-semibold text-gray-700">
            Date From
            <input type="date" value={filters.date_from} onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Date To
            <input type="date" value={filters.date_to} onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Status
            <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3">
              <option value="">All</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Staff ID
            <input type="number" min="1" value={filters.staff_id} onChange={(e) => setFilters((p) => ({ ...p, staff_id: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" placeholder="Optional staff ID" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Account/User ID
            <input type="number" min="1" value={filters.user_id} onChange={(e) => setFilters((p) => ({ ...p, user_id: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" placeholder="Optional user ID" />
          </label>
          <div className="flex items-end">
            <button type="button" onClick={() => void loadData(1)} disabled={loading} className="h-10 w-full rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Loading…' : 'Apply Filters'}
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
              <tr>
                {['Date', 'Opened Staff', 'Closed Staff', 'Opened By Account', 'Closed By Account', 'Opening Amount', 'Cash Sales', 'Expected Cash', 'Closing Amount', 'Difference', 'Status', 'Opened At', 'Closed At', 'Remark'].map((heading) => (
                  <th key={heading} className="whitespace-nowrap px-4 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(row.opened_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.opened_staff_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.closed_staff_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.opened_by_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.closed_by_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{currency(row.opening_amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{currency(row.cash_sales)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{currency(row.expected_cash)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.closing_amount == null ? '—' : currency(row.closing_amount)}</td>
                  <td className={`whitespace-nowrap px-4 py-3 font-semibold ${Number(row.difference ?? 0) < 0 ? 'text-red-600' : Number(row.difference ?? 0) > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{row.difference == null ? '—' : currency(row.difference)}</td>
                  <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>{row.status}</span></td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(row.opened_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(row.closed_at)}</td>
                  <td className="min-w-48 px-4 py-3">{row.remark || '—'}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr><td colSpan={14} className="px-4 py-10 text-center text-gray-500">No cash shifts found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
          <span>Total: {total}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadData(Math.max(1, page - 1))} disabled={loading || page <= 1} className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold disabled:opacity-50">Previous</button>
            <span>Page {page} / {lastPage}</span>
            <button type="button" onClick={() => void loadData(Math.min(lastPage, page + 1))} disabled={loading || page >= lastPage} className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}
