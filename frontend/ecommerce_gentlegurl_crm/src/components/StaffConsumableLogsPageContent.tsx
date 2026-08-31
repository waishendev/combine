'use client'

import { useCallback, useEffect, useState } from 'react'

import { NameStack, VariantNameStack } from '@/components/NameStack'
import PaginationControls from '@/components/PaginationControls'

type LogRow = {
  id: number
  claimed_at?: string | null
  staff?: string | null
  product?: string | null
  product_cn_name?: string | null
  variant?: string | null
  variant_cn_name?: string | null
  sku?: string | null
  qty: number
  original_price?: number
  line_total_snapshot?: number
  total_price?: number
}

type LogSummary = {
  total_logs: number
  total_qty: number
  total_price: number
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

const EMPTY_SUMMARY: LogSummary = { total_logs: 0, total_qty: 0, total_price: 0 }

const formatCurrency = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0)
  return `RM${(Number.isFinite(numeric) ? numeric : 0).toFixed(2)}`
}

const formatCount = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0)
  return new Intl.NumberFormat('en-MY').format(Number.isFinite(numeric) ? numeric : 0)
}

const rowTotalPrice = (row: LogRow) => {
  const total = Number(row.total_price)
  if (Number.isFinite(total) && total > 0) return total
  const snapshot = Number(row.line_total_snapshot)
  if (Number.isFinite(snapshot) && snapshot > 0) return snapshot
  return Number(row.original_price ?? 0) * Number(row.qty ?? 0)
}

const extractRows = <T,>(json: unknown): T[] => {
  if (!json || typeof json !== 'object') return []
  const data = (json as { data?: unknown }).data
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) return (data as { data: T[] }).data
  return []
}

const PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const

const extractMeta = (json: unknown): Meta => {
  const fallback = { current_page: 1, last_page: 1, per_page: 50, total: 0 }
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

const extractSummary = (json: unknown, totalLogs: number): LogSummary => {
  if (!json || typeof json !== 'object') return { ...EMPTY_SUMMARY, total_logs: totalLogs }
  const data = (json as { data?: unknown }).data
  const source = data && typeof data === 'object' ? (data as { summary?: Partial<LogSummary> }).summary : undefined
  return {
    total_logs: Number(source?.total_logs ?? totalLogs) || 0,
    total_qty: Number(source?.total_qty ?? 0) || 0,
    total_price: Number(source?.total_price ?? 0) || 0,
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
  const [pageSize, setPageSize] = useState(50)
  const [meta, setMeta] = useState<Meta>({ current_page: 1, last_page: 1, per_page: 50, total: 0 })
  const [summary, setSummary] = useState<LogSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/staffs/options/query?per_page=500', { cache: 'no-store' })
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
      const params = new URLSearchParams({ page: String(page), per_page: String(pageSize) })
      if (appliedFilters.dateFrom) params.set('from_date', appliedFilters.dateFrom)
      if (appliedFilters.dateTo) params.set('to_date', appliedFilters.dateTo)
      if (appliedFilters.staffId) params.set('staff_id', appliedFilters.staffId)
      if (appliedFilters.search.trim()) params.set('search', appliedFilters.search.trim())
      const res = await fetch(`/api/proxy/admin/staff-consumables/logs?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to load staff consumable logs.')
      const nextMeta = extractMeta(json)
      setRows(extractRows<LogRow>(json))
      setMeta(nextMeta)
      setSummary(extractSummary(json, nextMeta.total))
    } catch (err) {
      setRows([])
      setMeta((current) => ({ ...current, total: 0, last_page: 1, current_page: 1 }))
      setSummary(EMPTY_SUMMARY)
      setError(err instanceof Error ? err.message : 'Unable to load staff consumable logs.')
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, page, pageSize])

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

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
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

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryCard label="Total qty" value={formatCount(summary.total_qty)} hint="Pieces claimed" accent="blue" />
        <SummaryCard label="Total price" value={formatCurrency(summary.total_price)} hint="Retail value of free claims" accent="emerald" />
      </div>

      <div className="mb-4 flex items-center justify-end gap-3">
        <label htmlFor="staff-consumable-page-size" className="text-sm text-gray-700">
          Show
        </label>
        <select
          id="staff-consumable-page-size"
          value={pageSize}
          onChange={(event) => handlePageSizeChange(Number(event.target.value))}
          className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
          disabled={loading}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date/time</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Total price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading logs...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No staff consumable logs found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3 text-slate-600">{row.claimed_at ?? '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.staff ?? '-'}</td>
                  <td className="px-4 py-3">
                    <NameStack
                      name={row.product}
                      cnName={row.product_cn_name}
                      primaryClassName="font-medium text-slate-800"
                      secondaryClassName="mt-0.5 text-xs text-slate-500"
                      fallback="-"
                    />
                    {row.variant?.trim() || row.variant_cn_name?.trim() ? (
                      <div className="mt-1">
                        <VariantNameStack
                          name={row.variant}
                          cnName={row.variant_cn_name}
                          nameClassName="text-xs text-slate-700"
                          labelClassName="text-xs text-slate-500"
                          cnClassName="text-xs text-slate-500"
                          fallback=""
                        />
                      </div>
                    ) : null}
                    <span className="mt-0.5 block font-mono text-xs text-slate-500">{row.sku ?? '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{row.qty}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(rowTotalPrice(row))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PaginationControls
        currentPage={meta.current_page}
        totalPages={meta.last_page}
        pageSize={meta.per_page}
        onPageChange={setPage}
        disabled={loading}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint: string
  accent: 'blue' | 'emerald'
}) {
  const accentClass = {
    blue: 'from-blue-50 to-blue-100/40 border-blue-200 text-blue-900',
    emerald: 'from-emerald-50 to-emerald-100/40 border-emerald-200 text-emerald-900',
  }[accent]

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${accentClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs opacity-70">{hint}</div>
    </div>
  )
}
