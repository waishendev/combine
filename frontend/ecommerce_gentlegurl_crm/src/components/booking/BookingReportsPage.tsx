'use client'

import { useMemo, useState } from 'react'

type SummaryRow = {
  period: string
  total_bookings: number
  notified_cancellation_count: number
  completed_count: number
  deposit_collected: number
}

export default function BookingReportsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [groupBy, setGroupBy] = useState('day')
  const [rows, setRows] = useState<SummaryRow[]>([])

  const maxTotal = useMemo(() => Math.max(1, ...rows.map((r) => Number(r.total_bookings || 0))), [rows])

  const load = async () => {
    const qs = new URLSearchParams({ from, to, group_by: groupBy })
    const res = await fetch(`/api/proxy/admin/booking/reports/summary?${qs.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setRows(json.data ?? [])
  }

  const exportCsv = () => {
    const qs = new URLSearchParams({ from, to, group_by: groupBy })
    window.open(`/api/proxy/admin/booking/reports/summary/export.csv?${qs.toString()}`, '_blank')
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Booking Reports</h1>
      <div className="flex flex-wrap items-end gap-3 rounded border p-3">
        <label className="text-sm">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-2 rounded border px-2 py-1" /></label>
        <label className="text-sm">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-2 rounded border px-2 py-1" /></label>
        <label className="text-sm">Group
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="ml-2 rounded border px-2 py-1">
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <button onClick={load} className="rounded bg-black px-3 py-1 text-white">Load</button>
        <button onClick={exportCsv} className="rounded border px-3 py-1">Download CSV</button>
      </div>

      <div className="space-y-2 rounded border p-3">
        {rows.map((row) => (
          <div key={row.period} className="space-y-1">
            <div className="flex justify-between text-sm"><span>{row.period}</span><span>{row.total_bookings} bookings</span></div>
            <div className="h-3 w-full rounded bg-gray-200">
              <div className="h-3 rounded bg-blue-500" style={{ width: `${(Number(row.total_bookings || 0) / maxTotal) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Period</th><th className="border p-2">Total</th><th className="border p-2">Completed</th><th className="border p-2">Notified Cancel</th><th className="border p-2">Deposit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.period}>
              <td className="border p-2">{row.period}</td>
              <td className="border p-2">{row.total_bookings}</td>
              <td className="border p-2">{row.completed_count}</td>
              <td className="border p-2">{row.notified_cancellation_count}</td>
              <td className="border p-2">{row.deposit_collected}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
