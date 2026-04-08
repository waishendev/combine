'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'

type LeaveType = 'annual' | 'mc' | 'emergency' | 'unpaid'
type DayType = 'full_day' | 'half_day_am' | 'half_day_pm'
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

type LeaveBalance = {
  leave_type: LeaveType
  entitled_days: number
  used_days: number
  remaining_days: number
}

type LeaveRequest = {
  id: number
  leave_type: LeaveType | 'off_day'
  start_date: string
  end_date: string
  day_type: DayType
  days: number
  reason: string | null
  status: LeaveStatus
  admin_remark: string | null
  created_at: string
}

const LEAVE_LABEL: Record<LeaveRequest['leave_type'], string> = {
  annual: 'Annual Leave',
  mc: 'Medical Leave (MC)',
  emergency: 'Emergency Leave',
  unpaid: 'Unpaid Leave',
  off_day: 'Off Day',
}

const DAY_TYPE_LABEL: Record<DayType, string> = {
  full_day: 'Full Day',
  half_day_am: 'Half Day (Morning)',
  half_day_pm: 'Half Day (Afternoon)',
}

const STATUS_CLASS: Record<LeaveStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-200 text-slate-700',
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

export default function BookingMyLeavePage() {
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ leave_type: 'annual' as LeaveType, day_type: 'full_day' as DayType, start_date: '', end_date: '', reason: '' })

  const remainingAnnual = useMemo(() => balances.find((b) => b.leave_type === 'annual')?.remaining_days ?? 0, [balances])
  const isEmergency = form.leave_type === 'emergency'

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [balanceRes, requestRes] = await Promise.all([
        fetch('/api/proxy/booking/my-leave/balances', { cache: 'no-store' }),
        fetch('/api/proxy/booking/my-leave/requests?per_page=100', { cache: 'no-store' }),
      ])

      if (!balanceRes.ok || !requestRes.ok) {
        setError('Failed to load leave data.')
        return
      }

      setBalances(extractArray<LeaveBalance>(await balanceRes.json().catch(() => ({}))))
      setRequests(extractArray<LeaveRequest>(await requestRes.json().catch(() => ({}))))
    } catch {
      setError('Failed to load leave data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    if (!isEmergency && form.day_type !== 'full_day') {
      setForm((prev) => ({ ...prev, day_type: 'full_day' }))
    }
  }, [form.day_type, isEmergency])

  const applyLeave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/booking/my-leave/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { message?: string }
        setError(payload.message ?? 'Failed to submit leave request.')
        return
      }

      setForm({ leave_type: 'annual', day_type: 'full_day', start_date: '', end_date: '', reason: '' })
      await loadAll()
    } finally {
      setSaving(false)
    }
  }

  const cancelRequest = async (id: number) => {
    const confirmed = window.confirm('Cancel this leave request?')
    if (!confirmed) return

    const res = await fetch(`/api/proxy/booking/my-leave/requests/${id}/cancel`, { method: 'PATCH' })
    if (!res.ok) {
      setError('Failed to cancel leave request.')
      return
    }
    await loadAll()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold">Apply Leave</h3>
        <p className="text-sm text-slate-500 mt-1">Annual leave remaining: {remainingAnnual.toFixed(2)} day(s)</p>
        <form className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3" onSubmit={applyLeave}>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.leave_type}
            onChange={(e) => setForm((prev) => ({ ...prev, leave_type: e.target.value as LeaveType }))}
          >
            <option value="annual">Annual Leave</option>
            <option value="mc">Medical Leave (MC)</option>
            <option value="emergency">Emergency Leave</option>
            <option value="unpaid">Unpaid Leave</option>
          </select>

          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.day_type}
            disabled={!isEmergency}
            onChange={(e) => setForm((prev) => ({ ...prev, day_type: e.target.value as DayType }))}
          >
            <option value="full_day">Full Day</option>
            <option value="half_day_am" disabled={!isEmergency}>Half Day (Morning)</option>
            <option value="half_day_pm" disabled={!isEmergency}>Half Day (Afternoon)</option>
          </select>

          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" type="date" value={form.start_date} onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value, day_type: (prev.end_date && prev.end_date !== e.target.value) ? 'full_day' : prev.day_type }))} required />
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" type="date" value={form.end_date} onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value, day_type: (prev.start_date && prev.start_date !== e.target.value) ? 'full_day' : prev.day_type }))} required />
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Reason (optional)" value={form.reason} onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} />

          <button type="submit" disabled={saving} className="md:col-span-5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold">My Leave Balance</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Entitled</th>
                <th className="px-2 py-2">Used</th>
                <th className="px-2 py-2">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((row) => (
                <tr key={row.leave_type} className="border-b border-slate-100">
                  <td className="px-2 py-2">{LEAVE_LABEL[row.leave_type]}</td>
                  <td className="px-2 py-2">{row.entitled_days.toFixed(2)}</td>
                  <td className="px-2 py-2">{row.used_days.toFixed(2)}</td>
                  <td className="px-2 py-2">{row.remaining_days.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold">My Leave Request History</h3>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Day Type</th>
                <th className="px-2 py-2">Date Range</th>
                <th className="px-2 py-2">Days</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Admin Remark</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && requests.length === 0 && (
                <tr><td colSpan={8} className="px-2 py-6 text-center text-slate-500">No leave requests yet.</td></tr>
              )}
              {requests.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="px-2 py-2">{LEAVE_LABEL[row.leave_type]}</td>
                  <td className="px-2 py-2">{DAY_TYPE_LABEL[row.day_type]}</td>
                  <td className="px-2 py-2">{row.start_date} → {row.end_date}</td>
                  <td className="px-2 py-2">{row.days.toFixed(2)}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_CLASS[row.status]}`}>{row.status}</span></td>
                  <td className="px-2 py-2">{row.admin_remark || '-'}</td>
                  <td className="px-2 py-2">
                    {(row.status === 'pending' || row.status === 'approved') ? (
                      <button type="button" onClick={() => cancelRequest(row.id)} className="text-rose-600 hover:underline">Cancel</button>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
