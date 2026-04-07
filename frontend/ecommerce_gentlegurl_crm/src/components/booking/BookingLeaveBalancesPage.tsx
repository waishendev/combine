'use client'

import { useEffect, useMemo, useState } from 'react'

type LeaveType = 'annual' | 'mc' | 'off_day'

type LeaveItem = { leave_type: LeaveType; entitled_days: number; used_days: number; remaining_days: number }
type StaffBalance = { staff_id: number; staff_name: string; balances: LeaveItem[] }

const extractArray = <T,>(payload: unknown): T[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T[]
  return []
}

export default function BookingLeaveBalancesPage() {
  const [rows, setRows] = useState<StaffBalance[]>([])
  const [staffFilter, setStaffFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadRows = async () => {
    const res = await fetch('/api/proxy/admin/booking/leave-balances', { cache: 'no-store' })
    if (!res.ok) {
      setError('Failed to load leave balances.')
      return
    }
    setError(null)
    setRows(extractArray<StaffBalance>(await res.json().catch(() => ({}))))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows()
  }, [])

  const visibleRows = useMemo(() => rows.filter((row) => !staffFilter || String(row.staff_id) === staffFilter), [rows, staffFilter])

  const updateEntitlement = async (staffId: number, leaveType: LeaveType, value: number) => {
    const res = await fetch(`/api/proxy/admin/booking/leave-balances/${staffId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leave_type: leaveType, entitled_days: value }),
    })

    if (!res.ok) {
      setError('Failed to update leave entitlement.')
      return
    }

    await loadRows()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Staff Leave Entitlements & Usage</h3>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
          <option value="">All Staff</option>
          {rows.map((row) => <option key={row.staff_id} value={row.staff_id}>{row.staff_name}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="space-y-3">
        {visibleRows.map((row) => (
          <div key={row.staff_id} className="rounded-md border border-slate-200 p-3">
            <h4 className="font-medium">{row.staff_name}</h4>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-2 py-2">Leave Type</th>
                    <th className="px-2 py-2">Entitled Days</th>
                    <th className="px-2 py-2">Used Days</th>
                    <th className="px-2 py-2">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {row.balances.map((item) => (
                    <tr key={item.leave_type} className="border-b border-slate-100">
                      <td className="px-2 py-2">{item.leave_type}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          defaultValue={item.entitled_days}
                          className="w-28 rounded border border-slate-300 px-2 py-1"
                          onBlur={(e) => updateEntitlement(row.staff_id, item.leave_type, Number(e.target.value || 0))}
                        />
                      </td>
                      <td className="px-2 py-2">{item.used_days.toFixed(2)}</td>
                      <td className="px-2 py-2">{item.remaining_days.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
