'use client'

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
  bookingId: number | null
  isOpen: boolean
  onClose: () => void
  permissions: string[]
  onStatusUpdated?: () => void
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

export default function BookingAppointmentDrawer({ bookingId, isOpen, onClose, permissions, onStatusUpdated }: Props) {
  const [data, setData] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(false)
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

  useEffect(() => {
    if (!isOpen || !bookingId) {
      setData(null)
      setError(null)
      return
    }

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

    loadDetail()
  }, [isOpen, bookingId])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const submitStatusUpdate = async () => {
    if (!bookingId) return

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
      onStatusUpdated?.()
    } finally {
      setSubmitting(false)
    }
  }

  const submitReschedule = async () => {
    if (!bookingId || !rescheduleAt) {
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
      onStatusUpdated?.()
    } finally {
      setSubmitting(false)
    }
  }

  const submitPhoto = async () => {
    if (!bookingId || !photoUrl || !uploadedByStaffId) {
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
      onStatusUpdated?.()
    } finally {
      setSubmitting(false)
    }
  }

  const loadDetail = async () => {
    if (!bookingId) return

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

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-gray-50 shadow-xl transition-transform duration-300 ease-in-out">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-semibold">Appointment Details</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Action Buttons */}
          {data && (
            <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
              <div className="flex flex-wrap gap-2">
                {canUpdateStatus && (
                  <button
                    type="button"
                    onClick={() => setStatusOpen(true)}
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Update Status
                  </button>
                )}
                {canReschedule && (
                  <button
                    type="button"
                    onClick={() => setRescheduleOpen(true)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Reschedule
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPhotoOpen(true)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Upload Photo
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-gray-500">Loading...</p>
              </div>
            )}

            {error && !statusOpen && !rescheduleOpen && !photoOpen && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            {!loading && !error && !data && (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-gray-500">No data found.</p>
              </div>
            )}

            {!loading && !error && data && (
              <div className="space-y-6">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <dl className="grid gap-4 md:grid-cols-2 text-sm">
                    <div>
                      <dt className="text-gray-500 mb-1">Booking Code</dt>
                      <dd className="font-medium text-gray-900">{data.booking_code || `#${data.id}`}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1">Status</dt>
                      <dd className="font-medium text-gray-900">{data.status}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1">Customer</dt>
                      <dd className="font-medium text-gray-900">{data.customer?.name || data.guest_name || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1">Phone</dt>
                      <dd className="font-medium text-gray-900">{data.customer?.phone || data.guest_phone || '-'}</dd>
                    </div>
                    {data.customer?.email || data.guest_email ? (
                      <div>
                        <dt className="text-gray-500 mb-1">Email</dt>
                        <dd className="font-medium text-gray-900">{data.customer?.email || data.guest_email || '-'}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-gray-500 mb-1">Service</dt>
                      <dd className="font-medium text-gray-900">{data.service?.name || '-'}</dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="text-gray-500 mb-1">Add-ons</dt>
                      <dd className="font-medium text-gray-900">
                        {(data.add_ons?.length ?? 0) > 0 ? (
                          <div className="space-y-1">
                            {data.add_ons?.map((addon, index) => (
                              <p key={`${addon.id ?? addon.name}-${index}`}>
                                {addon.name} (+{Number(addon.extra_duration_min ?? 0)} mins, +{formatCurrency(addon.extra_price)})
                              </p>
                            ))}
                            <p className="text-gray-700">
                              Summary: +{Number(data.addon_total_duration_min ?? 0)} mins, +{formatCurrency(data.addon_total_price)}
                            </p>
                          </div>
                        ) : (
                          '-'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1">Staff</dt>
                      <dd className="font-medium text-gray-900">{data.staff?.name || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1">Start Time</dt>
                      <dd className="font-medium text-gray-900">{formatDateTime(data.start_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1">End Time</dt>
                      <dd className="font-medium text-gray-900">{formatDateTime(data.end_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1">Deposit</dt>
                      <dd className="font-medium text-gray-900">{data.deposit_amount}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1">Payment Status</dt>
                      <dd className="font-medium text-gray-900">{data.payment_status}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1">Source</dt>
                      <dd className="font-medium text-gray-900">{data.source || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1">Created</dt>
                      <dd className="font-medium text-gray-900">{formatDateTime(data.created_at)}</dd>
                    </div>
                    {data.notes && (
                      <div className="md:col-span-2">
                        <dt className="text-gray-500 mb-1">Notes</dt>
                        <dd className="font-medium text-gray-900 whitespace-pre-wrap">{data.notes}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Update Modal */}
      {statusOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Update Status</h3>
            <div className="mt-4 space-y-3">
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as StatusOption)}
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {nextStatus === 'NOTIFIED_CANCELLATION' && (
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Must be &gt;=24h and not NO_SHOW. Voucher will be auto-created if eligible.
                </p>
              )}
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Reason (optional)"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setStatusOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={submitStatusUpdate}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Reschedule (Admin Override)</h3>
            <div className="mt-4 space-y-3">
              <input
                type="datetime-local"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={rescheduleAt}
                onChange={(e) => setRescheduleAt(e.target.value)}
              />
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Reason (optional)"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setRescheduleOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={submitReschedule}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Photo Modal */}
      {photoOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Upload Completed Photo (URL)</h3>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Image URL"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
              />
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Uploaded by staff ID"
                value={uploadedByStaffId}
                onChange={(e) => setUploadedByStaffId(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setPhotoOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={submitPhoto}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
