'use client'

import { useEffect, useState } from 'react'

type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
type DayType = 'full_day' | 'half_day_am' | 'half_day_pm'

type LeaveRow = {
  id: number
  staff_id: number
  leave_type: 'annual' | 'mc' | 'off_day'
  day_type: DayType
  start_date: string
  end_date: string
  days: number
  status: LeaveStatus
  reason: string | null
  admin_remark: string | null
  staff?: { id: number; name: string }
}

const extractArray = <T,>(payload: unknown): T[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T[]
  if (root.data && typeof root.data === 'object' && 'data' in root.data) {
    const nested = (root.data as { data?: unknown }).data
    if (Array.isArray(nested)) return nested as T[]
  }
  return []
}

export default function BookingLeaveRequestsPage() {
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [filter, setFilter] = useState<LeaveStatus | ''>('pending')
  const [remarks, setRemarks] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  const loadRows = async () => {
    setError(null)
    const qs = new URLSearchParams()
    if (filter) qs.set('status', filter)
    const res = await fetch(`/api/proxy/admin/booking/leave-requests?${qs.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      setError('Failed to load leave requests.')
      return
    }
    setRows(extractArray<LeaveRow>(await res.json().catch(() => ({}))))
  }

  useEffect(() => {
    void loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const decide = async (id: number, status: 'approved' | 'rejected') => {
    const res = await fetch(`/api/proxy/admin/booking/leave-requests/${id}/decision`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_remark: remarks[id] || null }),
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { message?: string }
      setError(payload.message ?? 'Failed to update leave request.')
      return
    }
    await loadRows()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">All Leave Requests</h3>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as LeaveStatus | '')}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="px-2 py-2">Staff</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Day Type</th>
              <th className="px-2 py-2">Date Range</th>
              <th className="px-2 py-2">Days</th>
              <th className="px-2 py-2">Reason</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Admin Remark</th>
              <th className="px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 align-top">
                <td className="px-2 py-2">{row.staff?.name ?? `Staff #${row.staff_id}`}</td>
                <td className="px-2 py-2">{row.leave_type}</td>
                <td className="px-2 py-2">{row.day_type.replaceAll('_', ' ')}</td>
                <td className="px-2 py-2">{row.start_date} → {row.end_date}</td>
                <td className="px-2 py-2">{row.days.toFixed(2)}</td>
                <td className="px-2 py-2">{row.reason || '-'}</td>
                <td className="px-2 py-2">{row.status}</td>
                <td className="px-2 py-2">
                  <textarea
                    className="w-52 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    rows={2}
                    value={remarks[row.id] ?? row.admin_remark ?? ''}
                    onChange={(e) => setRemarks((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    disabled={row.status !== 'pending'}
                  />
                </td>
                <td className="px-2 py-2">
                  {row.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button type="button" className="rounded bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => decide(row.id, 'approved')}>Approve</button>
                      <button type="button" className="rounded bg-rose-600 px-2 py-1 text-xs text-white" onClick={() => decide(row.id, 'rejected')}>Reject</button>
                    </div>
                  ) : '-'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-slate-500">No leave requests found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
