'use client'

import { useCallback, useEffect, useState } from 'react'

type LogRow = {
  id: number
  claimed_at?: string | null
  staff?: string | null
  product?: string | null
  sku?: string | null
  qty: number
  original_price: number
  final_amount: number
  order_number?: string | null
  reference_no?: string | null
}

type StaffOption = {
  id: number
  name: string
}

export type StaffConsumableLogInitialFilters = {
  staffId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

const formatCurrency = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0)
  return `RM${(Number.isFinite(numeric) ? numeric : 0).toFixed(2)}`
}

const extractRows = <T,>(json: unknown): T[] => {
  if (!json || typeof json !== 'object') return []
  const data = (json as { data?: unknown }).data
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) return (data as { data: T[] }).data
  return []
}

const extractMeta = (json: unknown): Meta => {
  const fallback = { current_page: 1, last_page: 1, per_page: 20, total: 0 }
  if (!json || typeof json !== 'object') return fallback
  const data = (json as { data?: unknown }).data
  const source = data && typeof data === 'object' ? data as Partial<Meta> : {}
  return {
    current_page: Number(source.current_page ?? fallback.current_page) || fallback.current_page,
    last_page: Number(source.last_page ?? fallback.last_page) || fallback.last_page,
    per_page: Number(source.per_page ?? fallback.per_page) || fallback.per_page,
    total: Number(source.total ?? fallback.total) || fallback.total,
  }
}

export default function StaffConsumableLogsPageContent({ initialFilters = {} }: { initialFilters?: StaffConsumableLogInitialFilters }) {
  const [rows, setRows] = useState<LogRow[]>([])
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom ?? '')
  const [dateTo, setDateTo] = useState(initialFilters.dateTo ?? '')
  const [staffId, setStaffId] = useState(initialFilters.staffId ?? '')
  const [search, setSearch] = useState(initialFilters.search ?? '')
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: initialFilters.dateFrom ?? '',
    dateTo: initialFilters.dateTo ?? '',
    staffId: initialFilters.staffId ?? '',
    search: initialFilters.search ?? '',
  })
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<Meta>({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/staffs?per_page=100', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      const raw = extractRows<{ id?: number; name?: string }>(json)
      setStaffOptions(raw.map((item) => ({ id: Number(item.id), name: String(item.name ?? `Staff #${item.id}`) })).filter((item) => Number.isFinite(item.id)))
    } catch {
      setStaffOptions([])
    }
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '20' })
      if (appliedFilters.dateFrom) params.set('from_date', appliedFilters.dateFrom)
      if (appliedFilters.dateTo) params.set('to_date', appliedFilters.dateTo)
      if (appliedFilters.staffId) params.set('staff_id', appliedFilters.staffId)
      if (appliedFilters.search.trim()) params.set('search', appliedFilters.search.trim())
      const res = await fetch(`/api/proxy/admin/staff-consumables/logs?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to load staff consumable logs.')
      setRows(extractRows<LogRow>(json))
      setMeta(extractMeta(json))
    } catch (err) {
      setRows([])
      setMeta((current) => ({ ...current, total: 0, last_page: 1, current_page: 1 }))
      setError(err instanceof Error ? err.message : 'Unable to load staff consumable logs.')
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, page])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const applyFilters = () => {
    setPage(1)
    setAppliedFilters({ dateFrom, dateTo, staffId, search })
  }

  const resetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setStaffId('')
    setSearch('')
    setPage(1)
    setAppliedFilters({ dateFrom: '', dateTo: '', staffId: '', search: '' })
  }

  const clearStaffFilter = () => {
    setStaffId('')
    setPage(1)
    setAppliedFilters((current) => ({ ...current, staffId: '' }))
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Logs</p>
        <h1 className="text-3xl font-semibold text-slate-900">Staff Consumable Logs</h1>
        <p className="mt-1 text-sm text-slate-500">Audit trail for staff-free consumable claims. These are RM0 internal claims, not normal customer sales.</p>
        {appliedFilters.staffId ? (
          <button
            type="button"
            onClick={clearStaffFilter}
            className="mt-3 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Clear staff filter
          </button>
        ) : null}
      </div>

      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Date from</label>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Date to</label>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Staff</label>
            <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">All staff</option>
              {staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Product / search</label>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product, SKU, staff, order no" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <button type="button" onClick={applyFilters} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Filter</button>
            <button type="button" onClick={resetFilters} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Reset</button>
          </div>
        </div>
      </section>

      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date/time</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-left">Qty</th>
                <th className="px-4 py-3 text-left">Original price</th>
                <th className="px-4 py-3 text-left">Final amount</th>
                <th className="px-4 py-3 text-left">Reference no</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading logs...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No staff consumable logs found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3 text-slate-600">{row.claimed_at ?? '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.staff ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className="block font-medium text-slate-800">{row.product ?? '-'}</span>
                    <span className="mt-0.5 block font-mono text-xs text-slate-500">{row.sku ?? '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-left text-slate-700">{row.qty}</td>
                  <td className="px-4 py-3 text-left text-slate-700">{formatCurrency(row.original_price)}</td>
                  <td className="px-4 py-3 text-left font-bold text-emerald-700">{formatCurrency(row.final_amount)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 text-left">{row.reference_no ?? row.order_number ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <span>Total logs: {meta.total}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50">Previous</button>
            <span>Page {meta.current_page} / {meta.last_page}</span>
            <button type="button" disabled={page >= meta.last_page || loading} onClick={() => setPage((current) => current + 1)} className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      </section>
    </div>
  )
}
