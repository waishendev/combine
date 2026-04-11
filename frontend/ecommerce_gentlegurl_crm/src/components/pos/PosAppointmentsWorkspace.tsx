'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react'

import BookingStatusBadge from '@/components/booking/BookingStatusBadge'

import PosAppointmentsSchedule from './PosAppointmentsSchedule'
import { extractPaged, formatDateTimeRange, formatTimeRange } from './posAppointmentHelpers'
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

export default function PosAppointmentsWorkspace({ currentUser }: { currentUser: PosAppointmentCurrentUser }) {
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
  const [appointmentDetail, setAppointmentDetail] = useState<PosAppointmentDetail | null>(null)
  const [appointmentDetailLoading, setAppointmentDetailLoading] = useState(false)
  const [appointmentPaymentMethod, setAppointmentPaymentMethod] = useState<'cash' | 'qrpay'>('cash')
  const [appointmentCheckoutConfirmationOpen, setAppointmentCheckoutConfirmationOpen] = useState(false)
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
        return
      }

      const paged = extractPaged<PosAppointmentListItem>(json)
      setAppointments(paged.data)
    } catch {
      setAppointments([])
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

  const settleAppointmentPayment = useCallback(async () => {
    if (!appointmentDetail?.id) return
    const dueAmount = Number(appointmentDetail.amount_due_now ?? appointmentDetail.balance_due ?? 0)
    const cashReceivedAmount = Number(appointmentCashReceived || 0)
    if (dueAmount <= 0) {
      showMsg('No balance due for this appointment.', 'warning')
      return
    }

    if (appointmentPaymentMethod === 'cash') {
      if (!Number.isFinite(cashReceivedAmount) || cashReceivedAmount < dueAmount) {
        showMsg('Cash received must be equal or greater than settlement amount.', 'error')
        return
      }
    }

    if (appointmentPaymentMethod === 'qrpay' && !appointmentQrProofFileName) {
      showMsg('Please upload QR payment proof before checkout.', 'error')
      return
    }

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
        showMsg(json?.message ?? 'Unable to collect payment.', 'error')
        return
      }

      showMsg('Appointment payment collected.', 'success')
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
    setAppointmentQrProofFileName(file.name)
    setAppointmentQrProofPreviewUrl(url)
    event.currentTarget.value = ''
  }

  const clearAppointmentQrProof = () => {
    if (appointmentQrProofPreviewUrl) {
      URL.revokeObjectURL(appointmentQrProofPreviewUrl)
    }
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

  const appointmentDueAmountNow = Number(appointmentDetail?.amount_due_now ?? appointmentDetail?.balance_due ?? 0)
  const appointmentSettlementPaid = Number(appointmentDetail?.settlement_paid ?? 0)
  const appointmentPackageApplied = ['reserved', 'consumed'].includes(
    String(appointmentDetail?.package_status?.status ?? '').toLowerCase(),
  )
  const appointmentCheckoutCompleted = appointmentSettlementPaid > 0
  const canMarkAppointmentCompleted = !appointmentActionLoading && (
    appointmentDueAmountNow <= 0 || appointmentPackageApplied
  )

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
            <h3 className="mb-3 text-xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Appointments
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
                  </select>
                </div>
              )}
            />
          </div>
        </div>

        <div className="space-y-5 xl:col-span-2 xl:min-h-0">
          <div className="flex min-h-[420px] flex-col rounded-xl border-2 border-gray-200 bg-white p-5 shadow-md xl:h-[calc(80vh-5rem)] xl:min-h-0">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex-shrink-0">Appointment Settlement</h3>
            {appointmentDetailLoading ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">Loading appointment detail...</div>
            ) : !appointmentDetail ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                Select an appointment from the schedule on the left.
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto">
                <div className="rounded-lg border border-gray-200 p-3 text-sm">
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
                    <span className="font-semibold">Staff:</span> {appointmentDetail.staff?.name ?? '-'}
                  </p>
                  <p>
                    <span className="font-semibold">Date/Time:</span>{' '}
                    {formatDateTimeRange(appointmentDetail.appointment_start_at, appointmentDetail.appointment_end_at)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Status:</span>
                    <BookingStatusBadge status={appointmentDetail.status} label={appointmentDetail.status} showDot={false} />
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3 text-sm">
                  <p>
                    Service Total:{' '}
                    <span className="font-semibold">RM {Number(appointmentDetail.service_total ?? 0).toFixed(2)}</span>
                  </p>
                  {appointmentDetail.add_ons?.length ? (
                    <div className="mt-2 rounded border border-gray-200 bg-gray-50 px-2 py-2">
                      <p className="font-semibold text-gray-800">Add-ons</p>
                      {appointmentDetail.add_ons.map((addon, idx) => (
                        <p key={`${addon.id ?? addon.name}-${idx}`} className="text-xs text-gray-700">
                          {addon.name} (+{Number(addon.extra_duration_min ?? 0)} mins, +RM
                          {Number(addon.extra_price ?? 0).toFixed(2)})
                        </p>
                      ))}
                      <p className="mt-1 text-xs text-gray-700">
                        Add-on total duration: +{Number(appointmentDetail.addon_total_duration_min ?? 0)} mins
                      </p>
                      <p className="text-xs text-gray-700">
                        Add-on total price: RM {Number(appointmentDetail.addon_total_price ?? 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-700">
                        Add-on paid online: RM {Number(appointmentDetail.addon_paid_online ?? 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-700">
                        Add-on paid in settlement: RM {Number(appointmentDetail.addon_paid_settlement ?? 0).toFixed(2)}
                      </p>
                      <p className="text-xs font-semibold text-amber-700">
                        Add-on balance due now: RM {Number(appointmentDetail.addon_balance_due ?? 0).toFixed(2)}
                      </p>
                    </div>
                  ) : null}
                  <p>
                    Deposit Contribution:{' '}
                    <span className="font-semibold">RM {Number(appointmentDepositContributionForSettlement ?? 0).toFixed(2)}</span>
                  </p>
                  <p>
                    Linked Booking Deposit:{' '}
                    <span className="font-semibold">
                      RM {Number(appointmentDetail.linked_booking_deposit_total ?? appointmentDetail.linked_booking_deposit ?? 0).toFixed(2)}
                    </span>
                  </p>
                  <p>
                    Package Applied / Offset:{' '}
                    <span className="font-semibold">RM {Number(appointmentDetail.package_offset ?? 0).toFixed(2)}</span>
                  </p>
                  <p>
                    Settlement Paid:{' '}
                    <span className="font-semibold">RM {Number(appointmentDetail.settlement_paid ?? 0).toFixed(2)}</span>
                  </p>
                  <p>
                    Amount Due Now:{' '}
                    <span className="font-semibold text-emerald-700">
                      RM {Number(appointmentDetail.amount_due_now ?? appointmentDetail.balance_due ?? 0).toFixed(2)}
                    </span>
                  </p>
                  <p>
                    Package Status:{' '}
                    <span className="font-semibold">{appointmentDetail.package_status?.status ?? 'Not applied'}</span>
                  </p>
                  {appointmentIsFullyPackageCovered ? <p className="mt-1 font-semibold text-emerald-700">Covered by Package</p> : null}
                  {appointmentPreviouslyCollectedDeposit > 0 ? (
                    <>
                      <p>
                        Deposit Previously Collected:{' '}
                        <span className="font-semibold">RM {appointmentPreviouslyCollectedDeposit.toFixed(2)}</span>
                      </p>
                      <p className="text-amber-700">Deposit was previously collected. Refund/offset manually if needed.</p>
                    </>
                  ) : null}
                </div>
                <div className="rounded-lg border border-gray-200 p-3 text-sm">
                  {appointmentReschedulePolicyWarnings.length ? (
                    <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {appointmentReschedulePolicyWarnings.map((warning, idx) => (
                        <p key={`${warning}-${idx}`}>{warning}</p>
                      ))}
                    </div>
                  ) : null}
                  <p className="mb-2 font-semibold text-gray-900">Settlement Payment</p>
                  <div className="grid gap-2">
                    <p className="text-xs text-gray-500">Payment method is selected during checkout confirmation.</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={appointmentActionLoading || appointmentDueAmountNow <= 0}
                        onClick={() => {
                          const due = appointmentDueAmountNow
                          setAppointmentPaymentMethod('cash')
                          setAppointmentCashReceived(due > 0 ? due.toFixed(2) : '')
                          setAppointmentCheckoutConfirmationOpen(true)
                        }}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Checkout
                      </button>
                      <button
                        type="button"
                        disabled={
                          appointmentActionLoading ||
                          appointmentPackageApplied ||
                          appointmentCheckoutCompleted ||
                          ['reserved', 'consumed'].includes(String(appointmentDetail.package_status?.status ?? '').toLowerCase())
                        }
                        onClick={() => void applyAppointmentPackage()}
                        title={appointmentCheckoutCompleted ? 'Checkout already completed' : undefined}
                        className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {appointmentPackageApplied ? 'Package Applied' : 'Apply Package'}
                      </button>
                      {appointmentDetail.status === 'CONFIRMED' ? (
                        <>
                          <button
                            type="button"
                            disabled={appointmentActionLoading}
                            onClick={openAppointmentRescheduleModal}
                            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            disabled={!canMarkAppointmentCompleted}
                            onClick={() => void markAppointmentCompleted()}
                            title={
                              canMarkAppointmentCompleted ? 'Mark Completed' : 'Complete payment or apply package first'
                            }
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Mark Completed
                          </button>
                          <button
                            type="button"
                            disabled={appointmentActionLoading}
                            onClick={() => void updateAppointmentStatus('CANCELLED')}
                            className="rounded-md bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                          >
                            Mark Cancelled
                          </button>
                          <button
                            type="button"
                            disabled={appointmentActionLoading}
                            onClick={() => void updateAppointmentStatus('LATE_CANCELLATION')}
                            className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                          >
                            Late Cancellation
                          </button>
                          <button
                            type="button"
                            disabled={appointmentActionLoading}
                            onClick={() => void updateAppointmentStatus('NO_SHOW')}
                            className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            Mark No-show
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3 text-sm">
                  <p className="mb-2 font-semibold text-gray-900">Payment History</p>
                  {appointmentDetail.payment_history?.length ? (
                    <div className="space-y-1">
                      {appointmentDetail.payment_history.map((item, idx) => (
                        <p key={`${item.order_number ?? 'pay'}-${idx}`} className="text-xs text-gray-600">
                          {item.order_number} • {item.line_type} • RM {Number(item.amount ?? 0).toFixed(2)} •{' '}
                          {(item.payment_method ?? '').toUpperCase()} •{' '}
                          {item.paid_at ? new Date(item.paid_at).toLocaleString() : '-'}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No payment history yet.</p>
                  )}
                  {appointmentDetail.receipts?.length ? (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <p className="mb-2 font-semibold text-gray-900">Receipts</p>
                      <div className="space-y-1">
                        {appointmentDetail.receipts.map((item, idx) => (
                          <div
                            key={`${item.order_id ?? 'receipt'}-${idx}`}
                            className="flex flex-wrap items-center gap-2 text-xs text-gray-600"
                          >
                            <span>
                              {item.stage_label ?? 'Receipt'} • {item.order_number ?? '-'} • RM {Number(item.amount ?? 0).toFixed(2)}
                            </span>
                            {item.receipt_public_url ? (
                              <a
                                href={item.receipt_public_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded border border-gray-300 px-2 py-0.5 font-medium text-blue-700 hover:bg-blue-50"
                              >
                                Open
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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
                onClick={() => setAppointmentCheckoutConfirmationOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
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
                      onChange={() => setAppointmentPaymentMethod('cash')}
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
                      onChange={() => setAppointmentPaymentMethod('qrpay')}
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
                    onChange={(e) => setAppointmentCashReceived(e.target.value)}
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
                  onClick={() => setAppointmentCheckoutConfirmationOpen(false)}
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
        <div className="fixed inset-0 z-[56] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
              <h4 className="text-xl font-bold text-white">Settlement Completed</h4>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm">
              <p className="text-gray-700">Order Number</p>
              <p className="text-2xl font-bold text-gray-900">{appointmentSettlementResult.order_number}</p>
              <p className="text-lg font-semibold text-gray-800">RM {appointmentSettlementResult.paid_amount.toFixed(2)}</p>
              <p className="text-xs text-gray-600">Payment Method: {appointmentSettlementResult.payment_method.toUpperCase()}</p>
              {appointmentSettlementResult.payment_method === 'cash' ? (
                <p className="text-xs text-gray-600">
                  Cash Received: RM {appointmentSettlementResult.cash_received.toFixed(2)} • Change: RM{' '}
                  {appointmentSettlementResult.change_amount.toFixed(2)}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                {appointmentSettlementResult.receipt_public_url ? (
                  <button
                    type="button"
                    onClick={() => window.open(appointmentSettlementResult.receipt_public_url!, '_blank')}
                    className="rounded-md border border-blue-500 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Open Receipt
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setAppointmentSettlementResult(null)}
                  className="rounded-md bg-gray-800 px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
