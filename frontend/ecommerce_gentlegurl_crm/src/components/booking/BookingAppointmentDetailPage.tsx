'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type BookingDetail = {
  id: number
  booking_code: string | null
  source: string
  customer: { id: number; name: string; phone: string | null; email: string | null } | null
  guest_name: string | null
  guest_phone: string | null
  guest_email: string | null
  service: { id: number; name: string; duration_min: number } | null
  add_ons?: Array<{ id?: number | null; name: string; extra_duration_min: number; extra_price: number }>
  uploaded_item_photos?: Array<{ id: number; file_url: string; original_name?: string }>
  addon_total_duration_min?: number
  addon_total_price?: number
  staff: { id: number; name: string } | null
  start_at: string
  end_at: string
  status: string
  deposit_amount: string | number
  payment_status: string
  notes: string | null
  created_at: string
}

type Props = {
  bookingId: string
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

const formatCurrency = (value?: number | string | null) => `RM${Number(value ?? 0).toFixed(2)}`

export default function BookingAppointmentDetailPage({ bookingId, permissions }: Props) {
  const [data, setData] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusOpen, setStatusOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState<StatusOption>('CONFIRMED')
  const [statusReason, setStatusReason] = useState('')

  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleAt, setRescheduleAt] = useState('')
  const [rescheduleReason, setRescheduleReason] = useState('')

  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploadedByStaffId, setUploadedByStaffId] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const canUpdateStatus = permissions.includes('booking.appointments.update_status')
  const canReschedule = permissions.includes('booking.appointments.reschedule')

  const loadDetail = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/admin/booking/appointments/${bookingId}`, { cache: 'no-store' })
      if (!res.ok) {
        setError('Failed to load appointment detail.')
        setData(null)
        return
      }

      const json = await res.json().catch(() => ({})) as { data?: BookingDetail }
      setData(json?.data ?? null)
      if (json?.data?.status && STATUS_OPTIONS.includes(json.data.status as StatusOption)) {
        setNextStatus(json.data.status as StatusOption)
      }
      if (json?.data?.staff?.id) {
        setUploadedByStaffId(String(json.data.staff.id))
      }
    } catch {
      setError('Failed to load appointment detail.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  const submitStatusUpdate = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/proxy/admin/booking/appointments/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, reason: statusReason || null }),
      })
      const payload = await res.json().catch(() => ({})) as { message?: string }
      if (!res.ok) {
        setError(payload.message || 'Failed to update status.')
        return
      }

      setStatusOpen(false)
      setStatusReason('')
      await loadDetail()
    } finally {
      setSubmitting(false)
    }
  }

  const submitReschedule = async () => {
    if (!rescheduleAt) {
      setError('Please select a new date/time for reschedule.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/proxy/admin/booking/${bookingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_at: new Date(rescheduleAt).toISOString(), reason: rescheduleReason || null }),
      })
      const payload = await res.json().catch(() => ({})) as { message?: string }
      if (!res.ok) {
        setError(payload.message || 'Failed to reschedule booking.')
        return
      }
      setRescheduleOpen(false)
      setRescheduleAt('')
      setRescheduleReason('')
      await loadDetail()
    } finally {
      setSubmitting(false)
    }
  }

  const submitPhoto = async () => {
    if (!photoUrl || !uploadedByStaffId) {
      setError('Photo URL and uploaded-by staff are required.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/proxy/admin/booking/appointments/${bookingId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: photoUrl, uploaded_by_staff_id: Number(uploadedByStaffId) }),
      })
      const payload = await res.json().catch(() => ({})) as { message?: string }
      if (!res.ok) {
        setError(payload.message || 'Failed to upload photo record.')
        return
      }

      setPhotoOpen(false)
      setPhotoUrl('')
      await loadDetail()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="overflow-y-auto py-6 px-10 space-y-4">
      <div className="text-xs">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/appointments" className="text-blue-600 hover:underline">Appointments</Link>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold">Appointment Detail</h2>
        <div className="flex gap-2">
          {canUpdateStatus && (
            <button type="button" onClick={() => setStatusOpen(true)} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">Update Status</button>
          )}
          {canReschedule && (
            <button type="button" onClick={() => setRescheduleOpen(true)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Reschedule</button>
          )}
          <button type="button" onClick={() => setPhotoOpen(true)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Upload Photo</button>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {loading && <p className="text-sm text-slate-500">Loading...</p>}
        {!loading && !data && <p className="text-sm text-slate-500">No data found.</p>}
        {!loading && data && (
          <dl className="grid gap-4 md:grid-cols-2 text-sm">
            <div><dt className="text-slate-500">Booking Code</dt><dd className="font-medium">{data.booking_code || `#${data.id}`}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd className="font-medium">{data.status}</dd></div>
            <div><dt className="text-slate-500">Customer</dt><dd className="font-medium">{data.customer?.name || data.guest_name || '-'}</dd></div>
            <div><dt className="text-slate-500">Phone</dt><dd className="font-medium">{data.customer?.phone || data.guest_phone || '-'}</dd></div>
            <div><dt className="text-slate-500">Main Service</dt><dd className="font-medium">{data.service?.name || '-'}</dd></div>
            <div className="md:col-span-2">
              <dt className="text-slate-500">Add-ons</dt>
              <dd className="font-medium">
                {(data.uploaded_item_photos?.length ?? 0) > 0 ? (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Uploaded reference photos</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {data.uploaded_item_photos?.map((photo) => (
                        <a key={photo.id} href={photo.file_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border border-slate-200">
                          <img src={photo.file_url} alt={photo.original_name || 'Uploaded booking photo'} className="h-20 w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {(data.add_ons?.length ?? 0) > 0 ? (
                  <div className="space-y-1">
                    {data.add_ons?.map((addon, index) => (
                      <p key={`${addon.id ?? addon.name}-${index}`}>
                        {addon.name} (+{Number(addon.extra_duration_min ?? 0)} mins, +{formatCurrency(addon.extra_price)})
                      </p>
                    ))}
                    <p className="text-slate-700">
                      Add-on summary: +{Number(data.addon_total_duration_min ?? 0)} mins, +{formatCurrency(data.addon_total_price)}
                    </p>
                  </div>
                ) : (
                  '-'
                )}
              </dd>
            </div>
            <div><dt className="text-slate-500">Staff</dt><dd className="font-medium">{data.staff?.name || '-'}</dd></div>
            <div><dt className="text-slate-500">Start</dt><dd className="font-medium">{formatDateTime(data.start_at)}</dd></div>
            <div><dt className="text-slate-500">End</dt><dd className="font-medium">{formatDateTime(data.end_at)}</dd></div>
            <div><dt className="text-slate-500">Deposit</dt><dd className="font-medium">{data.deposit_amount}</dd></div>
            <div><dt className="text-slate-500">Payment Status</dt><dd className="font-medium">{data.payment_status}</dd></div>
            <div><dt className="text-slate-500">Created</dt><dd className="font-medium">{formatDateTime(data.created_at)}</dd></div>
            <div><dt className="text-slate-500">Notes</dt><dd className="font-medium">{data.notes || '-'}</dd></div>
          </dl>
        )}
      </div>

      {statusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Update Status</h3>
            <div className="mt-4 space-y-3">
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as StatusOption)}>
                {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              {nextStatus === 'NOTIFIED_CANCELLATION' && (
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Must be &gt;=24h and not NO_SHOW. Voucher will be auto-created if eligible.
                </p>
              )}
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Reason (optional)" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setStatusOpen(false)} disabled={submitting}>Cancel</button>
              <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={submitStatusUpdate} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Reschedule (Admin Override)</h3>
            <div className="mt-4 space-y-3">
              <input type="datetime-local" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} />
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Reason (optional)" value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setRescheduleOpen(false)} disabled={submitting}>Cancel</button>
              <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={submitReschedule} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {photoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Upload Completed Photo (URL)</h3>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Image URL" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Uploaded by staff ID" value={uploadedByStaffId} onChange={(e) => setUploadedByStaffId(e.target.value)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setPhotoOpen(false)} disabled={submitting}>Cancel</button>
              <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={submitPhoto} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
