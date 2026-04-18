'use client'

import { useEffect, useMemo, useState } from 'react'

import PaginationControls from '@/components/PaginationControls'
import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'

type CommissionType = 'BOOKING' | 'ECOMMERCE'
type LogAction = 'FREEZE' | 'REOPEN' | 'OVERRIDE' | 'RECALCULATE'

type CommissionLogRow = {
  id: number
  staff_monthly_sale_id: number | null
  staff_id: number
  staff_name?: string | null
  type: CommissionType
  year: number
  month: number
  action: LogAction | string
  old_values?: Record<string, unknown> | null
  new_values?: Record<string, unknown> | null
  remarks?: string | null
  performed_by?: number | null
  performed_by_name?: string | null
  created_at: string
}

type PaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type LogsApiResponse = {
  data?: {
    data?: CommissionLogRow[]
    current_page?: number
    last_page?: number
    per_page?: number
    total?: number
  }
}

type StaffOption = {
  id: number
  name: string
}

type FilterValues = {
  type: '' | CommissionType
  staff_id: string
  year: string
  month: string
  action: '' | LogAction
  keyword: string
  from: string
  to: string
}

const EMPTY_FILTERS: FilterValues = {
  type: '',
  staff_id: '',
  year: '',
  month: '',
  action: '',
  keyword: '',
  from: '',
  to: '',
}

const ACTION_BADGE_CLASS: Record<string, string> = {
  FREEZE: 'bg-amber-100 text-amber-800',
  REOPEN: 'bg-emerald-100 text-emerald-800',
  OVERRIDE: 'bg-blue-100 text-blue-800',
  RECALCULATE: 'bg-indigo-100 text-indigo-800',
}

export default function CommissionLogsPage() {
  const [rows, setRows] = useState<CommissionLogRow[]>([])
  const [staffs, setStaffs] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState<CommissionLogRow | null>(null)
  const [inputs, setInputs] = useState<FilterValues>({ ...EMPTY_FILTERS })
  const [filters, setFilters] = useState<FilterValues>({ ...EMPTY_FILTERS })
  const [meta, setMeta] = useState<PaginationMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })

  const loadStaffs = async () => {
    try {
      const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      const staffData = Array.isArray(json?.data) ? (json.data as StaffOption[]) : []
      setStaffs(staffData)
    } catch {
      setStaffs([])
    }
  }

  const buildQuery = () => {
    const qs = new URLSearchParams()
    qs.set('page', String(meta.current_page))
    qs.set('per_page', String(meta.per_page))
    if (filters.type) qs.set('type', filters.type)
    if (filters.staff_id) qs.set('staff_id', filters.staff_id)
    if (filters.year) qs.set('year', filters.year)
    if (filters.month) qs.set('month', filters.month)
    if (filters.action) qs.set('action', filters.action)
    if (filters.keyword) qs.set('keyword', filters.keyword)
    if (filters.from) qs.set('from', filters.from)
    if (filters.to) qs.set('to', filters.to)

    return qs
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proxy/admin/booking/commission-logs?${buildQuery().toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0, last_page: 1 }))
        return
      }

      const json: LogsApiResponse = await res.json().catch(() => ({}))
      const responseData = json?.data
      const responseRows = Array.isArray(responseData?.data) ? responseData.data : []

      setRows(responseRows)
      setMeta((prev) => ({
        current_page: Number(responseData?.current_page ?? prev.current_page) || 1,
        last_page: Number(responseData?.last_page ?? 1) || 1,
        per_page: Number(responseData?.per_page ?? prev.per_page) || prev.per_page,
        total: Number(responseData?.total ?? responseRows.length) || responseRows.length,
      }))
    } catch {
      setRows([])
      setMeta((prev) => ({ ...prev, total: 0, last_page: 1 }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStaffs()
  }, [])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, meta.current_page, meta.per_page])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, index) => currentYear - index)
  const months = Array.from({ length: 12 }, (_, index) => index + 1)
  const monthLabel = (month: number) => String(month).padStart(2, '0')

  const activeFilterBadges = useMemo(() => {
    const badges: Array<{ key: keyof FilterValues; label: string; value: string }> = []
    ;(Object.entries(filters) as Array<[keyof FilterValues, string]>).forEach(([key, value]) => {
      if (!value) return
      const labelMap: Record<keyof FilterValues, string> = {
        type: 'Type',
        staff_id: 'Staff',
        year: 'Year',
        month: 'Month',
        action: 'Action',
        keyword: 'Keyword',
        from: 'From',
        to: 'To',
      }
      let displayValue = value
      if (key === 'staff_id') {
        displayValue = staffs.find((staff) => String(staff.id) === value)?.name ?? value
      }
      badges.push({ key, label: labelMap[key], value: displayValue })
    })

    return badges
  }, [filters, staffs])

  const formatDateTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    return date.toLocaleString()
  }

  const handleFilterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFilters({ ...inputs })
    setMeta((prev) => ({ ...prev, current_page: 1 }))
    setIsFilterOpen(false)
  }

  const handleFilterReset = () => {
    setInputs({ ...EMPTY_FILTERS })
    setFilters({ ...EMPTY_FILTERS })
    setMeta((prev) => ({ ...prev, current_page: 1 }))
    setIsFilterOpen(false)
  }

  const removeBadge = (key: keyof FilterValues) => {
    const next = { ...filters, [key]: '' }
    setFilters(next)
    setInputs(next)
    setMeta((prev) => ({ ...prev, current_page: 1 }))
  }

  return (
    <div className="space-y-6 p-6">
      {isFilterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsFilterOpen(false)} />
          <div className="relative w-full max-w-3xl mx-auto bg-white rounded-lg shadow-lg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold">Filter Commission Logs</h2>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl leading-none" aria-label="Close">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <form onSubmit={handleFilterSubmit}>
              <div className="p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">Type</label>
                    <select value={inputs.type} onChange={(event) => setInputs((prev) => ({ ...prev, type: event.target.value as FilterValues['type'] }))} className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm">
                      <option value="">All Types</option>
                      <option value="BOOKING">BOOKING</option>
                      <option value="ECOMMERCE">ECOMMERCE</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">Staff</label>
                    <select value={inputs.staff_id} onChange={(event) => setInputs((prev) => ({ ...prev, staff_id: event.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm">
                      <option value="">All Staff</option>
                      {staffs.map((staff) => (
                        <option key={staff.id} value={staff.id}>{staff.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">Action</label>
                    <select value={inputs.action} onChange={(event) => setInputs((prev) => ({ ...prev, action: event.target.value as FilterValues['action'] }))} className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm">
                      <option value="">All Actions</option>
                      <option value="FREEZE">FREEZE</option>
                      <option value="REOPEN">REOPEN</option>
                      <option value="OVERRIDE">OVERRIDE</option>
                      <option value="RECALCULATE">RECALCULATE</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">Year</label>
                    <select value={inputs.year} onChange={(event) => setInputs((prev) => ({ ...prev, year: event.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm">
                      <option value="">All Years</option>
                      {years.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">Month</label>
                    <select value={inputs.month} onChange={(event) => setInputs((prev) => ({ ...prev, month: event.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm">
                      <option value="">All Months</option>
                      {months.map((month) => (
                        <option key={month} value={month}>{monthLabel(month)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">Keyword / Remarks</label>
                    <input
                      value={inputs.keyword}
                      onChange={(event) => setInputs((prev) => ({ ...prev, keyword: event.target.value }))}
                      placeholder="Search remarks / action / staff"
                      className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">From</label>
                    <input type="date" value={inputs.from} onChange={(event) => setInputs((prev) => ({ ...prev, from: event.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">To</label>
                    <input type="date" value={inputs.to} onChange={(event) => setInputs((prev) => ({ ...prev, to: event.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3">
                <button type="button" onClick={handleFilterReset} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200">
                  Reset
                </button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50" disabled={loading}>
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailTarget(null)} />
          <div className="relative w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold">Commission Log Details</h2>
              <button type="button" onClick={() => setDetailTarget(null)} className="text-gray-500 hover:text-gray-700 text-2xl leading-none" aria-label="Close">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Old Values</h3>
                <pre className="max-h-80 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                  {JSON.stringify(detailTarget.old_values ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">New Values</h3>
                <pre className="max-h-80 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                  {JSON.stringify(detailTarget.new_values ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Commission Logs</h1>
          <p className="mt-1 text-sm text-slate-500">Track freeze/reopen/override/recalculate actions for commission records.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <i className="fa-solid fa-list-check" />
          <span>{meta.total} {meta.total === 1 ? 'log entry' : 'log entries'}</span>
        </div>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-2">
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
          onClick={() => setIsFilterOpen(true)}
          disabled={loading}
          type="button"
        >
          <i className="fa-solid fa-filter" />
          Filter
        </button>
        <div className="flex items-center gap-3">
          <label htmlFor="pageSize" className="text-sm text-gray-700">Show</label>
          <select
            id="pageSize"
            value={meta.per_page}
            onChange={(event) => setMeta((prev) => ({ ...prev, per_page: Number(event.target.value), current_page: 1 }))}
            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50"
            disabled={loading}
          >
            {[50, 100, 150, 200].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>

      {activeFilterBadges.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterBadges.map((badge) => (
            <span key={badge.key} className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs">
              <span className="font-medium">{badge.label}</span>
              <span>{badge.value}</span>
              <button type="button" onClick={() => removeBadge(badge.key)} className="text-blue-600 hover:text-blue-800" aria-label={`Remove ${badge.label}`}>
                <i className="fa-solid fa-xmark" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Time</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Staff</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Year-Month</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Action</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Performed By</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Remarks</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <TableLoadingRow colSpan={8} />
              ) : rows.length === 0 ? (
                <TableEmptyState colSpan={8} message="No commission logs found." />
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{formatDateTime(row.created_at)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{row.type}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {row.staff_name ?? `#${row.staff_id}`}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{row.year}-{monthLabel(row.month)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${ACTION_BADGE_CLASS[row.action] ?? 'bg-slate-100 text-slate-700'}`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {row.performed_by_name ?? (row.performed_by ? `#${row.performed_by}` : 'System')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 max-w-sm">
                      <div className="line-clamp-2">{row.remarks || '—'}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <button type="button" onClick={() => setDetailTarget(row)} className="text-blue-600 hover:text-blue-800 font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationControls
        currentPage={meta.current_page}
        totalPages={meta.last_page}
        pageSize={meta.per_page}
        onPageChange={(page) => setMeta((prev) => ({ ...prev, current_page: page }))}
        disabled={loading}
      />
    </div>
  )
}
