'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react'

import BookingStatusBadge from '@/components/booking/BookingStatusBadge'

import PosAppointmentsSchedule from './PosAppointmentsSchedule'
import {
  extractPaged,
  formatBookingAddonSummary,
  formatDateTimeRange,
  formatDurationFromRange,
  formatPosPaymentHistoryLineType,
  formatTimeRange,
} from './posAppointmentHelpers'
import type { PosAppointmentCurrentUser, PosAppointmentDetail, PosAppointmentListItem } from './posAppointmentTypes'

type StaffOption = {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  code?: string | null
  service_commission_rate?: number
  is_active?: boolean | number | string | null
}

type PosCancellationRequestRow = {
  id: number
  booking_id: number
  status: string
  reason?: string | null
  requested_at?: string | null
  booking?: {
    id: number
    booking_code?: string | null
    status?: string
    start_at?: string
    end_at?: string | null
    addon_items_json?: unknown
    customer?: { id: number; name: string } | null
    service?: { id: number; name: string } | null
    staff?: { id: number; name: string } | null
  }
}

function PosCancellationRequestSummary({ row }: { row: PosCancellationRequestRow }) {
  const b = row.booking
  const addonLine = formatBookingAddonSummary(b?.addon_items_json)

  return (
    <div className="min-w-0 space-y-1 text-xs text-gray-800">
      <p className="text-sm font-semibold text-gray-900">Booking #{b?.booking_code ?? row.booking_id}</p>
      <p className="text-gray-900">{b?.customer?.name ?? '—'}</p>
      <p>
        <span className="font-semibold text-gray-600">Service:</span> {b?.service?.name ?? '—'}
      </p>
      <p>
        <span className="font-semibold text-gray-600">Add on:</span> {addonLine}
      </p>
      <p>
        <span className="font-semibold text-gray-600">Staff:</span> {b?.staff?.name ?? '—'}
      </p>
      <p>
        <span className="font-semibold text-gray-600">Time:</span> {formatDateTimeRange(b?.start_at, b?.end_at)}
      </p>
      {row.requested_at ? (
        <p>
          <span className="font-semibold text-gray-600">Requested at:</span> {new Date(row.requested_at).toLocaleString()}
        </p>
      ) : null}
      <p>
        <span className="font-semibold text-gray-600">Reason:</span> {row.reason?.trim() ? row.reason : '—'}
      </p>
    </div>
  )
}

type ToastKind = 'success' | 'error' | 'info' | 'warning'
type ToastItem = { id: string; kind: ToastKind; text: string }

/** YYYY-MM-DD within leave start/end (inclusive, date portion only). */
function ymdInInclusiveRange(needle: string, start: string, end: string): boolean {
  const n = needle.slice(0, 10)
  const s = (start ?? '').slice(0, 10)
  const e = (end ?? s).slice(0, 10)
  if (!s) return false
  return n >= s && n <= e
}

export default function PosAppointmentsWorkspace({
  currentUser,
  permissions = [],
}: {
  currentUser: PosAppointmentCurrentUser
  permissions?: string[]
}) {
  const appointmentQrUploadInputRef = useRef<HTMLInputElement | null>(null)
  const appointmentQrCameraBackInputRef = useRef<HTMLInputElement | null>(null)
  const appointmentQrCameraFrontInputRef = useRef<HTMLInputElement | null>(null)

  const [toasts, setToasts] = useState<ToastItem[]>([])
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])
  const pushToast = useCallback(
    (kind: ToastKind, text: string) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
      setToasts((prev) => [...prev, { id, kind, text }].slice(-4))
      window.setTimeout(() => dismissToast(id), 3200)
    },
    [dismissToast],
  )
  const showMsg = useCallback((text: string, kind: ToastKind = 'info') => pushToast(kind, text), [pushToast])

  const [activeStaffs, setActiveStaffs] = useState<StaffOption[]>([])
  const [posApptViewMode, setPosApptViewMode] = useState<'month' | 'day'>('month')
  const [posApptCalendarMonth, setPosApptCalendarMonth] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [appointmentQuery, setAppointmentQuery] = useState('')
  const [appointmentDateFilter, setAppointmentDateFilter] = useState(() => {
    const now = new Date()
    const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000
    return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
  })
  const [appointmentCustomerFilter, setAppointmentCustomerFilter] = useState('')
  const [appointmentCustomerOptions, setAppointmentCustomerOptions] = useState<
    Array<{ id: number; name: string; phone?: string | null; email?: string | null }>
  >([])
  const [appointmentCustomerLoading, setAppointmentCustomerLoading] = useState(false)
  const [appointmentStaffFilter, setAppointmentStaffFilter] = useState('')
  const [appointmentStaffOptions, setAppointmentStaffOptions] = useState<StaffOption[]>([])
  const [appointmentStaffLoading, setAppointmentStaffLoading] = useState(false)
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('')
  const [appointments, setAppointments] = useState<PosAppointmentListItem[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
  const [appointmentListAutoRefresh, setAppointmentListAutoRefresh] = useState(true)
  const [appointmentListRefreshCountdown, setAppointmentListRefreshCountdown] = useState(5)
  const [pendingCancellationRequestsCount, setPendingCancellationRequestsCount] = useState(0)
  const [cancellationRequestsModalOpen, setCancellationRequestsModalOpen] = useState(false)
  const [cancellationRequestsLoading, setCancellationRequestsLoading] = useState(false)
  const [cancellationRequestsRows, setCancellationRequestsRows] = useState<PosCancellationRequestRow[]>([])
  const [cancellationRequestsError, setCancellationRequestsError] = useState<string | null>(null)
  const [cancellationConfirmOpen, setCancellationConfirmOpen] = useState(false)
  const [cancellationConfirmRow, setCancellationConfirmRow] = useState<PosCancellationRequestRow | null>(null)
  const [cancellationConfirmAction, setCancellationConfirmAction] = useState<'approve' | 'reject' | null>(null)
  const [cancellationConfirmNote, setCancellationConfirmNote] = useState('')
  const [cancellationReviewSubmitting, setCancellationReviewSubmitting] = useState(false)

  const canReviewCancellationRequests = useMemo(
    () => permissions.includes('booking.appointments.update_status'),
    [permissions],
  )
  const [appointmentDetail, setAppointmentDetail] = useState<PosAppointmentDetail | null>(null)
  const [appointmentDetailLoading, setAppointmentDetailLoading] = useState(false)
  const [appointmentPaymentMethod, setAppointmentPaymentMethod] = useState<'cash' | 'qrpay'>('cash')
  const [appointmentCheckoutConfirmationOpen, setAppointmentCheckoutConfirmationOpen] = useState(false)
  const [appointmentCheckoutError, setAppointmentCheckoutError] = useState<string | null>(null)
  const [appointmentCashReceived, setAppointmentCashReceived] = useState('')
  const [appointmentQrProofFileName, setAppointmentQrProofFileName] = useState<string | null>(null)
  const [appointmentQrProofPreviewUrl, setAppointmentQrProofPreviewUrl] = useState<string | null>(null)
  const [appointmentSettlementResult, setAppointmentSettlementResult] = useState<null | {
    order_id: number
    order_number: string
    receipt_public_url: string | null
    payment_method: 'cash' | 'qrpay'
    paid_amount: number
    cash_received: number
    change_amount: number
  }>(null)
  const [appointmentReceiptEmail, setAppointmentReceiptEmail] = useState('')
  const [appointmentReceiptEmailError, setAppointmentReceiptEmailError] = useState<string | null>(null)
  const [appointmentSendingReceiptEmail, setAppointmentSendingReceiptEmail] = useState(false)
  const [appointmentReceiptCooldownUntil, setAppointmentReceiptCooldownUntil] = useState(0)
  const [appointmentQrCodeFullscreen, setAppointmentQrCodeFullscreen] = useState(false)
  const [appointmentReceiptQrLoaded, setAppointmentReceiptQrLoaded] = useState(false)
  const [appointmentActionLoading, setAppointmentActionLoading] = useState(false)
  const [appointmentRescheduleOpen, setAppointmentRescheduleOpen] = useState(false)
  const [appointmentRescheduleStaffId, setAppointmentRescheduleStaffId] = useState<number | null>(null)
  const [appointmentRescheduleDate, setAppointmentRescheduleDate] = useState('')
  const [appointmentRescheduleSlotValue, setAppointmentRescheduleSlotValue] = useState('')
  const [appointmentRescheduleReason, setAppointmentRescheduleReason] = useState('')
  const [appointmentRescheduleSlots, setAppointmentRescheduleSlots] = useState<Array<{ start_at: string; end_at: string }>>([])
  const [appointmentRescheduleSlotsLoading, setAppointmentRescheduleSlotsLoading] = useState(false)
  const [appointmentRescheduleSubmitting, setAppointmentRescheduleSubmitting] = useState(false)
  const [appointmentReschedulePolicyWarnings, setAppointmentReschedulePolicyWarnings] = useState<string[]>([])
  /** Staff IDs with approved leave covering the selected day (DAY view). */
  const [staffOffTodayIds, setStaffOffTodayIds] = useState<number[]>([])

  const appointmentReceiptQrImageUrl = useMemo(() => {
    if (!appointmentSettlementResult?.receipt_public_url) return null
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(appointmentSettlementResult.receipt_public_url)}`
  }, [appointmentSettlementResult?.receipt_public_url])

  const appointmentReceiptQrFullscreenImageUrl = useMemo(() => {
    if (!appointmentSettlementResult?.receipt_public_url) return null
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(appointmentSettlementResult.receipt_public_url)}`
  }, [appointmentSettlementResult?.receipt_public_url])

  const appointmentReceiptCooldownActive = appointmentReceiptCooldownUntil > Date.now()

  useEffect(() => {
    if (!appointmentReceiptQrImageUrl && !appointmentReceiptQrFullscreenImageUrl) {
      setAppointmentReceiptQrLoaded(false)
      return
    }

    setAppointmentReceiptQrLoaded(false)
    const smallImage = new Image()
    smallImage.src = appointmentReceiptQrImageUrl ?? ''
    smallImage.onload = () => setAppointmentReceiptQrLoaded(true)
    smallImage.onerror = () => setAppointmentReceiptQrLoaded(true)

    if (appointmentReceiptQrFullscreenImageUrl) {
      const fullImage = new Image()
      fullImage.src = appointmentReceiptQrFullscreenImageUrl
    }
  }, [appointmentReceiptQrImageUrl, appointmentReceiptQrFullscreenImageUrl])

  useEffect(() => {
    if (!appointmentReceiptCooldownUntil) return

    const remaining = appointmentReceiptCooldownUntil - Date.now()
    if (remaining <= 0) {
      setAppointmentReceiptCooldownUntil(0)
      return
    }

    const timer = window.setTimeout(() => setAppointmentReceiptCooldownUntil(0), remaining)

    return () => window.clearTimeout(timer)
  }, [appointmentReceiptCooldownUntil])

  const mapStaffOptions = useCallback((json: unknown): StaffOption[] => {
    const maybe = json as { data?: { data?: StaffOption[] } | StaffOption[] } | null
    const payload = Array.isArray(maybe?.data && (maybe.data as { data?: StaffOption[] }).data)
      ? (maybe?.data as { data?: StaffOption[] }).data ?? []
      : Array.isArray(maybe?.data)
        ? maybe.data
        : []
    return payload
      .map((staff: StaffOption) => ({
        id: Number(staff.id),
        name: String(staff.name ?? '').trim(),
        phone: staff.phone ?? null,
        email: staff.email ?? null,
        code: staff.code ?? null,
        service_commission_rate: Number((staff as { service_commission_rate?: number }).service_commission_rate ?? 0),
        is_active: staff.is_active,
      }))
      .filter((staff) => staff.id > 0 && staff.name)
  }, [])

  const fetchStaffOptions = useCallback(
    async (search: string) => {
      const params = new URLSearchParams({ page: '1', per_page: '20', is_active: '1' })
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/proxy/staffs?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) return [] as StaffOption[]
      const json = await res.json().catch(() => null)
      return mapStaffOptions(json)
    },
    [mapStaffOptions],
  )

  const fetchActiveStaffs = useCallback(async () => {
    const params = new URLSearchParams({ page: '1', per_page: '200', is_active: '1' })
    const res = await fetch(`/api/proxy/staffs?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) return
    const json = await res.json().catch(() => null)
    setActiveStaffs(mapStaffOptions(json))
  }, [mapStaffOptions])

  const fetchAppointmentCustomers = useCallback(async (search: string) => {
    setAppointmentCustomerLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', per_page: '20' })
      if (search.trim()) params.set('name', search.trim())
      const res = await fetch(`/api/proxy/customers?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setAppointmentCustomerOptions([])
        return
      }
      const json = await res.json().catch(() => null)
      const paged = extractPaged<Record<string, unknown>>(json)
      const mapped = paged.data
        .map((row) => {
          const id = Number(row?.id ?? 0)
          const name = String(row?.name ?? '').trim()
          if (!id || !name) return null
          return {
            id,
            name,
            phone: typeof row?.phone === 'string' ? row.phone : null,
            email: typeof row?.email === 'string' ? row.email : null,
          }
        })
        .filter(
          (row): row is { id: number; name: string; phone: string | null; email: string | null } => Boolean(row),
        )
      setAppointmentCustomerOptions(mapped)
    } catch {
      setAppointmentCustomerOptions([])
    } finally {
      setAppointmentCustomerLoading(false)
    }
  }, [])

  const fetchAppointmentStaffs = useCallback(
    async (search: string) => {
      setAppointmentStaffLoading(true)
      try {
        const rows = await fetchStaffOptions(search)
        setAppointmentStaffOptions(rows)
      } finally {
        setAppointmentStaffLoading(false)
      }
    },
    [fetchStaffOptions],
  )

  const fetchAppointments = useCallback(async () => {
    setAppointmentsLoading(true)
    try {
      const params = new URLSearchParams({ page: '1' })
      if (posApptViewMode === 'month') {
        const start = new Date(posApptCalendarMonth.getFullYear(), posApptCalendarMonth.getMonth(), 1)
        const end = new Date(posApptCalendarMonth.getFullYear(), posApptCalendarMonth.getMonth() + 1, 0)
        const ymd = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        params.set('from_date', ymd(start))
        params.set('to_date', ymd(end))
        params.set('per_page', '500')
      } else {
        params.set('per_page', '100')
        if (appointmentDateFilter) params.set('date', appointmentDateFilter)
      }
      if (appointmentQuery.trim()) params.set('q', appointmentQuery.trim())
      if (appointmentCustomerFilter.trim()) params.set('customer_id', appointmentCustomerFilter.trim())
      if (appointmentStaffFilter.trim()) params.set('staff_id', appointmentStaffFilter.trim())
      if (appointmentStatusFilter.trim()) params.set('status', appointmentStatusFilter.trim())

      const res = await fetch(`/api/proxy/pos/appointments?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setAppointments([])
        setPendingCancellationRequestsCount(0)
        return
      }

      const paged = extractPaged<PosAppointmentListItem>(json)
      setAppointments(paged.data)
      setPendingCancellationRequestsCount(paged.pending_cancellation_requests_count)
    } catch {
      setAppointments([])
      setPendingCancellationRequestsCount(0)
    } finally {
      setAppointmentsLoading(false)
    }
  }, [
    appointmentCustomerFilter,
    appointmentDateFilter,
    appointmentQuery,
    appointmentStaffFilter,
    appointmentStatusFilter,
    posApptCalendarMonth,
    posApptViewMode,
  ])

  const openAppointmentDetail = useCallback(
    async (appointmentId: number) => {
      setAppointmentDetailLoading(true)
      setAppointmentDetail(null)
      setAppointmentSettlementResult(null)
      setAppointmentCheckoutConfirmationOpen(false)
      setAppointmentPaymentMethod('cash')
      setAppointmentCashReceived('')
      if (appointmentQrProofPreviewUrl) {
        URL.revokeObjectURL(appointmentQrProofPreviewUrl)
      }
      setAppointmentQrProofPreviewUrl(null)
      setAppointmentQrProofFileName(null)
      setAppointmentReschedulePolicyWarnings([])
      try {
        const res = await fetch(`/api/proxy/pos/appointments/${appointmentId}`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          showMsg(json?.message ?? 'Unable to load appointment detail.', 'error')
          return
        }
        setAppointmentDetail((json?.data ?? null) as PosAppointmentDetail | null)
      } finally {
        setAppointmentDetailLoading(false)
      }
    },
    [appointmentQrProofPreviewUrl, showMsg],
  )

  const refreshOpenedAppointmentDetail = useCallback(async () => {
    if (!appointmentDetail?.id) return
    const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}`, { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    if (res.ok) {
      setAppointmentDetail((json?.data ?? null) as PosAppointmentDetail | null)
    }
  }, [appointmentDetail?.id])

  const loadCancellationRequestsModal = useCallback(async () => {
    setCancellationRequestsLoading(true)
    setCancellationRequestsError(null)
    try {
      const res = await fetch('/api/proxy/pos/cancellation-requests?status=pending&per_page=50', { cache: 'no-store' })
      const payload = (await res.json().catch(() => null)) as { data?: { data?: unknown }; message?: string } | null
      if (!res.ok) {
        setCancellationRequestsRows([])
        setCancellationRequestsError(
          typeof payload?.message === 'string' ? payload.message : 'Failed to load cancellation requests.',
        )
        return
      }
      const rows = payload?.data?.data ?? payload?.data ?? []
      setCancellationRequestsRows(Array.isArray(rows) ? (rows as PosCancellationRequestRow[]) : [])
    } catch {
      setCancellationRequestsRows([])
      setCancellationRequestsError('Failed to load cancellation requests.')
    } finally {
      setCancellationRequestsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!cancellationRequestsModalOpen) return
    void loadCancellationRequestsModal()
  }, [cancellationRequestsModalOpen, loadCancellationRequestsModal])

  const submitPosCancellationReview = useCallback(
    async (id: number, action: 'approve' | 'reject', adminNote: string | null) => {
      if (!canReviewCancellationRequests) return
      setCancellationReviewSubmitting(true)
      try {
        const res = await fetch(`/api/proxy/pos/cancellation-requests/${id}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_note: adminNote }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          showMsg(String((json as { message?: string } | null)?.message ?? `Unable to ${action} request.`), 'error')
          return
        }
        showMsg(action === 'approve' ? 'Cancellation approved.' : 'Cancellation request rejected.', 'success')
        setCancellationConfirmOpen(false)
        setCancellationConfirmRow(null)
        setCancellationConfirmAction(null)
        setCancellationConfirmNote('')
        await loadCancellationRequestsModal()
        await fetchAppointments()
        await refreshOpenedAppointmentDetail()
      } finally {
        setCancellationReviewSubmitting(false)
      }
    },
    [canReviewCancellationRequests, fetchAppointments, loadCancellationRequestsModal, refreshOpenedAppointmentDetail, showMsg],
  )

  const sendAppointmentReceiptToEmail = useCallback(async () => {
    if (!appointmentSettlementResult?.order_id) return

    const normalizedEmail = appointmentReceiptEmail.trim()
    if (!normalizedEmail) {
      setAppointmentReceiptEmailError('Email is required.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setAppointmentReceiptEmailError('Please enter a valid email.')
      return
    }

    setAppointmentSendingReceiptEmail(true)
    setAppointmentReceiptEmailError(null)

    try {
      const res = await fetch(`/api/proxy/orders/${appointmentSettlementResult.order_id}/send-receipt-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        setAppointmentReceiptEmailError(String((json as { message?: string } | null)?.message ?? 'Unable to send receipt email.'))
        return
      }

      setAppointmentReceiptCooldownUntil(Date.now() + 10_000)
      showMsg('Receipt sent', 'success')
    } catch {
      setAppointmentReceiptEmailError('Unable to send receipt email.')
    } finally {
      setAppointmentSendingReceiptEmail(false)
    }
  }, [appointmentSettlementResult, appointmentReceiptEmail, showMsg])

  const settleAppointmentPayment = useCallback(async () => {
    if (!appointmentDetail?.id) return
    const dueAmount = Number(appointmentDetail.amount_due_now ?? appointmentDetail.balance_due ?? 0)
    const cashReceivedAmount = Number(appointmentCashReceived || 0)
    if (dueAmount <= 0) {
      setAppointmentCheckoutError('No balance due for this appointment.')
      return
    }

    if (appointmentPaymentMethod === 'cash') {
      if (!Number.isFinite(cashReceivedAmount) || cashReceivedAmount < dueAmount) {
        setAppointmentCheckoutError('Cash received must be equal to or greater than the settlement amount.')
        return
      }
    }

    if (appointmentPaymentMethod === 'qrpay' && !appointmentQrProofFileName) {
      setAppointmentCheckoutError('Please upload QR payment proof before confirming checkout.')
      return
    }

    setAppointmentCheckoutError(null)
    setAppointmentActionLoading(true)
    try {
      const payload = {
        payment_method: appointmentPaymentMethod,
      }

      const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/collect-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setAppointmentCheckoutError(String(json?.message ?? 'Unable to collect payment.'))
        return
      }

      showMsg('Appointment payment collected.', 'success')
      setAppointmentCheckoutError(null)
      setAppointmentCheckoutConfirmationOpen(false)
      setAppointmentSettlementResult({
        order_id: Number(json?.data?.order_id ?? 0),
        order_number: String(json?.data?.order_number ?? '-'),
        receipt_public_url: json?.data?.receipt_public_url ?? null,
        payment_method: appointmentPaymentMethod,
        paid_amount: dueAmount,
        cash_received: appointmentPaymentMethod === 'cash' ? cashReceivedAmount : dueAmount,
        change_amount: appointmentPaymentMethod === 'cash' ? Math.max(0, cashReceivedAmount - dueAmount) : 0,
      })
      setAppointmentReceiptEmail(appointmentDetail?.customer?.email?.trim() ?? '')
      setAppointmentReceiptEmailError(null)
      setAppointmentReceiptCooldownUntil(0)
      setAppointmentQrCodeFullscreen(false)
      setAppointmentReceiptQrLoaded(false)
      setAppointmentCashReceived('')
      if (appointmentQrProofPreviewUrl) {
        URL.revokeObjectURL(appointmentQrProofPreviewUrl)
      }
      setAppointmentQrProofPreviewUrl(null)
      setAppointmentQrProofFileName(null)
      await fetchAppointments()
      await refreshOpenedAppointmentDetail()
    } finally {
      setAppointmentActionLoading(false)
    }
  }, [
    appointmentCashReceived,
    appointmentDetail,
    appointmentPaymentMethod,
    appointmentQrProofFileName,
    appointmentQrProofPreviewUrl,
    fetchAppointments,
    refreshOpenedAppointmentDetail,
    showMsg,
  ])

  const applyAppointmentPackage = useCallback(async () => {
    if (!appointmentDetail?.id) return
    setAppointmentActionLoading(true)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/apply-package`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to apply package.', 'error')
        return
      }
      showMsg('Package reserved for appointment.', 'success')
      await fetchAppointments()
      await refreshOpenedAppointmentDetail()
    } finally {
      setAppointmentActionLoading(false)
    }
  }, [appointmentDetail?.id, fetchAppointments, refreshOpenedAppointmentDetail, showMsg])

  const markAppointmentCompleted = useCallback(async () => {
    if (!appointmentDetail?.id) return
    setAppointmentActionLoading(true)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/mark-completed`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to mark completed.', 'error')
        return
      }
      showMsg('Appointment marked as completed.', 'success')
      await fetchAppointments()
      await refreshOpenedAppointmentDetail()
    } finally {
      setAppointmentActionLoading(false)
    }
  }, [appointmentDetail?.id, fetchAppointments, refreshOpenedAppointmentDetail, showMsg])

  const updateAppointmentStatus = useCallback(
    async (status: 'CANCELLED' | 'LATE_CANCELLATION' | 'NO_SHOW') => {
      if (!appointmentDetail?.id) return
      setAppointmentActionLoading(true)
      try {
        const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          showMsg(json?.message ?? 'Unable to update status.', 'error')
          return
        }
        showMsg('Appointment status updated.', 'success')
        await fetchAppointments()
        await refreshOpenedAppointmentDetail()
      } finally {
        setAppointmentActionLoading(false)
      }
    },
    [appointmentDetail?.id, fetchAppointments, refreshOpenedAppointmentDetail, showMsg],
  )

  const openAppointmentRescheduleModal = useCallback(() => {
    if (!appointmentDetail) return
    setAppointmentReschedulePolicyWarnings([])
    setAppointmentRescheduleStaffId(appointmentDetail.staff?.id ?? null)
    const currentStartAt = appointmentDetail.appointment_start_at ? new Date(appointmentDetail.appointment_start_at) : null
    setAppointmentRescheduleDate(currentStartAt ? currentStartAt.toISOString().slice(0, 10) : '')
    setAppointmentRescheduleSlotValue('')
    setAppointmentRescheduleReason('')
    setAppointmentRescheduleSlots([])
    setAppointmentRescheduleOpen(true)
  }, [appointmentDetail])

  const submitAppointmentReschedule = useCallback(async () => {
    if (!appointmentDetail?.id) return
    if (!appointmentRescheduleStaffId) {
      showMsg('Please select assigned staff.', 'error')
      return
    }
    if (!appointmentRescheduleDate) {
      showMsg('Please select appointment date.', 'error')
      return
    }
    if (!appointmentRescheduleSlotValue) {
      showMsg('Please select appointment slot/time.', 'error')
      return
    }

    setAppointmentRescheduleSubmitting(true)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: appointmentRescheduleStaffId,
          start_at: appointmentRescheduleSlotValue,
          reason: appointmentRescheduleReason.trim() ? appointmentRescheduleReason.trim() : null,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to reschedule appointment.', 'error')
        return
      }

      const warnings = Array.isArray(json?.data?.policy_warnings)
        ? json.data.policy_warnings.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
        : []
      setAppointmentReschedulePolicyWarnings(warnings)
      showMsg(warnings.length ? 'Appointment rescheduled with override warning.' : 'Appointment rescheduled.', 'success')
      setAppointmentRescheduleOpen(false)
      await fetchAppointments()
      await refreshOpenedAppointmentDetail()
    } finally {
      setAppointmentRescheduleSubmitting(false)
    }
  }, [
    appointmentDetail?.id,
    appointmentRescheduleDate,
    appointmentRescheduleReason,
    appointmentRescheduleSlotValue,
    appointmentRescheduleStaffId,
    fetchAppointments,
    refreshOpenedAppointmentDetail,
    showMsg,
  ])

  useEffect(() => {
    const loadRescheduleSlots = async () => {
      if (!appointmentRescheduleOpen || !appointmentDetail?.service?.id || !appointmentRescheduleStaffId || !appointmentRescheduleDate) {
        setAppointmentRescheduleSlots([])
        setAppointmentRescheduleSlotValue('')
        return
      }

      setAppointmentRescheduleSlotsLoading(true)
      try {
        const params = new URLSearchParams({
          service_id: String(appointmentDetail.service.id),
          staff_id: String(appointmentRescheduleStaffId),
          date: appointmentRescheduleDate,
        })
        const res = await fetch(`/api/proxy/booking/availability?${params.toString()}`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        const rows: unknown[] = Array.isArray(json?.data?.slots) ? json.data.slots : []
        const slots = rows
          .map((row: unknown) => {
            if (!row || typeof row !== 'object') return null
            const maybe = row as Record<string, unknown>
            const startAt = String(maybe.start_at ?? '')
            const endAt = String(maybe.end_at ?? '')
            if (!startAt || !endAt) return null
            return { start_at: startAt, end_at: endAt }
          })
          .filter((row): row is { start_at: string; end_at: string } => Boolean(row))

        setAppointmentRescheduleSlots(slots)
        setAppointmentRescheduleSlotValue((prev) => (slots.some((slot) => slot.start_at === prev) ? prev : ''))
      } finally {
        setAppointmentRescheduleSlotsLoading(false)
      }
    }

    void loadRescheduleSlots()
  }, [appointmentDetail?.service?.id, appointmentRescheduleDate, appointmentRescheduleOpen, appointmentRescheduleStaffId])

  useEffect(() => {
    void fetchAppointments()
  }, [
    appointmentCustomerFilter,
    appointmentDateFilter,
    appointmentQuery,
    appointmentStaffFilter,
    appointmentStatusFilter,
    fetchAppointments,
    posApptCalendarMonth,
    posApptViewMode,
  ])

  useEffect(() => {
    setAppointmentListRefreshCountdown(5)
  }, [
    appointmentCustomerFilter,
    appointmentDateFilter,
    appointmentQuery,
    appointmentStaffFilter,
    appointmentStatusFilter,
    posApptCalendarMonth,
    posApptViewMode,
  ])

  useEffect(() => {
    if (!appointmentListAutoRefresh) return
    const id = window.setInterval(() => {
      setAppointmentListRefreshCountdown((c) => {
        if (c <= 1) {
          void fetchAppointments()
          return 5
        }
        return c - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [appointmentListAutoRefresh, fetchAppointments])

  useEffect(() => {
    void fetchAppointmentCustomers('')
    void fetchAppointmentStaffs('')
  }, [fetchAppointmentCustomers, fetchAppointmentStaffs])

  useEffect(() => {
    void fetchActiveStaffs()
  }, [fetchActiveStaffs])

  useEffect(() => {
    if (posApptViewMode !== 'day') {
      setStaffOffTodayIds([])
      return
    }
    const dayYmd = appointmentDateFilter
    let cancelled = false
    ;(async () => {
      const qs = new URLSearchParams({
        status: 'approved',
        from_date: dayYmd,
        to_date: dayYmd,
        per_page: '500',
      })
      const res = await fetch(`/api/proxy/admin/booking/leave-requests?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        if (!cancelled) setStaffOffTodayIds([])
        return
      }
      const json = await res.json().catch(() => null)
      const rows = extractPaged<{ staff_id: number; start_date: string; end_date: string }>(json).data
      const seen = new Set<number>()
      const off: number[] = []
      for (const row of rows) {
        const sid = Number(row.staff_id)
        if (!Number.isFinite(sid) || sid <= 0 || seen.has(sid)) continue
        if (!ymdInInclusiveRange(dayYmd, row.start_date, row.end_date ?? row.start_date)) continue
        seen.add(sid)
        off.push(sid)
      }
      off.sort((a, b) => a - b)
      if (!cancelled) setStaffOffTodayIds(off)
    })()
    return () => {
      cancelled = true
    }
  }, [appointmentDateFilter, posApptViewMode])

  const scheduleStaffForDayGrid = useMemo(
    () => activeStaffs.map((s) => ({ id: s.id, name: s.name })),
    [activeStaffs],
  )

  const onSelectAppointmentQrProof: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (appointmentQrProofPreviewUrl) {
      URL.revokeObjectURL(appointmentQrProofPreviewUrl)
    }
    const url = URL.createObjectURL(file)
    setAppointmentCheckoutError(null)
    setAppointmentQrProofFileName(file.name)
    setAppointmentQrProofPreviewUrl(url)
    event.currentTarget.value = ''
  }

  const clearAppointmentQrProof = () => {
    if (appointmentQrProofPreviewUrl) {
      URL.revokeObjectURL(appointmentQrProofPreviewUrl)
    }
    setAppointmentCheckoutError(null)
    setAppointmentQrProofPreviewUrl(null)
    setAppointmentQrProofFileName(null)
  }

  const appointmentIsFullyPackageCovered = useMemo(() => {
    const serviceTotal = Number(appointmentDetail?.service_total ?? 0)
    const packageOffset = Number(appointmentDetail?.package_offset ?? 0)
    return serviceTotal > 0 && packageOffset >= serviceTotal - 0.0001
  }, [appointmentDetail?.package_offset, appointmentDetail?.service_total])

  const appointmentDepositContributionForSettlement = useMemo(() => {
    const contribution = Number(appointmentDetail?.deposit_contribution ?? appointmentDetail?.deposit_paid ?? 0)
    return appointmentIsFullyPackageCovered ? 0 : contribution
  }, [appointmentDetail?.deposit_contribution, appointmentDetail?.deposit_paid, appointmentIsFullyPackageCovered])

  const appointmentPreviouslyCollectedDeposit = useMemo(() => {
    const wasCollected = Boolean(appointmentDetail?.deposit_previously_collected)
    const amount = Number(appointmentDetail?.deposit_previously_collected_amount ?? 0)
    return appointmentIsFullyPackageCovered && wasCollected ? amount : 0
  }, [appointmentDetail?.deposit_previously_collected, appointmentDetail?.deposit_previously_collected_amount, appointmentIsFullyPackageCovered])

  const appointmentAddonTotal = useMemo(() => {
    if (!appointmentDetail) return 0
    if (appointmentDetail.addon_total_price != null && appointmentDetail.addon_total_price !== undefined) {
      return Number(appointmentDetail.addon_total_price)
    }
    return (appointmentDetail.add_ons ?? []).reduce((sum, a) => sum + Number(a.extra_price ?? 0), 0)
  }, [appointmentDetail])

  const appointmentServiceAmount = useMemo(
    () => Number(appointmentDetail?.service_total ?? 0),
    [appointmentDetail?.service_total],
  )

  const appointmentSubtotalBeforeCredits = useMemo(
    () => appointmentServiceAmount + appointmentAddonTotal,
    [appointmentAddonTotal, appointmentServiceAmount],
  )

  const appointmentPackageOffsetAmount = useMemo(
    () => Number(appointmentDetail?.package_offset ?? 0),
    [appointmentDetail?.package_offset],
  )

  /** Add-on amount still due at settlement (list total minus add-on deposits already paid on orders). */
  const appointmentAddonDueForBreakdown = useMemo(() => {
    if (!appointmentDetail) return 0
    const bal = appointmentDetail.addon_balance_due
    if (bal != null && Number.isFinite(Number(bal))) return Number(bal)
    return appointmentAddonTotal
  }, [appointmentDetail, appointmentAddonTotal])

  /**
   * Deposit credited against this visit’s service balance only.
   * Do not add linked_booking_deposit: that is the same pool of money; the API already splits it into deposit_contribution per booking.
   */
  const appointmentDepositTotalForBreakdown = useMemo(
    () => Number(appointmentDepositContributionForSettlement),
    [appointmentDepositContributionForSettlement],
  )

  const appointmentDueAmountNow = Number(appointmentDetail?.amount_due_now ?? appointmentDetail?.balance_due ?? 0)
  const appointmentSettlementPaid = Number(appointmentDetail?.settlement_paid ?? 0)
  const appointmentPackageApplied = ['reserved', 'consumed'].includes(
    String(appointmentDetail?.package_status?.status ?? '').toLowerCase(),
  )
  const appointmentCheckoutCompleted = appointmentSettlementPaid > 0
  const appointmentShowApplyPackageButton = useMemo(
    () =>
      !appointmentPackageApplied &&
      !appointmentCheckoutCompleted &&
      !['reserved', 'consumed'].includes(String(appointmentDetail?.package_status?.status ?? '').toLowerCase()),
    [appointmentCheckoutCompleted, appointmentDetail?.package_status?.status, appointmentPackageApplied],
  )
  const appointmentStatusUpper = String(appointmentDetail?.status ?? '').toUpperCase()
  /** Cancelled / no-show / late cancel — no checkout or “complete visit” CTAs. */
  const appointmentIsTerminalCancelled = ['CANCELLED', 'NO_SHOW', 'LATE_CANCELLATION'].includes(appointmentStatusUpper)

  const appointmentShowPaymentBadge =
    !appointmentIsTerminalCancelled && ['CONFIRMED', 'COMPLETED'].includes(appointmentStatusUpper)
  const appointmentPaymentBadgeIsPaid = appointmentDueAmountNow <= 0.0001

  const canMarkAppointmentCompleted =
    !appointmentActionLoading &&
    !appointmentIsTerminalCancelled &&
    appointmentStatusUpper !== 'COMPLETED'

  const showAppointmentCollectPayment =
    appointmentDueAmountNow > 0 && !appointmentIsTerminalCancelled && appointmentStatusUpper === 'COMPLETED'

  const showAppointmentMarkCompletedBlock =
    !appointmentIsTerminalCancelled && appointmentStatusUpper === 'CONFIRMED'

  const showAppointmentPaymentCtaCard =
    appointmentReschedulePolicyWarnings.length > 0 ||
    showAppointmentCollectPayment ||
    showAppointmentMarkCompletedBlock

  const appointmentDueAmount = Number(appointmentDetail?.amount_due_now ?? appointmentDetail?.balance_due ?? 0)
  const appointmentCashReceivedAmount = Number(appointmentCashReceived || 0)
  const appointmentCashChange = Math.max(0, appointmentCashReceivedAmount - appointmentDueAmount)

  return (
    <div className="min-h-screen space-y-4 bg-gray-50 p-3 sm:space-y-5 sm:p-4 lg:space-y-6 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">POS Appointments</h2>
          {/* <p className="mt-2 text-sm text-gray-600">
            Month view shows a calendar; Day view shows the staff × time grid. Settlement stays on the right.
          </p>
          {currentUser?.name ? (
            <p className="mt-1 text-xs text-gray-500">Signed in as {currentUser.name}</p>
          ) : null} */}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5 xl:min-h-0">
        <div className="space-y-5 xl:col-span-3 xl:min-h-0">
          <div className="flex flex-col rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md">
            <h3 className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xl font-bold text-gray-900">
              <span className="flex items-center gap-2">
                <svg className="h-6 w-6 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Appointments
              </span>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={appointmentListAutoRefresh}
                    onChange={(e) => {
                      const on = e.target.checked
                      setAppointmentListAutoRefresh(on)
                      if (on) setAppointmentListRefreshCountdown(5)
                    }}
                    className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  Auto refresh
                </label>
                {appointmentListAutoRefresh ? (
                  <span
                    className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg bg-slate-800 px-2 font-mono text-base font-bold tabular-nums text-white shadow-inner ring-1 ring-slate-600"
                    title="Seconds until the list refreshes"
                  >
                    {appointmentListRefreshCountdown}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-500">Manual refresh only</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAppointmentListRefreshCountdown(5)
                    void fetchAppointments()
                  }}
                  disabled={appointmentsLoading}
                  title={
                    appointmentListAutoRefresh
                      ? 'Refresh now (countdown resets to 5)'
                      : 'Refresh list'
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-900 disabled:pointer-events-none disabled:opacity-50"
                >
                  <svg
                    className={`h-4 w-4 shrink-0 ${appointmentsLoading ? 'animate-spin text-blue-600' : 'text-gray-600'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setCancellationRequestsModalOpen(true)}
                  className="relative inline-flex items-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-amber-500 hover:bg-amber-50 hover:text-amber-950"
                  aria-label={
                    pendingCancellationRequestsCount > 0
                      ? `Cancellation requests, ${pendingCancellationRequestsCount} pending`
                      : 'Cancellation requests'
                  }
                >
                  Request
                  {pendingCancellationRequestsCount > 0 ? (
                    <span
                      className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white"
                      aria-hidden
                    >
                      {pendingCancellationRequestsCount > 99 ? '99+' : pendingCancellationRequestsCount}
                    </span>
                  ) : null}
                </button>
              </div>
            </h3>
            <PosAppointmentsSchedule
              viewMode={posApptViewMode}
              onViewModeChange={(mode) => {
                setPosApptViewMode(mode)
                if (mode === 'day') {
                  const n = new Date()
                  const todayYmd = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
                  setAppointmentDateFilter(appointmentDateFilter || todayYmd)
                } else {
                  const parts = appointmentDateFilter.split('-').map(Number)
                  const [y, m] = parts
                  if (parts.length === 3 && y && m) {
                    setPosApptCalendarMonth(new Date(y, m - 1, 1))
                  }
                }
              }}
              calendarMonth={posApptCalendarMonth}
              onCalendarMonthChange={setPosApptCalendarMonth}
              dayDate={appointmentDateFilter}
              onDayDateChange={(ymd) => setAppointmentDateFilter(ymd)}
              onMonthDayNavigateToDay={(ymd) => {
                setAppointmentDateFilter(ymd)
                const [y, m] = ymd.split('-').map(Number)
                if (y && m) setPosApptCalendarMonth(new Date(y, m - 1, 1))
                setPosApptViewMode('day')
              }}
              appointments={appointments}
              appointmentsLoading={appointmentsLoading}
              onOpenAppointment={(id) => void openAppointmentDetail(id)}
              scheduleStaff={scheduleStaffForDayGrid}
              staffOffTodayIds={staffOffTodayIds}
              filterSlot={(
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={appointmentQuery}
                    onChange={(e) => setAppointmentQuery(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Search booking no (e.g. BK-20260327233637-15FFBC)"
                  />
                  <select
                    value={appointmentCustomerFilter}
                    onChange={(e) => setAppointmentCustomerFilter(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">{appointmentCustomerLoading ? 'Loading customers...' : 'All Customers'}</option>
                    {appointmentCustomerOptions.map((customer) => (
                      <option key={`appointment-customer-${customer.id}`} value={String(customer.id)}>
                        {customer.name}{customer.phone ? ` · ${customer.phone}` : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    value={appointmentStaffFilter}
                    onChange={(e) => setAppointmentStaffFilter(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">{appointmentStaffLoading ? 'Loading staffs...' : 'All Staffs'}</option>
                    {appointmentStaffOptions.map((staff) => (
                      <option key={`appointment-staff-${staff.id}`} value={String(staff.id)}>
                        {staff.name}{staff.code ? ` · ${staff.code}` : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    value={appointmentStatusFilter}
                    onChange={(e) => setAppointmentStatusFilter(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">ALL</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="NO_SHOW">NO_SHOW</option>
                    <option value="LATE_CANCELLATION">LATE_CANCELLATION</option>
                  </select>
                </div>
              )}
            />
          </div>
        </div>

        <div className="space-y-5 xl:col-span-2 xl:min-h-0">
          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-900/5 ">
            <div className="flex-shrink-0 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 sm:px-5">
              <h3 className="text-base font-bold tracking-tight text-slate-900">Appointment Settlement</h3>
              <p className="mt-0.5 text-xs text-slate-500">Review the breakdown, collect payment, or update the booking.</p>
            </div>

            {appointmentDetailLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" aria-hidden />
                <p className="text-sm text-slate-500">Loading booking details…</p>
              </div>
            ) : !appointmentDetail ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
                <div className="rounded-full bg-slate-100 p-4 text-slate-400">
                  <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-700">No appointment selected</p>
                <p className="mt-1 max-w-[18rem] text-xs leading-relaxed text-slate-500">
                  Tap a time slot or pick a date in the schedule. Settlement and actions will appear here.
                </p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5">
                  {/* Booking summary */}
                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="inline-flex items-center rounded-md bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-800 ring-1 ring-slate-200">
                        {appointmentDetail.booking_code}
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <BookingStatusBadge status={appointmentDetail.status} label={appointmentDetail.status} showDot={false} />
                        {appointmentShowPaymentBadge ? (
                          appointmentPaymentBadgeIsPaid ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200">
                              Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200">
                              Unpaid
                            </span>
                          )
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-3 text-lg font-semibold leading-snug text-slate-900">{appointmentDetail.customer?.name ?? '—'}</p>

                    <div className="mt-4 rounded-lg border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-white px-3 py-3 shadow-sm ring-1 ring-indigo-100/80">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-900">Services</p>
                      <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-900">{appointmentDetail.service?.name ?? '—'}</p>
                    </div>

                    {appointmentDetail.add_ons?.length ? (
                      <div className="mt-3 rounded-lg border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white px-3 py-3 shadow-sm ring-1 ring-violet-100/80">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-900">Add-ons</p>
                        <ul className="mt-2 space-y-2 text-sm text-slate-800">
                          {appointmentDetail.add_ons.map((addon, idx) => (
                            <li
                              key={`${addon.id ?? addon.name}-${idx}`}
                              className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-white/80 px-2 py-1.5 ring-1 ring-violet-100"
                            >
                              <span className="min-w-0 font-medium">{addon.name}</span>
                              <span className="shrink-0 text-xs tabular-nums text-violet-900/80">
                                +RM {Number(addon.extra_price ?? 0).toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <div className="flex gap-3 text-sm">
                        <span className="w-[5.5rem] shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Staff</span>
                        <span className="min-w-0 font-semibold text-slate-900">{appointmentDetail.staff?.name ?? '—'}</span>
                      </div>
                      <div className="flex gap-3 text-sm">
                        <span className="w-[5.5rem] shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</span>
                        <span className="min-w-0 text-slate-800">
                          {formatDateTimeRange(appointmentDetail.appointment_start_at, appointmentDetail.appointment_end_at)}
                        </span>
                      </div>
                      <div className="flex gap-3 text-sm">
                        <span className="w-[5.5rem] shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</span>
                        <span className="font-medium tabular-nums text-slate-900">
                          {formatDurationFromRange(appointmentDetail.appointment_start_at, appointmentDetail.appointment_end_at)}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Payment breakdown */}
                  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {appointmentDueAmountNow <= 0 &&
                    (appointmentIsFullyPackageCovered || appointmentPreviouslyCollectedDeposit > 0) ? (
                      <div className="border-b border-emerald-100 bg-emerald-50/70 px-4 py-2.5">
                        {appointmentIsFullyPackageCovered ? (
                          <p className="text-sm font-semibold text-emerald-900">Fully covered by package</p>
                        ) : null}
                        {appointmentPreviouslyCollectedDeposit > 0 ? (
                          <p
                            className={`text-[11px] leading-relaxed text-emerald-900/90 ${appointmentIsFullyPackageCovered ? 'mt-1' : ''}`}
                          >
                            Deposit previously collected RM {appointmentPreviouslyCollectedDeposit.toFixed(2)} — verify if adjustment is
                            needed.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <h4 className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                      Payment breakdown
                    </h4>
                    <div className="divide-y divide-slate-100 px-4 text-sm">
                      <div className="flex items-center justify-between gap-3 py-3.5">
                        <span className="text-slate-600">Service</span>
                        <span className="font-medium tabular-nums text-slate-900">RM {appointmentServiceAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col gap-1 py-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600">Add-ons</span>
                          <span className="font-medium tabular-nums text-slate-900">
                            {(appointmentDetail?.add_ons?.length ?? 0) > 0 || appointmentAddonTotal > 0
                              ? `RM ${appointmentAddonDueForBreakdown.toFixed(2)}`
                              : '—'}
                          </span>
                        </div>
                        {appointmentAddonTotal > appointmentAddonDueForBreakdown + 0.005 &&
                        Number(appointmentDetail?.addon_paid_online ?? 0) > 0.005 ? (
                          <p className="text-[11px] leading-snug text-slate-500">
                            List total RM {appointmentAddonTotal.toFixed(2)} · RM{' '}
                            {Number(appointmentDetail.addon_paid_online).toFixed(2)} already paid toward add-ons
                          </p>
                        ) : null}
                      </div>
                      {/* <div className="flex items-center justify-between gap-3 border-t border-dashed border-slate-200 py-3.5">
                        <span className="font-semibold text-slate-800">Subtotal</span>
                        <span className="font-semibold tabular-nums text-slate-900">RM {appointmentSubtotalBeforeCredits.toFixed(2)}</span>
                      </div> */}
                      <div className="flex items-center justify-between gap-3 py-3.5">
                        <span className="text-slate-600">Deposit</span>
                        <span className="font-medium tabular-nums text-slate-800">
                          {appointmentDepositTotalForBreakdown > 0 ? `− RM ${appointmentDepositTotalForBreakdown.toFixed(2)}` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-3.5">
                        <span className="text-slate-600">Package offset</span>
                        <span className="font-medium tabular-nums text-emerald-800">− RM {appointmentPackageOffsetAmount.toFixed(2)}</span>
                      </div>

                      <div className="-mx-4 flex items-center justify-between gap-3 border-t-2 border-slate-200 bg-emerald-50/50 px-4 py-4">
                        <span className="text-base font-bold text-slate-900">Total Amount to Pay</span>
                        <span className="text-xl font-bold tabular-nums text-emerald-800">RM {appointmentDueAmountNow.toFixed(2)}</span>
                      </div>
                    </div>
                    {/* <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] leading-relaxed text-slate-500">
                      Package: {appointmentDetail.package_status?.status ?? 'Not applied'}
                      {appointmentDueAmountNow > 0 ? ' · Final amount is calculated by the system.' : null}
                    </p> */}
                  </section>

                  {/* Payment CTAs — hidden for cancelled / no-show / late cancellation */}
                  {showAppointmentPaymentCtaCard ? (
                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {appointmentReschedulePolicyWarnings.length ? (
                      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        {appointmentReschedulePolicyWarnings.map((warning, idx) => (
                          <p key={`${warning}-${idx}`}>{warning}</p>
                        ))}
                      </div>
                    ) : null}

                    {showAppointmentCollectPayment ? (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collect payment</p>
                        <p className="text-xs text-slate-500">Settle this completed appointment via cash or QRPay.</p>
                        <div className={`grid gap-2 ${appointmentShowApplyPackageButton ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          <button
                            type="button"
                            disabled={appointmentActionLoading || appointmentDueAmountNow <= 0}
                            onClick={() => {
                              const due = appointmentDueAmountNow
                              setAppointmentPaymentMethod('cash')
                              setAppointmentCashReceived(due > 0 ? due.toFixed(2) : '')
                              setAppointmentCheckoutError(null)
                              setAppointmentCheckoutConfirmationOpen(true)
                            }}
                            className="min-h-[44px] rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"
                          >
                            Checkout
                          </button>
                          {appointmentShowApplyPackageButton ? (
                            <button
                              type="button"
                              disabled={appointmentActionLoading}
                              onClick={() => void applyAppointmentPackage()}
                              className="min-h-[44px] rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:pointer-events-none disabled:opacity-50"
                            >
                              Apply package
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {showAppointmentMarkCompletedBlock ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Complete visit</p>
                        <p className="text-xs text-slate-500">Mark as Completed first to enable Checkout / Apply package.</p>
                        <button
                          type="button"
                          disabled={!canMarkAppointmentCompleted || appointmentActionLoading}
                          title={
                            canMarkAppointmentCompleted ? 'Mark appointment as completed' : 'Mark appointment as completed'
                          }
                          onClick={() => void markAppointmentCompleted()}
                          className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
                        >
                          Mark as Completed
                        </button>
                      </div>
                    ) : null}
                  </section>
                  ) : null}

                  {/* Booking actions — hidden after checkout (settlement recorded); Mark Completed lives under Collect payment / Complete visit */}
                  {appointmentDetail.status === 'CONFIRMED' && !appointmentCheckoutCompleted ? (
                    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booking actions</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={appointmentActionLoading}
                          onClick={openAppointmentRescheduleModal}
                          className="min-h-[48px] rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm font-semibold text-indigo-900 shadow-sm transition hover:bg-indigo-50 disabled:opacity-50"
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          disabled={appointmentActionLoading}
                          onClick={() => void updateAppointmentStatus('CANCELLED')}
                          className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={appointmentActionLoading}
                          title="Customer did not attend the scheduled appointment (DNA / no-show)."
                          onClick={() => void updateAppointmentStatus('NO_SHOW')}
                          className="min-h-[48px] rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          No Show
                        </button>
                        <button
                          type="button"
                          disabled={appointmentActionLoading}
                          onClick={() => void updateAppointmentStatus('LATE_CANCELLATION')}
                          className="min-h-[48px] rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm font-semibold text-orange-900 shadow-sm transition hover:bg-orange-50 disabled:opacity-50"
                        >
                          Late cancellation
                        </button>
                      </div>
                    </section>
                  ) : null}

                  {/* History */}
                  <section className="rounded-xl border border-slate-200 bg-white">
                    <h4 className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Payment history
                    </h4>
                    {appointmentDetail.payment_history?.length ? (
                      <ul className="max-h-40 divide-y divide-slate-100 overflow-y-auto text-xs">
                        {appointmentDetail.payment_history.map((item, idx) => (
                          <li key={`${item.order_number ?? 'pay'}-${idx}`} className="px-3 py-2 text-slate-700">
                            <span className="font-mono text-[11px] text-slate-500">{item.order_number}</span>
                            <span className="mx-1 text-slate-300">·</span>
                            {formatPosPaymentHistoryLineType(item.line_type)}
                            <span className="float-right font-semibold tabular-nums text-slate-900">
                              RM {Number(item.amount ?? 0).toFixed(2)}
                            </span>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {(item.payment_method ?? '').toUpperCase()}
                              {item.paid_at ? ` · ${new Date(item.paid_at).toLocaleString()}` : ''}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-3 py-4 text-center text-xs text-slate-500">No payments recorded yet.</p>
                    )}
                    {appointmentDetail.receipts?.length ? (
                      <div className="border-t border-slate-100">
                        <h4 className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Receipts</h4>
                        <ul className="divide-y divide-slate-100 text-xs">
                          {appointmentDetail.receipts.map((item, idx) => (
                            <li
                              key={`${item.order_id ?? 'receipt'}-${idx}`}
                              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-slate-700"
                            >
                              <span>
                                {item.stage_label ?? 'Receipt'} · {item.order_number ?? '—'} · RM {Number(item.amount ?? 0).toFixed(2)}
                              </span>
                              {item.receipt_public_url ? (
                                <a
                                  href={item.receipt_public_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                                >
                                  Open
                                </a>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {cancellationRequestsModalOpen ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-cancellation-requests-title"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 id="pos-cancellation-requests-title" className="text-lg font-bold text-gray-900">
                  Cancellation requests
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">Pending customer requests (loaded when you open this panel).</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCancellationRequestsModalOpen(false)
                  setCancellationRequestsError(null)
                  setCancellationConfirmOpen(false)
                  setCancellationConfirmRow(null)
                  setCancellationConfirmAction(null)
                  setCancellationConfirmNote('')
                }}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {cancellationRequestsError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {cancellationRequestsError}
                </div>
              ) : null}
              {!canReviewCancellationRequests ? (
                <p className="text-xs text-amber-800">
                  You can view requests here. Approve or reject requires permission{' '}
                  <span className="font-mono">booking.appointments.update_status</span>.
                </p>
              ) : null}
              {cancellationRequestsLoading ? (
                <p className="text-sm text-gray-600">Loading…</p>
              ) : cancellationRequestsRows.length === 0 ? (
                <p className="text-sm text-gray-600">No pending cancellation requests.</p>
              ) : (
                <ul className="space-y-3">
                  {cancellationRequestsRows.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 text-sm text-gray-800 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <PosCancellationRequestSummary row={row} />
                        {canReviewCancellationRequests ? (
                          <div className="flex shrink-0 flex-wrap gap-2 self-start">
                            <button
                              type="button"
                              disabled={cancellationReviewSubmitting}
                              onClick={() => {
                                setCancellationConfirmRow(row)
                                setCancellationConfirmAction('approve')
                                setCancellationConfirmNote('')
                                setCancellationConfirmOpen(true)
                              }}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={cancellationReviewSubmitting}
                              onClick={() => {
                                setCancellationConfirmRow(row)
                                setCancellationConfirmAction('reject')
                                setCancellationConfirmNote('')
                                setCancellationConfirmOpen(true)
                              }}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                onClick={() => void loadCancellationRequestsModal()}
                disabled={cancellationRequestsLoading}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => {
                  setCancellationRequestsModalOpen(false)
                  setCancellationRequestsError(null)
                  setCancellationConfirmOpen(false)
                  setCancellationConfirmRow(null)
                  setCancellationConfirmAction(null)
                  setCancellationConfirmNote('')
                }}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div> */}
          </div>
        </div>
      ) : null}

      {cancellationConfirmOpen && cancellationConfirmRow && cancellationConfirmAction ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div
            className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-cancellation-confirm-title"
          >
            <div className="border-b border-gray-200 px-5 py-4">
              <h3 id="pos-cancellation-confirm-title" className="text-lg font-bold text-gray-900">
                {cancellationConfirmAction === 'approve' ? 'Approve cancellation?' : 'Reject cancellation?'}
              </h3>
              <p className="mt-1 text-xs text-gray-500">Review the details and add an optional note before confirming.</p>
            </div>
            <div className="max-h-[50vh] space-y-4 overflow-y-auto px-5 py-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50/90 p-3">
                <PosCancellationRequestSummary row={cancellationConfirmRow} />
              </div>
              <div>
                <label htmlFor="pos-cancellation-confirm-note" className="text-xs font-semibold text-gray-600">
                  Note to customer (optional)
                </label>
                <textarea
                  id="pos-cancellation-confirm-note"
                  rows={3}
                  value={cancellationConfirmNote}
                  onChange={(e) => setCancellationConfirmNote(e.target.value)}
                  disabled={cancellationReviewSubmitting}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  placeholder="Internal note stored on the request…"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                disabled={cancellationReviewSubmitting}
                onClick={() => {
                  setCancellationConfirmOpen(false)
                  setCancellationConfirmRow(null)
                  setCancellationConfirmAction(null)
                  setCancellationConfirmNote('')
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={cancellationReviewSubmitting}
                onClick={() =>
                  void submitPosCancellationReview(
                    cancellationConfirmRow.id,
                    cancellationConfirmAction,
                    cancellationConfirmNote.trim() || null,
                  )
                }
                className={
                  cancellationConfirmAction === 'approve'
                    ? 'rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'
                    : 'rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'
                }
              >
                {cancellationReviewSubmitting
                  ? 'Submitting…'
                  : cancellationConfirmAction === 'approve'
                    ? 'Confirm approve'
                    : 'Confirm reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {appointmentRescheduleOpen && appointmentDetail && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Reschedule Appointment</h3>
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
              <p>
                <span className="font-semibold">Booking:</span> {appointmentDetail.booking_code}
              </p>
              <p>
                <span className="font-semibold">Customer:</span> {appointmentDetail.customer?.name ?? '-'}
              </p>
              <p>
                <span className="font-semibold">Service:</span> {appointmentDetail.service?.name ?? '-'}
              </p>
              <p>
                <span className="font-semibold">Current Staff:</span> {appointmentDetail.staff?.name ?? '-'}
              </p>
              <p>
                <span className="font-semibold">Current Date/Time:</span>{' '}
                {formatDateTimeRange(appointmentDetail.appointment_start_at, appointmentDetail.appointment_end_at)}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {activeStaffs.length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No active staff available. Assign staff in settings before rescheduling.
                </div>
              ) : null}

              <div>
                <label className="text-xs font-semibold text-gray-600">Assigned Staff</label>
                <select
                  value={appointmentRescheduleStaffId ?? ''}
                  onChange={(e) => setAppointmentRescheduleStaffId(Number(e.target.value) || null)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select staff</option>
                  {activeStaffs.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">New Appointment Date</label>
                <input
                  type="date"
                  value={appointmentRescheduleDate}
                  onChange={(e) => setAppointmentRescheduleDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Available Slot / Time</label>
                <select
                  value={appointmentRescheduleSlotValue}
                  onChange={(e) => setAppointmentRescheduleSlotValue(e.target.value)}
                  disabled={!appointmentRescheduleStaffId || !appointmentRescheduleDate || appointmentRescheduleSlotsLoading}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                >
                  <option value="">{appointmentRescheduleSlotsLoading ? 'Loading slots...' : 'Select slot'}</option>
                  {appointmentRescheduleSlots.map((slot) => (
                    <option key={slot.start_at} value={slot.start_at}>
                      {formatTimeRange(slot.start_at, slot.end_at)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Reason (optional)</label>
                <textarea
                  rows={2}
                  value={appointmentRescheduleReason}
                  onChange={(e) => setAppointmentRescheduleReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAppointmentRescheduleOpen(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={appointmentRescheduleSubmitting}
                onClick={() => void submitAppointmentReschedule()}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {appointmentRescheduleSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {appointmentCheckoutConfirmationOpen && appointmentDetail && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h4 className="text-lg font-bold text-gray-900">Checkout Confirmation</h4>
                <p className="text-xs text-gray-500">Select payment method before collecting settlement.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAppointmentCheckoutError(null)
                  setAppointmentCheckoutConfirmationOpen(false)
                }}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              {appointmentCheckoutError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
                >
                  {appointmentCheckoutError}
                </div>
              ) : null}
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <p className="font-semibold text-gray-900">{appointmentDetail.booking_code}</p>
                <p className="text-xs text-gray-600">{appointmentDetail.customer?.name ?? '-'}</p>
                <p className="text-xs text-gray-600">
                  Amount Due:{' '}
                  <span className="font-semibold text-emerald-700">RM {appointmentDueAmount.toFixed(2)}</span>
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="mb-3 text-sm font-bold text-gray-900">Payment Method</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                      appointmentPaymentMethod === 'cash'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>Cash</span>
                    <input
                      type="radio"
                      checked={appointmentPaymentMethod === 'cash'}
                      onChange={() => {
                        setAppointmentCheckoutError(null)
                        setAppointmentPaymentMethod('cash')
                      }}
                      className="h-4 w-4"
                    />
                  </label>
                  <label
                    className={`flex cursor-pointer items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                      appointmentPaymentMethod === 'qrpay'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>QRPay</span>
                    <input
                      type="radio"
                      checked={appointmentPaymentMethod === 'qrpay'}
                      onChange={() => {
                        setAppointmentCheckoutError(null)
                        setAppointmentPaymentMethod('qrpay')
                      }}
                      className="h-4 w-4"
                    />
                  </label>
                </div>
              </div>
              {appointmentPaymentMethod === 'cash' ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <label className="mb-2 block text-sm font-bold text-gray-900">Cash Received</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={appointmentCashReceived}
                    onChange={(e) => {
                      setAppointmentCheckoutError(null)
                      setAppointmentCashReceived(e.target.value)
                    }}
                    className="h-11 w-full rounded-xl border-2 border-gray-300 bg-white px-3 font-semibold text-gray-900 focus:border-blue-500 focus:outline-none"
                    placeholder={appointmentDueAmount.toFixed(2)}
                  />
                  {appointmentCashChange > 0 ? (
                    <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-emerald-800">Change:</span>
                      <span className="font-bold text-emerald-700">RM {appointmentCashChange.toFixed(2)}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <label className="mb-2 block text-sm font-bold text-gray-900">Upload Payment Proof</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50"
                      onClick={() => appointmentQrUploadInputRef.current?.click()}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50"
                      onClick={() => appointmentQrCameraBackInputRef.current?.click()}
                    >
                      Back Camera
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50"
                      onClick={() => appointmentQrCameraFrontInputRef.current?.click()}
                    >
                      Front Camera
                    </button>
                  </div>
                  <input
                    ref={appointmentQrUploadInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onSelectAppointmentQrProof}
                    className="sr-only"
                  />
                  <input
                    ref={appointmentQrCameraBackInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={onSelectAppointmentQrProof}
                    className="sr-only"
                  />
                  <input
                    ref={appointmentQrCameraFrontInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={onSelectAppointmentQrProof}
                    className="sr-only"
                  />
                  {appointmentQrProofFileName ? (
                    <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                      <p className="truncate pr-2 font-semibold text-emerald-800">{appointmentQrProofFileName}</p>
                      <button type="button" className="font-semibold text-red-600 hover:text-red-700" onClick={clearAppointmentQrProof}>
                        Clear
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAppointmentCheckoutError(null)
                    setAppointmentCheckoutConfirmationOpen(false)
                  }}
                  className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={appointmentActionLoading || appointmentDueAmount <= 0}
                  onClick={() => void settleAppointmentPayment()}
                  className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Confirm Checkout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {appointmentSettlementResult && (
        <div className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border-2 border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-green-600 to-green-700 px-6 py-5">
              <h4 className="flex items-center gap-2 text-xl font-bold text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Settlement Completed
              </h4>
              <button
                type="button"
                onClick={() => {
                  setAppointmentSettlementResult(null)
                  setAppointmentQrCodeFullscreen(false)
                  setAppointmentReceiptEmail('')
                  setAppointmentReceiptEmailError(null)
                  setAppointmentSendingReceiptEmail(false)
                  setAppointmentReceiptCooldownUntil(0)
                }}
                className="rounded-lg p-1.5 text-white/90 transition-all hover:bg-white/20 hover:text-white"
                title="Close"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="space-y-2 text-center">
                <p className="text-sm font-medium text-gray-600">Order Number</p>
                <p className="text-2xl font-bold text-gray-900">{appointmentSettlementResult.order_number}</p>
                {/* <p className="text-lg font-semibold text-gray-700">RM {appointmentSettlementResult.paid_amount.toFixed(2)}</p>
                {appointmentSettlementResult.payment_method === 'cash' ? (
                  <p className="text-xs text-gray-500">
                    Cash received: RM {appointmentSettlementResult.cash_received.toFixed(2)} · Change: RM{' '}
                    {appointmentSettlementResult.change_amount.toFixed(2)}
                  </p>
                ) : null} */}
              </div>

              {appointmentSettlementResult.receipt_public_url ? (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="mb-3 text-sm font-semibold text-gray-700">Scan QR Code to View Receipt</p>
                    <div
                      className="relative flex cursor-pointer justify-center rounded-xl border-2 border-gray-200 bg-white p-4 transition-all hover:border-blue-400 hover:shadow-lg"
                      onClick={() => setAppointmentQrCodeFullscreen(true)}
                      title="Click to enlarge QR code"
                    >
                      {!appointmentReceiptQrLoaded && <div className="h-48 w-48 animate-pulse rounded-lg bg-gray-100" />}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={appointmentReceiptQrImageUrl ?? ''}
                        onLoad={() => setAppointmentReceiptQrLoaded(true)}
                        onError={() => setAppointmentReceiptQrLoaded(true)}
                        alt="Receipt QR Code"
                        className={`h-48 w-48 ${appointmentReceiptQrLoaded ? 'block' : 'hidden'}`}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Tap QR code to enlarge for customer scanning</p>
                  </div>

                  <div className="space-y-3 rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-700">Send receipt to email</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        value={appointmentReceiptEmail}
                        onChange={(event) => {
                          setAppointmentReceiptEmail(event.target.value)
                          if (appointmentReceiptEmailError) setAppointmentReceiptEmailError(null)
                        }}
                        placeholder="customer@email.com"
                        className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => void sendAppointmentReceiptToEmail()}
                        disabled={appointmentSendingReceiptEmail || appointmentReceiptCooldownActive}
                        className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {appointmentSendingReceiptEmail
                          ? 'Sending...'
                          : appointmentReceiptCooldownActive
                            ? 'Send (wait...)'
                            : 'Send'}
                      </button>
                    </div>
                    {appointmentReceiptEmailError ? (
                      <p className="text-xs font-medium text-red-600">{appointmentReceiptEmailError}</p>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(appointmentSettlementResult.receipt_public_url!, '_blank')}
                      className="flex-1 rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100 active:scale-95"
                    >
                      Open Receipt
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {appointmentQrCodeFullscreen && appointmentSettlementResult?.receipt_public_url ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setAppointmentQrCodeFullscreen(false)}
        >
          <div className="relative">
            <div className="rounded-2xl bg-white p-8 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={appointmentReceiptQrFullscreenImageUrl ?? ''}
                alt="Receipt QR Code - Fullscreen"
                className="h-80 w-80"
              />
            </div>
            <p className="mt-4 text-center text-sm text-white">Tap anywhere to close</p>
          </div>
        </div>
      ) : null}

      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-40 flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-3">
          {toasts.map((toast) => {
            const styles =
              toast.kind === 'success'
                ? 'border-green-200 bg-green-50 text-green-900'
                : toast.kind === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : toast.kind === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-blue-200 bg-blue-50 text-blue-900'

            const icon =
              toast.kind === 'success' ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : toast.kind === 'error' ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : toast.kind === 'warning' ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )

            return (
              <div key={toast.id} className={`rounded-xl border-2 px-4 py-3 shadow-lg backdrop-blur-sm ${styles}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{icon}</div>
                  <div className="flex-1 text-sm font-semibold leading-snug">{toast.text}</div>
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="ml-2 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
                    title="Dismiss"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
