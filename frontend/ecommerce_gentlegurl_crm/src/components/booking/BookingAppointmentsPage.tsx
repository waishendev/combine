'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'

type BookingRow = {
  id: number
  booking_code: string | null
  customer: { id: number; name: string; phone: string | null } | null
  service: { id: number; name: string } | null
  staff: { id: number; name: string } | null
  start_at: string
  status: string
  deposit_amount: string | number
  created_at: string
}

type StaffOption = { id: number; name: string }

type Props = {
  permissions: string[]
}

type StatusOption =
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'LATE_CANCELLATION'
  | 'NO_SHOW'
  | 'NOTIFIED_CANCELLATION'

const STATUS_OPTIONS: StatusOption[] = [
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'LATE_CANCELLATION',
  'NO_SHOW',
  'NOTIFIED_CANCELLATION',
]

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const extractData = <T,>(payload: unknown, fallback: T): T => {
  if (!payload || typeof payload !== 'object') return fallback
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T
  if (root.data && typeof root.data === 'object' && 'data' in (root.data as object)) {
    const nested = (root.data as { data?: unknown }).data
    if (Array.isArray(nested)) return nested as T
  }
  return fallback
}

export default function BookingAppointmentsPage({ permissions }: Props) {
  const [rows, setRows] = useState<BookingRow[]>([])
  const [staffs, setStaffs] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [date, setDate] = useState('')
  const [staffId, setStaffId] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<BookingRow | null>(null)
  const [nextStatus, setNextStatus] = useState<StatusOption>('CONFIRMED')
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canUpdateStatus = permissions.includes('booking.appointments.update_status')

  const loadStaffs = async () => {
    try {
      const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json().catch(() => ({}))
      const data = extractData<StaffOption[]>(json, [])
      setStaffs(data)
    } catch {
      setStaffs([])
    }
  }

  const loadAppointments = async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (date) qs.set('date', date)
      if (staffId) qs.set('staff_id', staffId)
      if (status) qs.set('status', status)
      if (search.trim()) qs.set('q', search.trim())

      const res = await fetch(`/api/proxy/admin/booking/appointments?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setRows([])
        setError('Failed to load appointments.')
        return
      }

      const json = await res.json().catch(() => ({}))
      const data = extractData<BookingRow[]>(json, [])
      setRows(data)
    } catch {
      setError('Failed to load appointments.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStaffs()
  }, [])

  useEffect(() => {
    loadAppointments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, staffId, status])

  const openStatusModal = (row: BookingRow) => {
    setStatusTarget(row)
    setNextStatus((STATUS_OPTIONS.includes(row.status as StatusOption) ? row.status : 'CONFIRMED') as StatusOption)
    setNotes('')
    setReason('')
    setStatusModalOpen(true)
  }

  const submitStatusUpdate = async () => {
    if (!statusTarget) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/proxy/admin/booking/appointments/${statusTarget.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, notes: notes || null, reason: reason || null }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = (json && typeof json === 'object' && 'message' in json && typeof json.message === 'string')
          ? json.message
          : 'Failed to update status.'
        setError(message)
        return
      }

      setStatusModalOpen(false)
      setStatusTarget(null)
      await loadAppointments()
    } finally {
      setSubmitting(false)
    }
  }

  const hasRows = useMemo(() => rows.length > 0, [rows])

  return (
    <div className="overflow-y-auto py-6 px-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Booking Appointments</h2>
          <p className="mt-1 text-sm text-slate-500">View appointments and update booking statuses.</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">All Staff</option>
            {staffs.map((staff) => (
              <option key={staff.id} value={staff.id}>{staff.name}</option>
            ))}
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search keyword"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" onClick={loadAppointments} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
            Search
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Booking</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Deposit</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <TableLoadingRow colSpan={9} />}
            {!loading && !hasRows && <TableEmptyState colSpan={9} />}
            {!loading && rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">{row.booking_code || `#${row.id}`}</td>
                <td className="px-4 py-3">{row.customer?.name || '-'}<div className="text-xs text-slate-500">{row.customer?.phone || '-'}</div></td>
                <td className="px-4 py-3">{row.service?.name || '-'}</td>
                <td className="px-4 py-3">{row.staff?.name || '-'}</td>
                <td className="px-4 py-3">{formatDateTime(row.start_at)}</td>
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3">{row.deposit_amount}</td>
                <td className="px-4 py-3">{formatDateTime(row.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link href={`/booking/appointments/${row.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">View</Link>
                    {canUpdateStatus && (
                      <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs text-white" onClick={() => openStatusModal(row)}>
                        Update Status
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {statusModalOpen && statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Update Status: {statusTarget.booking_code || `#${statusTarget.id}`}</h3>
            <div className="mt-4 space-y-3">
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as StatusOption)}>
                {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              {nextStatus === 'NOTIFIED_CANCELLATION' && (
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Must be &gt;=24h and not NO_SHOW. Voucher will be auto-created if eligible.
                </p>
              )}
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <textarea className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Notes (optional)" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setStatusModalOpen(false)} disabled={submitting}>Cancel</button>
              <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={submitStatusUpdate} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
