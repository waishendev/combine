'use client'

import { useEffect, useMemo, useState } from 'react'

type ActionType = 'created' | 'approved' | 'rejected' | 'cancelled' | 'adjusted'

type LeaveLogRow = {
  id: number
  created_at: string
  staff_id: number
  leave_request_id: number | null
  action_type: ActionType
  remark: string | null
  before_value: unknown
  after_value: unknown
  staff?: { id: number; name: string }
  creator?: { id: number; name: string }
}

type StaffOption = { staff_id: number; staff_name: string }

type PaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

const ACTION_LABEL: Record<ActionType, string> = {
  created: 'Created',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  adjusted: 'Adjusted',
}

const ACTION_BADGE: Record<ActionType, string> = {
  created: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-amber-100 text-amber-700',
  adjusted: 'bg-violet-100 text-violet-700',
}

const readNumberField = (value: unknown, key: string): number | null => {
  if (!value || typeof value !== 'object') return null
  const v = (value as Record<string, unknown>)[key]
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

const getAdjustedLabelAndBadge = (row: LeaveLogRow): { label: string; badge: string } => {
  if (row.action_type !== 'adjusted') {
    return { label: ACTION_LABEL[row.action_type], badge: ACTION_BADGE[row.action_type] }
  }

  // Try to infer direction from before/after entitled days
  const beforeEntitled = readNumberField(row.before_value, 'entitled_days')
  const afterEntitled = readNumberField(row.after_value, 'entitled_days')
  if (beforeEntitled != null && afterEntitled != null) {
    const delta = afterEntitled - beforeEntitled
    if (delta > 0) return { label: 'ADD', badge: 'bg-emerald-100 text-emerald-700' }
    if (delta < 0) return { label: 'REDUCE', badge: 'bg-rose-100 text-rose-700' }
  }

  return { label: 'ADJUST', badge: ACTION_BADGE.adjusted }
}

const extractPaginated = (payload: unknown): { rows: LeaveLogRow[]; meta: PaginationMeta } => {
  const emptyMeta = { current_page: 1, last_page: 1, per_page: 20, total: 0 }
  if (!payload || typeof payload !== 'object') return { rows: [], meta: emptyMeta }

  const root = payload as { data?: unknown }
  if (!root.data || typeof root.data !== 'object') return { rows: [], meta: emptyMeta }

  const p = root.data as { data?: unknown; current_page?: number; last_page?: number; per_page?: number; total?: number }
  const rows = Array.isArray(p.data) ? (p.data as LeaveLogRow[]) : []

  return {
    rows,
    meta: {
      current_page: Number(p.current_page ?? 1),
      last_page: Number(p.last_page ?? 1),
      per_page: Number(p.per_page ?? 20),
      total: Number(p.total ?? rows.length),
    },
  }
}

const extractStaffOptions = (payload: unknown): StaffOption[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (!Array.isArray(root.data)) return []
  return root.data
    .map((r) => {
      if (!r || typeof r !== 'object') return null
      const row = r as { staff_id?: number; staff_name?: string }
      if (!row.staff_id || !row.staff_name) return null
      return { staff_id: row.staff_id, staff_name: row.staff_name }
    })
    .filter((v): v is StaffOption => Boolean(v))
}

export default function BookingLeaveLogsPage() {
  const [rows, setRows] = useState<LeaveLogRow[]>([])
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [staffId, setStaffId] = useState('')
  const [actionType, setActionType] = useState<ActionType | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<PaginationMeta>({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [detailsRow, setDetailsRow] = useState<LeaveLogRow | null>(null)

  const loadStaffOptions = async () => {
    const res = await fetch('/api/proxy/admin/booking/leave-balances', { cache: 'no-store' })
    if (!res.ok) return
    const payload = await res.json().catch(() => ({}))
    setStaffOptions(extractStaffOptions(payload))
  }

  const loadRows = async () => {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('per_page', '20')
    if (staffId) qs.set('staff_id', staffId)
    if (actionType) qs.set('action_type', actionType)
    if (fromDate) qs.set('from_date', fromDate)
    if (toDate) qs.set('to_date', toDate)

    const res = await fetch(`/api/proxy/admin/booking/leave-logs?${qs.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      setError('Failed to load leave logs.')
      return
    }

    setError(null)
    const payload = await res.json().catch(() => ({}))
    const parsed = extractPaginated(payload)
    setRows(parsed.rows)
    setMeta(parsed.meta)
  }

  useEffect(() => {
    void loadStaffOptions()
  }, [])

  useEffect(() => {
    void loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, staffId, actionType, fromDate, toDate])

  const prettyJson = (value: unknown) => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'string') return value
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  const pageInfo = useMemo(() => {
    if (meta.total === 0) return '0 logs'
    const start = (meta.current_page - 1) * meta.per_page + 1
    const end = Math.min(meta.current_page * meta.per_page, meta.total)
    return `${start}-${end} of ${meta.total}`
  }, [meta])

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Staff</label>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={staffId} onChange={(e) => { setPage(1); setStaffId(e.target.value) }}>
            <option value="">All staff</option>
            {staffOptions.map((s) => <option key={s.staff_id} value={s.staff_id}>{s.staff_name}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500">Action Type</label>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={actionType} onChange={(e) => { setPage(1); setActionType(e.target.value as ActionType | '') }}>
            <option value="">All actions</option>
            {Object.entries(ACTION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500">From</label>
          <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value) }} />
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500">To</label>
          <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value) }} />
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="px-2 py-2">Created At</th>
              <th className="px-2 py-2">Staff</th>
              <th className="px-2 py-2">Leave Request ID</th>
              <th className="px-2 py-2">Action</th>
              <th className="px-2 py-2">Remark</th>
              <th className="px-2 py-2">Created By</th>
              <th className="px-2 py-2">Changes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 align-top">
                <td className="px-2 py-2">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-2 py-2">{row.staff?.name ?? `Staff #${row.staff_id}`}</td>
                <td className="px-2 py-2">{row.leave_request_id ?? '-'}</td>
                <td className="px-2 py-2">
                  {(() => {
                    const view = getAdjustedLabelAndBadge(row)
                    return (
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${view.badge}`}>
                        {view.label}
                      </span>
                    )
                  })()}
                </td>
                <td className="px-2 py-2">{row.remark || '-'}</td>
                <td className="px-2 py-2">{row.creator?.name ?? '-'}</td>
                <td className="px-2 py-2">
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => setDetailsRow(row)}>View Details</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-6 text-center text-slate-500">No leave logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{pageInfo}</span>
        <div className="flex gap-2">
          <button type="button" className="rounded border px-3 py-1 disabled:opacity-50" disabled={meta.current_page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <button type="button" className="rounded border px-3 py-1 disabled:opacity-50" disabled={meta.current_page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>

      {detailsRow && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={() => setDetailsRow(null)}>
          <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold">Leave Log #{detailsRow.id}</h4>
              <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => setDetailsRow(null)}>✕</button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Before Value</p>
                <pre className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs">{prettyJson(detailsRow.before_value)}</pre>
              </div>
              <div>
                <p className="text-xs text-slate-500">After Value</p>
                <pre className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs">{prettyJson(detailsRow.after_value)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
