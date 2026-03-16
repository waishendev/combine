'use client'

import { useCallback, useEffect, useState } from 'react'

type Props = { permissions: string[] }

type RequestRow = {
  id: number
  booking_id: number
  status: 'pending' | 'approved' | 'rejected'
  reason?: string | null
  admin_note?: string | null
  requested_at?: string | null
  booking?: {
    id: number
    booking_code?: string | null
    status?: string
    start_at?: string
    customer?: { id: number; name: string } | null
    service?: { id: number; name: string } | null
    staff?: { id: number; name: string } | null
  }
}

export default function BookingCancellationRequestsPage({ permissions }: Props) {
  const [rows, setRows] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<RequestRow | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canReview = permissions.includes('booking.appointments.update_status')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/admin/booking/cancellation-requests?per_page=50', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load cancellation requests')

      const payload = await res.json()
      const data = payload?.data?.data ?? payload?.data ?? []
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setRows([])
      setError('Failed to load cancellation requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submitReview = async (id: number, action: 'approve' | 'reject') => {
    if (!canReview) return

    try {
      setSubmitting(true)
      const res = await fetch(`/api/proxy/admin/booking/cancellation-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_note: adminNote || null }),
      })
      if (!res.ok) throw new Error(`Failed to ${action} request`)
      await load()
      setSelected(null)
      setAdminNote('')
    } catch (e) {
      console.error(e)
      setError(`Failed to ${action} request.`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Cancellation Requests</h1>
        <p className="mt-1 text-sm text-slate-500">Review customer booking cancellation requests.</p>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Booking</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Booking Time</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Requested At</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-4 text-slate-500" colSpan={9}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-4 py-4 text-slate-500" colSpan={9}>No cancellation requests.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3">#{row.booking?.booking_code || row.booking_id}</td>
                <td className="px-4 py-3">{row.booking?.customer?.name || '-'}</td>
                <td className="px-4 py-3">{row.booking?.service?.name || '-'}</td>
                <td className="px-4 py-3">{row.booking?.staff?.name || '-'}</td>
                <td className="px-4 py-3">{row.booking?.start_at ? new Date(row.booking.start_at).toLocaleString() : '-'}</td>
                <td className="max-w-[220px] truncate px-4 py-3" title={row.reason || ''}>{row.reason || '-'}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-700">{row.status}</span>
                </td>
                <td className="px-4 py-3">{row.requested_at ? new Date(row.requested_at).toLocaleString() : '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => { setSelected(row); setAdminNote(row.admin_note || '') }} className="rounded border px-2 py-1">View</button>
                    {canReview && row.status === 'pending' ? (
                      <>
                        <button onClick={() => submitReview(row.id, 'approve')} className="rounded border px-2 py-1 text-emerald-700">Approve</button>
                        <button onClick={() => submitReview(row.id, 'reject')} className="rounded border px-2 py-1 text-rose-700">Reject</button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6">
            <h2 className="text-lg font-semibold">Cancellation Request #{selected.id}</h2>
            <p className="mt-2 text-sm text-slate-600">Booking #{selected.booking?.booking_code || selected.booking_id}</p>
            <p className="mt-1 text-sm text-slate-600">Reason: {selected.reason || '-'}</p>
            <p className="mt-1 text-sm text-slate-600">Status: {selected.status}</p>

            <label className="mt-4 block text-sm font-medium text-slate-700">Admin Note</label>
            <textarea
              className="mt-2 w-full rounded border border-slate-200 p-3 text-sm"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              disabled={!canReview || selected.status !== 'pending'}
            />

            <div className="mt-5 flex gap-2">
              {canReview && selected.status === 'pending' ? (
                <>
                  <button disabled={submitting} onClick={() => submitReview(selected.id, 'approve')} className="rounded border px-3 py-2 text-emerald-700">Approve</button>
                  <button disabled={submitting} onClick={() => submitReview(selected.id, 'reject')} className="rounded border px-3 py-2 text-rose-700">Reject</button>
                </>
              ) : null}
              <button onClick={() => setSelected(null)} className="ml-auto rounded border px-3 py-2">Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
