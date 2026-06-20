'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react'
import BookingPackageItemServicePicker from '@/components/booking/BookingPackageItemServicePicker'
import BookingStatusBadge from '@/components/booking/BookingStatusBadge'
import InternationalPhoneInput from '@/components/common/InternationalPhoneInput'
import {
  bookingServiceSettlementSource,
  getSettlementRangeBounds,
  parseSettlementAmountInput,
  settlementNeedsSettledAmount,
  validateSettlementAmountInput,
} from '@/components/pos/settlementAmountUtils'
import BookingServicePhotosModal from '@/components/booking/BookingServicePhotosModal'
import BookingServicePicker, { bookingServiceMatchesPickerCategory } from '@/components/pos/BookingServicePicker'
import CustomerUploadedPhotosModal from '@/components/booking/CustomerUploadedPhotosModal'
import { usePosCashShift } from '@/components/pos/PosCashShiftGate'
import { normalizeInternationalPhone } from '@/lib/phone'

import PosAppointmentsSchedule from './PosAppointmentsSchedule'
import {
  extractPaged,
  posAppointmentBlocksActiveSchedule,
  formatAppointmentCustomerDisplayName,
  formatAppointmentCustomerContactLines,
  formatAppointmentReceiptDefaultEmail,
  formatBookingAddonSummary,
  formatDateTimeRange,
  formatDurationFromRange,
  formatPosPaymentHistoryLineType,
  formatTimeRange,
} from './posAppointmentHelpers'
import type { PosAppointmentCurrentUser, PosAppointmentDetail, PosAppointmentListItem, ServiceAddonQuestion, ServiceAddonOption } from './posAppointmentTypes'

type SplitPaymentMethod = 'cash' | 'qrpay' | 'credit_card'
const SPLIT_PAYMENT_METHODS: Array<{ method: SplitPaymentMethod; label: string }> = [
  { method: 'cash', label: 'Cash' },
  { method: 'qrpay', label: 'QRPay' },
  { method: 'credit_card', label: 'Credit Card' },
]

const toPaymentCents = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0
}

type StaffOption = {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  code?: string | null
  service_commission_rate?: number
  is_active?: boolean | number | string | null
}

type AppointmentLineStaffSplit = { staff_id: number; share_percent: number }

type AppointmentLineSplitDraftRow = { staff_id: number | null; share_percent: string }

type AppointmentLineSplitTarget =
  | { type: 'line'; lineKey: string; title: string; inheritedSplits: AppointmentLineStaffSplit[] }
  | { type: 'bulk'; lineKeys: string[]; title: string; inheritedSplits: AppointmentLineStaffSplit[] }

function durationMinutesFromRange(startAt?: string | null, endAt?: string | null): number {
  if (!startAt || !endAt) return 0
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.round(ms / 60000)
}

type BookingServiceCategoryOption = { id: number; name: string; cn_name?: string | null }

type BookingServiceOption = {
  id: number
  name: string
  cn_name?: string | null
  service_type?: string | null
  price?: number
  service_price?: number
  price_mode?: string | null
  price_range_min?: number | null
  price_range_max?: number | null
  duration_min?: number
  is_active?: boolean
  allowed_staffs?: Array<{ id: number; name: string }>
  category_ids?: number[]
  categories?: BookingServiceCategoryOption[]
}

function PosServiceNameStack({
  name,
  cnName,
  primaryClassName = 'text-sm font-semibold text-gray-900',
  secondaryClassName = 'mt-0.5 text-xs text-gray-500',
}: {
  name?: string | null
  cnName?: string | null
  primaryClassName?: string
  secondaryClassName?: string
}) {
  return (
    <div className="min-w-0">
      <p className={primaryClassName}>{name || '—'}</p>
      {cnName ? <p className={secondaryClassName}>{cnName}</p> : null}
    </div>
  )
}

type CreateExtraServiceBlock = {
  id: string
  service: BookingServiceOption | null
  questions: ServiceAddonQuestion[]
  selectedOptionIds: number[]
}

type AppointmentPriceEditTarget =
  | { kind: 'originalService'; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number }
  | { kind: 'originalAddon'; optionId: number; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number }
  | { kind: 'addedService'; tmpId: string; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number }
  | { kind: 'addedAddon'; tmpId: string; optionId: number; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number }


/** POS member search row (`/api/proxy/pos/members/search`) */
type PosMemberSearchRow = {
  id: number
  name: string
  phone?: string | null
  phone_masked?: string | null
  avatar_url?: string | null
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
    service?: { id: number; name: string; cn_name?: string | null } | null
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
      <div>
        <span className="font-semibold text-gray-600">Service:</span>
        <PosServiceNameStack
          name={b?.service?.name}
          cnName={b?.service?.cn_name}
          primaryClassName="mt-0.5 text-xs font-medium text-gray-900"
          secondaryClassName="mt-0.5 text-[11px] text-gray-500"
        />
      </div>
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
  const { hasOpenShift, cashShiftLoading, requireOpenShiftMessage } = usePosCashShift()
  const cashShiftActionDisabled = cashShiftLoading || !hasOpenShift
  const cashShiftActionTitle = cashShiftActionDisabled ? requireOpenShiftMessage : undefined

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
  const [createAppointmentModalOpen, setCreateAppointmentModalOpen] = useState(false)
  const [createAppointmentServices, setCreateAppointmentServices] = useState<BookingServiceOption[]>([])
  const [bookingServiceCategories, setBookingServiceCategories] = useState<BookingServiceCategoryOption[]>([])
  const [createAppointmentServiceCategoryId, setCreateAppointmentServiceCategoryId] = useState<number | null>(null)
  const [createAppointmentServiceQuery, setCreateAppointmentServiceQuery] = useState('')
  const [createAppointmentExtraServiceCategoryIds, setCreateAppointmentExtraServiceCategoryIds] = useState<Record<string, number | null>>({})
  const [createAppointmentExtraServiceQueries, setCreateAppointmentExtraServiceQueries] = useState<Record<string, string>>({})
  const [createAppointmentServicesLoading, setCreateAppointmentServicesLoading] = useState(false)
  const [createAppointmentSubmitting, setCreateAppointmentSubmitting] = useState(false)
  const [createAppointmentError, setCreateAppointmentError] = useState<string | null>(null)
  const [createAppointmentServiceDraft, setCreateAppointmentServiceDraft] = useState<BookingServiceOption | null>(null)
  const [createAppointmentCustomerId, setCreateAppointmentCustomerId] = useState<number | null>(null)
  const [createAppointmentMemberSummary, setCreateAppointmentMemberSummary] = useState<{
    id: number
    name: string
    phone?: string | null
  } | null>(null)
  const [createAppointmentMemberPickerOpen, setCreateAppointmentMemberPickerOpen] = useState(false)
  const [createAppointmentMemberQuery, setCreateAppointmentMemberQuery] = useState('')
  const [createAppointmentMemberResults, setCreateAppointmentMemberResults] = useState<PosMemberSearchRow[]>([])
  const [createAppointmentMemberSearchLoading, setCreateAppointmentMemberSearchLoading] = useState(false)
  const [createAppointmentIdentityMode, setCreateAppointmentIdentityMode] = useState<'member' | 'guest'>('member')
  const [createAppointmentGuestName, setCreateAppointmentGuestName] = useState('')
  const [createAppointmentGuestPhone, setCreateAppointmentGuestPhone] = useState('')
  const [createAppointmentGuestEmail, setCreateAppointmentGuestEmail] = useState('')
  const [createAppointmentAssignedStaffId, setCreateAppointmentAssignedStaffId] = useState<number | null>(null)
  const [createAppointmentDate, setCreateAppointmentDate] = useState('')
  const [createAppointmentSlotValue, setCreateAppointmentSlotValue] = useState('')
  const [createAppointmentSlots, setCreateAppointmentSlots] = useState<Array<{ start_at: string; end_at: string; available_staff_ids?: number[] }>>([])
  const [createAppointmentSlotsLoading, setCreateAppointmentSlotsLoading] = useState(false)
  const [createAppointmentNotes, setCreateAppointmentNotes] = useState('')
  const [createAppointmentDepositPayments, setCreateAppointmentDepositPayments] = useState<Record<SplitPaymentMethod, string>>({ cash: '', qrpay: '', credit_card: '' })
  const [createAppointmentQuestions, setCreateAppointmentQuestions] = useState<ServiceAddonQuestion[]>([])
  const [createAppointmentSelectedOptionIds, setCreateAppointmentSelectedOptionIds] = useState<number[]>([])
  const [createAppointmentExtraServiceBlocks, setCreateAppointmentExtraServiceBlocks] = useState<CreateExtraServiceBlock[]>([])
  const [appointmentLineStaffSplits, setAppointmentLineStaffSplits] = useState<Record<string, AppointmentLineStaffSplit[]>>({})
  const [appointmentLineSplitTarget, setAppointmentLineSplitTarget] = useState<AppointmentLineSplitTarget | null>(null)
  const [appointmentLineSplitDraftRows, setAppointmentLineSplitDraftRows] = useState<AppointmentLineSplitDraftRow[]>([])
  const [appointmentLineSplitAutoBalance, setAppointmentLineSplitAutoBalance] = useState(true)
  const [appointmentLineSplitOverwrite, setAppointmentLineSplitOverwrite] = useState(false)
  const [appointmentLineSplitError, setAppointmentLineSplitError] = useState<string | null>(null)
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
  const [appointmentPaymentMethod, setAppointmentPaymentMethod] = useState<'cash' | 'qrpay' | 'credit_card' | 'split'>('cash')
  const [appointmentSettlementPaymentAmounts, setAppointmentSettlementPaymentAmounts] = useState<Record<SplitPaymentMethod, string>>({ cash: '', qrpay: '', credit_card: '' })
  const [appointmentCheckoutConfirmationOpen, setAppointmentCheckoutConfirmationOpen] = useState(false)
  const [appointmentCheckoutError, setAppointmentCheckoutError] = useState<string | null>(null)
  const [appointmentDiscountTypeDraft, setAppointmentDiscountTypeDraft] = useState<'percentage' | 'fixed'>('fixed')
  const [appointmentDiscountValueDraft, setAppointmentDiscountValueDraft] = useState('')
  const [appointmentDiscountRemarkDraft, setAppointmentDiscountRemarkDraft] = useState('')
  const [appointmentQrProofFile, setAppointmentQrProofFile] = useState<File | null>(null)
  const [appointmentQrProofFileName, setAppointmentQrProofFileName] = useState<string | null>(null)
  const [appointmentQrProofPreviewUrl, setAppointmentQrProofPreviewUrl] = useState<string | null>(null)
  const [appointmentSettlementResult, setAppointmentSettlementResult] = useState<null | {
    order_id: number
    order_number: string
    receipt_public_url: string | null
    payment_method: 'cash' | 'qrpay' | 'credit_card' | 'split'
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
  const [sendingConfirmationEmail, setSendingConfirmationEmail] = useState(false)
  const [confirmationEmailCooldownUntil, setConfirmationEmailCooldownUntil] = useState(0)

  const [editSettlementOpen, setEditSettlementOpen] = useState(false)
  const [editSettlementLoading, setEditSettlementLoading] = useState(false)
  const [editSettlementError, setEditSettlementError] = useState<string | null>(null)
  const [editMainServicePickerOpen, setEditMainServicePickerOpen] = useState(false)
  const [editMainServicePickerTargetId, setEditMainServicePickerTargetId] = useState<string | null>(null)
  const [editAddonQuestions, setEditAddonQuestions] = useState<ServiceAddonQuestion[]>([])
  const [editSelectedAddonIds, setEditSelectedAddonIds] = useState<Set<number>>(new Set())
  const [editMainServiceCatalog, setEditMainServiceCatalog] = useState<BookingServiceOption[]>([])
  const [editMainServiceCatalogLoading, setEditMainServiceCatalogLoading] = useState(false)
  const [editMainServiceQuery, setEditMainServiceQuery] = useState('')
  const [editMainServiceCategoryId, setEditMainServiceCategoryId] = useState<number | null>(null)
  const [editAddedMainBlocks, setEditAddedMainBlocks] = useState<Array<{
    tmp_id: string
    service_id: number
    service_name: string
    service_cn_name?: string | null
    price: number
    duration_min: number
    addon_questions: ServiceAddonQuestion[]
    selected_addon_ids: Set<number>
    addon_price_overrides: Record<number, number>
    staff_splits: Array<{ staff_id: number | null; share_percent: string }>
    auto_balance: boolean
  }>>([])
  const [editOriginalService, setEditOriginalService] = useState<BookingServiceOption | null>(null)
  const [editOriginalServicePriceOverride, setEditOriginalServicePriceOverride] = useState<number | null>(null)
  const [editAddonPriceOverrides, setEditAddonPriceOverrides] = useState<Record<number, number>>({})
  const [appointmentPriceEditTarget, setAppointmentPriceEditTarget] = useState<AppointmentPriceEditTarget | null>(null)
  const [appointmentPriceEditMode, setAppointmentPriceEditMode] = useState<'unit' | 'line'>('unit')
  const [appointmentPriceEditValueDraft, setAppointmentPriceEditValueDraft] = useState('')
  const [appointmentPriceEditLineTotalDraft, setAppointmentPriceEditLineTotalDraft] = useState('')
  const [appointmentPriceEditReasonDraft, setAppointmentPriceEditReasonDraft] = useState('')

  const resolveBookingImageUrl = useCallback((imageUrl?: string | null, imagePath?: string | null) => {
    if (imageUrl && /^https?:\/\//i.test(imageUrl)) return imageUrl
    if (imagePath && /^https?:\/\//i.test(imagePath)) return imagePath
    const path = (imageUrl || imagePath || '').trim()
    if (!path) return ''
    const normalized = path.startsWith('/') ? path : `/${path}`
    if (normalized.startsWith('/storage/')) return normalized
    return `/storage${normalized}`
  }, [])

  const appointmentUploadedPhotos = useMemo(
    () =>
      (appointmentDetail?.uploaded_item_photos ?? []).map((photo) => ({
        ...photo,
        resolved_url: resolveBookingImageUrl(photo.image_url, photo.image_path),
      })),
    [appointmentDetail?.uploaded_item_photos, resolveBookingImageUrl],
  )
  const [editSettledAmount, setEditSettledAmount] = useState('')
  const [editStaffSplits, setEditStaffSplits] = useState<Array<{ staff_id: number | null; share_percent: string }>>([])
  const [editStaffSplitAutoBalance, setEditStaffSplitAutoBalance] = useState(true)
  const [editAddonOptionsLoading, setEditAddonOptionsLoading] = useState(false)
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

  const formatAppointmentStaffLabel = useCallback((detail: PosAppointmentDetail): string => {
    const splits = (detail.staff_splits ?? []).filter((split) => Number(split.staff_id) > 0 && Number(split.share_percent) > 0)
    if (splits.length > 0) {
      return splits
        .map((split) => `${split.staff_name || `Staff #${split.staff_id}`} (${Number(split.share_percent)}%)`)
        .join(', ')
    }
    const fallback = detail.staff?.name?.trim() ?? ''
    return fallback ? `${fallback} (100%)` : '—'
  }, [])

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

  const renderAppointmentLineSplitStack = useCallback((lineKey: string, inheritedSplits: AppointmentLineStaffSplit[], inheritedLabel = 'main service') => {
    const explicitSplits = appointmentLineStaffSplits[lineKey] ?? []
    const rows = explicitSplits.length > 0 ? explicitSplits : inheritedSplits
    return (
      <div className="mt-1 w-full rounded-md border border-indigo-100 bg-indigo-50/40 px-2 py-1.5 text-left">
        <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">
          {explicitSplits.length > 0 ? 'Staff split' : `Inherited from ${inheritedLabel}`}
        </p>
        <div className="mt-1 flex flex-col gap-1">
          {rows.length ? rows.map((split, idx) => {
            const staff = activeStaffs.find((item) => item.id === Number(split.staff_id))
            return (
              <span key={`${lineKey}-${split.staff_id}-${idx}`} className="inline-flex max-w-full flex-wrap items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-900 ring-1 ring-indigo-100">
                <span className="min-w-0 break-words">{staff?.name ?? `Staff #${split.staff_id}`}</span>
                <span className="shrink-0 text-indigo-700">{Number(split.share_percent)}%</span>
              </span>
            )
          }) : <span className="text-[10px] text-gray-500">No staff selected</span>}
        </div>
      </div>
    )
  }, [activeStaffs, appointmentLineStaffSplits])

  const assignedStaffDefaultSplit = useCallback((staffId: number | null | undefined): AppointmentLineStaffSplit[] => (
    staffId ? [{ staff_id: staffId, share_percent: 100 }] : []
  ), [])

  const editStaffSplitsToLineSplits = useCallback((rows: Array<{ staff_id: number | null; share_percent: string }>): AppointmentLineStaffSplit[] => (
    rows
      .map((row) => ({ staff_id: Number(row.staff_id ?? 0), share_percent: Number.parseInt(row.share_percent || '0', 10) }))
      .filter((row) => row.staff_id > 0 && row.share_percent > 0)
  ), [])

  const openAppointmentLineSplitEditor = useCallback(async (lineKey: string, title: string, inheritedSplits: AppointmentLineStaffSplit[] = []) => {
    let nextStaffs = activeStaffs
    if (!nextStaffs.length) {
      nextStaffs = await fetchStaffOptions('')
      setActiveStaffs(nextStaffs)
    }
    const existingSplits = appointmentLineStaffSplits[lineKey] ?? inheritedSplits
    setAppointmentLineSplitTarget({ type: 'line', lineKey, title, inheritedSplits })
    setAppointmentLineSplitDraftRows(existingSplits.length ? existingSplits.map((split) => ({ staff_id: split.staff_id, share_percent: String(split.share_percent) })) : [{ staff_id: null, share_percent: '100' }])
    setAppointmentLineSplitAutoBalance(true)
    setAppointmentLineSplitOverwrite(false)
    setAppointmentLineSplitError(null)
  }, [activeStaffs, appointmentLineStaffSplits, fetchStaffOptions])

  const openAppointmentBulkLineSplitEditor = useCallback(async (title: string, lineKeys: string[], inheritedSplits: AppointmentLineStaffSplit[] = []) => {
    let nextStaffs = activeStaffs
    if (!nextStaffs.length) {
      nextStaffs = await fetchStaffOptions('')
      setActiveStaffs(nextStaffs)
    }
    const uniqueLineKeys = Array.from(new Set(lineKeys)).filter(Boolean)
    setAppointmentLineSplitTarget({ type: 'bulk', lineKeys: uniqueLineKeys, title, inheritedSplits })
    setAppointmentLineSplitDraftRows(inheritedSplits.length ? inheritedSplits.map((split) => ({ staff_id: split.staff_id, share_percent: String(split.share_percent) })) : [{ staff_id: null, share_percent: '100' }])
    setAppointmentLineSplitAutoBalance(true)
    setAppointmentLineSplitOverwrite(false)
    setAppointmentLineSplitError(null)
  }, [activeStaffs, fetchStaffOptions])

  const saveAppointmentLineSplitEditor = useCallback(() => {
    if (!appointmentLineSplitTarget) return
    const mappedSplits = appointmentLineSplitDraftRows.map((row) => ({
      staff_id: Number(row.staff_id ?? 0),
      share_percent: Number.parseInt(row.share_percent || '0', 10),
    }))
    if (mappedSplits.length < 1 || mappedSplits.some((row) => row.staff_id <= 0 || row.share_percent <= 0)) {
      setAppointmentLineSplitError('Please select staff and enter valid split percentages.')
      return
    }
    const uniqueIds = new Set(mappedSplits.map((row) => row.staff_id))
    const splitSum = mappedSplits.reduce((sum, row) => sum + row.share_percent, 0)
    if (uniqueIds.size !== mappedSplits.length || splitSum !== 100) {
      setAppointmentLineSplitError(`Staff split must use unique staff and total 100% (current: ${splitSum}%).`)
      return
    }
    if (appointmentLineSplitTarget.type === 'line') {
      setAppointmentLineStaffSplits((prev) => ({ ...prev, [appointmentLineSplitTarget.lineKey]: mappedSplits }))
    } else {
      setAppointmentLineStaffSplits((prev) => {
        const next = { ...prev }
        appointmentLineSplitTarget.lineKeys.forEach((lineKey) => {
          if (appointmentLineSplitOverwrite || !next[lineKey]?.length) next[lineKey] = mappedSplits
        })
        return next
      })
    }
    setAppointmentLineSplitTarget(null)
  }, [appointmentLineSplitDraftRows, appointmentLineSplitOverwrite, appointmentLineSplitTarget])

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
      setAppointments(paged.data.filter(posAppointmentBlocksActiveSchedule))
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

  const fetchCreateAppointmentServices = useCallback(async () => {
    setCreateAppointmentServicesLoading(true)
    try {
      const res = await fetch('/api/proxy/booking/services', { cache: 'no-store' })
      if (!res.ok) {
        setCreateAppointmentServices([])
        return
      }
      const json = await res.json().catch(() => null)
      const payload = (json && typeof json === 'object' && 'data' in json)
        ? (json as { data?: unknown }).data
        : json
      const list = Array.isArray(payload) ? payload : []
      const mapped = list
        .map((item): BookingServiceOption | null => {
          if (!item || typeof item !== 'object') return null
          const maybe = item as Record<string, unknown>
          const id = Number(maybe.id)
          if (!Number.isFinite(id) || id <= 0) return null
          return {
            id,
            name: String(maybe.name ?? '').trim(),
            cn_name: typeof maybe.cn_name === 'string' ? maybe.cn_name.trim() || null : null,
            service_type: typeof maybe.service_type === 'string' ? maybe.service_type : null,
            price: Number(maybe.price ?? 0),
            service_price: Number(maybe.service_price ?? 0),
            price_mode: typeof maybe.price_mode === 'string' ? maybe.price_mode : 'fixed',
            price_range_min: maybe.price_range_min != null ? Number(maybe.price_range_min) : null,
            price_range_max: maybe.price_range_max != null ? Number(maybe.price_range_max) : null,
            duration_min: Number(maybe.duration_min ?? 0),
            is_active: Boolean(maybe.is_active ?? true),
            allowed_staffs: Array.isArray(maybe.allowed_staffs)
              ? (maybe.allowed_staffs as Array<Record<string, unknown>>)
                .map((staff) => ({ id: Number(staff.id), name: String(staff.name ?? '').trim() }))
                .filter((staff) => staff.id > 0 && staff.name)
              : [],
            category_ids: Array.isArray(maybe.category_ids) ? (maybe.category_ids as unknown[]).map(Number).filter((id) => Number.isFinite(id) && id > 0) : [],
            categories: Array.isArray(maybe.categories)
              ? (maybe.categories as Array<Record<string, unknown>>).map((category) => ({ id: Number(category.id), name: String(category.name ?? '').trim(), cn_name: typeof category.cn_name === 'string' ? category.cn_name.trim() || null : null })).filter((category) => category.id > 0 && category.name)
              : [],
          }
        })
        .filter((item): item is BookingServiceOption => Boolean(item && item.name))
      setCreateAppointmentServices(mapped)
    } catch {
      setCreateAppointmentServices([])
    } finally {
      setCreateAppointmentServicesLoading(false)
    }
  }, [])

  const fetchBookingServiceCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/booking/service-categories', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json().catch(() => null)
      const payload = (json && typeof json === 'object' && 'data' in json) ? (json as { data?: unknown }).data : json
      const list = Array.isArray(payload) ? payload : []
      setBookingServiceCategories(list.map((item): BookingServiceCategoryOption | null => {
        if (!item || typeof item !== 'object') return null
        const row = item as Record<string, unknown>
        const id = Number(row.id)
        const name = String(row.name ?? '').trim()
        if (!Number.isFinite(id) || id <= 0 || !name) return null
        return { id, name, cn_name: typeof row.cn_name === 'string' ? row.cn_name.trim() || null : null }
      }).filter((item): item is BookingServiceCategoryOption => Boolean(item)))
    } catch {
      setBookingServiceCategories([])
    }
  }, [])

  const loadCreateAppointmentQuestions = useCallback(async (serviceId: number) => {
    if (!serviceId) {
      setCreateAppointmentQuestions([])
      return
    }
    try {
      const res = await fetch(`/api/proxy/booking/services/${serviceId}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      const questionsRaw: unknown[] = Array.isArray(json?.data?.questions) ? json.data.questions : []
      const mappedQuestions: ServiceAddonQuestion[] = questionsRaw
        .map((raw) => {
          if (!raw || typeof raw !== 'object') return null
          const record = raw as Record<string, unknown>
          const optionsRaw: unknown[] = Array.isArray(record.options) ? record.options : []
          return {
            id: Number(record.id ?? 0),
            title: String(record.title ?? 'Question'),
            cn_title: typeof record.cn_title === 'string' ? record.cn_title : null,
            description: typeof record.description === 'string' ? record.description : null,
            cn_description: typeof record.cn_description === 'string' ? record.cn_description : null,
            question_type: String(record.question_type ?? 'single_choice') === 'multi_choice' ? 'multi_choice' : 'single_choice',
            is_required: Boolean(record.is_required),
            options: optionsRaw
              .map((optionRaw) => {
                if (!optionRaw || typeof optionRaw !== 'object') return null
                const option = optionRaw as Record<string, unknown>
                return {
                  id: Number(option.id ?? 0),
                  label: String(option.label ?? 'Add-on'),
                  cn_label: typeof option.cn_label === 'string' ? option.cn_label : null,
                  cn_name: typeof option.cn_label === 'string' ? option.cn_label : (typeof option.cn_name === 'string' ? option.cn_name : (typeof option.linked_cn_name === 'string' ? option.linked_cn_name : null)),
                  linked_cn_name: typeof option.linked_cn_name === 'string' ? option.linked_cn_name : null,
                  extra_duration_min: Number(option.extra_duration_min ?? 0),
                  extra_price: Number(option.extra_price ?? 0),
                } as ServiceAddonOption
              })
              .filter((option): option is ServiceAddonOption => Boolean(option && option.id > 0)),
          } as ServiceAddonQuestion
        })
        .filter((question): question is ServiceAddonQuestion => Boolean(question && question.id > 0 && question.options.length > 0))
      setCreateAppointmentQuestions(mappedQuestions)
    } catch {
      setCreateAppointmentQuestions([])
    }
  }, [])

  const fetchServiceAddonQuestions = useCallback(async (serviceId: number): Promise<ServiceAddonQuestion[]> => {
    if (!serviceId) return []
    try {
      const res = await fetch(`/api/proxy/booking/services/${serviceId}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      const questionsRaw: unknown[] = Array.isArray(json?.data?.questions) ? json.data.questions : []
      return questionsRaw
        .map((raw) => {
          if (!raw || typeof raw !== 'object') return null
          const record = raw as Record<string, unknown>
          const optionsRaw: unknown[] = Array.isArray(record.options) ? record.options : []
          return {
            id: Number(record.id ?? 0),
            title: String(record.title ?? 'Question'),
            cn_title: typeof record.cn_title === 'string' ? record.cn_title : null,
            description: typeof record.description === 'string' ? record.description : null,
            cn_description: typeof record.cn_description === 'string' ? record.cn_description : null,
            question_type: String(record.question_type ?? 'single_choice') === 'multi_choice' ? 'multi_choice' : 'single_choice',
            is_required: Boolean(record.is_required),
            options: optionsRaw
              .map((optionRaw) => {
                if (!optionRaw || typeof optionRaw !== 'object') return null
                const option = optionRaw as Record<string, unknown>
                return {
                  id: Number(option.id ?? 0),
                  label: String(option.label ?? 'Add-on'),
                  cn_label: typeof option.cn_label === 'string' ? option.cn_label : null,
                  cn_name: typeof option.cn_label === 'string' ? option.cn_label : (typeof option.cn_name === 'string' ? option.cn_name : (typeof option.linked_cn_name === 'string' ? option.linked_cn_name : null)),
                  linked_cn_name: typeof option.linked_cn_name === 'string' ? option.linked_cn_name : null,
                  extra_duration_min: Number(option.extra_duration_min ?? 0),
                  extra_price: Number(option.extra_price ?? 0),
                } as ServiceAddonOption
              })
              .filter((option): option is ServiceAddonOption => Boolean(option && option.id > 0)),
          } as ServiceAddonQuestion
        })
        .filter((question): question is ServiceAddonQuestion => Boolean(question && question.id > 0 && question.options.length > 0))
    } catch {
      return []
    }
  }, [])

  const openCreateAppointmentModal = useCallback(() => {
    if (cashShiftActionDisabled) {
      showMsg(requireOpenShiftMessage, 'warning')
      return
    }
    setCreateAppointmentError(null)
    setCreateAppointmentSubmitting(false)
    setCreateAppointmentServiceDraft(null)
    setCreateAppointmentSelectedOptionIds([])
    setCreateAppointmentExtraServiceBlocks([])
    setAppointmentLineStaffSplits({})
    setAppointmentLineSplitTarget(null)
    setCreateAppointmentServiceCategoryId(null)
    setCreateAppointmentServiceQuery('')
    setCreateAppointmentExtraServiceCategoryIds({})
    setCreateAppointmentExtraServiceQueries({})
    setCreateAppointmentQuestions([])
    setCreateAppointmentAssignedStaffId(null)
    setCreateAppointmentDate(appointmentDateFilter || '')
    setCreateAppointmentSlotValue('')
    setCreateAppointmentSlots([])
    setCreateAppointmentNotes('')
    setCreateAppointmentDepositPayments({ cash: '', qrpay: '', credit_card: '' })
    if (appointmentQrProofPreviewUrl) {
      URL.revokeObjectURL(appointmentQrProofPreviewUrl)
    }
    setAppointmentQrProofFile(null)
    setAppointmentQrProofFileName(null)
    setAppointmentQrProofPreviewUrl(null)
    setCreateAppointmentIdentityMode('member')
    setCreateAppointmentCustomerId(null)
    setCreateAppointmentMemberSummary(null)
    setCreateAppointmentMemberPickerOpen(false)
    setCreateAppointmentMemberQuery('')
    setCreateAppointmentMemberResults([])
    setCreateAppointmentGuestName('')
    setCreateAppointmentGuestPhone('')
    setCreateAppointmentGuestEmail('')
    setCreateAppointmentModalOpen(true)
    if (!createAppointmentServices.length) {
      void fetchCreateAppointmentServices()
    void fetchBookingServiceCategories()
    }
  }, [appointmentDateFilter, appointmentQrProofPreviewUrl, cashShiftActionDisabled, createAppointmentServices.length, fetchCreateAppointmentServices, requireOpenShiftMessage, showMsg])

  const closeCreateAppointmentMemberPicker = useCallback(() => {
    setCreateAppointmentMemberPickerOpen(false)
    setCreateAppointmentMemberQuery('')
    setCreateAppointmentMemberResults([])
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!createAppointmentMemberPickerOpen) return
      if (createAppointmentMemberQuery.trim().length < 3) {
        setCreateAppointmentMemberResults([])
        setCreateAppointmentMemberSearchLoading(false)
        return
      }
      setCreateAppointmentMemberSearchLoading(true)
      try {
        const params = new URLSearchParams({ page: '1', per_page: '20', q: createAppointmentMemberQuery.trim() })
        const res = await fetch(`/api/proxy/pos/members/search?${params.toString()}`)
        const json = await res.json().catch(() => null)
        const paged = extractPaged<PosMemberSearchRow>(json)
        if (!cancelled) setCreateAppointmentMemberResults(paged.data)
      } finally {
        if (!cancelled) setCreateAppointmentMemberSearchLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [createAppointmentMemberPickerOpen, createAppointmentMemberQuery])

  const createAppointmentSelectedOptions = useMemo(() => {
    const selected = new Set(createAppointmentSelectedOptionIds)
    return createAppointmentQuestions.flatMap((question) => question.options.filter((option) => selected.has(option.id)))
  }, [createAppointmentQuestions, createAppointmentSelectedOptionIds])

  const createAppointmentAddonDurationTotal = useMemo(
    () => createAppointmentSelectedOptions.reduce((sum, option) => sum + Number(option.extra_duration_min ?? 0), 0),
    [createAppointmentSelectedOptions],
  )

  const createAppointmentAddonPriceTotal = useMemo(
    () => createAppointmentSelectedOptions.reduce((sum, option) => sum + Number(option.extra_price ?? 0), 0),
    [createAppointmentSelectedOptions],
  )
  const createAppointmentExtraTotals = useMemo(() => {
    return createAppointmentExtraServiceBlocks.reduce((acc, block) => {
      if (!block.service) return acc
      acc.baseDuration += Number(block.service.duration_min ?? 0)
      acc.basePrice += Number(block.service.price ?? block.service.service_price ?? 0)
      const selected = new Set(block.selectedOptionIds)
      const selectedOptions = block.questions.flatMap((question) => question.options.filter((option) => selected.has(option.id)))
      acc.addonDuration += selectedOptions.reduce((sum, option) => sum + Number(option.extra_duration_min ?? 0), 0)
      acc.addonPrice += selectedOptions.reduce((sum, option) => sum + Number(option.extra_price ?? 0), 0)
      return acc
    }, { baseDuration: 0, addonDuration: 0, basePrice: 0, addonPrice: 0 })
  }, [createAppointmentExtraServiceBlocks])
  const createAppointmentDepositRows = useMemo(() => SPLIT_PAYMENT_METHODS.map(({ method }) => ({ method, amount: Number(createAppointmentDepositPayments[method] || 0) })).filter((row) => Number.isFinite(row.amount) && row.amount > 0), [createAppointmentDepositPayments])
  const createAppointmentDepositValue = useMemo(() => createAppointmentDepositRows.reduce((sum, row) => sum + row.amount, 0), [createAppointmentDepositRows])
  const createAppointmentDepositPaid = createAppointmentDepositValue
  const createAppointmentDepositHasQrPay = createAppointmentDepositRows.some((row) => row.method === 'qrpay' && row.amount > 0)

  const createAppointmentAllowedStaffs = useMemo(() => {
    if (!createAppointmentServiceDraft) return []
    let allowed = createAppointmentServiceDraft.allowed_staffs ?? []
    for (const block of createAppointmentExtraServiceBlocks) {
      const ids = new Set((block.service?.allowed_staffs ?? []).map((staff) => staff.id))
      allowed = allowed.filter((staff) => ids.has(staff.id))
    }
    return allowed
  }, [createAppointmentExtraServiceBlocks, createAppointmentServiceDraft])

  const createAppointmentStaffPickerOptions = useMemo(() => {
    if (!createAppointmentDate || !createAppointmentSlotValue) return []
    const slot = createAppointmentSlots.find((s) => s.start_at === createAppointmentSlotValue)
    const staffIds = slot?.available_staff_ids
    const base = createAppointmentAllowedStaffs
    if (Array.isArray(staffIds) && staffIds.length > 0) {
      return base.filter((s) => staffIds.includes(s.id))
    }
    return []
  }, [createAppointmentAllowedStaffs, createAppointmentDate, createAppointmentSlotValue, createAppointmentSlots])

  const createAppointmentStaffPickerReady = Boolean(createAppointmentDate && createAppointmentSlotValue)

  const createAppointmentSelectedServiceIds = useMemo(
    () => [
      ...(createAppointmentServiceDraft?.id ? [createAppointmentServiceDraft.id] : []),
      ...createAppointmentExtraServiceBlocks.map((block) => Number(block.service?.id ?? 0)).filter((id) => id > 0),
    ],
    [createAppointmentExtraServiceBlocks, createAppointmentServiceDraft?.id],
  )

  const submitCreateAppointment = useCallback(async () => {
    if (!createAppointmentServiceDraft) {
      setCreateAppointmentError('Please select service first.')
      return
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const phonePattern = /^\+?[0-9]{8,15}$/

    if (createAppointmentIdentityMode === 'member') {
      if (!createAppointmentCustomerId) {
        setCreateAppointmentError('Please assign member.')
        return
      }
    } else {
      if (normalizeInternationalPhone(createAppointmentGuestPhone) && !phonePattern.test(normalizeInternationalPhone(createAppointmentGuestPhone))) {
        setCreateAppointmentError('Please enter a valid guest phone (8-15 digits, optional +).')
        return
      }
      if (createAppointmentGuestEmail.trim() && !emailPattern.test(createAppointmentGuestEmail.trim())) {
        setCreateAppointmentError('Please enter a valid guest email.')
        return
      }
    }

    if (!createAppointmentAssignedStaffId) {
      setCreateAppointmentError('Please select assigned staff.')
      return
    }
    if (!createAppointmentDate) {
      setCreateAppointmentError('Please select appointment date.')
      return
    }
    if (!createAppointmentSlotValue) {
      setCreateAppointmentError('Please select appointment slot/time.')
      return
    }
    if (new Set(createAppointmentSelectedServiceIds).size !== createAppointmentSelectedServiceIds.length) {
      setCreateAppointmentError('Duplicate main services are not allowed in the same appointment.')
      return
    }
    for (const question of createAppointmentQuestions) {
      if (!question.is_required) continue
      const hasSelection = question.options.some((option) => createAppointmentSelectedOptionIds.includes(option.id))
      if (!hasSelection) {
        setCreateAppointmentError(`Please answer required question: ${question.title}`)
        return
      }
    }
    for (const block of createAppointmentExtraServiceBlocks) {
      if (!block.service) {
        setCreateAppointmentError('Please select service for every added main service block.')
        return
      }
      for (const question of block.questions) {
        if (!question.is_required) continue
        const hasSelection = question.options.some((option) => block.selectedOptionIds.includes(option.id))
        if (!hasSelection) {
          setCreateAppointmentError(`Please answer required question: ${question.title}`)
          return
        }
      }
    }

    setCreateAppointmentSubmitting(true)
    setCreateAppointmentError(null)
    try {
      const payload: Record<string, unknown> = {
        booking_service_id: createAppointmentServiceDraft.id,
        assigned_staff_id: createAppointmentAssignedStaffId,
        selected_option_ids: createAppointmentSelectedOptionIds,
        main_service_items: [
          {
            booking_service_id: createAppointmentServiceDraft.id,
            selected_option_ids: createAppointmentSelectedOptionIds,
            staff_splits: appointmentLineStaffSplits[`appointment-create:main:${createAppointmentServiceDraft.id}`] ?? [{ staff_id: createAppointmentAssignedStaffId, share_percent: 100 }],
            addon_staff_splits: Object.fromEntries(createAppointmentSelectedOptionIds.map((id) => [id, appointmentLineStaffSplits[`appointment-create:addon:${id}`] ?? []])),
          },
          ...createAppointmentExtraServiceBlocks
            .filter((block) => block.service?.id)
            .map((block) => ({
              booking_service_id: Number(block.service?.id),
              selected_option_ids: block.selectedOptionIds,
              staff_splits: appointmentLineStaffSplits[`appointment-create:block:${block.id}:main`] ?? [{ staff_id: createAppointmentAssignedStaffId, share_percent: 100 }],
              addon_staff_splits: Object.fromEntries(block.selectedOptionIds.map((id) => [id, appointmentLineStaffSplits[`appointment-create:block:${block.id}:addon:${id}`] ?? []])),
            })),
        ],
        start_at: createAppointmentSlotValue,
        notes: createAppointmentNotes.trim() ? createAppointmentNotes.trim() : null,
        staff_splits: [{ staff_id: createAppointmentAssignedStaffId, share_percent: 100 }],
        qty: 1,
        deposit_amount: Math.max(0, createAppointmentDepositValue || 0),
        deposit_payments: createAppointmentDepositValue > 0 ? createAppointmentDepositRows : [],
      }
      if (createAppointmentIdentityMode === 'member') {
        payload.customer_id = createAppointmentCustomerId
      } else {
        const guestName = createAppointmentGuestName.trim()
        const guestPhone = normalizeInternationalPhone(createAppointmentGuestPhone)
        const guestEmail = createAppointmentGuestEmail.trim()
        payload.customer_id = null
        payload.guest_name = guestName || 'UNKNOWN'
        payload.guest_phone = guestPhone || null
        payload.guest_email = guestEmail || null
      }

      const appointmentBody = appointmentQrProofFile && createAppointmentDepositHasQrPay ? new FormData() : null
      if (appointmentBody) {
        appointmentBody.append('payload', JSON.stringify(payload))
        appointmentBody.append('deposit_qr_payment_proof', appointmentQrProofFile as File)
      }

      const res = await fetch('/api/proxy/pos/appointments', appointmentBody
        ? { method: 'POST', body: appointmentBody }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setCreateAppointmentError(String(json?.message ?? 'Unable to create appointment.'))
        return
      }

      showMsg(createAppointmentDepositValue > 0 ? 'Appointment created and deposit collected.' : 'Appointment created successfully.', 'success')
      if (appointmentQrProofPreviewUrl) {
        URL.revokeObjectURL(appointmentQrProofPreviewUrl)
      }
      setAppointmentQrProofFile(null)
      setAppointmentQrProofFileName(null)
      setAppointmentQrProofPreviewUrl(null)
      closeCreateAppointmentMemberPicker()
      setCreateAppointmentModalOpen(false)

      const depositOrderId = Number(json?.data?.order_id ?? json?.data?.order?.id ?? 0)
      const depositOrderNumber = String(json?.data?.order_number ?? json?.data?.order?.order_number ?? '')
      const depositReceiptUrl = json?.data?.receipt_public_url ?? json?.data?.order?.receipt_public_url ?? null
      if (depositOrderId > 0 && depositOrderNumber) {
        const depositCashPaid = Number(createAppointmentDepositPayments.cash || 0)
        setAppointmentSettlementResult({
          order_id: depositOrderId,
          order_number: depositOrderNumber,
          receipt_public_url: depositReceiptUrl,
          payment_method: createAppointmentDepositRows.length > 1 ? 'split' : (createAppointmentDepositRows[0]?.method ?? 'cash'),
          paid_amount: createAppointmentDepositValue,
          cash_received: depositCashPaid,
          change_amount: 0,
        })
        setAppointmentReceiptEmail(createAppointmentIdentityMode === 'guest' ? createAppointmentGuestEmail.trim() : '')
        setAppointmentReceiptEmailError(null)
        setAppointmentReceiptCooldownUntil(0)
        setAppointmentQrCodeFullscreen(false)
        setAppointmentReceiptQrLoaded(false)
      }

      await fetchAppointments()

      const createdId = Number(json?.data?.id ?? json?.data?.booking_id ?? 0)
      if (createdId > 0) {
        const detailRes = await fetch(`/api/proxy/pos/appointments/${createdId}`, { cache: 'no-store' })
        const detailJson = await detailRes.json().catch(() => null)
        if (detailRes.ok) {
          setAppointmentDetail((detailJson?.data ?? null) as PosAppointmentDetail | null)
        }
      }
    } finally {
      setCreateAppointmentSubmitting(false)
    }
  }, [
    createAppointmentAssignedStaffId,
    appointmentQrProofFile,
    appointmentLineStaffSplits,
    appointmentQrProofPreviewUrl,
    createAppointmentDepositHasQrPay,
    createAppointmentDepositPayments,
    createAppointmentDepositRows,
    createAppointmentDepositValue,
    createAppointmentCustomerId,
    createAppointmentDate,
    createAppointmentExtraServiceBlocks,
    createAppointmentGuestEmail,
    createAppointmentGuestName,
    createAppointmentGuestPhone,
    createAppointmentIdentityMode,
    createAppointmentNotes,
    createAppointmentQuestions,
    createAppointmentSelectedOptionIds,
    createAppointmentSelectedServiceIds,
    createAppointmentServiceDraft,
    createAppointmentSlotValue,
    closeCreateAppointmentMemberPicker,
    fetchAppointments,
    showMsg,
  ])

  const openAppointmentDetail = useCallback(
    async (appointmentId: number) => {
      setAppointmentDetailLoading(true)
      setAppointmentDetail(null)
      setAppointmentSettlementResult(null)
      setAppointmentCheckoutConfirmationOpen(false)
      setAppointmentPaymentMethod('cash')
      setAppointmentSettlementPaymentAmounts({ cash: '', qrpay: '', credit_card: '' })
      setAppointmentSettlementPaymentAmounts({ cash: '', qrpay: '', credit_card: '' })
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
    const grossDueAmount = Number(appointmentDetail.amount_due_now ?? appointmentDetail.balance_due ?? 0)
    const discountDraftValue = Number(appointmentDiscountValueDraft || 0)
    if (!Number.isFinite(discountDraftValue) || discountDraftValue < 0) {
      setAppointmentCheckoutError('Discount value must be 0 or higher.')
      return
    }
    if (appointmentDiscountTypeDraft === 'percentage' && discountDraftValue > 100) {
      setAppointmentCheckoutError('Percentage discount must be between 0 and 100.')
      return
    }
    if (appointmentDiscountTypeDraft === 'fixed' && discountDraftValue > grossDueAmount) {
      setAppointmentCheckoutError('Fixed discount must not exceed settlement amount due.')
      return
    }
    const discountAmount =
      appointmentDiscountTypeDraft === 'percentage'
        ? Math.min(grossDueAmount, (grossDueAmount * discountDraftValue) / 100)
        : Math.min(grossDueAmount, discountDraftValue)
    const dueAmount = Math.max(0, grossDueAmount - discountAmount)
    const settlementPaidSnapshot = Number(appointmentDetail?.settlement_paid ?? 0)
    const packageStatusSnapshot = String(appointmentDetail?.package_status?.status ?? '').toLowerCase()
    const isZeroPackageFinalize =
      packageStatusSnapshot === 'reserved' && settlementPaidSnapshot <= 0.0001 && dueAmount <= 0.0001
    const paymentRows = isZeroPackageFinalize
      ? []
      : SPLIT_PAYMENT_METHODS
          .map(({ method }) => ({ method, amount: Number(appointmentSettlementPaymentAmounts[method] || 0) }))
          .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
    const settlementTotalPaid = paymentRows.reduce((sum, row) => sum + row.amount, 0)
    const settlementCashCents = toPaymentCents(appointmentSettlementPaymentAmounts.cash)
    const settlementQrPayCents = toPaymentCents(appointmentSettlementPaymentAmounts.qrpay)
    const settlementCreditCardCents = toPaymentCents(appointmentSettlementPaymentAmounts.credit_card)
    const settlementTotalPaidCents = settlementCashCents + settlementQrPayCents + settlementCreditCardCents
    const dueCents = toPaymentCents(dueAmount)
    const settlementCashOnlyOverpaid = settlementCashCents > dueCents && settlementQrPayCents === 0 && settlementCreditCardCents === 0
    const settlementMixedOverpaid = settlementTotalPaidCents > dueCents && (settlementQrPayCents > 0 || settlementCreditCardCents > 0)
    const settlementHasQrPay = settlementQrPayCents > 0
    const settlementChange = settlementCashOnlyOverpaid ? Math.max(0, (settlementTotalPaidCents - dueCents) / 100) : 0

    if (!isZeroPackageFinalize && dueAmount <= 0) {
      setAppointmentCheckoutError('No balance due for this appointment.')
      return
    }

    if (!isZeroPackageFinalize) {
      if (paymentRows.length === 0 || (settlementTotalPaidCents !== dueCents && !settlementCashOnlyOverpaid)) {
        setAppointmentCheckoutError(settlementMixedOverpaid ? 'Payment total cannot exceed grand total for split/non-cash payment.' : 'Total paid must equal the amount due.')
        return
      }
    }

    setAppointmentCheckoutError(null)
    setAppointmentActionLoading(true)
    try {
      const payload = {
        payment_method: paymentRows.length > 1 ? 'split' : (paymentRows[0]?.method ?? appointmentPaymentMethod),
        payments: paymentRows,
        discount_type: discountDraftValue > 0 ? appointmentDiscountTypeDraft : null,
        discount_value: discountDraftValue > 0 ? discountDraftValue : 0,
        discount_remark: discountDraftValue > 0 ? appointmentDiscountRemarkDraft.trim() || null : null,
      }

      const endpoint = isZeroPackageFinalize
        ? `/api/proxy/pos/appointments/${appointmentDetail.id}/finalize-zero-settlement`
        : `/api/proxy/pos/appointments/${appointmentDetail.id}/collect-payment`

      const settlementBody = appointmentQrProofFile && settlementHasQrPay ? new FormData() : null
      if (settlementBody) {
        settlementBody.append('payload', JSON.stringify(payload))
        settlementBody.append('qr_payment_proof', appointmentQrProofFile as File)
      }

      const res = await fetch(endpoint, settlementBody
        ? { method: 'POST', body: settlementBody }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setAppointmentCheckoutError(String(json?.message ?? 'Unable to collect payment.'))
        return
      }

      showMsg(isZeroPackageFinalize ? 'Appointment finalised.' : 'Appointment payment collected.', 'success')
      setAppointmentCheckoutError(null)
      setAppointmentCheckoutConfirmationOpen(false)
      setAppointmentSettlementResult({
        order_id: Number(json?.data?.order_id ?? 0),
        order_number: String(json?.data?.order_number ?? '-'),
        receipt_public_url: json?.data?.receipt_public_url ?? null,
        payment_method: paymentRows.length > 1 ? 'split' : (paymentRows[0]?.method ?? appointmentPaymentMethod),
        paid_amount: isZeroPackageFinalize ? 0 : dueAmount,
        cash_received: isZeroPackageFinalize ? 0 : settlementTotalPaid,
        change_amount: isZeroPackageFinalize ? 0 : settlementChange,
      })
      setAppointmentReceiptEmail(formatAppointmentReceiptDefaultEmail(appointmentDetail))
      setAppointmentReceiptEmailError(null)
      setAppointmentReceiptCooldownUntil(0)
      setAppointmentQrCodeFullscreen(false)
      setAppointmentReceiptQrLoaded(false)
      setAppointmentSettlementPaymentAmounts({ cash: '', qrpay: '', credit_card: '' })
      if (appointmentQrProofPreviewUrl) {
        URL.revokeObjectURL(appointmentQrProofPreviewUrl)
      }
      setAppointmentQrProofFile(null)
      setAppointmentQrProofPreviewUrl(null)
      setAppointmentQrProofFileName(null)
      await fetchAppointments()
      setAppointmentDetail(null)
    } finally {
      setAppointmentActionLoading(false)
    }
  }, [
    appointmentDetail,
    appointmentDiscountRemarkDraft,
    appointmentDiscountTypeDraft,
    appointmentDiscountValueDraft,
    appointmentPaymentMethod,
    appointmentQrProofFile,
    appointmentQrProofPreviewUrl,
    appointmentSettlementPaymentAmounts,
    fetchAppointments,
    showMsg,
  ])

  const rebalanceEditSettlementPrimaryShare = useCallback((rows: Array<{ staff_id: number | null; share_percent: string }>) => {
    if (rows.length === 0) return rows
    const otherTotal = rows.slice(1).reduce((sum, row) => sum + Math.max(0, Number.parseInt(row.share_percent || '0', 10) || 0), 0)
    const primaryShare = Math.max(0, 100 - otherTotal)
    return rows.map((row, idx) => (idx === 0 ? { ...row, share_percent: String(primaryShare) } : row))
  }, [])

  const appointmentDisplayMainServices = useMemo(() => {
    const originalServiceId = Number(appointmentDetail?.service?.id ?? 0)
    const seenAdded = new Set<number>()
    return (appointmentDetail?.main_services ?? []).filter((service) => {
      const serviceId = Number(service.linked_booking_service_id ?? service.id ?? 0)
      if (service.is_original) return true
      if (originalServiceId > 0 && serviceId === originalServiceId) return false
      if (serviceId > 0) {
        if (seenAdded.has(serviceId)) return false
        seenAdded.add(serviceId)
      }
      return true
    })
  }, [appointmentDetail?.main_services, appointmentDetail?.service?.id])

  const openEditSettlement = useCallback(async () => {
    if (!appointmentDetail?.service?.id) return
    setEditSettlementError(null)
    setEditSettlementLoading(false)

    const originalMainService = appointmentDisplayMainServices.find((service) => service.is_original)
    setEditOriginalService({
      id: Number(appointmentDetail.service.id),
      name: String(originalMainService?.name ?? appointmentDetail.service.name ?? 'Service'),
      cn_name: originalMainService?.cn_name ?? appointmentDetail.service.cn_name ?? null,
      price_mode: appointmentDetail.service.price_mode ?? null,
      price_range_min: appointmentDetail.service.price_range_min ?? null,
      price_range_max: appointmentDetail.service.price_range_max ?? null,
      service_price: Number(originalMainService?.extra_price ?? appointmentDetail.service_total ?? 0),
      price: Number(originalMainService?.extra_price ?? appointmentDetail.service_total ?? 0),
      duration_min: Number(originalMainService?.extra_duration_min ?? appointmentDetail.service.duration_min ?? 0),
    })

    const currentAddonIds = new Set(
      (appointmentDetail.add_ons ?? [])
        .map((a) => a.id)
        .filter((id): id is number => id != null),
    )
    setEditSelectedAddonIds(currentAddonIds)
    setEditAddonPriceOverrides(Object.fromEntries((appointmentDetail.add_ons ?? [])
      .filter((addon) => Number(addon.id ?? 0) > 0)
      .map((addon) => [Number(addon.id), Number(addon.extra_price ?? 0)])))
    setEditOriginalServicePriceOverride(Number(originalMainService?.extra_price ?? appointmentDetail.service_total ?? 0))
    const addedMainBlocksSeed = appointmentDisplayMainServices
      .filter((service) => !service.is_original)
      .map((service) => ({
        tmp_id: `seed-${Number(service.linked_booking_service_id ?? service.id ?? 0)}-${Math.random()}`,
        service_id: Number(service.linked_booking_service_id ?? service.id ?? 0),
        service_name: String(service.name ?? 'Service'),
        service_cn_name: typeof service.cn_name === 'string' ? service.cn_name : null,
        price: Number(service.extra_price ?? 0),
        duration_min: Number(service.extra_duration_min ?? 0),
        addon_questions: [] as ServiceAddonQuestion[],
        selected_addon_ids: new Set<number>((service.add_ons ?? []).map((addon) => Number(addon.id)).filter((id) => Number.isFinite(id) && id > 0)),
        addon_price_overrides: Object.fromEntries((service.add_ons ?? [])
          .filter((addon) => Number(addon.id ?? 0) > 0)
          .map((addon) => [Number(addon.id), Number(addon.extra_price ?? 0)])),
        staff_splits: (service.staff_splits ?? []).map((split) => ({
          staff_id: Number(split.staff_id) > 0 ? Number(split.staff_id) : null,
          share_percent: String(split.share_percent ?? ''),
        })),
        auto_balance: true,
      }))
      .filter((block) => block.service_id > 0)
    setEditAddedMainBlocks(addedMainBlocksSeed)
    setEditMainServiceQuery('')
                  setEditMainServiceCategoryId(null)
    setEditMainServicePickerOpen(false)
    setEditMainServicePickerTargetId(null)

    const settled = appointmentDetail.settled_service_amount
    setEditSettledAmount(settled != null ? String(settled) : '')
    setEditStaffSplitAutoBalance(true)
    const initialSplits = (appointmentDetail.staff_splits ?? [])
      .map((split) => ({
        staff_id: Number(split.staff_id) > 0 ? Number(split.staff_id) : null,
        share_percent: String(split.share_percent ?? ''),
      }))
      .filter((split) => split.staff_id != null)
    if (initialSplits.length > 0) {
      setEditStaffSplits(rebalanceEditSettlementPrimaryShare(initialSplits))
    } else {
      setEditStaffSplits(appointmentDetail.staff?.id ? [{ staff_id: appointmentDetail.staff.id, share_percent: '100' }] : [])
    }

    setEditAddonOptionsLoading(true)
    setEditMainServiceCatalogLoading(true)
    setEditSettlementOpen(true)
    try {
      const [addonRes, servicesRes] = await Promise.all([
        fetch(`/api/proxy/pos/services/${appointmentDetail.service.id}/addon-options`),
        fetch('/api/proxy/booking/services', { cache: 'no-store' }),
      ])
      const addonJson = await addonRes.json().catch(() => null)
      setEditAddonQuestions((addonJson?.data?.questions ?? []) as ServiceAddonQuestion[])
      const servicesJson = await servicesRes.json().catch(() => null)
      const catalog = (Array.isArray(servicesJson?.data) ? servicesJson.data : []) as BookingServiceOption[]
      setEditMainServiceCatalog(catalog)
      const originalServiceId = Number(appointmentDetail.service?.id ?? 0)
      const catalogOriginal = catalog.find((service) => service.id === originalServiceId)
      if (catalogOriginal) {
        setEditOriginalService((current) => current ? {
          ...catalogOriginal,
          service_price: Number(catalogOriginal.service_price ?? catalogOriginal.price ?? current.service_price ?? 0),
          price: Number(catalogOriginal.service_price ?? catalogOriginal.price ?? current.price ?? 0),
          duration_min: Number(catalogOriginal.duration_min ?? current.duration_min ?? 0),
        } : catalogOriginal)
      }
      if (addedMainBlocksSeed.length > 0) {
        const hydrated = await Promise.all(addedMainBlocksSeed.map(async (block) => {
          try {
            const addonRes2 = await fetch(`/api/proxy/pos/services/${block.service_id}/addon-options`)
            const addonJson2 = await addonRes2.json().catch(() => null)
            const questions = (addonJson2?.data?.questions ?? []) as ServiceAddonQuestion[]
            return { ...block, addon_questions: questions, staff_splits: block.staff_splits.length > 0 ? rebalanceEditSettlementPrimaryShare(block.staff_splits) : [{ staff_id: null, share_percent: '100' }] }
          } catch {
            return { ...block, addon_questions: [], staff_splits: block.staff_splits.length > 0 ? rebalanceEditSettlementPrimaryShare(block.staff_splits) : [{ staff_id: null, share_percent: '100' }] }
          }
        }))
        setEditAddedMainBlocks(hydrated)
      }
    } catch {
      setEditAddonQuestions([])
      setEditMainServiceCatalog([])
      setEditAddedMainBlocks([])
    } finally {
      setEditAddonOptionsLoading(false)
      setEditMainServiceCatalogLoading(false)
    }
  }, [appointmentDetail, appointmentDisplayMainServices, rebalanceEditSettlementPrimaryShare])

  const toggleEditAddon = useCallback((optionId: number) => {
    setEditSelectedAddonIds((prev) => {
      const next = new Set(prev)
      if (next.has(optionId)) {
        next.delete(optionId)
      } else {
        next.add(optionId)
      }
      return next
    })
  }, [])

  const selectEditOriginalService = useCallback(async (service: BookingServiceOption) => {
    if (!service?.id) return
    setEditSettlementError(null)
    setEditOriginalService(service)
    setEditOriginalServicePriceOverride(Number(service.service_price ?? service.price ?? 0))
    setEditAddonPriceOverrides({})
    setEditSelectedAddonIds(new Set())
    setEditAddedMainBlocks((prev) => prev.filter((block) => block.service_id !== service.id))
    if (!settlementNeedsSettledAmount(bookingServiceSettlementSource(service))) {
      setEditSettledAmount('')
    } else {
      setEditSettledAmount('')
    }
    setEditAddonOptionsLoading(true)
    try {
      const res = await fetch(`/api/proxy/pos/services/${service.id}/addon-options`)
      const json = await res.json().catch(() => null)
      setEditAddonQuestions((json?.data?.questions ?? []) as ServiceAddonQuestion[])
    } catch {
      setEditAddonQuestions([])
    } finally {
      setEditAddonOptionsLoading(false)
    }
    setEditMainServicePickerOpen(false)
    setEditMainServicePickerTargetId(null)
    setEditMainServiceQuery('')
  }, [])

  const openEditOriginalServicePicker = useCallback(() => {
    setEditMainServiceQuery('')
    setEditMainServicePickerTargetId('__original__')
    setEditMainServicePickerOpen(true)
  }, [])

  const addEditMainServiceBlock = useCallback(async (service: BookingServiceOption) => {
    if (!service?.id) return
    if (editOriginalService?.id === service.id) return
    if (editAddedMainBlocks.some((block) => block.service_id === service.id)) return
    let questions: ServiceAddonQuestion[] = []
    try {
      const res = await fetch(`/api/proxy/pos/services/${service.id}/addon-options`)
      const json = await res.json().catch(() => null)
      questions = (json?.data?.questions ?? []) as ServiceAddonQuestion[]
    } catch {
      questions = []
    }
    setEditAddedMainBlocks((prev) => [...prev, {
      tmp_id: `added-${service.id}-${Math.random()}`,
      service_id: service.id,
      service_name: service.name,
      service_cn_name: service.cn_name ?? null,
      price: Number(service.service_price ?? service.price ?? 0),
      duration_min: Number(service.duration_min ?? 0),
      addon_questions: questions,
      selected_addon_ids: new Set<number>(),
      addon_price_overrides: {},
      staff_splits: [{ staff_id: null, share_percent: '100' }],
      auto_balance: true,
    }])
  }, [editOriginalService?.id, editAddedMainBlocks])

  const openEditMainServicePicker = useCallback(() => {
    setEditMainServiceQuery('')
    setEditMainServicePickerTargetId('__new__')
    setEditMainServicePickerOpen(true)
  }, [])

  const updateEditAddedMainSplitStaff = useCallback((tmpId: string, index: number, staffId: number | null) => {
    setEditAddedMainBlocks((prev) => prev.map((block) => {
      if (block.tmp_id !== tmpId) return block
      const next = block.staff_splits.map((row, rowIdx) => (rowIdx === index ? { ...row, staff_id: staffId } : row))
      const rebalanced = block.auto_balance ? rebalanceEditSettlementPrimaryShare(next) : next
      return { ...block, staff_splits: rebalanced }
    }))
  }, [rebalanceEditSettlementPrimaryShare])

  const updateEditAddedMainSplitShare = useCallback((tmpId: string, index: number, value: string) => {
    setEditAddedMainBlocks((prev) => prev.map((block) => {
      if (block.tmp_id !== tmpId) return block
      const next = block.staff_splits.map((row, rowIdx) => (rowIdx === index ? { ...row, share_percent: value } : row))
      if (!block.auto_balance || index === 0) return { ...block, staff_splits: next }
      return { ...block, staff_splits: rebalanceEditSettlementPrimaryShare(next) }
    }))
  }, [rebalanceEditSettlementPrimaryShare])

  const toggleEditAddedMainAutoBalance = useCallback((tmpId: string, enabled: boolean) => {
    setEditAddedMainBlocks((prev) => prev.map((block) => {
      if (block.tmp_id !== tmpId) return block
      const nextSplits = enabled ? rebalanceEditSettlementPrimaryShare(block.staff_splits) : block.staff_splits
      return { ...block, auto_balance: enabled, staff_splits: nextSplits }
    }))
  }, [rebalanceEditSettlementPrimaryShare])

  const selectEditMainServiceForBlock = useCallback(async (tmpId: string, service: BookingServiceOption) => {
    if (!service?.id) return
    if (tmpId === '__original__') {
      await selectEditOriginalService(service)
      return
    }
    // When adding a new block, only create after selection.
    if (tmpId === '__new__') {
      await addEditMainServiceBlock(service)
      setEditMainServicePickerOpen(false)
      setEditMainServicePickerTargetId(null)
      setEditMainServiceQuery('')
      return
    }
  }, [addEditMainServiceBlock, selectEditOriginalService])

  const updateEditSettlementSplitShare = useCallback((index: number, value: string) => {
    setEditSettlementError(null)
    setEditStaffSplits((prev) => {
      const next = prev.map((row, rowIdx) => (rowIdx === index ? { ...row, share_percent: value } : row))
      if (!editStaffSplitAutoBalance || index === 0) return next
      return rebalanceEditSettlementPrimaryShare(next)
    })
  }, [editStaffSplitAutoBalance, rebalanceEditSettlementPrimaryShare])

  const removeEditSettlementSplitRow = useCallback((index: number) => {
    setEditSettlementError(null)
    setEditStaffSplits((prev) => {
      const next = prev.filter((_, rowIdx) => rowIdx !== index)
      if (!editStaffSplitAutoBalance) return next
      return rebalanceEditSettlementPrimaryShare(next)
    })
  }, [editStaffSplitAutoBalance, rebalanceEditSettlementPrimaryShare])

  const editOriginalSettlementSource = useMemo(
    () => bookingServiceSettlementSource(editOriginalService),
    [editOriginalService],
  )

  const saveEditSettlement = useCallback(async () => {
    if (!appointmentDetail?.id) return
    setEditSettlementError(null)
    setEditSettlementLoading(true)
    try {
      const needsSettledAmount = settlementNeedsSettledAmount(editOriginalSettlementSource)
      const payload: Record<string, unknown> = {
        addon_option_ids: Array.from(editSelectedAddonIds),
        addon_price_overrides: editAddonPriceOverrides,
        addon_staff_splits: Object.fromEntries(Array.from(editSelectedAddonIds).map((id) => [id, appointmentLineStaffSplits[`appointment-settlement:${appointmentDetail.id}:addon:${id}`] ?? []])),
        original_service_price: editOriginalServicePriceOverride,
        main_service_ids: editAddedMainBlocks.map((block) => block.service_id),
        main_service_items: editAddedMainBlocks.map((block) => ({
          booking_service_id: block.service_id,
          price: block.price,
          addon_option_ids: Array.from(block.selected_addon_ids),
          addon_price_overrides: block.addon_price_overrides,
          addon_staff_splits: Object.fromEntries(Array.from(block.selected_addon_ids).map((id) => [id, appointmentLineStaffSplits[`appointment-settlement:${appointmentDetail.id}:block:${block.tmp_id}:addon:${id}`] ?? []])),
          staff_splits: block.staff_splits.map((row) => ({
            staff_id: Number(row.staff_id ?? 0),
            share_percent: Number.parseInt(row.share_percent || '0', 10),
          })),
        })),
      }
      const originalServiceId = Number(editOriginalService?.id ?? appointmentDetail.service?.id ?? 0)
      if (originalServiceId > 0 && originalServiceId !== Number(appointmentDetail.service?.id ?? 0)) {
        payload.booking_service_id = originalServiceId
      }
      if (needsSettledAmount) {
        const amountCheck = validateSettlementAmountInput(editSettledAmount, editOriginalSettlementSource)
        if (!amountCheck.ok) {
          setEditSettlementError(amountCheck.message)
          return
        }
        payload.settled_service_amount = amountCheck.amount
      }
      const normalizedSplits = editStaffSplits.map((row) => ({
        staff_id: Number(row.staff_id ?? 0),
        share_percent: Number.parseInt(row.share_percent || '0', 10),
      }))
      if (normalizedSplits.length < 1 || normalizedSplits.some((row) => row.staff_id <= 0 || row.share_percent <= 0)) {
        setEditSettlementError('Please select at least one staff and enter valid split percentages.')
        return
      }
      const uniqueIds = new Set(normalizedSplits.map((row) => row.staff_id))
      if (uniqueIds.size !== normalizedSplits.length) {
        setEditSettlementError('Duplicate staff is not allowed in split.')
        return
      }
      const splitSum = normalizedSplits.reduce((sum, row) => sum + row.share_percent, 0)
      if (splitSum !== 100) {
        setEditSettlementError(`Staff split total must equal 100% (current: ${splitSum}%).`)
        return
      }
      payload.staff_splits = normalizedSplits

      for (const block of editAddedMainBlocks) {
        const blockSplits = block.staff_splits.map((row) => ({
          staff_id: Number(row.staff_id ?? 0),
          share_percent: Number.parseInt(row.share_percent || '0', 10),
        }))
        if (blockSplits.length < 1 || blockSplits.some((row) => row.staff_id <= 0 || row.share_percent <= 0)) {
          setEditSettlementError(`Please complete staff split for ${block.service_name}.`)
          return
        }
        const blockUnique = new Set(blockSplits.map((row) => row.staff_id))
        const blockSum = blockSplits.reduce((sum, row) => sum + row.share_percent, 0)
        if (blockUnique.size !== blockSplits.length || blockSum !== 100) {
          setEditSettlementError(`Staff split for ${block.service_name} must be valid and total 100%.`)
          return
        }
      }

      const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/edit-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setEditSettlementError(json?.message ?? 'Failed to update settlement.')
        return
      }
      const updatedAppointment = (json?.data?.appointment ?? null) as Partial<PosAppointmentDetail> | null
      if (updatedAppointment) {
        setAppointmentDetail((current) => current ? {
          ...current,
          ...updatedAppointment,
          service_total: Number(json?.data?.service_total ?? updatedAppointment.service_total ?? current.service_total ?? 0),
          settled_service_amount: json?.data?.settled_service_amount ?? updatedAppointment.settled_service_amount ?? current.settled_service_amount,
          requires_settled_amount: Boolean(json?.data?.requires_settled_amount ?? updatedAppointment.requires_settled_amount ?? current.requires_settled_amount ?? false),
          main_services: (json?.data?.main_services ?? updatedAppointment.main_services ?? current.main_services) as PosAppointmentDetail['main_services'],
          add_ons: (json?.data?.add_ons ?? updatedAppointment.add_ons ?? current.add_ons) as PosAppointmentDetail['add_ons'],
          balance_due: Number(json?.data?.balance_due ?? updatedAppointment.balance_due ?? current.balance_due ?? 0),
          amount_due_now: Number(json?.data?.amount_due_now ?? updatedAppointment.amount_due_now ?? current.amount_due_now ?? 0),
        } : current)
      }
      showMsg('Settlement updated.', 'success')
      setEditSettlementOpen(false)
      await refreshOpenedAppointmentDetail()
      await fetchAppointments()
    } finally {
      setEditSettlementLoading(false)
    }
  }, [appointmentDetail, appointmentLineStaffSplits, editAddedMainBlocks, editOriginalService, editOriginalSettlementSource, editSelectedAddonIds, editSettledAmount, editStaffSplits, editAddonPriceOverrides, editOriginalServicePriceOverride, fetchAppointments, refreshOpenedAppointmentDetail, showMsg])


  const openAppointmentPriceEditModal = useCallback((target: AppointmentPriceEditTarget) => {
    const qty = Math.max(1, Number(target.quantity ?? 1))
    const unit = Math.max(0, Number(target.currentUnitPrice ?? 0))
    setAppointmentPriceEditTarget({ ...target, quantity: qty })
    setAppointmentPriceEditMode('unit')
    setAppointmentPriceEditValueDraft(unit.toFixed(2))
    setAppointmentPriceEditLineTotalDraft((unit * qty).toFixed(2))
    setAppointmentPriceEditReasonDraft('')
  }, [])

  const submitAppointmentPriceEditModal = useCallback(() => {
    if (!appointmentPriceEditTarget) return
    const qty = Math.max(1, Number(appointmentPriceEditTarget.quantity ?? 1))
    const rawValue = appointmentPriceEditMode === 'line' ? appointmentPriceEditLineTotalDraft : appointmentPriceEditValueDraft
    const amount = Number(rawValue)
    if (!Number.isFinite(amount) || amount < 0) {
      setEditSettlementError('Price cannot be negative.')
      return
    }
    const unitPrice = appointmentPriceEditMode === 'line' ? amount / qty : amount
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setEditSettlementError('Price cannot be negative.')
      return
    }
    const rounded = Number(unitPrice.toFixed(2))
    if (appointmentPriceEditTarget.kind === 'originalService') {
      setEditOriginalServicePriceOverride(rounded)
      if (settlementNeedsSettledAmount(editOriginalSettlementSource)) {
        setEditSettledAmount(rounded.toFixed(2))
      }
    } else if (appointmentPriceEditTarget.kind === 'originalAddon') {
      setEditAddonPriceOverrides((prev) => ({ ...prev, [appointmentPriceEditTarget.optionId]: rounded }))
    } else if (appointmentPriceEditTarget.kind === 'addedService') {
      setEditAddedMainBlocks((prev) => prev.map((block) => block.tmp_id === appointmentPriceEditTarget.tmpId ? { ...block, price: rounded } : block))
    } else if (appointmentPriceEditTarget.kind === 'addedAddon') {
      setEditAddedMainBlocks((prev) => prev.map((block) => block.tmp_id === appointmentPriceEditTarget.tmpId ? { ...block, addon_price_overrides: { ...block.addon_price_overrides, [appointmentPriceEditTarget.optionId]: rounded } } : block))
    }
    setEditSettlementError(null)
    setAppointmentPriceEditTarget(null)
  }, [appointmentPriceEditLineTotalDraft, appointmentPriceEditMode, appointmentPriceEditTarget, appointmentPriceEditValueDraft, editOriginalSettlementSource])

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

  const releaseAppointmentPackage = useCallback(async () => {
    if (!appointmentDetail?.id) return
    setAppointmentActionLoading(true)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/release-package`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to release package claim.', 'error')
        return
      }
      showMsg('Package claim released.', 'success')
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

  const sendConfirmationEmail = useCallback(async () => {
    if (!appointmentDetail?.id) return
    const email = (appointmentDetail.customer?.email?.trim() || appointmentDetail.guest_email?.trim() || '').trim()
    if (!email) {
      showMsg('No email address available for this booking.', 'error')
      return
    }
    setSendingConfirmationEmail(true)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/send-confirmation-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to send confirmation email.', 'error')
        return
      }
      setConfirmationEmailCooldownUntil(Date.now() + 10_000)
      showMsg('Confirmation email sent to ' + email, 'success')
    } catch {
      showMsg('Unable to send confirmation email.', 'error')
    } finally {
      setSendingConfirmationEmail(false)
    }
  }, [appointmentDetail, showMsg])

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
    const loadCreateSlots = async () => {
      if (!createAppointmentModalOpen || !createAppointmentServiceDraft?.id || !createAppointmentDate) {
        setCreateAppointmentSlots([])
        setCreateAppointmentSlotValue('')
        return
      }

      setCreateAppointmentSlotsLoading(true)
      try {
        const params = new URLSearchParams({
          service_id: String(createAppointmentServiceDraft.id),
          date: createAppointmentDate,
          extra_duration_min: String(
            (createAppointmentAddonDurationTotal || 0) +
            createAppointmentExtraTotals.baseDuration +
            createAppointmentExtraTotals.addonDuration,
          ),
        })
        const res = await fetch(`/api/proxy/pos/availability/pooled?${params.toString()}`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        const rows: unknown[] = Array.isArray(json?.data?.visible_slots)
          ? json.data.visible_slots
          : (Array.isArray(json?.data?.slots) ? json.data.slots : [])
        const slots = rows
          .map((row: unknown) => {
            if (!row || typeof row !== 'object') return null
            const maybe = row as Record<string, unknown>
            const startAt = String(maybe.start_at ?? '')
            const endAt = String(maybe.end_at ?? '')
            if (!startAt || !endAt) return null
            const staffIds = Array.isArray(maybe.available_staff_ids)
              ? (maybe.available_staff_ids as unknown[]).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
              : undefined
            return { start_at: startAt, end_at: endAt, available_staff_ids: staffIds } as {
              start_at: string
              end_at: string
              available_staff_ids?: number[]
            }
          })
          .filter((row): row is { start_at: string; end_at: string; available_staff_ids?: number[] } => row !== null)
        setCreateAppointmentSlots(slots)
        setCreateAppointmentSlotValue((prev) => (slots.some((slot) => slot.start_at === prev) ? prev : ''))
      } finally {
        setCreateAppointmentSlotsLoading(false)
      }
    }
    void loadCreateSlots()
  }, [
    createAppointmentAddonDurationTotal,
    createAppointmentDate,
    createAppointmentExtraTotals.addonDuration,
    createAppointmentExtraTotals.baseDuration,
    createAppointmentModalOpen,
    createAppointmentServiceDraft?.id,
  ])

  useEffect(() => {
    if (!createAppointmentModalOpen || !createAppointmentDate || !createAppointmentSlotValue) {
      setCreateAppointmentAssignedStaffId(null)
      return
    }

    const slot = createAppointmentSlots.find((s) => s.start_at === createAppointmentSlotValue)
    const staffIds = slot?.available_staff_ids ?? []
    const options = Array.isArray(staffIds) && staffIds.length > 0
      ? createAppointmentAllowedStaffs.filter((staff) => staffIds.includes(staff.id))
      : []

    setCreateAppointmentAssignedStaffId((prev) => {
      if (prev && options.some((staff) => staff.id === prev)) return prev
      return options[0]?.id ?? null
    })
  }, [
    createAppointmentAllowedStaffs,
    createAppointmentDate,
    createAppointmentModalOpen,
    createAppointmentSlotValue,
    createAppointmentSlots,
  ])

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
    setAppointmentQrProofFile(file)
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
    setAppointmentQrProofFile(null)
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

  const appointmentSettlementDurationMin = useMemo(
    () => durationMinutesFromRange(appointmentDetail?.appointment_start_at, appointmentDetail?.appointment_end_at),
    [appointmentDetail?.appointment_end_at, appointmentDetail?.appointment_start_at],
  )

  const editSettlementEstimatedDurationMin = useMemo(() => {
    if (!appointmentDetail) return 0
    const originalDuration = Number(editOriginalService?.duration_min ?? 0) > 0
      ? Number(editOriginalService?.duration_min ?? 0)
      : appointmentDisplayMainServices
          .filter((service) => service.is_original)
          .reduce((sum, service) => sum + Number(service.extra_duration_min ?? 0), 0)
    const fallbackOriginalDuration = Number(appointmentDetail.estimated_duration_min ?? 0) > 0
      ? Number(appointmentDetail.estimated_duration_min ?? 0) - Number(appointmentDetail.addon_total_duration_min ?? 0)
      : appointmentSettlementDurationMin
    const baseDuration = originalDuration > 0 ? originalDuration : Math.max(0, fallbackOriginalDuration)
    const originalAddonDuration = editAddonQuestions
      .flatMap((question) => question.options)
      .filter((option) => editSelectedAddonIds.has(option.id))
      .reduce((sum, option) => sum + Number(option.extra_duration_min ?? 0), 0)
    const addedBlockDuration = editAddedMainBlocks.reduce((sum, block) => {
      const blockAddonDuration = block.addon_questions
        .flatMap((question) => question.options)
        .filter((option) => block.selected_addon_ids.has(option.id))
        .reduce((addonSum, option) => addonSum + Number(option.extra_duration_min ?? 0), 0)
      return sum + Number(block.duration_min ?? 0) + blockAddonDuration
    }, 0)
    return Math.max(0, baseDuration + originalAddonDuration + addedBlockDuration)
  }, [appointmentDetail, appointmentDisplayMainServices, appointmentSettlementDurationMin, editAddedMainBlocks, editAddonQuestions, editOriginalService?.duration_min, editSelectedAddonIds])

  const editSettlementEstimatedEndAt = useMemo(() => {
    const startAt = appointmentDetail?.appointment_start_at
    if (!startAt || editSettlementEstimatedDurationMin <= 0) return appointmentDetail?.appointment_end_at ?? null
    const start = new Date(startAt)
    if (Number.isNaN(start.getTime())) return appointmentDetail?.appointment_end_at ?? null
    return new Date(start.getTime() + editSettlementEstimatedDurationMin * 60 * 1000).toISOString()
  }, [appointmentDetail?.appointment_end_at, appointmentDetail?.appointment_start_at, editSettlementEstimatedDurationMin])

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
  const appointmentPaymentStatusUpper = String(appointmentDetail?.payment_status ?? '').toUpperCase()
  const appointmentPackageApplied = ['reserved', 'consumed'].includes(
    String(appointmentDetail?.package_status?.status ?? '').toLowerCase(),
  )
  /** Package reserved on booking but settlement not recorded yet — treat as unpaid until POS/main checkout finalises. */
  const packageReservedPendingRegister = useMemo(
    () =>
      String(appointmentDetail?.package_status?.status ?? '').toLowerCase() === 'reserved' &&
      appointmentSettlementPaid <= 0.0001,
    [appointmentDetail?.package_status?.status, appointmentSettlementPaid],
  )
  /** Reserved package, remaining balance, or non-PAID status ⇒ still unpaid at register. */
  const appointmentPaymentBadgeIsPaid =
    !packageReservedPendingRegister &&
    appointmentDueAmountNow <= 0.0001 &&
    (appointmentPaymentStatusUpper.length === 0 || appointmentPaymentStatusUpper === 'PAID')
  const appointmentCheckoutCompleted = appointmentPaymentBadgeIsPaid
  const appointmentShowApplyPackageButton = useMemo(
    () =>
      !appointmentPackageApplied &&
      !appointmentCheckoutCompleted &&
      !['reserved', 'consumed'].includes(String(appointmentDetail?.package_status?.status ?? '').toLowerCase()),
    [appointmentCheckoutCompleted, appointmentDetail?.package_status?.status, appointmentPackageApplied],
  )
  const appointmentPackageDisabledReason = appointmentDetail?.package_disabled_reason ?? 'No eligible package available.'
  const appointmentCanApplyPackage = Boolean(appointmentDetail?.can_apply_package)
  const appointmentStatusUpper = String(appointmentDetail?.status ?? '').toUpperCase()
  /** Cancelled / no-show / late cancel — no checkout or “complete visit” CTAs. */
  const appointmentIsTerminalCancelled = ['CANCELLED', 'NO_SHOW', 'LATE_CANCELLATION'].includes(appointmentStatusUpper)

  const appointmentShowPaymentBadge =
    !appointmentIsTerminalCancelled && ['CONFIRMED', 'COMPLETED'].includes(appointmentStatusUpper)
  const canMarkAppointmentCompleted =
    !cashShiftActionDisabled &&
    !appointmentActionLoading &&
    !appointmentIsTerminalCancelled &&
    appointmentStatusUpper !== 'COMPLETED'

  /** Reserved package, amount to collect is RM 0 — finalise in place (receipt) without sending the user to Main POS. */
  const checkoutZeroPackageSettlement =
    packageReservedPendingRegister && appointmentDueAmountNow <= 0.0001

  const showAppointmentCollectPayment =
    !appointmentIsTerminalCancelled &&
    appointmentStatusUpper === 'COMPLETED' &&
    !appointmentCheckoutCompleted &&
    (appointmentDueAmountNow > 0.0001 || packageReservedPendingRegister)

  const showAppointmentMarkCompletedBlock =
    !appointmentIsTerminalCancelled && appointmentStatusUpper === 'CONFIRMED'

  const showAppointmentPaymentCtaCard =
    appointmentReschedulePolicyWarnings.length > 0 ||
    showAppointmentCollectPayment ||
    showAppointmentMarkCompletedBlock

  const appointmentDueAmount = Number(appointmentDetail?.amount_due_now ?? appointmentDetail?.balance_due ?? 0)
  const appointmentDiscountValueNumber = Number(appointmentDiscountValueDraft || 0)
  const appointmentDiscountAmount =
    !Number.isFinite(appointmentDiscountValueNumber) || appointmentDiscountValueNumber <= 0
      ? 0
      : appointmentDiscountTypeDraft === 'percentage'
        ? Math.min(appointmentDueAmount, (appointmentDueAmount * appointmentDiscountValueNumber) / 100)
        : Math.min(appointmentDueAmount, appointmentDiscountValueNumber)
  const appointmentDueAfterDiscount = Math.max(0, appointmentDueAmount - appointmentDiscountAmount)
  const appointmentSettlementPaymentRows = useMemo(() => SPLIT_PAYMENT_METHODS.map(({ method }) => ({ method, amount: Number(appointmentSettlementPaymentAmounts[method] || 0) })).filter((row) => Number.isFinite(row.amount) && row.amount > 0), [appointmentSettlementPaymentAmounts])
  const appointmentSettlementTotalPaid = useMemo(() => appointmentSettlementPaymentRows.reduce((sum, row) => sum + row.amount, 0), [appointmentSettlementPaymentRows])
  const appointmentSettlementCashCents = toPaymentCents(appointmentSettlementPaymentAmounts.cash)
  const appointmentSettlementQrPayCents = toPaymentCents(appointmentSettlementPaymentAmounts.qrpay)
  const appointmentSettlementCreditCardCents = toPaymentCents(appointmentSettlementPaymentAmounts.credit_card)
  const appointmentSettlementTotalPaidCents = appointmentSettlementCashCents + appointmentSettlementQrPayCents + appointmentSettlementCreditCardCents
  const appointmentDueAfterDiscountCents = toPaymentCents(appointmentDueAfterDiscount)
  const appointmentSettlementHasNonCashPayment = appointmentSettlementQrPayCents > 0 || appointmentSettlementCreditCardCents > 0
  const appointmentSettlementRemaining = Math.max(0, (appointmentDueAfterDiscountCents - appointmentSettlementTotalPaidCents) / 100)
  const appointmentSettlementOverpaid = Math.max(0, (appointmentSettlementTotalPaidCents - appointmentDueAfterDiscountCents) / 100)
  const appointmentSettlementCashOnlyOverpaid = appointmentSettlementCashCents > appointmentDueAfterDiscountCents && appointmentSettlementQrPayCents === 0 && appointmentSettlementCreditCardCents === 0
  const appointmentSettlementMixedOverpaid = appointmentSettlementTotalPaidCents > appointmentDueAfterDiscountCents && appointmentSettlementHasNonCashPayment
  const appointmentSettlementChange = appointmentSettlementCashOnlyOverpaid ? appointmentSettlementOverpaid : 0
  const appointmentSettlementMatchesDue = appointmentSettlementTotalPaidCents === appointmentDueAfterDiscountCents
  const appointmentSettlementPaymentValid = appointmentSettlementPaymentRows.length > 0 && (appointmentSettlementMatchesDue || appointmentSettlementCashOnlyOverpaid)
  const appointmentSettlementHasCashChange = Boolean(
    appointmentSettlementResult &&
      appointmentSettlementResult.payment_method === 'cash' &&
      appointmentSettlementResult.change_amount > 0 &&
      appointmentSettlementResult.cash_received > appointmentSettlementResult.paid_amount,
  )

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

      <div className="pos-appt-layout grid min-w-0 grid-cols-1 gap-5">
        <div className="pos-appt-left space-y-5 min-w-0">
          <div className="flex flex-col rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md">
            <h3 className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xl font-bold text-gray-900">
              <div className="flex items-center gap-2">
                <svg className="h-6 w-6 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Appointments
              </div>
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
                  onClick={openCreateAppointmentModal}
                  disabled={cashShiftActionDisabled}
                  title={cashShiftActionTitle}
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create Appointment
                </button>
                <button
                  type="button"
                  onClick={() => setCancellationRequestsModalOpen(true)}
                  disabled={cashShiftActionDisabled}
                  title={cashShiftActionTitle}
                  className="relative inline-flex items-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-amber-500 hover:bg-amber-50 hover:text-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
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
                {cashShiftActionDisabled ? (
                  <p className="basis-full text-right text-xs font-semibold text-amber-700">{requireOpenShiftMessage}</p>
                ) : null}
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
                    <option value="HOLD">HOLD</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="COMPLETED">COMPLETED (UNPAID)</option>
                  </select>
                </div>
              )}
            />
          </div>
        </div>

        <div className="pos-appt-right space-y-5 min-w-0">
          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-900/5 min-w-0">
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
                        <BookingStatusBadge
                          status={
                            appointmentStatusUpper === 'COMPLETED'
                              ? appointmentPaymentBadgeIsPaid
                                ? 'completed_paid'
                                : 'completed_unpaid'
                              : appointmentDetail.status
                          }
                          label={appointmentDetail.status}
                          showDot={false}
                        />
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
                    <div className="mt-3 space-y-1">
                      <p className="text-lg font-semibold leading-snug text-slate-900">
                        {formatAppointmentCustomerDisplayName(appointmentDetail)}
                      </p>
                      {formatAppointmentCustomerContactLines(appointmentDetail).map((line) => (
                        <p key={`appointment-contact-${line.label}`} className="text-xs font-medium text-slate-600">
                          <span className="text-slate-500">{line.label}:</span> {line.value}
                        </p>
                      ))}
                    </div>

                    {/* <div className="mt-4 rounded-lg border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-white px-3 py-3 shadow-sm ring-1 ring-indigo-100/80">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-900">Services</p>
                      <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-900">{appointmentDetail.service?.name ?? '—'}</p>
                    </div>

                    {appointmentDetail.add_ons?.length && !(appointmentDetail.main_services?.length) ? (
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
                    ) : null} */}

                    {appointmentDisplayMainServices.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3 shadow-sm ring-1 ring-slate-200/80">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-800">Service</p>
                        <div className="mt-2 space-y-2">
                          {(() => {
                            const originalServiceForPackage = appointmentDisplayMainServices.find((service, idx) => service.is_original ?? idx === 0)
                            const packageMainReference = Number(originalServiceForPackage?.extra_price ?? appointmentDetail.service_total ?? 0)
                            const packageRemainingForAddons = Math.max(0, appointmentPackageOffsetAmount - packageMainReference)
                            let addonCoverageUsed = 0

                            return appointmentDisplayMainServices.map((service, serviceIdx) => {
                              const servicePrice = Number(service.extra_price ?? 0)
                              const packageCoversMainService =
                                appointmentPackageApplied &&
                                (service.is_original ?? serviceIdx === 0) &&
                                appointmentPackageOffsetAmount > 0.0001

                              return (
                                <div key={`appt-main-block-${service.id ?? service.name}-${serviceIdx}`} className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <PosServiceNameStack
                                        name={`${service.name}${service.is_original ? ' (Original)' : ''}`}
                                        cnName={service.cn_name}
                                        primaryClassName="text-sm font-semibold text-slate-900"
                                        secondaryClassName="mt-0.5 text-xs text-slate-500"
                                      />
                                      {packageCoversMainService ? (
                                        <p className="mt-0.5 text-[11px] font-medium leading-snug text-emerald-700">
                                          Included in your package (main service)
                                        </p>
                                      ) : null}
                                    </div>
                                    <span className="text-right text-xs font-semibold tabular-nums text-slate-900">
                                      {packageCoversMainService ? (
                                        <>
                                          <span className="block text-slate-400 line-through">RM {servicePrice.toFixed(2)}</span>
                                          <span className="block text-emerald-800">RM 0.00</span>
                                        </>
                                      ) : (
                                        <>RM {servicePrice.toFixed(2)}</>
                                      )}
                                    </span>
                                  </div>
                                  {(service.add_ons ?? []).length > 0 ? (
                                    <ul className="mt-1.5 space-y-0.5 text-xs text-slate-700">
                                      {(service.add_ons ?? []).map((addon, addonIdx) => {
                                        const addonPrice = Number(addon.extra_price ?? 0)
                                        const packageCoversAddon =
                                          appointmentPackageApplied &&
                                          packageRemainingForAddons > addonCoverageUsed + 0.0001 &&
                                          addonPrice > 0.0001 &&
                                          packageRemainingForAddons + 0.0001 >= addonCoverageUsed + addonPrice
                                        if (packageCoversAddon) addonCoverageUsed += addonPrice

                                        return (
                                          <li key={`appt-main-addon-${service.id ?? service.name}-${addon.id ?? addon.name}-${addonIdx}`} className="flex justify-between gap-2">
                                            <span>
                                              + {addon.name}
                                              {addon.cn_name ? <span className="block pl-2 text-[11px] text-slate-500">{addon.cn_name}</span> : null}
                                              {packageCoversAddon ? (
                                                <span className="mt-0.5 block pl-2 text-[11px] font-medium leading-snug text-emerald-700">
                                                  Included in your package (add-on)
                                                </span>
                                              ) : null}
                                            </span>
                                            <span className="text-right tabular-nums">
                                              {packageCoversAddon ? (
                                                <>
                                                  <span className="block text-slate-400 line-through">RM {addonPrice.toFixed(2)}</span>
                                                  <span className="block font-semibold text-emerald-800">RM 0.00</span>
                                                </>
                                              ) : (
                                                <>RM {addonPrice.toFixed(2)}</>
                                              )}
                                            </span>
                                          </li>
                                        )
                                      })}
                                    </ul>
                                  ) : null}
                                </div>
                              )
                            })
                          })()}
                        </div>
                      </div>
                    ) : null}

                    {!appointmentIsTerminalCancelled &&
                    !(appointmentStatusUpper === 'COMPLETED' && appointmentPaymentBadgeIsPaid) ? (
                      <div className="mt-3">
                        {appointmentDetail.requires_settled_amount ? (
                          <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                            <p className="text-xs font-semibold text-amber-900">
                              This service uses range pricing (RM {Number(appointmentDetail.service?.price_range_min ?? 0).toFixed(2)} - RM {Number(appointmentDetail.service?.price_range_max ?? 0).toFixed(2)}). Please click Edit to set the final service amount before checkout.
                            </p>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void openEditSettlement()}
                          disabled={appointmentActionLoading}
                          className="w-full rounded-lg border-2 border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 shadow-sm transition-colors hover:bg-indigo-100 disabled:opacity-50"
                        >
                          Edit Settlement
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <div className="flex gap-3 text-sm">
                        <span className="w-[5.5rem] shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Staff</span>
                        <span className="min-w-0 font-semibold text-slate-900">{formatAppointmentStaffLabel(appointmentDetail)}</span>
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
                          {appointmentSettlementDurationMin > 0 ? `${appointmentSettlementDurationMin} min` : formatDurationFromRange(appointmentDetail.appointment_start_at, appointmentDetail.appointment_end_at)}
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
                        <span className="font-medium tabular-nums text-slate-900">
                          {appointmentDetail.is_range_priced && appointmentDetail.settled_service_amount == null
                            ? `RM ${Number(appointmentDetail.service?.price_range_min ?? 0).toFixed(2)} - ${Number(appointmentDetail.service?.price_range_max ?? 0).toFixed(2)}`
                            : `RM ${appointmentServiceAmount.toFixed(2)}`}
                        </span>
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
                        <span className="text-xl font-bold tabular-nums text-emerald-800">
                          {appointmentDetail.is_range_priced && appointmentDetail.settled_service_amount == null
                            ? (() => {
                                const rangeMin = Number(appointmentDetail.service?.price_range_min ?? 0)
                                const rangeMax = Number(appointmentDetail.service?.price_range_max ?? 0)
                                const totalMin = Math.max(0, rangeMin + appointmentAddonDueForBreakdown - appointmentDepositTotalForBreakdown - appointmentPackageOffsetAmount)
                                const totalMax = Math.max(0, rangeMax + appointmentAddonDueForBreakdown - appointmentDepositTotalForBreakdown - appointmentPackageOffsetAmount)
                                return totalMin === totalMax
                                  ? `RM ${totalMin.toFixed(2)}`
                                  : `RM ${totalMin.toFixed(2)} - ${totalMax.toFixed(2)}`
                              })()
                            : `RM ${appointmentDueAmountNow.toFixed(2)}`}
                        </span>
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
                        <p className="text-xs text-slate-500">
                          {checkoutZeroPackageSettlement
                            ? 'Package covers this visit—tap Checkout to confirm and issue the receipt (same flow as when collecting payment).'
                            : 'Settle this completed appointment via cash or QRPay.'}
                        </p>
                        <div
                          className={`grid gap-2 ${
                            appointmentShowApplyPackageButton || packageReservedPendingRegister ? 'grid-cols-2' : 'grid-cols-1'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={
                              cashShiftActionDisabled ||
                              appointmentActionLoading ||
                              !!appointmentDetail?.requires_settled_amount ||
                              (appointmentDueAmountNow <= 0.0001 && !checkoutZeroPackageSettlement)
                            }
                            onClick={() => {
                              const due = appointmentDueAmountNow
                              setAppointmentPaymentMethod('cash')
                              setAppointmentSettlementPaymentAmounts({ cash: due > 0 ? due.toFixed(2) : '', qrpay: '', credit_card: '' })
                              setAppointmentDiscountTypeDraft('fixed')
                              setAppointmentDiscountValueDraft('')
                              setAppointmentDiscountRemarkDraft('')
                              setAppointmentCheckoutError(null)
                              setAppointmentCheckoutConfirmationOpen(true)
                            }}
                            className="min-h-[44px] rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"
                            title={
                              cashShiftActionDisabled
                                ? requireOpenShiftMessage
                                : appointmentDetail?.requires_settled_amount
                                ? 'Set the service amount via Edit Settlement first'
                                : checkoutZeroPackageSettlement
                                  ? 'Confirm checkout and receipt'
                                  : undefined
                            }
                          >
                            Checkout
                          </button>
                          {appointmentShowApplyPackageButton ? (
                            <button
                              type="button"
                              disabled={cashShiftActionDisabled || appointmentActionLoading || !appointmentCanApplyPackage}
                              title={cashShiftActionTitle ?? (!appointmentCanApplyPackage ? appointmentPackageDisabledReason : undefined)}
                              onClick={() => void applyAppointmentPackage()}
                              className="min-h-[44px] rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:pointer-events-none disabled:opacity-50"
                            >
                              Apply package
                            </button>
                          ) : packageReservedPendingRegister ? (
                            <button
                              type="button"
                              disabled={cashShiftActionDisabled || appointmentActionLoading}
                              title={cashShiftActionTitle}
                              onClick={() => void releaseAppointmentPackage()}
                              className="min-h-[44px] rounded-lg border-2 border-amber-600 bg-white py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50 disabled:pointer-events-none disabled:opacity-50"
                            >
                              Unclaim package
                            </button>
                          ) : null}
                        </div>
                        {appointmentShowApplyPackageButton && !appointmentCanApplyPackage ? (
                          <p className="text-[11px] font-medium text-amber-700">{appointmentPackageDisabledReason}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {showAppointmentMarkCompletedBlock ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Complete visit</p>
                        <p className="text-xs text-slate-500">Mark as Completed first to enable Checkout / Apply package.</p>
                        <button
                          type="button"
                          disabled={!canMarkAppointmentCompleted || appointmentActionLoading}
                          title={cashShiftActionDisabled ? requireOpenShiftMessage : 'Mark appointment as completed'}
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
                          disabled={cashShiftActionDisabled || appointmentActionLoading}
                          title={cashShiftActionTitle}
                          onClick={() => void updateAppointmentStatus('CANCELLED')}
                          className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={cashShiftActionDisabled || appointmentActionLoading}
                          title={cashShiftActionDisabled ? requireOpenShiftMessage : 'Customer did not attend the scheduled appointment (DNA / no-show).'}
                          onClick={() => void updateAppointmentStatus('NO_SHOW')}
                          className="min-h-[48px] rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          No Show
                        </button>
                        <button
                          type="button"
                          disabled={cashShiftActionDisabled || appointmentActionLoading}
                          title={cashShiftActionTitle}
                          onClick={() => void updateAppointmentStatus('LATE_CANCELLATION')}
                          className="min-h-[48px] rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm font-semibold text-orange-900 shadow-sm transition hover:bg-orange-50 disabled:opacity-50"
                        >
                          Late cancellation
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={sendingConfirmationEmail || Date.now() < confirmationEmailCooldownUntil || appointmentActionLoading}
                        onClick={() => void sendConfirmationEmail()}
                        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-100 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        {sendingConfirmationEmail
                          ? 'Sending…'
                          : Date.now() < confirmationEmailCooldownUntil
                            ? 'Sent (wait…)'
                            : 'Send Confirmation Email'}
                      </button>
                    </section>
                  ) : null}

                  <section className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <CustomerUploadedPhotosModal
                        photos={appointmentUploadedPhotos}
                        bookingCode={appointmentDetail.booking_code}
                        layout="tile"
                      />
                      <BookingServicePhotosModal
                        bookingId={appointmentDetail.id}
                        bookingCode={appointmentDetail.booking_code}
                        initialPhotos={appointmentDetail.service_photos ?? []}
                        canManage={!cashShiftActionDisabled}
                        layout="tile"
                        onChanged={(photos) => setAppointmentDetail((prev) => (prev ? { ...prev, service_photos: photos } : prev))}
                      />
                    </div>
                  </section>

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

      {createAppointmentModalOpen ? (
        <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Create Appointment</h3>
                <p className="mt-0.5 text-xs text-gray-500">Create directly, with optional split deposit collection.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeCreateAppointmentMemberPicker()
                  setCreateAppointmentModalOpen(false)
                }}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-600">Main Services</label>
                    <div className="flex flex-wrap justify-end gap-2">
                      {createAppointmentServiceDraft ? (
                        <button
                          type="button"
                          onClick={() => {
                            const lineKeys = [
                              `appointment-create:main:${createAppointmentServiceDraft.id}`,
                              ...createAppointmentSelectedOptionIds.map((id) => `appointment-create:addon:${id}`),
                              ...createAppointmentExtraServiceBlocks.flatMap((block) => [
                                ...(block.service ? [`appointment-create:block:${block.id}:main`] : []),
                                ...block.selectedOptionIds.map((id) => `appointment-create:block:${block.id}:addon:${id}`),
                              ]),
                            ]
                            void openAppointmentBulkLineSplitEditor('Create Appointment Lines', lineKeys, assignedStaffDefaultSplit(createAppointmentAssignedStaffId))
                          }}
                          className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700"
                        >
                          Apply Staff Split to All Lines
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setCreateAppointmentExtraServiceBlocks((prev) => [
                            ...prev,
                            { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, service: null, questions: [], selectedOptionIds: [] },
                          ])
                        }}
                        className="rounded-md border border-blue-300 bg-white px-2 py-1 text-xs font-semibold text-blue-700"
                      >
                        + Add Main Service
                      </button>
                    </div>
                  </div>
                  <BookingServicePicker
                    categories={bookingServiceCategories}
                    services={createAppointmentServices}
                    selectedCategoryId={createAppointmentServiceCategoryId}
                    onCategoryChange={(next) => {
                      setCreateAppointmentServiceCategoryId(next)
                      if (next && createAppointmentServiceDraft && !bookingServiceMatchesPickerCategory(createAppointmentServiceDraft, next)) {
                        setCreateAppointmentServiceDraft(null)
                        setCreateAppointmentQuestions([])
                        setCreateAppointmentSelectedOptionIds([])
                      }
                    }}
                    searchQuery={createAppointmentServiceQuery}
                    onSearchQueryChange={setCreateAppointmentServiceQuery}
                    selectedServiceId={createAppointmentServiceDraft?.id ?? null}
                    onSelectService={(service) => {
                      const selected = service as BookingServiceOption
                      setCreateAppointmentServiceDraft(selected)
                      setCreateAppointmentSelectedOptionIds([])
                      setCreateAppointmentAssignedStaffId(null)
                      setCreateAppointmentSlotValue('')
                      setCreateAppointmentSlots([])
                      void loadCreateAppointmentQuestions(selected.id)
                    }}
                    loading={createAppointmentServicesLoading}
                    emptyMessage="No services found."
                    searchPlaceholder="Search service name..."
                  />

                  {createAppointmentServiceDraft ? (
                    <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                      <PosServiceNameStack
                        name={createAppointmentServiceDraft.name}
                        cnName={createAppointmentServiceDraft.cn_name}
                        primaryClassName="text-sm font-semibold text-blue-950"
                        secondaryClassName="mt-0.5 text-xs text-blue-700/80"
                      />
                      <p className="mt-1">Base time: {Number(createAppointmentServiceDraft.duration_min ?? 0)} min</p>
                      {(() => {
                        const lineKey = `appointment-create:main:${createAppointmentServiceDraft.id}`
                        const inherited = assignedStaffDefaultSplit(createAppointmentAssignedStaffId)
                        return (
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {renderAppointmentLineSplitStack(lineKey, inherited, 'assigned staff')}
                            <button type="button" onClick={() => void openAppointmentLineSplitEditor(lineKey, createAppointmentServiceDraft.name ?? 'Main service', inherited)} className="rounded border border-indigo-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                          </div>
                        )
                      })()}
                    </div>
                  ) : null}

                  {createAppointmentQuestions.map((question) => (
                    <div key={question.id} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div><p className="text-sm font-semibold text-gray-900">{question.title}</p>{question.cn_title ? <p className="mt-0.5 text-xs text-gray-500">{question.cn_title}</p> : null}</div>
                      <div className="mt-2 space-y-1.5">
                        {question.options.map((option) => {
                          const checked = createAppointmentSelectedOptionIds.includes(option.id)
                          return (
                            <label key={option.id} className="flex cursor-pointer items-start justify-between gap-2 rounded-md px-1 py-1 hover:bg-gray-50">
                              <div className="flex items-start gap-2">
                                <input
                                  type={question.question_type === 'multi_choice' ? 'checkbox' : 'radio'}
                                  name={`create-question-${question.id}`}
                                  checked={checked}
                                  onChange={() => {
                                    setCreateAppointmentSelectedOptionIds((prev) => {
                                      if (question.question_type === 'single_choice') {
                                        const keep = prev.filter((id) => !question.options.some((opt) => opt.id === id))
                                        return checked ? keep : [...keep, option.id]
                                      }
                                      return checked ? prev.filter((id) => id !== option.id) : [...prev, option.id]
                                    })
                                  }}
                                />
                                <PosServiceNameStack
                                  name={option.label}
                                  cnName={option.cn_label ?? option.cn_name ?? option.linked_cn_name}
                                  primaryClassName="text-sm text-gray-800"
                                  secondaryClassName="mt-0.5 text-xs text-gray-500"
                                />
                              </div>
                              <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold text-gray-700">
                                <span>+RM{Number(option.extra_price ?? 0).toFixed(2)}</span>
                                {checked && createAppointmentServiceDraft ? (() => {
                                  const lineKey = `appointment-create:addon:${option.id}`
                                  const inherited = appointmentLineStaffSplits[`appointment-create:main:${createAppointmentServiceDraft.id}`] ?? assignedStaffDefaultSplit(createAppointmentAssignedStaffId)
                                  return (
                                    <>
                                      {renderAppointmentLineSplitStack(lineKey, inherited, 'main service')}
                                      <button type="button" onClick={(event) => { event.preventDefault(); void openAppointmentLineSplitEditor(lineKey, option.label, inherited) }} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                                    </>
                                  )
                                })() : null}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  {createAppointmentServiceDraft ? (
                    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                      <p>Duration: {Number(createAppointmentServiceDraft.duration_min ?? 0) + createAppointmentAddonDurationTotal + createAppointmentExtraTotals.baseDuration + createAppointmentExtraTotals.addonDuration} min</p>
                      <p>
                        Total price:{' '}
                        {createAppointmentServiceDraft.price_mode === 'range' &&
                        createAppointmentServiceDraft.price_range_min != null &&
                        createAppointmentServiceDraft.price_range_max != null
                          ? `RM${(Number(createAppointmentServiceDraft.price_range_min) + createAppointmentAddonPriceTotal + createAppointmentExtraTotals.basePrice + createAppointmentExtraTotals.addonPrice).toFixed(2)} - RM${(Number(createAppointmentServiceDraft.price_range_max) + createAppointmentAddonPriceTotal + createAppointmentExtraTotals.basePrice + createAppointmentExtraTotals.addonPrice).toFixed(2)}`
                          : `RM${(Number(createAppointmentServiceDraft.price ?? createAppointmentServiceDraft.service_price ?? 0) + createAppointmentAddonPriceTotal + createAppointmentExtraTotals.basePrice + createAppointmentExtraTotals.addonPrice).toFixed(2)}`}
                      </p>
                    </div>
                  ) : null}
                  {createAppointmentExtraServiceBlocks.map((block, blockIndex) => (
                    <div key={block.id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Service Block {blockIndex + 2}</p>
                          {block.service ? (
                            <>
                              <PosServiceNameStack name={block.service.name} cnName={block.service.cn_name} primaryClassName="mt-0.5 text-sm font-semibold text-gray-900" secondaryClassName="mt-0.5 text-xs text-gray-500" />
                              {(() => {
                                const lineKey = `appointment-create:block:${block.id}:main`
                                const inherited = assignedStaffDefaultSplit(createAppointmentAssignedStaffId)
                                return (
                                  <div className="mt-1 flex flex-wrap items-center gap-1">
                                    {renderAppointmentLineSplitStack(lineKey, inherited, 'assigned staff')}
                                    <button type="button" onClick={() => void openAppointmentLineSplitEditor(lineKey, block.service?.name ?? 'Service block', inherited)} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                                  </div>
                                )
                              })()}
                            </>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCreateAppointmentExtraServiceBlocks((prev) => prev.filter((row) => row.id !== block.id))
                            setCreateAppointmentExtraServiceCategoryIds((prev) => {
                              const next = { ...prev }
                              delete next[block.id]
                              return next
                            })
                            setCreateAppointmentExtraServiceQueries((prev) => {
                              const next = { ...prev }
                              delete next[block.id]
                              return next
                            })
                          }}
                          className="shrink-0 rounded-md border border-rose-300 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="min-w-0">
                          {(() => {
                            const takenByOthers = [
                              ...(createAppointmentServiceDraft?.id ? [createAppointmentServiceDraft.id] : []),
                              ...createAppointmentExtraServiceBlocks
                                .filter((row) => row.id !== block.id)
                                .map((row) => Number(row.service?.id ?? 0))
                                .filter((id) => id > 0),
                            ]

                            return (
                              <BookingServicePicker
                                categories={bookingServiceCategories}
                                services={createAppointmentServices}
                                selectedCategoryId={createAppointmentExtraServiceCategoryIds[block.id] ?? null}
                                onCategoryChange={(next) => {
                                  setCreateAppointmentExtraServiceCategoryIds((prev) => ({ ...prev, [block.id]: next }))
                                  if (next && block.service && !bookingServiceMatchesPickerCategory(block.service, next)) {
                                    setCreateAppointmentExtraServiceBlocks((prev) => prev.map((row) => row.id === block.id ? { ...row, service: null, questions: [], selectedOptionIds: [] } : row))
                                  }
                                }}
                                searchQuery={createAppointmentExtraServiceQueries[block.id] ?? ''}
                                onSearchQueryChange={(query) => setCreateAppointmentExtraServiceQueries((prev) => ({ ...prev, [block.id]: query }))}
                                selectedServiceId={block.service?.id ?? null}
                                excludeServiceIds={takenByOthers}
                                onSelectService={async (service) => {
                                  const selected = service as BookingServiceOption
                                  const questions = await fetchServiceAddonQuestions(selected.id)
                                  setCreateAppointmentExtraServiceBlocks((prev) =>
                                    prev.map((row) =>
                                      row.id === block.id
                                        ? { ...row, service: selected, questions, selectedOptionIds: [] }
                                        : row,
                                    ),
                                  )
                                }}
                                loading={createAppointmentServicesLoading}
                                emptyMessage="No services found."
                                searchPlaceholder="Search service name..."
                              />
                            )
                          })()}
                      </div>
                      {block.questions.map((question) => (
                        <div key={`${block.id}-${question.id}`} className="rounded border border-gray-200 p-2">
                          <p className="text-xs font-semibold text-gray-800">
                            {question.title}
                            {question.is_required ? <span className="ml-1 text-red-600">*</span> : null}
                          </p>
                          {question.cn_title ? <p className="mt-0.5 text-[11px] text-gray-500">{question.cn_title}</p> : null}
                          <div className="mt-1 space-y-1">
                            {question.options.map((option) => {
                              const checked = block.selectedOptionIds.includes(option.id)
                              return (
                                <label key={`${block.id}-option-${option.id}`} className="flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        setCreateAppointmentExtraServiceBlocks((prev) => prev.map((row) => {
                                          if (row.id !== block.id) return row
                                          if (question.question_type === 'single_choice') {
                                            const withoutQuestion = row.selectedOptionIds.filter((id) => !question.options.some((opt) => opt.id === id))
                                            return { ...row, selectedOptionIds: checked ? withoutQuestion : [...withoutQuestion, option.id] }
                                          }
                                          return { ...row, selectedOptionIds: checked ? row.selectedOptionIds.filter((id) => id !== option.id) : [...row.selectedOptionIds, option.id] }
                                        }))
                                      }}
                                    />
                                    <PosServiceNameStack
                                      name={option.label}
                                      cnName={option.cn_label ?? option.cn_name ?? option.linked_cn_name}
                                      primaryClassName="text-xs text-gray-700"
                                      secondaryClassName="mt-0.5 text-[11px] text-gray-500"
                                    />
                                  </div>
                                  <span className="flex flex-col items-end gap-1 font-semibold text-gray-700">
                                    <span>+RM{Number(option.extra_price ?? 0).toFixed(2)}</span>
                                    {checked ? (() => {
                                      const lineKey = `appointment-create:block:${block.id}:addon:${option.id}`
                                      const inherited = appointmentLineStaffSplits[`appointment-create:block:${block.id}:main`] ?? assignedStaffDefaultSplit(createAppointmentAssignedStaffId)
                                      return (
                                        <>
                                          {renderAppointmentLineSplitStack(lineKey, inherited, 'service block')}
                                          <button type="button" onClick={(event) => { event.preventDefault(); void openAppointmentLineSplitEditor(lineKey, option.label, inherited) }} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                                        </>
                                      )
                                    })() : null}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Customer</label>
                    <div
                      className="mt-1 flex w-full rounded-lg border border-gray-300 bg-gray-100 p-1"
                      role="tablist"
                      aria-label="Customer type"
                    >
                      <button
                        type="button"
                        onClick={() => setCreateAppointmentIdentityMode('member')}
                        role="tab"
                        aria-selected={createAppointmentIdentityMode === 'member'}
                        className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                          createAppointmentIdentityMode === 'member'
                            ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Member
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateAppointmentIdentityMode('guest')
                          setCreateAppointmentCustomerId(null)
                          setCreateAppointmentMemberSummary(null)
                          closeCreateAppointmentMemberPicker()
                        }}
                        role="tab"
                        aria-selected={createAppointmentIdentityMode === 'guest'}
                        className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                          createAppointmentIdentityMode === 'guest'
                            ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Guest
                      </button>
                    </div>
                  </div>

                  {createAppointmentIdentityMode === 'member' ? (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-gray-600">Member</label>
                        <button
                          type="button"
                          onClick={() => {
                            setCreateAppointmentMemberQuery('')
                            setCreateAppointmentMemberResults([])
                            setCreateAppointmentMemberPickerOpen(true)
                          }}
                          className="rounded-md border border-blue-300 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700"
                        >
                          {createAppointmentMemberSummary ? 'change member' : 'assign member'}
                        </button>
                      </div>
                      <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        {createAppointmentMemberSummary
                          ? `${createAppointmentMemberSummary.name}${
                              createAppointmentMemberSummary.phone ? ` (${createAppointmentMemberSummary.phone})` : ''
                            }`
                          : 'No member selected'}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={createAppointmentGuestName}
                        onChange={(e) => setCreateAppointmentGuestName(e.target.value)}
                        placeholder="Guest name"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      />
                      <InternationalPhoneInput
                        value={createAppointmentGuestPhone}
                        onChange={setCreateAppointmentGuestPhone}
                        placeholder="Guest phone"
                      />
                      <input
                        value={createAppointmentGuestEmail}
                        onChange={(e) => setCreateAppointmentGuestEmail(e.target.value)}
                        placeholder="Guest email"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Appointment Date</label>
                      <input
                        type="date"
                        value={createAppointmentDate}
                        onChange={(e) => {
                          setCreateAppointmentDate(e.target.value)
                          setCreateAppointmentSlotValue('')
                          setCreateAppointmentAssignedStaffId(null)
                        }}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Appointment Slot / Time</label>
                      <select
                        value={createAppointmentSlotValue}
                        onChange={(e) => setCreateAppointmentSlotValue(e.target.value)}
                        disabled={!createAppointmentDate || createAppointmentSlotsLoading}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
                      >
                        <option value="">{createAppointmentSlotsLoading ? 'Loading slots...' : 'Select slot'}</option>
                        {createAppointmentSlots.map((slot) => (
                          <option key={slot.start_at} value={slot.start_at}>
                            {formatTimeRange(slot.start_at, slot.end_at)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Assigned Staff</label>
                    <div className="mt-1">
                      <BookingPackageItemServicePicker
                        options={createAppointmentStaffPickerOptions.map((s) => ({ id: s.id, name: s.name }))}
                        value={createAppointmentAssignedStaffId != null ? String(createAppointmentAssignedStaffId) : ''}
                        onChange={(next) => setCreateAppointmentAssignedStaffId(Number(next) || null)}
                        disabled={
                          createAppointmentSubmitting ||
                          !createAppointmentServiceDraft ||
                          !createAppointmentStaffPickerReady ||
                          createAppointmentStaffPickerOptions.length === 0
                        }
                        placeholder={createAppointmentStaffPickerReady ? 'Select staff' : 'Select date and slot first'}
                        searchPlaceholder="Search staff…"
                        unknownEntityLabel="Staff"
                        ariaLabel="Select staff"
                        emptySearchMessage="No staff match your search."
                        emptyListMessage={
                          createAppointmentStaffPickerReady
                            ? 'No staff available for this slot.'
                            : 'Select appointment date and slot first.'
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Remarks (optional)</label>
                    <textarea
                      rows={3}
                      value={createAppointmentNotes}
                      onChange={(e) => setCreateAppointmentNotes(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <label className="text-xs font-semibold text-gray-700">Deposit Payment (optional)</label>
                      <span className="text-[11px] font-medium text-gray-500">Leave all amounts as 0 for no deposit</span>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {SPLIT_PAYMENT_METHODS.map(({ method, label }) => (
                          <div key={method}>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">{label} Amount</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={createAppointmentDepositPayments[method]}
                              onChange={(e) => {
                                setCreateAppointmentDepositPayments((prev) => ({ ...prev, [method]: e.target.value }))
                                setCreateAppointmentError(null)
                              }}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                              placeholder="0.00"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                        <span>Total Deposit: RM {createAppointmentDepositValue.toFixed(2)}</span>
                        <span>Paid: RM {createAppointmentDepositPaid.toFixed(2)}</span>
                        <span className="text-emerald-700">Remaining: RM 0.00</span>
                      </div>
                      {createAppointmentDepositHasQrPay ? (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <label className="mb-2 block text-sm font-bold text-gray-900">Upload Payment Proof (optional)</label>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <button type="button" className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50" onClick={() => appointmentQrUploadInputRef.current?.click()}>Upload</button>
                            <button type="button" className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50" onClick={() => appointmentQrCameraBackInputRef.current?.click()}>Back Camera</button>
                            <button type="button" className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50" onClick={() => appointmentQrCameraFrontInputRef.current?.click()}>Front Camera</button>
                          </div>
                          <input ref={appointmentQrUploadInputRef} type="file" accept="image/*" onChange={onSelectAppointmentQrProof} className="sr-only" />
                          <input ref={appointmentQrCameraBackInputRef} type="file" accept="image/*" capture="environment" onChange={onSelectAppointmentQrProof} className="sr-only" />
                          <input ref={appointmentQrCameraFrontInputRef} type="file" accept="image/*" capture="user" onChange={onSelectAppointmentQrProof} className="sr-only" />
                          {appointmentQrProofFileName ? (
                            <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                              <p className="truncate pr-2 font-semibold text-emerald-800">{appointmentQrProofFileName}</p>
                              <button type="button" className="font-semibold text-red-600 hover:text-red-700" onClick={clearAppointmentQrProof}>Clear</button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {createAppointmentError ? (
              <div className="mx-5 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {createAppointmentError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  closeCreateAppointmentMemberPicker()
                  setCreateAppointmentModalOpen(false)
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitCreateAppointment()}
                disabled={cashShiftActionDisabled || createAppointmentSubmitting}
                title={cashShiftActionTitle}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {createAppointmentSubmitting ? 'Creating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createAppointmentMemberPickerOpen ? (
        <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={closeCreateAppointmentMemberPicker}
            aria-label="Close assign member"
          />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between rounded-t-2xl border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4">
              <h4 className="text-xl font-bold text-gray-900">assign member</h4>
              <button
                type="button"
                onClick={closeCreateAppointmentMemberPicker}
                className="rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="border-b-2 border-gray-200 bg-white p-5">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={createAppointmentMemberQuery}
                  onChange={(e) => setCreateAppointmentMemberQuery(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Search by name or phone"
                  autoFocus
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Search member by name or phone. Type at least 3 characters to search.
              </p>
            </div>

            <div className="max-h-[65vh] overflow-auto">
              {createAppointmentMemberQuery.trim().length < 3 ? (
                <div className="p-8 text-center text-sm text-gray-500">Type at least 3 characters to search.</div>
              ) : createAppointmentMemberSearchLoading ? (
                <div className="p-6 text-sm text-gray-500">Loading members...</div>
              ) : (
                createAppointmentMemberResults.map((member) => (
                  <button
                    key={`create-appt-member-${member.id}`}
                    type="button"
                    className="block w-full border-b border-gray-100 p-4 text-left transition-all last:border-b-0 hover:bg-gradient-to-r hover:from-blue-50 hover:to-white active:bg-blue-100"
                    onClick={() => {
                      const phone =
                        (member.phone && member.phone.trim()) || member.phone_masked?.trim() || null
                      setCreateAppointmentCustomerId(member.id)
                      setCreateAppointmentMemberSummary({
                        id: member.id,
                        name: member.name,
                        phone,
                      })
                      showMsg('Member assigned.', 'success')
                      closeCreateAppointmentMemberPicker()
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-blue-300">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={member.avatar_url || '/images/default_user_image.jpg'}
                          alt={member.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold leading-tight text-gray-900">{member.name}</p>
                        <p className="mt-1 text-xs text-gray-600">{member.phone_masked ?? '***'}</p>
                      </div>
                      <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))
              )}

              {!createAppointmentMemberSearchLoading &&
              createAppointmentMemberQuery.trim().length >= 3 &&
              createAppointmentMemberResults.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm font-medium text-gray-600">No members found</p>
                  <p className="mt-1 text-xs text-gray-500">Try adjusting your search terms</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

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
                              disabled={cashShiftActionDisabled || cancellationReviewSubmitting}
                              title={cashShiftActionTitle}
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
                              disabled={cashShiftActionDisabled || cancellationReviewSubmitting}
                              title={cashShiftActionTitle}
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
                <span className="font-semibold">Customer:</span> {formatAppointmentCustomerDisplayName(appointmentDetail)}
              </p>
              <p>
                <span className="font-semibold">Service:</span>
                <PosServiceNameStack
                  name={appointmentDetail.service?.name}
                  cnName={appointmentDetail.service?.cn_name}
                  primaryClassName="mt-0.5 text-xs font-medium text-gray-900"
                  secondaryClassName="mt-0.5 text-[11px] text-gray-500"
                />
              </p>
              <p>
                <span className="font-semibold">Current Staff:</span> {formatAppointmentStaffLabel(appointmentDetail)}
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

      {editSettlementOpen && appointmentDetail && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
              <div>
                <h4 className="text-lg font-bold text-gray-900">Edit Settlement</h4>
                <p className="text-xs text-gray-500">{appointmentDetail.booking_code} · {editOriginalService?.name ?? appointmentDetail.service?.name ?? '—'}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditSettlementOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold">Estimated duration after save: {editSettlementEstimatedDurationMin > 0 ? `${editSettlementEstimatedDurationMin} min` : '—'}</p>
                    <p className="text-xs text-amber-800">Backend will validate the updated time range before saving.</p>
                  </div>
                  <div className="text-xs font-semibold tabular-nums text-amber-950">
                    {formatTimeRange(appointmentDetail.appointment_start_at, editSettlementEstimatedEndAt)}
                  </div>
                </div>
                {appointmentDetail.appointment_end_at && editSettlementEstimatedEndAt && new Date(editSettlementEstimatedEndAt).getTime() > new Date(appointmentDetail.appointment_end_at).getTime() ? (
                  <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-amber-900">
                    This settlement extends the appointment. Save will be blocked if the new end time conflicts with another booking or staff availability.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-5">
              {settlementNeedsSettledAmount(editOriginalSettlementSource) ? (
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">
                    Service Amount
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Range: RM {getSettlementRangeBounds(editOriginalSettlementSource).min.toFixed(2)} – RM{' '}
                    {getSettlementRangeBounds(editOriginalSettlementSource).max.toFixed(2)}
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">RM</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={editSettledAmount}
                      onChange={(e) => {
                        setEditSettlementError(null)
                        setEditSettledAmount(e.target.value)
                      }}
                      className="w-full rounded-lg border-2 border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder={`${getSettlementRangeBounds(editOriginalSettlementSource).min.toFixed(2)} - ${getSettlementRangeBounds(editOriginalSettlementSource).max.toFixed(2)}`}
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Staff Split Bulk Setup</p>
                      <p className="mt-0.5 text-[11px] text-indigo-700">Apply a split to selected settlement add-on lines; service blocks remain the inheritance source.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!appointmentDetail?.id) return
                        const lineKeys = [
                          ...Array.from(editSelectedAddonIds).map((id) => `appointment-settlement:${appointmentDetail.id}:addon:${id}`),
                          ...editAddedMainBlocks.flatMap((block) => Array.from(block.selected_addon_ids).map((id) => `appointment-settlement:${appointmentDetail.id}:block:${block.tmp_id}:addon:${id}`)),
                        ]
                        void openAppointmentBulkLineSplitEditor('Edit Settlement Lines', lineKeys, editStaffSplitsToLineSplits(editStaffSplits))
                      }}
                      className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      Apply Staff Split to All Lines
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Service Block · Original</p>
                      <PosServiceNameStack
                        name={editOriginalService?.name ?? appointmentDetail.service?.name ?? 'Service'}
                        cnName={editOriginalService?.cn_name ?? appointmentDetail.service?.cn_name}
                        primaryClassName="mt-1 text-sm font-semibold text-gray-900"
                        secondaryClassName="mt-0.5 text-xs text-gray-500"
                      />
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-gray-600">
                          {settlementNeedsSettledAmount(editOriginalSettlementSource) && parseSettlementAmountInput(editSettledAmount) == null
                            ? `RM ${getSettlementRangeBounds(editOriginalSettlementSource).min.toFixed(2)} - ${getSettlementRangeBounds(editOriginalSettlementSource).max.toFixed(2)}`
                            : `RM ${Number(
                                editOriginalServicePriceOverride
                                  ?? (settlementNeedsSettledAmount(editOriginalSettlementSource) && parseSettlementAmountInput(editSettledAmount) != null
                                    ? parseSettlementAmountInput(editSettledAmount)
                                    : editOriginalService?.service_price ?? editOriginalService?.price ?? appointmentDetail.service_total ?? 0),
                              ).toFixed(2)}`}
                          {Number(editOriginalService?.duration_min ?? 0) > 0 ? ` · ${editOriginalService?.duration_min}min` : ''}
                        </p>
                        <button type="button" onClick={() => openAppointmentPriceEditModal({ kind: 'originalService', name: editOriginalService?.name ?? appointmentDetail.service?.name ?? 'Service', currentUnitPrice: Number(editOriginalServicePriceOverride ?? editOriginalService?.service_price ?? editOriginalService?.price ?? appointmentDetail.service_total ?? 0), originalUnitPrice: Number(editOriginalService?.service_price ?? editOriginalService?.price ?? appointmentDetail.service_total ?? 0), quantity: 1 })} className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditOriginalServicePicker()}
                      className="shrink-0 rounded-md border border-indigo-300 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      change
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">Staff Split</p>
                  <button
                    type="button"
                    onClick={() => setEditStaffSplits((prev) => {
                      const next = [...prev, { staff_id: null, share_percent: '' }]
                      if (!editStaffSplitAutoBalance) return next
                      return rebalanceEditSettlementPrimaryShare(next)
                    })}
                    className="rounded-md border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    + Add Staff
                  </button>
                </div>
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={editStaffSplitAutoBalance}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setEditStaffSplitAutoBalance(checked)
                      if (checked) {
                        setEditStaffSplits((prev) => rebalanceEditSettlementPrimaryShare(prev))
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Auto Balance (lock first row, auto adjust to 100%)
                </label>
                <div className="space-y-2">
                  {editStaffSplits.map((split, idx) => (
                    <div key={`split-${idx}`} className="grid grid-cols-[1fr_120px_auto] gap-2">
                      <div className="min-w-0">
                        <BookingPackageItemServicePicker
                          options={activeStaffs
                            .filter((staff) => {
                              const selected = new Set(
                                editStaffSplits
                                  .map((row, rowIdx) => (rowIdx === idx ? null : row.staff_id))
                                  .filter((id): id is number => id != null),
                              )
                              return !selected.has(staff.id)
                            })
                            .map((staff) => ({ id: staff.id, name: staff.name }))}
                          value={split.staff_id != null ? String(split.staff_id) : ''}
                          onChange={(next) => {
                            const value = next ? Number(next) : null
                            setEditSettlementError(null)
                            setEditStaffSplits((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, staff_id: value } : row)))
                          }}
                          disabled={editSettlementLoading}
                          placeholder="Select staff"
                          searchPlaceholder="Search staff…"
                          unknownEntityLabel="Staff"
                          ariaLabel="Select staff"
                          emptySearchMessage="No staff match your search."
                          emptyListMessage="No staff available."
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={split.share_percent}
                          disabled={editStaffSplitAutoBalance && idx === 0}
                          onChange={(e) => updateEditSettlementSplitShare(idx, e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-7 text-sm"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                      </div>
                      <button
                        type="button"
                        disabled={editStaffSplits.length <= 1}
                        onClick={() => removeEditSettlementSplitRow(idx)}
                        className="rounded-lg border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-600 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>


              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-bold text-gray-900 mb-2">Add-ons</p>
                {editAddonOptionsLoading ? (
                  <p className="text-xs text-gray-500">Loading add-on options...</p>
                ) : editAddonQuestions.length === 0 ? (
                  <p className="text-xs text-gray-500">No add-on options available for this service.</p>
                ) : (
                  <div className="space-y-3">
                    {editAddonQuestions.map((question) => (
                      <div key={question.id}>
                        <div className="mb-1.5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{question.title}</p>{question.cn_title ? <p className="mt-0.5 text-[11px] text-gray-500">{question.cn_title}</p> : null}</div>
                        <div className="space-y-1.5">
                          {question.options.map((opt) => {
                            const checked = editSelectedAddonIds.has(opt.id)
                            return (
                              <label
                                key={opt.id}
                                className={`flex cursor-pointer items-center justify-between rounded-lg border-2 px-3 py-2.5 transition-all ${
                                  checked
                                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleEditAddon(opt.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <PosServiceNameStack
                                    name={opt.label}
                                    cnName={opt.cn_label ?? opt.cn_name ?? opt.linked_cn_name}
                                    primaryClassName="text-sm font-medium text-gray-900"
                                    secondaryClassName="mt-0.5 text-[11px] text-gray-500"
                                  />
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <span className="text-xs font-semibold tabular-nums text-gray-600">
                                    +RM {Number(editAddonPriceOverrides[opt.id] ?? opt.extra_price).toFixed(2)}
                                    {opt.extra_duration_min > 0 ? ` · ${opt.extra_duration_min}min` : ''}
                                  </span>
                                  {checked && appointmentDetail?.id ? (() => {
                                    const lineKey = `appointment-settlement:${appointmentDetail.id}:addon:${opt.id}`
                                    const inherited = editStaffSplitsToLineSplits(editStaffSplits)
                                    return (
                                      <>
                                        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); openAppointmentPriceEditModal({ kind: 'originalAddon', optionId: opt.id, name: opt.label ?? 'Add-on', currentUnitPrice: Number(editAddonPriceOverrides[opt.id] ?? opt.extra_price ?? 0), originalUnitPrice: Number(opt.extra_price ?? 0), quantity: 1 }) }} className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button>
                                        {renderAppointmentLineSplitStack(lineKey, inherited, 'main service')}
                                        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void openAppointmentLineSplitEditor(lineKey, opt.label, inherited) }} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                                      </>
                                    )
                                  })() : null}
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>

                <div className="space-y-5">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <button
                      type="button"
                      onClick={() => openEditMainServicePicker()}
                      className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">+ Add Main Service</p>
                          <p className="mt-0.5 text-xs text-gray-500">Add a service block, then configure its add-ons & staff split below</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-200">
                          Add
                        </span>
                      </div>
                    </button>
                  </div>


              {editAddedMainBlocks.map((block) => {
                const addonOptions = block.addon_questions.flatMap((q) => q.options)
                const selectedAddons = addonOptions.filter((opt) => block.selected_addon_ids.has(opt.id))
                const addonTotal = selectedAddons.reduce((sum, opt) => sum + Number(block.addon_price_overrides[opt.id] ?? opt.extra_price ?? 0), 0)
                const blockSubtotal = Number(block.price ?? 0) + addonTotal
                return (
                  <div key={`added-main-block-${block.tmp_id}`} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Service Block · Added</p>
                        {block.service_id > 0 ? (
                          <>
                            <PosServiceNameStack
                              name={block.service_name}
                              cnName={block.service_cn_name}
                              primaryClassName="text-sm font-semibold text-gray-900"
                              secondaryClassName="mt-0.5 text-xs text-gray-500"
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2"><p className="text-xs text-gray-600">RM {Number(block.price).toFixed(2)}{block.duration_min > 0 ? ` · ${block.duration_min}min` : ''}</p><button type="button" onClick={() => openAppointmentPriceEditModal({ kind: 'addedService', tmpId: block.tmp_id, name: block.service_name, currentUnitPrice: Number(block.price ?? 0), originalUnitPrice: Number(block.price ?? 0), quantity: 1 })} className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button></div>
                          </>
                        ) : (
                          <p className="text-sm font-semibold text-gray-700">Select a service</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditAddedMainBlocks((prev) => prev.filter((item) => item.tmp_id !== block.tmp_id))}
                        className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Added blocks are only created after selecting a service. */}

                    {block.service_id > 0 ? (
                      <>
                      <div className="space-y-1.5">
                      {block.addon_questions.map((question) => (
                        <div key={`added-q-${block.service_id}-${question.id}`}>
                          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">{question.title}</p>{question.cn_title ? <p className="mt-0.5 text-[11px] text-gray-500">{question.cn_title}</p> : null}</div>
                          {question.options.map((opt) => {
                            const checked = block.selected_addon_ids.has(opt.id)
                            return (
                              <label key={`added-opt-${block.service_id}-${opt.id}`} className="mt-1 flex items-center justify-between rounded-md border border-gray-200 px-2 py-1.5 text-sm">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setEditAddedMainBlocks((prev) => prev.map((item) => {
                                      if (item.service_id !== block.service_id) return item
                                      const next = new Set(item.selected_addon_ids)
                                      if (next.has(opt.id)) next.delete(opt.id)
                                      else next.add(opt.id)
                                      return { ...item, selected_addon_ids: next }
                                    }))}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                                  />
                                  <PosServiceNameStack name={opt.label} cnName={opt.cn_name ?? opt.cn_label ?? opt.linked_cn_name} primaryClassName="text-sm text-gray-700" secondaryClassName="mt-0.5 text-[11px] text-gray-500" />
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <span className="text-xs font-semibold text-gray-500">+RM {Number(block.addon_price_overrides[opt.id] ?? opt.extra_price).toFixed(2)}</span>
                                  {checked && appointmentDetail?.id ? (() => {
                                    const lineKey = `appointment-settlement:${appointmentDetail.id}:block:${block.tmp_id}:addon:${opt.id}`
                                    const inherited = editStaffSplitsToLineSplits(block.staff_splits)
                                    return (
                                      <>
                                        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); openAppointmentPriceEditModal({ kind: 'addedAddon', tmpId: block.tmp_id, optionId: opt.id, name: opt.label ?? 'Add-on', currentUnitPrice: Number(block.addon_price_overrides[opt.id] ?? opt.extra_price ?? 0), originalUnitPrice: Number(opt.extra_price ?? 0), quantity: 1 }) }} className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button>
                                        {renderAppointmentLineSplitStack(lineKey, inherited, 'service block')}
                                        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void openAppointmentLineSplitEditor(lineKey, opt.label, inherited) }} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                                      </>
                                    )
                                  })() : null}
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={block.auto_balance}
                          onChange={(e) => toggleEditAddedMainAutoBalance(block.tmp_id, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Auto Balance (lock first row, auto adjust to 100%)
                      </label>
                      {block.staff_splits.map((split, idx) => (
                        <div key={`added-split-${block.tmp_id}-${idx}`} className="grid grid-cols-[1fr_120px_auto] gap-2">
                          <div className="min-w-0">
                            <BookingPackageItemServicePicker
                              options={activeStaffs
                                .filter((staff) => {
                                  const selected = new Set(
                                    block.staff_splits
                                      .map((row, rowIdx) => (rowIdx === idx ? null : row.staff_id))
                                      .filter((id): id is number => id != null),
                                  )
                                  return !selected.has(staff.id)
                                })
                                .map((staff) => ({ id: staff.id, name: staff.name }))}
                              value={split.staff_id != null ? String(split.staff_id) : ''}
                              onChange={(next) => {
                                const value = next ? Number(next) : null
                                updateEditAddedMainSplitStaff(block.tmp_id, idx, value)
                              }}
                              disabled={editSettlementLoading}
                              placeholder="Select staff"
                              searchPlaceholder="Search staff…"
                              unknownEntityLabel="Staff"
                              ariaLabel="Select staff"
                              emptySearchMessage="No staff match your search."
                              emptyListMessage="No staff available."
                            />
                          </div>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={split.share_percent}
                            disabled={block.auto_balance && idx === 0}
                            onChange={(e) => {
                              const value = e.target.value
                              updateEditAddedMainSplitShare(block.tmp_id, idx, value)
                            }}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setEditAddedMainBlocks((prev) => prev.map((item) => item.service_id === block.service_id
                              ? { ...item, staff_splits: item.staff_splits.length <= 1 ? item.staff_splits : item.staff_splits.filter((_, rowIdx) => rowIdx !== idx) }
                              : item))}
                            className="rounded-lg border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-600"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditAddedMainBlocks((prev) => prev.map((item) => item.service_id === block.service_id ? { ...item, staff_splits: [...item.staff_splits, { staff_id: null, share_percent: '' }] } : item))}
                        className="rounded-md border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-700"
                      >
                        + Add Staff
                      </button>
                    </div>
                    <div className="mt-3 border-t border-gray-200 pt-2 text-sm font-semibold text-gray-800">Block Subtotal: RM {blockSubtotal.toFixed(2)}</div>
                      </>
                    ) : null}
                  </div>
                )
              })}
                </div>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-5">
                {(() => {
                  const allOptions = editAddonQuestions.flatMap((q) => q.options)
                  const selectedAddons = allOptions.filter((o) => editSelectedAddonIds.has(o.id))
                  const addonTotal = selectedAddons.reduce((sum, o) => sum + Number(editAddonPriceOverrides[o.id] ?? o.extra_price), 0)
                  const selectedMainServices = editAddedMainBlocks
                  const addedMainTotal = selectedMainServices.reduce((sum, service) => {
                    const addonOptions = service.addon_questions.flatMap((q) => q.options)
                    const addonTotal = addonOptions.filter((opt) => service.selected_addon_ids.has(opt.id)).reduce((acc, opt) => acc + Number(service.addon_price_overrides[opt.id] ?? opt.extra_price ?? 0), 0)
                    return sum + Number(service.price ?? 0) + addonTotal
                  }, 0)
                  const isRange = settlementNeedsSettledAmount(editOriginalSettlementSource)
                  const settledAmt = parseSettlementAmountInput(editSettledAmount)
                  const originalServiceAmt = isRange && settledAmt != null
                    ? settledAmt
                    : Number(
                      editOriginalServicePriceOverride
                        ?? editOriginalService?.service_price
                        ?? editOriginalService?.price
                        ?? appointmentDisplayMainServices
                          .find((service) => service.is_original)?.extra_price
                        ?? appointmentDetail.service_total
                        ?? 0,
                    )
                  const serviceAmt = originalServiceAmt + addedMainTotal
                  const depositOffset = Number(appointmentDetail.deposit_contribution ?? 0)
                  const packageOffset = Number(appointmentDetail.package_offset ?? 0)
                  const finalTotal = Math.max(0, serviceAmt + addonTotal - depositOffset - packageOffset)
                  return (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">Summary</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Original Service</span>
                          <span className="font-semibold tabular-nums text-gray-900">
                            {isRange && settledAmt == null
                              ? `RM ${getSettlementRangeBounds(editOriginalSettlementSource).min.toFixed(2)} - ${getSettlementRangeBounds(editOriginalSettlementSource).max.toFixed(2)}`
                              : `RM ${originalServiceAmt.toFixed(2)}`}
                          </span>
                        </div>
                        {selectedMainServices.length > 0 ? (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Added Main Services ({selectedMainServices.length})</span>
                            <span className="font-semibold tabular-nums text-gray-900">+RM {addedMainTotal.toFixed(2)}</span>
                          </div>
                        ) : null}
                        {selectedAddons.length > 0 ? (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Add-ons ({selectedAddons.length})</span>
                            <span className="font-semibold tabular-nums text-gray-900">+RM {addonTotal.toFixed(2)}</span>
                          </div>
                        ) : null}
                        {depositOffset > 0 ? (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Deposit Offset</span>
                            <span className="font-semibold tabular-nums text-emerald-700">−RM {depositOffset.toFixed(2)}</span>
                          </div>
                        ) : null}
                        {packageOffset > 0 ? (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Package Offset</span>
                            <span className="font-semibold tabular-nums text-emerald-700">−RM {packageOffset.toFixed(2)}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between border-t border-gray-200 pt-1.5">
                          <span className="font-bold text-gray-900">Final Amount</span>
                          <span className="font-bold tabular-nums text-gray-900">RM {finalTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="border-t border-gray-200 bg-gray-50 px-5 py-4">
              {editSettlementError ? (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{editSettlementError}</p>
              ) : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditSettlementOpen(false)}
                  className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={editSettlementLoading}
                  onClick={() => void saveEditSettlement()}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {editSettlementLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {appointmentLineSplitTarget ? (
        <div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h4 className="text-lg font-bold text-gray-900">
                {appointmentLineSplitTarget.type === 'bulk' ? `Apply Staff Split: ${appointmentLineSplitTarget.title}` : `Line Staff Split: ${appointmentLineSplitTarget.title}`}
              </h4>
              <button type="button" onClick={() => setAppointmentLineSplitTarget(null)} className="text-2xl leading-none text-gray-500">×</button>
            </div>
            <div className="space-y-3 p-5">
              {appointmentLineSplitTarget.type === 'bulk' ? (
                <label className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  <input type="checkbox" checked={appointmentLineSplitOverwrite} onChange={(event) => setAppointmentLineSplitOverwrite(event.target.checked)} className="h-4 w-4" />
                  Overwrite existing explicit staff splits
                </label>
              ) : null}
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={appointmentLineSplitAutoBalance}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setAppointmentLineSplitAutoBalance(checked)
                    if (checked) {
                      setAppointmentLineSplitDraftRows((prev) => {
                        if (prev.length <= 1) return prev
                        const othersTotal = prev.slice(1).reduce((sum, row) => sum + Math.max(0, Number.parseInt(row.share_percent || '0', 10)), 0)
                        return prev.map((row, idx) => (idx === 0 ? { ...row, share_percent: String(Math.max(0, 100 - othersTotal)) } : row))
                      })
                    }
                  }}
                  className="h-4 w-4"
                />
                Auto Balance
              </label>
              <div className="space-y-2">
                {appointmentLineSplitDraftRows.map((row, index) => (
                  <div key={`appointment-line-split-${index}`} className="grid grid-cols-[1fr_110px_auto] gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <BookingPackageItemServicePicker
                      options={activeStaffs
                        .filter((staff) => !appointmentLineSplitDraftRows.some((item, itemIndex) => itemIndex !== index && item.staff_id === staff.id))
                        .map((staff) => ({ id: staff.id, name: staff.name }))}
                      value={row.staff_id != null ? String(row.staff_id) : ''}
                      onChange={(next) => setAppointmentLineSplitDraftRows((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, staff_id: next ? Number(next) : null } : item))}
                      placeholder="Select staff"
                      searchPlaceholder="Search staff…"
                      unknownEntityLabel="Staff"
                      ariaLabel="Select staff"
                      emptySearchMessage="No staff match your search."
                      emptyListMessage="No staff available."
                    />
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={row.share_percent}
                        disabled={appointmentLineSplitAutoBalance && index === 0}
                        onChange={(event) => {
                          const value = event.target.value
                          setAppointmentLineSplitDraftRows((prev) => {
                            const next = prev.map((item, itemIndex) => itemIndex === index ? { ...item, share_percent: value } : item)
                            if (!appointmentLineSplitAutoBalance || index === 0) return next
                            const othersTotal = next.slice(1).reduce((sum, item) => sum + Math.max(0, Number.parseInt(item.share_percent || '0', 10)), 0)
                            return next.map((item, itemIndex) => itemIndex === 0 ? { ...item, share_percent: String(Math.max(0, 100 - othersTotal)) } : item)
                          })
                        }}
                        className="h-10 w-full rounded-lg border border-gray-300 px-3 pr-7 text-sm"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                    </div>
                    <button
                      type="button"
                      disabled={appointmentLineSplitDraftRows.length <= 1}
                      onClick={() => setAppointmentLineSplitDraftRows((prev) => prev.length <= 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index))}
                      className="rounded-lg border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-600 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setAppointmentLineSplitDraftRows((prev) => [...prev, { staff_id: null, share_percent: '' }])} className="rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700">+ Add Staff</button>
              {appointmentLineSplitError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{appointmentLineSplitError}</p> : null}
            </div>
            <div className="flex gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4">
              <button type="button" onClick={() => setAppointmentLineSplitTarget(null)} className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
              <button type="button" onClick={saveAppointmentLineSplitEditor} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      ) : null}

      {appointmentPriceEditTarget ? (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
            <h4 className="text-lg font-bold text-gray-900">Edit Price</h4>
            <p className="mt-1 text-sm text-gray-600">{appointmentPriceEditTarget.name}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-sm">
              <div><p className="text-xs text-gray-500">Original Price</p><p className="font-semibold">RM {Number(appointmentPriceEditTarget.originalUnitPrice ?? 0).toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-500">Current Price</p><p className="font-semibold">RM {Number(appointmentPriceEditTarget.currentUnitPrice ?? 0).toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-500">Quantity</p><p className="font-semibold">{Math.max(1, Number(appointmentPriceEditTarget.quantity ?? 1))}</p></div>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Edit Method</p>
              <div className="flex flex-wrap gap-4 text-sm font-semibold text-gray-700">
                <label className="inline-flex items-center gap-2"><input type="radio" checked={appointmentPriceEditMode === 'unit'} onChange={() => setAppointmentPriceEditMode('unit')} /> Unit Price</label>
                <label className="inline-flex items-center gap-2"><input type="radio" checked={appointmentPriceEditMode === 'line'} onChange={() => setAppointmentPriceEditMode('line')} /> Line Total</label>
              </div>
            </div>
            {appointmentPriceEditMode === 'unit' ? (
              <div className="mt-4"><label className="text-xs font-semibold text-gray-600">New Unit Price</label><input type="number" min={0} step="0.01" value={appointmentPriceEditValueDraft} onChange={(event) => setAppointmentPriceEditValueDraft(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" /><p className="mt-1 text-xs text-gray-500">Calculated Line Total: RM {(Math.max(0, Number(appointmentPriceEditValueDraft || 0)) * Math.max(1, Number(appointmentPriceEditTarget.quantity ?? 1))).toFixed(2)}</p></div>
            ) : (
              <div className="mt-4"><label className="text-xs font-semibold text-gray-600">New Line Total</label><input type="number" min={0} step="0.01" value={appointmentPriceEditLineTotalDraft} onChange={(event) => setAppointmentPriceEditLineTotalDraft(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" /><p className="mt-1 text-xs text-gray-500">Calculated Unit Price: RM {(Math.max(0, Number(appointmentPriceEditLineTotalDraft || 0)) / Math.max(1, Number(appointmentPriceEditTarget.quantity ?? 1))).toFixed(2)}</p></div>
            )}
            <div className="mt-4"><label className="text-xs font-semibold text-gray-600">Reason / remark</label><textarea value={appointmentPriceEditReasonDraft} onChange={(event) => setAppointmentPriceEditReasonDraft(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Optional reason" /></div>
            <div className="mt-5 flex gap-3"><button type="button" onClick={() => setAppointmentPriceEditTarget(null)} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700">Cancel</button><button type="button" onClick={() => submitAppointmentPriceEditModal()} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Save</button></div>
          </div>
        </div>
      ) : null}

      {editMainServicePickerOpen && editMainServicePickerTargetId ? (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
              <div>
                <h4 className="text-base font-bold text-gray-900">
                  {editMainServicePickerTargetId === '__original__' ? 'Change Original Service' : 'Choose Main Service'}
                </h4>
                <p className="text-xs text-gray-500">
                  {editMainServicePickerTargetId === '__original__'
                    ? 'Search and select the correct original service.'
                    : 'Search and select a booking service.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditMainServicePickerOpen(false)
                  setEditMainServicePickerTargetId(null)
                  setEditMainServiceQuery('')
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <BookingServicePicker
                categories={bookingServiceCategories}
                services={editMainServiceCatalog}
                selectedCategoryId={editMainServiceCategoryId}
                onCategoryChange={setEditMainServiceCategoryId}
                searchQuery={editMainServiceQuery}
                onSearchQueryChange={setEditMainServiceQuery}
                selectedServiceId={editMainServicePickerTargetId === '__original__' ? editOriginalService?.id : null}
                excludeServiceIds={[
                  ...(editOriginalService?.id ? [editOriginalService.id] : []),
                  ...editAddedMainBlocks.map((block) => block.service_id),
                ]}
                onSelectService={(service) => void selectEditMainServiceForBlock(editMainServicePickerTargetId, service as BookingServiceOption)}
                emptyMessage="No services found."
                searchPlaceholder="Search service name..."
              />
            </div>
          </div>
        </div>
      ) : null}

      {appointmentCheckoutConfirmationOpen && appointmentDetail && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h4 className="text-lg font-bold text-gray-900">Checkout Confirmation</h4>
                <p className="text-xs text-gray-500">
                  {checkoutZeroPackageSettlement
                    ? 'Confirm payment method (cash or QRPay). QR proof is optional. Package covers the amount due — this step records the receipt.'
                    : 'Select payment method before collecting settlement. QR proof is optional.'}
                </p>
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
            <div className="space-y-4 overflow-y-auto px-6 py-5">
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
                <p className="text-xs text-gray-600">{formatAppointmentCustomerDisplayName(appointmentDetail)}</p>
                <p className="text-xs text-gray-600">
                  Amount Due:{' '}
                  <span className="font-semibold text-emerald-700">RM {appointmentDueAmount.toFixed(2)}</span>
                  {checkoutZeroPackageSettlement ? (
                    <span className="block pt-1 text-[11px] font-normal text-slate-500">
                      Covered by package — RM 0 to collect at checkout.
                    </span>
                  ) : null}
                </p>
                {appointmentDiscountAmount > 0 ? (
                  <p className="text-xs text-amber-700">
                    Discount:{' '}
                    <span className="font-semibold">
                      − RM {appointmentDiscountAmount.toFixed(2)}
                    </span>{' '}
                    → Payable <span className="font-semibold text-emerald-700">RM {appointmentDueAfterDiscount.toFixed(2)}</span>
                  </p>
                ) : null}
              </div>
              {!checkoutZeroPackageSettlement ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-3 text-sm font-bold text-gray-900">Settlement Discount</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Discount Type
                      <select
                        value={appointmentDiscountTypeDraft}
                        onChange={(event) => {
                          setAppointmentCheckoutError(null)
                          setAppointmentDiscountTypeDraft(event.target.value as 'percentage' | 'fixed')
                        }}
                        className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
                      >
                        <option value="fixed">Fixed amount</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Discount Value {appointmentDiscountTypeDraft === 'percentage' ? '(%)' : '(RM)'}
                      <input
                        type="number"
                        min="0"
                        max={appointmentDiscountTypeDraft === 'percentage' ? '100' : appointmentDueAmount.toFixed(2)}
                        step="0.01"
                        value={appointmentDiscountValueDraft}
                        onChange={(event) => {
                          setAppointmentCheckoutError(null)
                          setAppointmentDiscountValueDraft(event.target.value)
                        }}
                        className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
                        placeholder="0.00"
                      />
                    </label>
                  </div>
                  <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Remark (optional)
                    <textarea
                      value={appointmentDiscountRemarkDraft}
                      onChange={(event) => {
                        setAppointmentCheckoutError(null)
                        setAppointmentDiscountRemarkDraft(event.target.value)
                      }}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                      placeholder="VIP discount / goodwill adjustment"
                    />
                  </label>
                </div>
              ) : null}
              {!checkoutZeroPackageSettlement ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-gray-900">Split Payment</p>
                    <span className="text-xs font-semibold text-gray-500">Enter paid amount per method</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {SPLIT_PAYMENT_METHODS.map(({ method, label }) => (
                      <div key={method} className="rounded-lg border border-gray-200 bg-white p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setAppointmentCheckoutError(null)
                            setAppointmentPaymentMethod(method === 'credit_card' ? 'credit_card' : method)
                            setAppointmentSettlementPaymentAmounts({ cash: '', qrpay: '', credit_card: '', [method]: appointmentDueAfterDiscount.toFixed(2) })
                          }}
                          className="mb-2 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                        >
                          {label}
                        </button>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">{label} Amount</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={appointmentSettlementPaymentAmounts[method]}
                          onChange={(e) => {
                            setAppointmentCheckoutError(null)
                            setAppointmentPaymentMethod(method === 'credit_card' ? 'credit_card' : method)
                            setAppointmentSettlementPaymentAmounts((prev) => ({ ...prev, [method]: e.target.value }))
                          }}
                          className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700 sm:grid-cols-3">
                    <span>Amount Due: RM {appointmentDueAfterDiscount.toFixed(2)}</span>
                    <span>Total Paid: RM {appointmentSettlementTotalPaid.toFixed(2)}</span>
                    <span className={appointmentSettlementMixedOverpaid ? 'text-rose-700' : appointmentSettlementMatchesDue || appointmentSettlementCashOnlyOverpaid ? 'text-emerald-700' : 'text-amber-700'}>
                      {appointmentSettlementCashOnlyOverpaid
                        ? `Change RM ${appointmentSettlementChange.toFixed(2)}`
                        : appointmentSettlementMixedOverpaid
                          ? `Overpaid RM ${appointmentSettlementOverpaid.toFixed(2)}`
                          : `Remaining: RM ${appointmentSettlementRemaining.toFixed(2)}`}
                    </span>
                  </div>
                  {appointmentSettlementMixedOverpaid ? (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Payment total cannot exceed grand total for split/non-cash payment.</p>
                  ) : null}
                </div>
              ) : null}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <label className="mb-2 block text-sm font-bold text-gray-900">Upload Payment Proof (optional)</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button type="button" className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50" onClick={() => appointmentQrUploadInputRef.current?.click()}>Upload</button>
                    <button type="button" className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50" onClick={() => appointmentQrCameraBackInputRef.current?.click()}>Back Camera</button>
                    <button type="button" className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50" onClick={() => appointmentQrCameraFrontInputRef.current?.click()}>Front Camera</button>
                  </div>
                  <input ref={appointmentQrUploadInputRef} type="file" accept="image/*" onChange={onSelectAppointmentQrProof} className="sr-only" />
                  <input ref={appointmentQrCameraBackInputRef} type="file" accept="image/*" capture="environment" onChange={onSelectAppointmentQrProof} className="sr-only" />
                  <input ref={appointmentQrCameraFrontInputRef} type="file" accept="image/*" capture="user" onChange={onSelectAppointmentQrProof} className="sr-only" />
                  {appointmentQrProofFileName ? (
                    <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                      <p className="truncate pr-2 font-semibold text-emerald-800">{appointmentQrProofFileName}</p>
                      <button type="button" className="font-semibold text-red-600 hover:text-red-700" onClick={clearAppointmentQrProof}>Clear</button>
                    </div>
                  ) : null}
                </div>
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
                  disabled={
                    cashShiftActionDisabled ||
                    appointmentActionLoading ||
                    (!checkoutZeroPackageSettlement && (appointmentDueAfterDiscount <= 0 || !appointmentSettlementPaymentValid))
                  }
                  onClick={() => void settleAppointmentPayment()}
                  title={cashShiftActionTitle}
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
          <div className={`w-full ${appointmentSettlementHasCashChange ? 'max-w-4xl' : 'max-w-lg'} overflow-hidden rounded-2xl border-2 border-gray-100 bg-white shadow-2xl`}>
            <div className="flex items-center justify-between bg-gradient-to-r from-green-600 to-green-700 px-6 py-5">
              <h4 className="flex items-center gap-2 text-xl font-bold text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Order Completed
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
            <div className={appointmentSettlementHasCashChange ? 'grid gap-6 p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : 'p-6'}>
              {appointmentSettlementHasCashChange ? (
                <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 shadow-inner">
                  <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Cash Summary</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/80 px-4 py-3">
                      <span className="font-semibold text-gray-600">Grand Total</span>
                      <span className="font-bold text-gray-900">RM {appointmentSettlementResult.paid_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/80 px-4 py-3">
                      <span className="font-semibold text-gray-600">Cash Received</span>
                      <span className="font-bold text-gray-900">RM {appointmentSettlementResult.cash_received.toFixed(2)}</span>
                    </div>
                    <div className="rounded-2xl border-2 border-emerald-500 bg-white px-4 py-4 text-center shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Change to Return</p>
                      <p className="mt-1 text-4xl font-black text-emerald-700">RM {appointmentSettlementResult.change_amount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="space-y-5">
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
