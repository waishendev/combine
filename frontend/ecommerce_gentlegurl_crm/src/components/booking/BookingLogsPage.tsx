'use client'

import { useState } from 'react'

type LogRow = {
  id: number
  booking_id: number | null
  actor_type: string
  action: string
  meta: Record<string, unknown> | null
  created_at: string
}

export default function BookingLogsPage() {
  const [action, setAction] = useState('')
  const [rows, setRows] = useState<LogRow[]>([])

  const load = async () => {
    const qs = new URLSearchParams()
    if (action) qs.set('action', action)
    const res = await fetch(`/api/proxy/admin/booking/logs?${qs.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setRows(json.data?.data ?? [])
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Booking Audit Logs</h1>
      <div className="flex items-end gap-3 rounded border p-3">
        <label className="text-sm">Action
          <input value={action} onChange={(e) => setAction(e.target.value)} className="ml-2 rounded border px-2 py-1" placeholder="e.g. VOUCHER_GRANTED" />
        </label>
        <button onClick={load} className="rounded bg-black px-3 py-1 text-white">Load</button>
        <button onClick={() => window.open(`/api/proxy/admin/booking/logs/export.csv?action=${encodeURIComponent(action)}`, '_blank')} className="rounded border px-3 py-1">Download CSV</button>
      </div>

      <table className="w-full border text-sm">
        <thead><tr className="bg-gray-100"><th className="border p-2">Time</th><th className="border p-2">Booking</th><th className="border p-2">Actor</th><th className="border p-2">Action</th><th className="border p-2">Meta</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="border p-2">{row.created_at}</td>
              <td className="border p-2">{row.booking_id ?? '-'}</td>
              <td className="border p-2">{row.actor_type}</td>
              <td className="border p-2">{row.action}</td>
              <td className="border p-2"><pre className="whitespace-pre-wrap">{JSON.stringify(row.meta ?? {}, null, 2)}</pre></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
