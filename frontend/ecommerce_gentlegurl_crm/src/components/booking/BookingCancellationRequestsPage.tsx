'use client'

import { useCallback, useEffect, useState } from 'react'

import StatusBadge from '@/components/StatusBadge'
import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'

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
    end_at?: string | null
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
    <div className="overflow-y-auto py-6 px-10 space-y-4">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Cancellation Requests</h1>
        <p className="mt-1 text-sm text-slate-500">Review customer booking cancellation requests.</p>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Booking</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Customer</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Service</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Staff</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Time</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Reason</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Status</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Requested at</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={9} />
            ) : rows.length === 0 ? (
              <TableEmptyState colSpan={9} />
            ) : rows.map((row) => (
              <tr key={row.id} className="text-sm">
                <td className="px-4 py-2 border border-gray-200">#{row.booking?.booking_code || row.booking_id}</td>
                <td className="px-4 py-2 border border-gray-200">{row.booking?.customer?.name || '-'}</td>
                <td className="px-4 py-2 border border-gray-200">{row.booking?.service?.name || '-'}</td>
                <td className="px-4 py-2 border border-gray-200">{row.booking?.staff?.name || '-'}</td>
                <td className="px-4 py-2 border border-gray-200">
                  {row.booking?.start_at ? new Date(row.booking.start_at).toLocaleString() : '-'}
                  {' - '}
                  {row.booking?.end_at ? new Date(row.booking.end_at).toLocaleString() : '-'}
                </td>
                <td className="max-w-[220px] truncate px-4 py-2 border border-gray-200" title={row.reason || ''}>{row.reason || '-'}</td>
                <td className="px-4 py-2 border border-gray-200">
                  <StatusBadge status={row.status} label={row.status} />
                </td>
                <td className="px-4 py-2 border border-gray-200">{row.requested_at ? new Date(row.requested_at).toLocaleString() : '-'}</td>
                <td className="px-4 py-2 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setSelected(row); setAdminNote(row.admin_note || '') }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-800"
                      aria-label="View"
                      title="View"
                    >
                      <i className="fa-solid fa-eye" />
                    </button>
                    {canReview && row.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => submitReview(row.id, 'approve')}
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700"
                          aria-label="Approve"
                          title="Approve"
                          disabled={submitting}
                        >
                          <i className="fa-solid fa-check" />
                        </button>
                        <button
                          type="button"
                          onClick={() => submitReview(row.id, 'reject')}
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-rose-600 text-white hover:bg-rose-700"
                          aria-label="Reject"
                          title="Reject"
                          disabled={submitting}
                        >
                          <i className="fa-solid fa-xmark" />
                        </button>
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
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <span>Status:</span>
              <StatusBadge status={selected.status} label={selected.status} />
            </div>

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
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => submitReview(selected.id, 'approve')}
                    className="rounded bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => submitReview(selected.id, 'reject')}
                    className="rounded bg-rose-600 px-3 py-2 text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    Reject
                  </button>
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
