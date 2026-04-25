'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

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

const formatStatusLabel = (value?: string | null) => {
  if (!value) return '-'
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

const statusToneMap: Record<string, string> = {
  CONFIRMED: 'bg-blue-50 text-blue-700 ring-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-200',
  LATE_CANCELLATION: 'bg-amber-50 text-amber-700 ring-amber-200',
  NO_SHOW: 'bg-slate-100 text-slate-700 ring-slate-200',
  NOTIFIED_CANCELLATION: 'bg-violet-50 text-violet-700 ring-violet-200',
  HOLD: 'bg-amber-50 text-amber-700 ring-amber-200',
  EXPIRED: 'bg-rose-50 text-rose-700 ring-rose-200',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  UNPAID: 'bg-amber-50 text-amber-700 ring-amber-200',
}

function Pill({ value }: { value?: string | null }) {
  const tone = statusToneMap[(value || '').toUpperCase()] || 'bg-slate-100 text-slate-700 ring-slate-200'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}>
      {formatStatusLabel(value)}
    </span>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  )
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-4 md:grid-cols-2">{children}</dl>
}

function InfoField({
  label,
  value,
  fullWidth = false,
}: {
  label: string
  value: React.ReactNode
  fullWidth?: boolean
}) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : undefined}>
      <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value}</dd>
    </div>
  )
}

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

  const loadDetail = useCallback(async () => {
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
  }, [bookingId])

  useEffect(() => {
    if (!isOpen || !bookingId) {
      setData(null)
      setError(null)
      return
    }

    void loadDetail()
  }, [isOpen, bookingId, loadDetail])

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

  const customerName = data?.customer?.name || data?.guest_name || '-'
  const customerPhone = data?.customer?.phone || data?.guest_phone || '-'
  const customerEmail = data?.customer?.email || data?.guest_email || '-'
  const hasAddOns = (data?.add_ons?.length ?? 0) > 0
  const actionButtons = useMemo(
    () =>
      [
        canUpdateStatus
          ? {
              label: 'Update Status',
              onClick: () => setStatusOpen(true),
              className: 'bg-slate-900 text-white hover:bg-slate-800',
            }
          : null,
        canReschedule
          ? {
              label: 'Reschedule',
              onClick: () => setRescheduleOpen(true),
              className: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            }
          : null,
        {
          label: 'Upload Photo',
          onClick: () => setPhotoOpen(true),
          className: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        },
      ].filter(Boolean) as Array<{ label: string; onClick: () => void; className: string }>,
    [canReschedule, canUpdateStatus]
  )

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex bg-black/40" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="hidden flex-1 bg-black/40 md:block" />
        <aside
          className="relative ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Appointment Details</h2>
              <p className="text-sm text-slate-500">{data?.booking_code || (bookingId ? `#${bookingId}` : '-')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* {data ? (
            <div className="border-b border-slate-200 bg-white px-5 py-3">
              <div className="flex flex-wrap gap-2">
                {actionButtons.map((button) => (
                  <button
                    key={button.label}
                    type="button"
                    onClick={button.onClick}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${button.className}`}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null} */}

          <div className="flex-1 overflow-y-auto bg-slate-50 px-5 py-4 pb-28">
            {loading && (
              <div className="py-12 text-center text-sm text-slate-500">
                Loading...
              </div>
            )}

            {error && !statusOpen && !rescheduleOpen && !photoOpen && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && !data && (
              <div className="py-12 text-center text-sm text-slate-500">
                No data found.
              </div>
            )}

            {!loading && !error && data && (
              <div className="space-y-6">
                <Section title="Overview" description="Key appointment status and commercial summary.">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                      <div className="mt-2">
                        <Pill value={data.status} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</p>
                      <div className="mt-2">
                        <Pill value={data.payment_status} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deposit</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(data.deposit_amount)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatStatusLabel(data.source)}</p>
                    </div>
                  </div>
                </Section>

                <Section title="Customer" description="Booking owner and contact details.">
                  <InfoGrid>
                    <InfoField label="Booking Code" value={data.booking_code || `#${data.id}`} />
                    <InfoField label="Customer Type" value={data.customer ? 'Member' : 'Guest'} />
                    <InfoField label="Name" value={customerName} />
                    <InfoField label="Phone" value={customerPhone} />
                    <InfoField label="Email" value={customerEmail} />
                    <InfoField label="Created" value={formatDateTime(data.created_at)} />
                  </InfoGrid>
                </Section>

                <Section title="Appointment" description="Service, staff, and scheduled timing.">
                  <InfoGrid>
                    <InfoField label="Service" value={data.service?.name || '-'} />
                    <InfoField label="Duration" value={data.service ? `${Number(data.service.duration_min ?? 0)} mins` : '-'} />
                    <InfoField label="Staff" value={data.staff?.name || '-'} />
                    <InfoField label="Start Time" value={formatDateTime(data.start_at)} />
                    <InfoField label="End Time" value={formatDateTime(data.end_at)} />
                  </InfoGrid>
                </Section>

                <Section title="Add-ons" description="Selected optional services and totals.">
                  {hasAddOns ? (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Name</th>
                              <th className="px-3 py-2 text-right font-medium">Duration</th>
                              <th className="px-3 py-2 text-right font-medium">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.add_ons?.map((addon, index) => (
                              <tr key={`${addon.id ?? addon.name}-${index}`} className="border-t border-slate-100">
                                <td className="px-3 py-2 text-slate-900">{addon.name}</td>
                                <td className="px-3 py-2 text-right text-slate-700">
                                  +{Number(addon.extra_duration_min ?? 0)} mins
                                </td>
                                <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(addon.extra_price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-700">
                          Total duration: +{Number(data.addon_total_duration_min ?? 0)} mins
                        </div>
                        <div className="rounded-md bg-slate-100 px-3 py-2 font-medium text-slate-900">
                          Total price: {formatCurrency(data.addon_total_price)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No add-ons selected.</p>
                  )}
                </Section>

                <Section title="Reference Photos" description="Customer uploaded design/condition photos.">
                  {(data.uploaded_item_photos?.length ?? 0) > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {data.uploaded_item_photos?.map((photo) => (
                        <a key={photo.id} href={photo.file_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border border-slate-200">
                          <img src={photo.file_url} alt={photo.original_name || 'Uploaded booking photo'} className="h-20 w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No customer photos uploaded.</p>
                  )}
                </Section>

                <Section title="Internal Notes" description="Administrative note attached to this booking.">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{data.notes || 'No notes added.'}</p>
                </Section>
              </div>
            )}
          </div>
        </aside>
      </div>

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
