'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEventHandler, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { renderPosBodyModalPortal } from '@/components/pos/posBodyModalPortal'
import BookingPackageItemServicePicker from '@/components/booking/BookingPackageItemServicePicker'
import BookingStatusBadge from '@/components/booking/BookingStatusBadge'
import InternationalPhoneInput from '@/components/common/InternationalPhoneInput'
import SearchableFilterSelect from '@/components/common/SearchableFilterSelect'
import {
  accumulatePosPriceBounds,
  appointmentDetailHasUnsettledRangePricing,
  appointmentNeedsZeroBalanceCheckout,
  appointmentVisitCheckoutFinalized,
  bookingServiceSettlementSource,
  buildAddonSettlementSaveOverrides,
  formatPosAccumulatedPriceDisplay,
  formatPosCurrentOrRangeDisplay,
  formatPosPriceDisplay,
  getSettlementRangeBounds,
  optionalSettlementAmountPayload,
  parseSettlementAmountInput,
  posAddonHasStoredLineTotal,
  posPriceDisplayHasFinalPrice,
  posPriceDisplayHasRange,
  posPriceDisplayForAddonLine,
  posPriceDisplayWithOverride,
  matchAddedMainSettlementLine,
  resolveAddedMainServiceReferenceUnitPrice,
  resolveAddedMainServiceSeedFinalized,
  resolveAddedMainServiceSeedPrice,
  resolveEditSettlementAddonLineAmount,
  resolveEditSettlementAddonSplitLineTotal,
  resolveEditSettlementAddedMainBlockLineTotal,
  resolveEditSettlementAddonUnitDisplay,
  resolveSettlementRefundNeededAmount,
  computeSettlementRefundSummary,
  seedAddonLineTotalOverrides,
  seedFinalizedAddonPriceOverrides,
  bookingServiceIdCoveredByPackage,
  settlementNeedsSettledAmount,
  validateSettlementAmountInput,
  UNSETTLED_RANGE_CHECKOUT_MESSAGE,
  type PosPriceDisplaySource,
  type SettlementCartItemLike,
} from '@/components/pos/settlementAmountUtils'
import BookingServicePhotosModal from '@/components/booking/BookingServicePhotosModal'
import BookingServicePicker, { bookingServiceMatchesPickerCategory } from '@/components/pos/BookingServicePicker'
import BookingAddonOptionRow, { PosAddonLineName, PosAddonSelectionDurationLabel, PosAddonSelectionPriceLabel, PosAddonSettlementPriceLabel } from '@/components/pos/BookingAddonOptionRow'
import {
  buildAddonQuantitiesPayload,
  getAddonQuantity,
  getSelectedAddonIds,
  isAddonSelected,
  selectionFromAddonRows,
  setAddonQuantity,
  storedAddonLineDuration,
  storedAddonLinePrice,
  storedAddonQuantity,
  sumSelectedAddonDuration,
  toggleAddonSelection,
  type AddonSelectionMap,
} from '@/components/pos/bookingAddonQuantity'
import CustomerUploadedPhotosModal from '@/components/booking/CustomerUploadedPhotosModal'
import CustomerCreateModal from '@/components/CustomerCreateModal'
import type { CustomerRowData } from '@/components/CustomerRow'
import OrderViewPanel from '@/components/OrderViewPanel'
import { usePosCashShift } from '@/components/pos/PosCashShiftGate'
import { formatPosAvailabilityErrorMessage, formatPosNoStaffAvailableMessage, parsePosAvailabilityVerifyMode, posAvailabilityShouldHardBlock, posAvailabilityStaffIsUnavailable, POS_SCHEDULE_OVERRIDE_REASONS, type PosAvailabilityVerifyMode } from '@/components/pos/posAvailabilityMessages'
import PosPrimaryStaffChangeConfirmModal, { type PrimaryStaffChangePrompt } from '@/components/pos/PosPrimaryStaffChangeConfirmModal'
import {
  buildEditSettlementPrimaryStaffChangePrompt,
  createStaffNameResolver,
  resolvePrimaryStaffIdFromSplits,
  verifyEditSettlementPrimaryStaffAvailability,
} from '@/components/pos/posStaffSplitUtils'
import {
  mapStaffSplitDraftToPayload,
  mapSettlementInlineStaffRowsForApi,
  parseMoneyInput,
  percentsToAmounts,
  rebalancePrimaryPercentShare,
  rebalanceSettlementInlineStaffRows,
  resolveSavedSettlementStaffSplitMode,
  roundMoney,
  seedSettlementInlineStaffRows,
  serializeStaffSplitForApi,
  settlementInlineRowsToInheritedSplits,
  validateStaffSplitDraft,
  type SettlementInlineStaffSplitRow,
  type StaffSplitMode,
} from '@/components/pos/staffSplitCore'
import { formatDateTime12Hour } from '@/lib/formatDateTime'
import { normalizeInternationalPhone } from '@/lib/phone'
import { usePosWideLayout } from '@/lib/usePosWideLayout'

import PosAppointmentDepositCreditSection from '@/components/pos/PosAppointmentDepositCreditSection'
import { StaffSplitModeToggle } from '@/components/pos/PosStaffSplitEditorPanel'
import PosAppointmentRefundCreditSection from '@/components/pos/PosAppointmentRefundCreditSection'
import { SettlementRefundBreakdownRows } from '@/components/pos/SettlementCartPaymentBreakdown'
import PosAppointmentPaymentLinksSection from '@/components/pos/PosAppointmentPaymentLinksSection'
import PosPriceEditSummaryGrid, { priceEditTargetUsesSimpleServicePriceLayout, resolvePriceEditQuantity } from '@/components/pos/PosPriceEditSummaryGrid'
import PosRequestCenter from '@/components/pos/PosRequestCenter'
import ApplyPackageModal from '@/components/pos/ApplyPackageModal'
import {
  batchReleaseAppointmentPackageClaims,
  collectActivePackageClaimUsageIds,
  findPackageClaimForService,
  formatPackageClaimLineText,
  pruneReleasedPackageClaims,
  releaseAppointmentPackageClaimsForService,
} from '@/components/pos/packageClaimDisplay'
import PosAppointmentsSchedule from './PosAppointmentsSchedule'
import {
  extractPaged,
  posAppointmentRegisterPaid,
  posAppointmentShowOnScheduleCalendar,
  formatAppointmentCustomerDisplayName,
  formatAppointmentCustomerContactLines,
  formatCustomerPhoneMasked,
  formatAppointmentReceiptDefaultEmail,
  getAppointmentDisplayRemarkLines,
  formatBookingAddonSummary,
  buildPosAppointmentSlots,
  formatDateTimeRange,
  formatDurationFromRange,
  formatPosPaymentHistoryLineType,
  formatTimeRange,
  normalizePosAppointmentListItem,
  type PosAppointmentScheduleScope,
} from './posAppointmentHelpers'
import type { PosAppointmentCurrentUser, PosAppointmentDetail, PosAppointmentListItem, ServiceAddonQuestion, ServiceAddonOption } from './posAppointmentTypes'


type AppointmentStatusFilterValue =
  | ''
  | 'HOLD'
  | 'CONFIRMED'
  | 'COMPLETED_UNPAID'
  | 'COMPLETED_PAID'
  | 'CANCELLED'
  | 'NOTIFIED_CANCELLATION'
  | 'LATE_CANCELLATION'
  | 'NO_SHOW'
  | 'EXPIRED'
  | 'VOIDED'

const APPOINTMENT_STATUS_FILTER_OPTIONS: Array<{ value: AppointmentStatusFilterValue; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED_UNPAID', label: 'Completed unpaid' },
  { value: 'COMPLETED_PAID', label: 'Completed paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NOTIFIED_CANCELLATION', label: 'Notified Cancellation' },
  { value: 'LATE_CANCELLATION', label: 'Late Cancellation' },
  { value: 'NO_SHOW', label: 'No Show' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'VOIDED', label: 'Voided' },
]

type AppointmentTerminalStatusAction = 'CANCELLED' | 'LATE_CANCELLATION' | 'NO_SHOW'

const APPOINTMENT_TERMINAL_STATUS_ACTION_LABELS: Record<AppointmentTerminalStatusAction, string> = {
  CANCELLED: 'Cancel',
  LATE_CANCELLATION: 'Late cancellation',
  NO_SHOW: 'No Show',
}

const appointmentStatusFilterApiValue = (value: string) =>
  ['COMPLETED_UNPAID', 'COMPLETED_PAID'].includes(value) ? 'COMPLETED' : value

const appointmentMatchesStatusFilter = (row: PosAppointmentListItem, value: string) => {
  if (!value) return true
  const status = String(row.status ?? '').toUpperCase()
  if (value === 'COMPLETED_UNPAID') return status === 'COMPLETED' && !posAppointmentRegisterPaid(row)
  if (value === 'COMPLETED_PAID') return status === 'COMPLETED' && posAppointmentRegisterPaid(row)
  return status === value
}

type SplitPaymentMethod = 'cash' | 'qrpay' | 'credit_card' | 'customer_balance'

const SPLIT_PAYMENT_METHODS: Array<{ method: SplitPaymentMethod; label: string }> = [
  { method: 'cash', label: 'Cash' },
  { method: 'qrpay', label: 'QRPay' },
  { method: 'credit_card', label: 'Credit Card' },
  { method: 'customer_balance', label: 'Customer Balance' },
]

const toPaymentCents = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0
}

const mapZeroSettlementPaymentMethod = (method: string) => {
  if (method === 'credit_card' || method === 'billplz_credit_card') return 'billplz_credit_card'
  if (method === 'split') return 'qrpay'
  return method
}

const isAppointmentPaymentMethodSelected = (
  selected: string,
  method: SplitPaymentMethod,
) => (method === 'credit_card' ? selected === 'credit_card' || selected === 'billplz_credit_card' : selected === method)

type StaffOption = {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  code?: string | null
  service_commission_rate?: number
  is_active?: boolean | number | string | null
}

type AppointmentLineStaffSplit = { staff_id: number; share_percent: number; share_amount?: number | null; split_mode?: StaffSplitMode }

type AppointmentLineSplitDraftRow = { staff_id: number | null; share_percent: string; share_amount: string }

type AppointmentLineSplitTarget =
  | { type: 'line'; lineKey: string; title: string; inheritedSplits: AppointmentLineStaffSplit[]; lineTotal?: number | null }
  | { type: 'bulk'; lineKeys: string[]; title: string; inheritedSplits: AppointmentLineStaffSplit[]; applyEditSettlementMainServices?: boolean; lineTotal?: number | null }

function durationMinutesFromRange(startAt?: string | null, endAt?: string | null): number {
  if (!startAt || !endAt) return 0
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.round(ms / 60000)
}


const POS_SLOT_INTERVAL_MIN = 15

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
  linked_booking_service_id?: number | null
  duration_min?: number
  is_active?: boolean
  allowed_staffs?: Array<{ id: number; name: string }>
  category_ids?: number[]
  categories?: BookingServiceCategoryOption[]
}

function resolveBookingServiceLineTotal(service?: Pick<BookingServiceOption, 'price' | 'service_price'> | null): number | null {
  const total = Number(service?.price ?? service?.service_price ?? 0)
  return total > 0 ? total : null
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
  addonQuantities: AddonSelectionMap
  addon_price_overrides: Record<number, number>
  addon_line_total_overrides: Record<number, number>
}

type AppointmentPriceEditTarget =
  | { kind: 'originalService'; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number; priceSource?: PosPriceDisplaySource | null }
  | { kind: 'originalAddon'; optionId: number; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number; priceSource?: PosPriceDisplaySource | null; lineTotalOverride?: number; hasLineTotalOverrideKey?: boolean }
  | { kind: 'addedService'; tmpId: string; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number; priceSource?: PosPriceDisplaySource | null }
  | { kind: 'addedAddon'; tmpId: string; optionId: number; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number; priceSource?: PosPriceDisplaySource | null; lineTotalOverride?: number; hasLineTotalOverrideKey?: boolean }
  | { kind: 'createMainAddon'; optionId: number; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number; priceSource?: PosPriceDisplaySource | null; lineTotalOverride?: number; hasLineTotalOverrideKey?: boolean }
  | { kind: 'createBlockAddon'; blockId: string; optionId: number; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number; priceSource?: PosPriceDisplaySource | null; lineTotalOverride?: number; hasLineTotalOverrideKey?: boolean }

type AppointmentAddonPriceEditTarget = Extract<
  AppointmentPriceEditTarget,
  { kind: 'originalAddon' | 'addedAddon' | 'createMainAddon' | 'createBlockAddon' }
>

function getAppointmentAddonPriceEditTarget(target: AppointmentPriceEditTarget): AppointmentAddonPriceEditTarget | null {
  if (
    target.kind === 'originalAddon'
    || target.kind === 'addedAddon'
    || target.kind === 'createMainAddon'
    || target.kind === 'createBlockAddon'
  ) {
    return target
  }
  return null
}

function buildAddedServicePriceEditTarget(block: {
  tmp_id: string
  service_name: string
  price: number
  reference_unit_price?: number
  price_mode?: string | null
  price_range_min?: number | null
  price_range_max?: number | null
  price_finalized?: boolean | null
}): Extract<AppointmentPriceEditTarget, { kind: 'addedService' }> {
  return {
    kind: 'addedService',
    tmpId: block.tmp_id,
    name: block.service_name,
    currentUnitPrice: Number(block.price ?? 0),
    originalUnitPrice: Number(block.reference_unit_price ?? block.price_range_min ?? block.price ?? 0),
    quantity: 1,
    priceSource: {
      price_mode: block.price_mode ?? null,
      price_range_min: block.price_range_min ?? null,
      price_range_max: block.price_range_max ?? null,
      extra_price: block.price,
      price_finalized: block.price_finalized,
    },
  }
}


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
          <span className="font-semibold text-gray-600">Requested at:</span> {formatDateTime12Hour(row.requested_at)}
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
  const canCreateMember = useMemo(() => permissions.includes('customers.create'), [permissions])
  const canPosCheckout = useMemo(() => permissions.includes('pos.checkout'), [permissions])
  const canManagePosAppointments = useMemo(() => permissions.includes('pos.appointments.manage'), [permissions])
  const canAppointmentCheckoutAndPackage = useMemo(
    () => canPosCheckout || permissions.includes('pos.appointments.checkout'),
    [canPosCheckout, permissions],
  )
  const canRunAppointmentLifecycleActions = canPosCheckout || canManagePosAppointments
  const canEditAppointmentSettlement = canPosCheckout || canManagePosAppointments
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
  const { hasOpenShift, cashShiftLoading, requireOpenShiftMessage } = usePosCashShift()
  const { isCompactLayout } = usePosWideLayout()
  const settlementColumnRef = useRef<HTMLDivElement>(null)
  const settlementHostRef = useRef<HTMLDivElement>(null)
  const [bodyModalRoot, setBodyModalRoot] = useState<HTMLDivElement | null>(null)
  const requiresOpenCashShift = canPosCheckout || canManagePosAppointments || canAppointmentCheckoutAndPackage
  const cashShiftActionDisabled = requiresOpenCashShift && (cashShiftLoading || !hasOpenShift)
  const cashShiftActionTitle = cashShiftActionDisabled ? requireOpenShiftMessage : undefined

  const [activeStaffs, setActiveStaffs] = useState<StaffOption[]>([])
  const [posApptViewMode, setPosApptViewMode] = useState<'month' | 'day'>('month')
  const [scheduleScope, setScheduleScope] = useState<PosAppointmentScheduleScope>('active')
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
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<AppointmentStatusFilterValue>('')
  const [appointmentFiltersOpen, setAppointmentFiltersOpen] = useState(false)
  const [createAppointmentModalOpen, setCreateAppointmentModalOpen] = useState(false)
  const [posAvailabilityVerifyMode, setPosAvailabilityVerifyMode] = useState<PosAvailabilityVerifyMode>('holiday_only')
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
  const [createAppointmentMemberWalletBalance, setCreateAppointmentMemberWalletBalance] = useState<number | null>(null)
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
  const [createAppointmentSlots, setCreateAppointmentSlots] = useState<Array<{ start_at: string; end_at: string; available_staff_ids?: number[]; scheduled_staff_ids?: number[]; unavailable_staff_reasons?: Record<string, string> }>>([])
  const [createAppointmentSlotsLoading, setCreateAppointmentSlotsLoading] = useState(false)
  const [createAppointmentNotes, setCreateAppointmentNotes] = useState('')
  const [createAppointmentDepositPayments, setCreateAppointmentDepositPayments] = useState<Record<SplitPaymentMethod, string>>({ cash: '', qrpay: '', credit_card: '', customer_balance: '' })
  useEffect(() => {
    setCreateAppointmentMemberWalletBalance(null)
    setCreateAppointmentDepositPayments((prev) => ({ ...prev, customer_balance: '' }))
    const memberId = createAppointmentMemberSummary?.id
    if (!memberId) return
    void fetch(`/api/proxy/admin/customers/${memberId}/wallet`).then((r) => r.ok ? r.json() : null).then((json) => setCreateAppointmentMemberWalletBalance(Number(json?.data?.wallet_balance ?? 0))).catch(() => setCreateAppointmentMemberWalletBalance(null))
  }, [createAppointmentMemberSummary?.id])
  const [createAppointmentQuestions, setCreateAppointmentQuestions] = useState<ServiceAddonQuestion[]>([])
  const [createAppointmentAddonQuantities, setCreateAppointmentAddonQuantities] = useState<AddonSelectionMap>({})
  const [createAppointmentAddonPriceOverrides, setCreateAppointmentAddonPriceOverrides] = useState<Record<number, number>>({})
  const [createAppointmentAddonLineTotalOverrides, setCreateAppointmentAddonLineTotalOverrides] = useState<Record<number, number>>({})
  const [createAppointmentExtraServiceBlocks, setCreateAppointmentExtraServiceBlocks] = useState<CreateExtraServiceBlock[]>([])
  const [appointmentLineStaffSplits, setAppointmentLineStaffSplits] = useState<Record<string, AppointmentLineStaffSplit[]>>({})
  const [appointmentLineSplitTarget, setAppointmentLineSplitTarget] = useState<AppointmentLineSplitTarget | null>(null)
  const [appointmentLineSplitDraftRows, setAppointmentLineSplitDraftRows] = useState<AppointmentLineSplitDraftRow[]>([])
  const [appointmentLineSplitAutoBalance, setAppointmentLineSplitAutoBalance] = useState(true)
  const [appointmentLineSplitMode, setAppointmentLineSplitMode] = useState<StaffSplitMode>('percent')
  const [appointmentLineSplitLineTotal, setAppointmentLineSplitLineTotal] = useState<number | null>(null)
  const [appointmentLineSplitOverwrite, setAppointmentLineSplitOverwrite] = useState(false)
  const [appointmentLineSplitError, setAppointmentLineSplitError] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<PosAppointmentListItem[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
  const [appointmentsRefreshing, setAppointmentsRefreshing] = useState(false)
  const [appointmentListAutoRefresh, setAppointmentListAutoRefresh] = useState(true)
  const [appointmentListRefreshCountdown, setAppointmentListRefreshCountdown] = useState(5)
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
    () =>
      permissions.includes('booking.appointments.update_status')
      || permissions.includes('pos.appointments.manage'),
    [permissions],
  )
  const [appointmentDetail, setAppointmentDetail] = useState<PosAppointmentDetail | null>(null)
  const [appointmentDetailLoading, setAppointmentDetailLoading] = useState(false)
  const [settlementSheetOpen, setSettlementSheetOpen] = useState(false)
  const [settlementBarPulse, setSettlementBarPulse] = useState(false)
  const [appointmentPaymentMethod, setAppointmentPaymentMethod] = useState<'cash' | 'qrpay' | 'credit_card' | 'customer_balance' | 'split'>('cash')
  const [appointmentSettlementPaymentAmounts, setAppointmentSettlementPaymentAmounts] = useState<Record<SplitPaymentMethod, string>>({ cash: '', qrpay: '', credit_card: '', customer_balance: '' })
  const [appointmentMemberWalletBalance, setAppointmentMemberWalletBalance] = useState<number | null>(null)
  useEffect(() => {
    setAppointmentMemberWalletBalance(null)
    setAppointmentSettlementPaymentAmounts((prev) => ({ ...prev, customer_balance: '' }))
    const memberId = Number(appointmentDetail?.customer?.id ?? 0)
    if (!memberId) return
    void fetch(`/api/proxy/admin/customers/${memberId}/wallet`).then((r) => r.ok ? r.json() : null).then((json) => setAppointmentMemberWalletBalance(Number(json?.data?.wallet_balance ?? 0))).catch(() => setAppointmentMemberWalletBalance(null))
  }, [appointmentDetail?.customer?.id])
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
    payment_method: 'cash' | 'qrpay' | 'credit_card' | 'customer_balance' | 'split'
    paid_amount: number
    cash_received: number
    change_amount: number
    refund_no?: string | null
    refund_amount?: number
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
  const [holdApproveConfirmOpen, setHoldApproveConfirmOpen] = useState(false)
  const [holdCancelConfirmOpen, setHoldCancelConfirmOpen] = useState(false)
  const [holdRejectConfirmOpen, setHoldRejectConfirmOpen] = useState(false)
  const [holdReviewNote, setHoldReviewNote] = useState('')
  const [holdCancelReason, setHoldCancelReason] = useState('')
  const [holdRejectNote, setHoldRejectNote] = useState('')
  const [depositReviewViewOrderId, setDepositReviewViewOrderId] = useState<number | null>(null)
  const [appointmentStatusConfirmOpen, setAppointmentStatusConfirmOpen] = useState(false)
  const [appointmentStatusConfirmTarget, setAppointmentStatusConfirmTarget] = useState<AppointmentTerminalStatusAction | null>(null)
  const [appointmentStatusVoidDeposit, setAppointmentStatusVoidDeposit] = useState(false)

  const [editSettlementOpen, setEditSettlementOpen] = useState(false)
  const [editSettlementLoading, setEditSettlementLoading] = useState(false)
  const [editSettlementError, setEditSettlementError] = useState<string | null>(null)
  const [editSettlementAvailability, setEditSettlementAvailability] = useState<{ reason_code?: string | null; is_hard_block?: boolean; is_outside_staff_schedule?: boolean } | null>(null)
  const [editSettlementIdentityMode, setEditSettlementIdentityMode] = useState<'member' | 'guest'>('guest')
  const [editSettlementCustomerId, setEditSettlementCustomerId] = useState<number | null>(null)
  const [editSettlementMemberSummary, setEditSettlementMemberSummary] = useState<{
    id: number
    name: string
    phone?: string | null
  } | null>(null)
  const [editSettlementGuestName, setEditSettlementGuestName] = useState('')
  const [editSettlementGuestPhone, setEditSettlementGuestPhone] = useState('')
  const [editSettlementGuestEmail, setEditSettlementGuestEmail] = useState('')
  const [editSettlementDepositTotal, setEditSettlementDepositTotal] = useState(0)
  const [editSettlementNoteDraft, setEditSettlementNoteDraft] = useState('')
  const [memberPickerForEditSettlement, setMemberPickerForEditSettlement] = useState(false)
  const [isCreateMemberModalOpen, setIsCreateMemberModalOpen] = useState(false)
  const [applyPackageModalOpen, setApplyPackageModalOpen] = useState(false)
  const [editMainServicePickerOpen, setEditMainServicePickerOpen] = useState(false)
  const [editMainServicePickerTargetId, setEditMainServicePickerTargetId] = useState<string | null>(null)
  const [editAddonQuestions, setEditAddonQuestions] = useState<ServiceAddonQuestion[]>([])
  const [editAddonQuantities, setEditAddonQuantities] = useState<AddonSelectionMap>({})
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
    reference_unit_price?: number
    price_mode?: string | null
    price_range_min?: number | null
    price_range_max?: number | null
    price_finalized?: boolean | null
    duration_min: number
    addon_questions: ServiceAddonQuestion[]
    selected_addon_ids: AddonSelectionMap
    addon_price_overrides: Record<number, number>
    addon_line_total_overrides: Record<number, number>
    staff_splits: SettlementInlineStaffSplitRow[]
    split_mode: StaffSplitMode
    auto_balance: boolean
  }>>([])
  const [editOriginalService, setEditOriginalService] = useState<BookingServiceOption | null>(null)
  const [editOriginalServicePriceOverride, setEditOriginalServicePriceOverride] = useState<number | null>(null)
  const [editAddonPriceOverrides, setEditAddonPriceOverrides] = useState<Record<number, number>>({})
  const [editAddonLineTotalOverrides, setEditAddonLineTotalOverrides] = useState<Record<number, number>>({})
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
  const [editStaffSplits, setEditStaffSplits] = useState<SettlementInlineStaffSplitRow[]>([])
  const [editStaffSplitMode, setEditStaffSplitMode] = useState<StaffSplitMode>('percent')
  const [editSettlementOriginalPrimaryStaffId, setEditSettlementOriginalPrimaryStaffId] = useState<number | null>(null)
  const [primaryStaffChangePrompt, setPrimaryStaffChangePrompt] = useState<PrimaryStaffChangePrompt | null>(null)
  const [pendingEditSettlementPayload, setPendingEditSettlementPayload] = useState<Record<string, unknown> | null>(null)
  const [editStaffSplitAutoBalance, setEditStaffSplitAutoBalance] = useState(true)
  const [editAddonOptionsLoading, setEditAddonOptionsLoading] = useState(false)

  const editOriginalSettlementSource = useMemo(
    () => bookingServiceSettlementSource(editOriginalService),
    [editOriginalService],
  )

  const editOriginalLineTotal = useMemo((): number | null => {
    if (settlementNeedsSettledAmount(editOriginalSettlementSource)) {
      const validation = validateSettlementAmountInput(editSettledAmount, editOriginalSettlementSource)
      return validation.ok ? roundMoney(validation.amount) : null
    }
    const price = Number(
      editOriginalServicePriceOverride
      ?? editOriginalService?.service_price
      ?? editOriginalService?.price
      ?? appointmentDetail?.service_total
      ?? 0,
    )
    return price > 0.0001 ? roundMoney(price) : null
  }, [
    appointmentDetail?.service_total,
    editOriginalService,
    editOriginalServicePriceOverride,
    editOriginalSettlementSource,
    editSettledAmount,
  ])

  const editOriginalServiceCoveredByPackage = useMemo(() => {
    if (!appointmentDetail) return false
    const bookingServiceId = Number(
      editOriginalService?.linked_booking_service_id
      ?? editOriginalService?.id
      ?? appointmentDetail.service?.id
      ?? 0,
    )
    return bookingServiceIdCoveredByPackage(appointmentDetail as SettlementCartItemLike, bookingServiceId, {
      treatAsOriginalMain: true,
    })
  }, [appointmentDetail, editOriginalService])

  const editSettlementStaffSplitAllowAmountMode = useMemo(
    () => !editOriginalServiceCoveredByPackage && editOriginalLineTotal != null && editOriginalLineTotal > 0,
    [editOriginalServiceCoveredByPackage, editOriginalLineTotal],
  )

  useEffect(() => {
    if (editOriginalServiceCoveredByPackage && editStaffSplitMode === 'amount') {
      setEditStaffSplitMode('percent')
    }
  }, [editOriginalServiceCoveredByPackage, editStaffSplitMode])

  const [appointmentRescheduleOpen, setAppointmentRescheduleOpen] = useState(false)
  const [appointmentRescheduleStaffId, setAppointmentRescheduleStaffId] = useState<number | null>(null)
  const [appointmentRescheduleDate, setAppointmentRescheduleDate] = useState('')
  const [appointmentRescheduleSlotValue, setAppointmentRescheduleSlotValue] = useState('')
  const [appointmentRescheduleReason, setAppointmentRescheduleReason] = useState('')
  const [appointmentRescheduleSlots, setAppointmentRescheduleSlots] = useState<Array<{ start_at: string; end_at: string; is_in_schedule?: boolean; unavailable_reason?: string }>>([])
  const [appointmentRescheduleSlotsLoading, setAppointmentRescheduleSlotsLoading] = useState(false)
  const [appointmentRescheduleSubmitting, setAppointmentRescheduleSubmitting] = useState(false)
  const [appointmentReschedulePolicyWarnings, setAppointmentReschedulePolicyWarnings] = useState<string[]>([])
  /** Staff IDs with approved leave covering the selected day (DAY view). */
  const [staffOffTodayIds, setStaffOffTodayIds] = useState<number[]>([])
  const [appointmentRescheduleError, setAppointmentRescheduleError] = useState<string | null>(null)

  const createAppointmentErrorRef = useRef<HTMLDivElement>(null)
  const editSettlementErrorRef = useRef<HTMLDivElement>(null)
  const appointmentCheckoutErrorRef = useRef<HTMLDivElement>(null)
  const appointmentRescheduleErrorRef = useRef<HTMLDivElement>(null)
  const appointmentLineSplitErrorRef = useRef<HTMLDivElement>(null)
  const cancellationRequestsErrorRef = useRef<HTMLDivElement>(null)

  const scrollToModalError = useCallback((ref: RefObject<HTMLDivElement | null>) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const reportCreateAppointmentError = useCallback(
    (message: string | null) => {
      setCreateAppointmentError(message)
      if (message) scrollToModalError(createAppointmentErrorRef)
    },
    [scrollToModalError],
  )

  const reportEditSettlementError = useCallback(
    (message: string | null) => {
      setEditSettlementError(message)
      if (message) scrollToModalError(editSettlementErrorRef)
    },
    [scrollToModalError],
  )

  const reportAppointmentCheckoutError = useCallback(
    (message: string | null) => {
      setAppointmentCheckoutError(message)
      if (message) scrollToModalError(appointmentCheckoutErrorRef)
    },
    [scrollToModalError],
  )

  const reportAppointmentRescheduleError = useCallback(
    (message: string | null) => {
      setAppointmentRescheduleError(message)
      if (message) scrollToModalError(appointmentRescheduleErrorRef)
    },
    [scrollToModalError],
  )

  const reportAppointmentLineSplitError = useCallback(
    (message: string | null) => {
      setAppointmentLineSplitError(message)
      if (message) scrollToModalError(appointmentLineSplitErrorRef)
    },
    [scrollToModalError],
  )

  const reportCancellationRequestsError = useCallback(
    (message: string | null) => {
      setCancellationRequestsError(message)
      if (message) scrollToModalError(cancellationRequestsErrorRef)
    },
    [scrollToModalError],
  )

  const showMsg = useCallback(
    (text: string, kind: ToastKind = 'info') => {
      if (kind === 'error') {
        if (appointmentLineSplitTarget) {
          reportAppointmentLineSplitError(text)
          return
        }
        if (editSettlementOpen) {
          reportEditSettlementError(text)
          return
        }
        if (appointmentCheckoutConfirmationOpen) {
          reportAppointmentCheckoutError(text)
          return
        }
        if (appointmentRescheduleOpen) {
          reportAppointmentRescheduleError(text)
          return
        }
        if (createAppointmentModalOpen) {
          reportCreateAppointmentError(text)
          return
        }
        if (cancellationRequestsModalOpen) {
          reportCancellationRequestsError(text)
          return
        }
      }
      pushToast(kind, text)
    },
    [
      appointmentCheckoutConfirmationOpen,
      appointmentLineSplitTarget,
      appointmentRescheduleOpen,
      cancellationRequestsModalOpen,
      createAppointmentModalOpen,
      editSettlementOpen,
      pushToast,
      reportAppointmentCheckoutError,
      reportAppointmentLineSplitError,
      reportAppointmentRescheduleError,
      reportCancellationRequestsError,
      reportCreateAppointmentError,
      reportEditSettlementError,
    ],
  )

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
                <span className="shrink-0 text-indigo-700">
                  {split.split_mode === 'amount' && split.share_amount != null
                    ? `RM ${Number(split.share_amount).toFixed(2)}`
                    : `${Number(split.share_percent)}%`}
                </span>
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

  const editStaffSplitsToLineSplits = useCallback((rows: SettlementInlineStaffSplitRow[]) => (
    settlementInlineRowsToInheritedSplits(rows)
  ), [])

  const resolveAppointmentEditLinePackageCovered = useCallback((lineKey: string): boolean => {
    if (!appointmentDetail?.id) return false
    const settlement = appointmentDetail as SettlementCartItemLike
    const originalServiceReference = Number(
      editOriginalService?.service_price
      ?? editOriginalService?.price
      ?? appointmentDetail.service_total
      ?? 0,
    )

    const addonMatch = lineKey.match(/^appointment-settlement:(\d+):addon:(\d+)$/)
    if (addonMatch && appointmentDetail.id === Number(addonMatch[1])) {
      const addonId = Number(addonMatch[2])
      const option = editAddonQuestions.flatMap((q) => q.options ?? []).find((opt) => Number(opt.id) === addonId)
      if (!option) return false
      const bookingServiceId = Number(option.linked_booking_service_id ?? option.id ?? 0)
      const qty = getAddonQuantity(editAddonQuantities, addonId)
      const gross = Number(option.extra_price ?? 0) * Math.max(1, qty)
      const amount = resolveEditSettlementAddonLineAmount(
        addonId,
        Number(option.extra_price ?? 0),
        editAddonQuantities,
        editAddonPriceOverrides,
        editAddonLineTotalOverrides,
      )
      return bookingServiceIdCoveredByPackage(settlement, bookingServiceId, {
        addon: {
          linked_booking_service_id: bookingServiceId,
          extra_price: option.extra_price,
          balance_due: amount ?? 0,
          gross_amount: gross,
          quantity: qty,
        },
        originalServiceReference,
      })
    }

    const blockAddonMatch = lineKey.match(/^appointment-settlement:(\d+):block:([^:]+):addon:(\d+)$/)
    if (blockAddonMatch && appointmentDetail.id === Number(blockAddonMatch[1])) {
      const block = editAddedMainBlocks.find((row) => row.tmp_id === blockAddonMatch[2])
      const addonId = Number(blockAddonMatch[3])
      const option = block?.addon_questions?.flatMap((q) => q.options ?? []).find((opt) => Number(opt.id) === addonId)
      if (!option) return false
      const bookingServiceId = Number(option.linked_booking_service_id ?? option.id ?? 0)
      const qty = getAddonQuantity(block?.selected_addon_ids ?? {}, addonId)
      const gross = Number(option.extra_price ?? 0) * Math.max(1, qty)
      const amount = resolveEditSettlementAddonLineAmount(
        addonId,
        Number(option.extra_price ?? 0),
        block?.selected_addon_ids ?? {},
        block?.addon_price_overrides ?? {},
        block?.addon_line_total_overrides ?? {},
      )
      return bookingServiceIdCoveredByPackage(settlement, bookingServiceId, {
        addon: {
          linked_booking_service_id: bookingServiceId,
          extra_price: option.extra_price,
          balance_due: amount ?? 0,
          gross_amount: gross,
          quantity: qty,
        },
        originalServiceReference,
      })
    }

    return false
  }, [
    appointmentDetail,
    editAddedMainBlocks,
    editAddonLineTotalOverrides,
    editAddonPriceOverrides,
    editAddonQuantities,
    editAddonQuestions,
    editOriginalService,
  ])

  const openAppointmentLineSplitEditor = useCallback(async (lineKey: string, title: string, inheritedSplits: AppointmentLineStaffSplit[] = [], lineTotal: number | null = null) => {
    let nextStaffs = activeStaffs
    if (!nextStaffs.length) {
      nextStaffs = await fetchStaffOptions('')
      setActiveStaffs(nextStaffs)
    }
    const existingSplits = appointmentLineStaffSplits[lineKey] ?? inheritedSplits
    const resolvedTotal = lineTotal != null && lineTotal > 0 ? lineTotal : null
    const allowAmountMode = resolvedTotal != null && !resolveAppointmentEditLinePackageCovered(lineKey)
    setAppointmentLineSplitTarget({ type: 'line', lineKey, title, inheritedSplits, lineTotal: resolvedTotal })
    setAppointmentLineSplitDraftRows(
      existingSplits.length
        ? existingSplits.map((split) => ({
            staff_id: split.staff_id,
            share_percent: String(split.share_percent),
            share_amount:
              split.share_amount != null
                ? Number(split.share_amount).toFixed(2)
                : resolvedTotal != null
                  ? (resolvedTotal * (split.share_percent / 100)).toFixed(2)
                  : '0.00',
          }))
        : [{ staff_id: null, share_percent: '100', share_amount: resolvedTotal != null ? resolvedTotal.toFixed(2) : '0.00' }],
    )
    setAppointmentLineSplitMode(
      existingSplits[0]?.split_mode === 'amount' && allowAmountMode ? 'amount' : 'percent',
    )
    setAppointmentLineSplitLineTotal(resolvedTotal)
    setAppointmentLineSplitAutoBalance(true)
    setAppointmentLineSplitOverwrite(false)
    reportAppointmentLineSplitError(null)
  }, [activeStaffs, appointmentLineStaffSplits, fetchStaffOptions, resolveAppointmentEditLinePackageCovered, reportAppointmentLineSplitError])

  const resolveAppointmentEditLineTotal = useCallback((lineKey: string): number | null => {
    if (!appointmentDetail?.id) return null
    const positive = (value: number) => (value > 0.0001 ? roundMoney(value) : null)

    const addonMatch = lineKey.match(/^appointment-settlement:(\d+):addon:(\d+)$/)
    if (addonMatch && Number(addonMatch[1]) === appointmentDetail.id) {
      const addonId = Number(addonMatch[2])
      const option = editAddonQuestions.flatMap((q) => q.options ?? []).find((opt) => Number(opt.id) === addonId)
      if (option) {
        const storedAddon = (appointmentDetail.addon_settlement_items ?? appointmentDetail.add_ons ?? [])
          .find((row) => Number(row.id ?? 0) === addonId)
        const amount = resolveEditSettlementAddonSplitLineTotal(
          option,
          editAddonQuantities,
          editAddonPriceOverrides,
          editAddonLineTotalOverrides,
          storedAddon,
        )
        return amount != null ? positive(amount) : null
      }
    }

    const blockAddonMatch = lineKey.match(/^appointment-settlement:(\d+):block:([^:]+):addon:(\d+)$/)
    if (blockAddonMatch && Number(blockAddonMatch[1]) === appointmentDetail.id) {
      const block = editAddedMainBlocks.find((row) => row.tmp_id === blockAddonMatch[2])
      const addonId = Number(blockAddonMatch[3])
      const option = block?.addon_questions?.flatMap((q) => q.options ?? []).find((opt) => Number(opt.id) === addonId)
      if (option) {
        const storedAddon = (appointmentDetail.main_services ?? [])
          .find((service) => Number(service.linked_booking_service_id ?? service.id ?? 0) === block?.service_id)
          ?.add_ons?.find((row) => Number(row.id ?? 0) === addonId)
        const amount = resolveEditSettlementAddonSplitLineTotal(
          option,
          block?.selected_addon_ids ?? {},
          block?.addon_price_overrides ?? {},
          block?.addon_line_total_overrides ?? {},
          storedAddon,
        )
        return amount != null ? positive(amount) : null
      }
    }

    return null
  }, [
    appointmentDetail?.addon_settlement_items,
    appointmentDetail?.add_ons,
    appointmentDetail?.id,
    appointmentDetail?.main_services,
    editAddedMainBlocks,
    editAddonLineTotalOverrides,
    editAddonPriceOverrides,
    editAddonQuantities,
    editAddonQuestions,
  ])

  const appointmentLineSplitAllowAmountMode = useMemo(() => {
    if (!appointmentLineSplitTarget || appointmentLineSplitTarget.type !== 'line') return false
    if (appointmentLineSplitLineTotal == null || appointmentLineSplitLineTotal <= 0) return false
    return !resolveAppointmentEditLinePackageCovered(appointmentLineSplitTarget.lineKey)
  }, [appointmentLineSplitTarget, appointmentLineSplitLineTotal, resolveAppointmentEditLinePackageCovered])

  const openAppointmentBulkLineSplitEditor = useCallback(async (
    title: string,
    lineKeys: string[],
    inheritedSplits: AppointmentLineStaffSplit[] = [],
    options?: { applyEditSettlementMainServices?: boolean },
  ) => {
    let nextStaffs = activeStaffs
    if (!nextStaffs.length) {
      nextStaffs = await fetchStaffOptions('')
      setActiveStaffs(nextStaffs)
    }
    const uniqueLineKeys = Array.from(new Set(lineKeys)).filter(Boolean)
    const applyEditSettlementMainServices = options?.applyEditSettlementMainServices ?? false
    setAppointmentLineSplitTarget({
      type: 'bulk',
      lineKeys: uniqueLineKeys,
      title,
      inheritedSplits,
      applyEditSettlementMainServices,
      lineTotal: null,
    })
    setAppointmentLineSplitDraftRows(inheritedSplits.length ? inheritedSplits.map((split) => ({
      staff_id: split.staff_id,
      share_percent: String(split.share_percent),
      share_amount: split.share_amount != null ? Number(split.share_amount).toFixed(2) : '0.00',
    })) : [{ staff_id: null, share_percent: '100', share_amount: '0.00' }])
    const inheritedMode = inheritedSplits[0]?.split_mode ?? 'percent'
    setAppointmentLineSplitMode(
      applyEditSettlementMainServices && editOriginalServiceCoveredByPackage ? 'percent' : inheritedMode,
    )
    setAppointmentLineSplitLineTotal(null)
    setAppointmentLineSplitAutoBalance(true)
    setAppointmentLineSplitOverwrite(applyEditSettlementMainServices)
    reportAppointmentLineSplitError(null)
  }, [activeStaffs, editOriginalServiceCoveredByPackage, fetchStaffOptions, reportAppointmentLineSplitError])

  const saveAppointmentLineSplitEditor = useCallback(() => {
    if (!appointmentLineSplitTarget) return
    const draftRows = appointmentLineSplitDraftRows.map((row) => ({
      staff_id: row.staff_id,
      share_percent: Number.parseInt(row.share_percent || '0', 10),
      share_amount: row.share_amount,
    }))
    const validation = validateStaffSplitDraft(draftRows, appointmentLineSplitMode, appointmentLineSplitLineTotal)
    if (!validation.valid) {
      reportAppointmentLineSplitError(validation.error ?? 'Invalid staff split.')
      return
    }
    const mappedSplits = mapStaffSplitDraftToPayload(draftRows, appointmentLineSplitMode, appointmentLineSplitLineTotal)
    if (appointmentLineSplitTarget.type === 'line') {
      setAppointmentLineStaffSplits((prev) => ({ ...prev, [appointmentLineSplitTarget.lineKey]: mappedSplits }))
    } else {
      const forceOverwrite = appointmentLineSplitTarget.applyEditSettlementMainServices || appointmentLineSplitOverwrite
      setAppointmentLineStaffSplits((prev) => {
        const next = { ...prev }
        appointmentLineSplitTarget.lineKeys.forEach((lineKey) => {
          if (forceOverwrite || !next[lineKey]?.length) next[lineKey] = mappedSplits
        })
        return next
      })
      if (appointmentLineSplitTarget.applyEditSettlementMainServices) {
        const draftRows = mappedSplits.map((row) => ({
          staff_id: row.staff_id,
          share_percent: String(row.share_percent),
          share_amount: row.share_amount != null ? Number(row.share_amount).toFixed(2) : '0.00',
        }))
        setEditStaffSplitMode(appointmentLineSplitMode)
        setEditStaffSplits(draftRows)
        setEditAddedMainBlocks((prev) => prev.map((block) => ({
          ...block,
          split_mode: appointmentLineSplitMode,
          staff_splits: draftRows.map((row) => ({ ...row })),
        })))
      }
    }
    setAppointmentLineSplitTarget(null)
  }, [appointmentLineSplitDraftRows, appointmentLineSplitLineTotal, appointmentLineSplitMode, appointmentLineSplitOverwrite, appointmentLineSplitTarget])

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

  const fetchAppointments = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    if (silent) {
      setAppointmentsRefreshing(true)
    } else {
      setAppointmentsLoading(true)
    }
    try {
      const params = new URLSearchParams({ page: '1' })
      const ymdFromDate = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      if (posApptViewMode === 'month') {
        const start = new Date(posApptCalendarMonth.getFullYear(), posApptCalendarMonth.getMonth(), 1)
        const end = new Date(posApptCalendarMonth.getFullYear(), posApptCalendarMonth.getMonth() + 1, 0)
        params.set('from_date', ymdFromDate(start))
        params.set('to_date', ymdFromDate(end))
        params.set('per_page', '500')
      } else {
        const parts = appointmentDateFilter.split('-').map(Number)
        if (parts.length === 3 && parts[0] && parts[1]) {
          const start = new Date(parts[0], parts[1] - 1, 1)
          const end = new Date(parts[0], parts[1], 0)
          params.set('from_date', ymdFromDate(start))
          params.set('to_date', ymdFromDate(end))
          params.set('per_page', '500')
        } else if (appointmentDateFilter) {
          params.set('date', appointmentDateFilter)
          params.set('per_page', '100')
        }
      }
      if (appointmentQuery.trim()) params.set('q', appointmentQuery.trim())
      if (appointmentCustomerFilter.trim()) params.set('customer_id', appointmentCustomerFilter.trim())
      if (appointmentStaffFilter.trim()) params.set('staff_id', appointmentStaffFilter.trim())
      if (scheduleScope === 'all') {
        params.set('include_terminal_statuses', '1')
      }
      if (appointmentStatusFilter.trim()) {
        params.set('status', appointmentStatusFilterApiValue(appointmentStatusFilter.trim()))
      }

      const res = await fetch(`/api/proxy/pos/appointments?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setAppointments([])
        return
      }

      const paged = extractPaged<PosAppointmentListItem>(json)
      setAppointments(
        paged.data
          .map(normalizePosAppointmentListItem)
          .filter((row) => appointmentMatchesStatusFilter(row, appointmentStatusFilter)),
      )
    } catch {
      setAppointments([])
    } finally {
      if (silent) {
        setAppointmentsRefreshing(false)
      } else {
        setAppointmentsLoading(false)
      }
    }
  }, [
    appointmentCustomerFilter,
    appointmentDateFilter,
    appointmentQuery,
    appointmentStaffFilter,
    appointmentStatusFilter,
    posApptCalendarMonth,
    posApptViewMode,
    scheduleScope,
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
                  price_mode: typeof option.price_mode === 'string' ? option.price_mode : (typeof option.linked_price_mode === 'string' ? option.linked_price_mode : null),
                  price_range_min: option.price_range_min == null ? (option.linked_price_range_min == null ? null : Number(option.linked_price_range_min)) : Number(option.price_range_min),
                  price_range_max: option.price_range_max == null ? (option.linked_price_range_max == null ? null : Number(option.linked_price_range_max)) : Number(option.price_range_max),
                  linked_price_mode: typeof option.linked_price_mode === 'string' ? option.linked_price_mode : null,
                  linked_price_range_min: option.linked_price_range_min == null ? null : Number(option.linked_price_range_min),
                  linked_price_range_max: option.linked_price_range_max == null ? null : Number(option.linked_price_range_max),
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
                  price_mode: typeof option.price_mode === 'string' ? option.price_mode : (typeof option.linked_price_mode === 'string' ? option.linked_price_mode : null),
                  price_range_min: option.price_range_min == null ? (option.linked_price_range_min == null ? null : Number(option.linked_price_range_min)) : Number(option.price_range_min),
                  price_range_max: option.price_range_max == null ? (option.linked_price_range_max == null ? null : Number(option.linked_price_range_max)) : Number(option.price_range_max),
                  linked_price_mode: typeof option.linked_price_mode === 'string' ? option.linked_price_mode : null,
                  linked_price_range_min: option.linked_price_range_min == null ? null : Number(option.linked_price_range_min),
                  linked_price_range_max: option.linked_price_range_max == null ? null : Number(option.linked_price_range_max),
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
    reportCreateAppointmentError(null)
    setCreateAppointmentSubmitting(false)
    setCreateAppointmentServiceDraft(null)
    setCreateAppointmentAddonQuantities({})
    setCreateAppointmentAddonPriceOverrides({})
    setCreateAppointmentAddonLineTotalOverrides({})
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
    setCreateAppointmentDepositPayments({ cash: '', qrpay: '', credit_card: '', customer_balance: '' })
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
    setMemberPickerForEditSettlement(false)
  }, [])

  const handleMemberCreated = useCallback(
    (customer: CustomerRowData) => {
      setIsCreateMemberModalOpen(false)
      if (!customer.id) {
        showMsg('Member created, but could not assign automatically. Please search again.', 'warning')
        return
      }

      const phone = customer.phone?.trim() || null
      const summary = { id: customer.id, name: customer.name, phone }

      if (memberPickerForEditSettlement) {
        setEditSettlementCustomerId(customer.id)
        setEditSettlementMemberSummary(summary)
        setEditSettlementIdentityMode('member')
        closeCreateAppointmentMemberPicker()
        showMsg('Member created and assigned.', 'success')
        return
      }

      if (createAppointmentMemberPickerOpen || createAppointmentModalOpen) {
        setCreateAppointmentCustomerId(customer.id)
        setCreateAppointmentMemberSummary(summary)
        setCreateAppointmentIdentityMode('member')
        closeCreateAppointmentMemberPicker()
        showMsg('Member created and assigned.', 'success')
        return
      }

      if (editSettlementOpen) {
        setEditSettlementCustomerId(customer.id)
        setEditSettlementMemberSummary(summary)
        setEditSettlementIdentityMode('member')
        showMsg('Member created and assigned.', 'success')
        return
      }

      showMsg('Member created.', 'success')
    },
    [
      closeCreateAppointmentMemberPicker,
      createAppointmentMemberPickerOpen,
      createAppointmentModalOpen,
      editSettlementOpen,
      memberPickerForEditSettlement,
      showMsg,
    ],
  )

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
    const selected = new Set(getSelectedAddonIds(createAppointmentAddonQuantities))
    return createAppointmentQuestions.flatMap((question) => question.options.filter((option) => selected.has(option.id)))
  }, [createAppointmentQuestions, createAppointmentAddonQuantities])

  const createAppointmentAddonDurationTotal = useMemo(
    () => sumSelectedAddonDuration(createAppointmentSelectedOptions, createAppointmentAddonQuantities),
    [createAppointmentAddonQuantities, createAppointmentSelectedOptions],
  )

  const createAppointmentGrandTotalBounds = useMemo(() => {
    const items: Array<{
      source?: PosPriceDisplaySource | null
      overrideAmount?: number
      hasOverrideKey?: boolean
      lineTotalOverride?: number
      hasLineTotalOverrideKey?: boolean
    }> = []
    if (createAppointmentServiceDraft) items.push({ source: createAppointmentServiceDraft })
    createAppointmentSelectedOptions.forEach((option) => {
      items.push({
        source: { ...option, quantity: getAddonQuantity(createAppointmentAddonQuantities, option.id) },
        overrideAmount: createAppointmentAddonPriceOverrides[option.id],
        hasOverrideKey: Object.prototype.hasOwnProperty.call(createAppointmentAddonPriceOverrides, option.id),
        lineTotalOverride: createAppointmentAddonLineTotalOverrides[option.id],
        hasLineTotalOverrideKey: Object.prototype.hasOwnProperty.call(createAppointmentAddonLineTotalOverrides, option.id),
      })
    })
    for (const block of createAppointmentExtraServiceBlocks) {
      if (!block.service) continue
      items.push({ source: block.service })
      block.questions
        .flatMap((question) => question.options.filter((option) => isAddonSelected(block.addonQuantities, option.id)))
        .forEach((option) => {
          items.push({
            source: { ...option, quantity: getAddonQuantity(block.addonQuantities, option.id) },
            overrideAmount: block.addon_price_overrides[option.id],
            hasOverrideKey: Object.prototype.hasOwnProperty.call(block.addon_price_overrides, option.id),
            lineTotalOverride: block.addon_line_total_overrides[option.id],
            hasLineTotalOverrideKey: Object.prototype.hasOwnProperty.call(block.addon_line_total_overrides, option.id),
          })
        })
    }
    return accumulatePosPriceBounds(items)
  }, [createAppointmentAddonLineTotalOverrides, createAppointmentAddonPriceOverrides, createAppointmentAddonQuantities, createAppointmentExtraServiceBlocks, createAppointmentSelectedOptions, createAppointmentServiceDraft])
  const createAppointmentExtraTotals = useMemo(() => {
    return createAppointmentExtraServiceBlocks.reduce((acc, block) => {
      if (!block.service) return acc
      acc.baseDuration += Number(block.service.duration_min ?? 0)
      acc.basePrice += Number(block.service.price ?? block.service.service_price ?? 0)
      const selectedOptions = block.questions.flatMap((question) => question.options.filter((option) => isAddonSelected(block.addonQuantities, option.id)))
      acc.addonDuration += sumSelectedAddonDuration(selectedOptions, block.addonQuantities)
      acc.addonPrice += selectedOptions.reduce((sum, option) => sum + Number(option.extra_price ?? 0) * (block.addonQuantities[option.id] ?? 1), 0)
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

  const createAppointmentSelectedSlot = useMemo(
    () => createAppointmentSlots.find((s) => s.start_at === createAppointmentSlotValue) ?? null,
    [createAppointmentSlotValue, createAppointmentSlots],
  )

  const createAppointmentStaffPickerOptions = useMemo(() => {
    if (!createAppointmentDate || !createAppointmentSlotValue) return []
    const unavailableReasons = createAppointmentSelectedSlot?.unavailable_staff_reasons ?? {}
    return createAppointmentAllowedStaffs.filter((staff) => !posAvailabilityStaffIsUnavailable(unavailableReasons[String(staff.id)] ?? '', posAvailabilityVerifyMode))
  }, [createAppointmentAllowedStaffs, createAppointmentDate, createAppointmentSelectedSlot, createAppointmentSlotValue, posAvailabilityVerifyMode])

  const createAppointmentSelectedSlotScheduleIds = useMemo(() => {
    return Array.isArray(createAppointmentSelectedSlot?.scheduled_staff_ids) ? createAppointmentSelectedSlot.scheduled_staff_ids : []
  }, [createAppointmentSelectedSlot])

  const createAppointmentStaffScheduleWarning = useMemo(() => {
    if (posAvailabilityVerifyMode === 'holiday_only') return null
    if (!createAppointmentAssignedStaffId || !createAppointmentSlotValue || createAppointmentSlotsLoading) {
      return null
    }

    const unavailableReason = createAppointmentSelectedSlot?.unavailable_staff_reasons?.[String(createAppointmentAssignedStaffId)] ?? ''
    if (POS_SCHEDULE_OVERRIDE_REASONS.has(unavailableReason)) {
      return unavailableReason
    }

    if (
      createAppointmentSelectedSlotScheduleIds.length > 0
      && !createAppointmentSelectedSlotScheduleIds.includes(createAppointmentAssignedStaffId)
    ) {
      return 'outside_staff_schedule'
    }

    return null
  }, [
    createAppointmentAssignedStaffId,
    createAppointmentSelectedSlot,
    createAppointmentSelectedSlotScheduleIds,
    createAppointmentSlotValue,
    createAppointmentSlotsLoading,
    posAvailabilityVerifyMode,
  ])

  const createAppointmentStaffScheduleWarningMessage = useMemo(() => {
    if (!createAppointmentStaffScheduleWarning || !createAppointmentAssignedStaffId) return null
    const staffName =
      createAppointmentStaffPickerOptions.find((staff) => staff.id === createAppointmentAssignedStaffId)?.name
      ?? activeStaffs.find((staff) => staff.id === createAppointmentAssignedStaffId)?.name
      ?? 'Selected staff'

    if (createAppointmentStaffScheduleWarning === 'hits_staff_break') {
      return `${staffName} is scheduled for a break at this time. POS can continue for walk-in / overtime.`
    }

    return `${staffName} is outside their regular working hours for this time. POS can continue for walk-in / overtime.`
  }, [
    activeStaffs,
    createAppointmentAssignedStaffId,
    createAppointmentStaffPickerOptions,
    createAppointmentStaffScheduleWarning,
  ])

  const appointmentRescheduleSelectedSlot = useMemo(
    () => appointmentRescheduleSlots.find((slot) => slot.start_at === appointmentRescheduleSlotValue) ?? null,
    [appointmentRescheduleSlotValue, appointmentRescheduleSlots],
  )

  const appointmentRescheduleOutsideStaffSchedule = Boolean(
    posAvailabilityVerifyMode !== 'holiday_only'
    && appointmentRescheduleDate
    && appointmentRescheduleSlotValue
    && appointmentRescheduleStaffId
    && appointmentRescheduleSelectedSlot?.is_in_schedule === false,
  )

  const createAppointmentStaffPickerReady = Boolean(createAppointmentDate && createAppointmentSlotValue)

  const createAppointmentNoStaffAvailableMessage = useMemo(() => {
    if (!createAppointmentStaffPickerReady || createAppointmentSlotsLoading) return null
    if (createAppointmentStaffPickerOptions.length > 0) return null
    return formatPosNoStaffAvailableMessage({
      allowedStaffCount: createAppointmentAllowedStaffs.length,
      unavailableReasons: createAppointmentSelectedSlot?.unavailable_staff_reasons,
      allowedStaffIds: createAppointmentAllowedStaffs.map((staff) => staff.id),
    })
  }, [
    createAppointmentAllowedStaffs,
    createAppointmentSelectedSlot,
    createAppointmentSlotsLoading,
    createAppointmentStaffPickerOptions.length,
    createAppointmentStaffPickerReady,
  ])

  useEffect(() => {
    if (createAppointmentAssignedStaffId && createAppointmentStaffPickerReady && !createAppointmentStaffPickerOptions.some((staff) => staff.id === createAppointmentAssignedStaffId)) {
      setCreateAppointmentAssignedStaffId(null)
    }
  }, [createAppointmentAssignedStaffId, createAppointmentStaffPickerOptions, createAppointmentStaffPickerReady])

  const createAppointmentSelectedServiceIds = useMemo(
    () => [
      ...(createAppointmentServiceDraft?.id ? [createAppointmentServiceDraft.id] : []),
      ...createAppointmentExtraServiceBlocks.map((block) => Number(block.service?.id ?? 0)).filter((id) => id > 0),
    ],
    [createAppointmentExtraServiceBlocks, createAppointmentServiceDraft?.id],
  )

  const submitCreateAppointment = useCallback(async () => {
    if (!createAppointmentServiceDraft) {
      reportCreateAppointmentError('Please select service first.')
      return
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const phonePattern = /^\+?[0-9]{8,15}$/

    if (createAppointmentIdentityMode === 'member') {
      if (!createAppointmentCustomerId) {
        reportCreateAppointmentError('Please assign member.')
        return
      }
    } else {
      if (normalizeInternationalPhone(createAppointmentGuestPhone) && !phonePattern.test(normalizeInternationalPhone(createAppointmentGuestPhone))) {
        reportCreateAppointmentError('Please enter a valid guest phone (8-15 digits, optional +).')
        return
      }
      if (createAppointmentGuestEmail.trim() && !emailPattern.test(createAppointmentGuestEmail.trim())) {
        reportCreateAppointmentError('Please enter a valid guest email.')
        return
      }
    }

    if (!createAppointmentAssignedStaffId) {
      reportCreateAppointmentError('Please select assigned staff.')
      return
    }
    if (!createAppointmentDate) {
      reportCreateAppointmentError('Please select appointment date.')
      return
    }
    if (!createAppointmentSlotValue) {
      reportCreateAppointmentError('Please select appointment slot/time.')
      return
    }
    if (new Set(createAppointmentSelectedServiceIds).size !== createAppointmentSelectedServiceIds.length) {
      reportCreateAppointmentError('Duplicate main services are not allowed in the same appointment.')
      return
    }
    for (const question of createAppointmentQuestions) {
      if (!question.is_required) continue
      const hasSelection = question.options.some((option) => isAddonSelected(createAppointmentAddonQuantities, option.id))
      if (!hasSelection) {
        reportCreateAppointmentError(`Please answer required question: ${question.title}`)
        return
      }
    }
    for (const block of createAppointmentExtraServiceBlocks) {
      if (!block.service) {
        reportCreateAppointmentError('Please select service for every added main service block.')
        return
      }
      for (const question of block.questions) {
        if (!question.is_required) continue
        const hasSelection = question.options.some((option) => isAddonSelected(block.addonQuantities, option.id))
        if (!hasSelection) {
          reportCreateAppointmentError(`Please answer required question: ${question.title}`)
          return
        }
      }
    }
    const unavailableReason = createAppointmentSelectedSlot?.unavailable_staff_reasons?.[String(createAppointmentAssignedStaffId)] ?? ''
    if (posAvailabilityShouldHardBlock(unavailableReason, posAvailabilityVerifyMode)) {
      reportCreateAppointmentError(formatPosAvailabilityErrorMessage({
        reasonCode: unavailableReason,
        staffName: activeStaffs.find((staff) => staff.id === createAppointmentAssignedStaffId)?.name,
        startAt: createAppointmentSlotValue,
        endAt: createAppointmentSelectedSlot?.end_at,
      }))
      return
    }

    setCreateAppointmentSubmitting(true)
    reportCreateAppointmentError(null)
    try {
      if (createAppointmentSelectedSlot?.end_at) {
        const params = new URLSearchParams({ staff_id: String(createAppointmentAssignedStaffId), start_at: createAppointmentSlotValue, end_at: createAppointmentSelectedSlot.end_at })
        const availabilityRes = await fetch(`/api/proxy/pos/availability/check?${params.toString()}`, { cache: 'no-store' })
        const availabilityJson = await availabilityRes.json().catch(() => null)
        const reason = String(availabilityJson?.data?.reason_code ?? '')
        if (availabilityJson?.data?.verify_mode != null) {
          setPosAvailabilityVerifyMode(parsePosAvailabilityVerifyMode(availabilityJson.data.verify_mode))
        }
        if (
          availabilityJson?.data?.is_hard_block
          || posAvailabilityShouldHardBlock(reason, parsePosAvailabilityVerifyMode(availabilityJson?.data?.verify_mode) || posAvailabilityVerifyMode)
        ) {
          reportCreateAppointmentError(formatPosAvailabilityErrorMessage({
            reasonCode: reason,
            staffName: activeStaffs.find((staff) => staff.id === createAppointmentAssignedStaffId)?.name,
            startAt: createAppointmentSlotValue,
            endAt: createAppointmentSelectedSlot.end_at,
            conflictDebug: availabilityJson?.data?.conflict_debug ?? null,
            backendMessage: availabilityJson?.data?.message ?? availabilityJson?.message ?? null,
          }))
          return
        }
      }
      console.debug('[POS appointment-create staff-splits] modal state before payload', {
        main_service: {
          booking_service_id: createAppointmentServiceDraft.id,
          staff_splits: appointmentLineStaffSplits[`appointment-create:main:${createAppointmentServiceDraft.id}`] ?? [{ staff_id: createAppointmentAssignedStaffId, share_percent: 100 }],
        },
        selected_addon_ids: getSelectedAddonIds(createAppointmentAddonQuantities),
        addon_staff_splits: Object.fromEntries(getSelectedAddonIds(createAppointmentAddonQuantities).map((id) => [id, appointmentLineStaffSplits[`appointment-create:addon:${id}`] ?? []])),
        service_blocks: createAppointmentExtraServiceBlocks.map((block) => ({
          id: block.id,
          booking_service_id: block.service?.id ?? null,
          selected_addon_ids: getSelectedAddonIds(block.addonQuantities),
          staff_splits: appointmentLineStaffSplits[`appointment-create:block:${block.id}:main`] ?? [],
          addon_staff_splits: Object.fromEntries(getSelectedAddonIds(block.addonQuantities).map((id) => [id, appointmentLineStaffSplits[`appointment-create:block:${block.id}:addon:${id}`] ?? []])),
        })),
      })
      const createMainStaffSplits = appointmentLineStaffSplits[`appointment-create:main:${createAppointmentServiceDraft.id}`] ?? [{ staff_id: createAppointmentAssignedStaffId, share_percent: 100 }]
      const createMainAddonIds = getSelectedAddonIds(createAppointmentAddonQuantities)
      const createMainAddonOverrides = buildAddonSettlementSaveOverrides(
        createMainAddonIds,
        createAppointmentAddonQuantities,
        createAppointmentAddonPriceOverrides,
        createAppointmentAddonLineTotalOverrides,
      )
      const payload: Record<string, unknown> = {
        booking_service_id: createAppointmentServiceDraft.id,
        assigned_staff_id: createAppointmentAssignedStaffId,
        selected_option_ids: createMainAddonIds,
        selected_option_quantities: buildAddonQuantitiesPayload(createAppointmentAddonQuantities),
        main_service_items: [
          {
            booking_service_id: createAppointmentServiceDraft.id,
            selected_option_ids: createMainAddonIds,
            selected_option_quantities: buildAddonQuantitiesPayload(createAppointmentAddonQuantities),
            addon_price_overrides: createMainAddonOverrides.addon_price_overrides,
            addon_line_total_overrides: createMainAddonOverrides.addon_line_total_overrides,
            staff_splits: createMainStaffSplits,
            addon_staff_splits: Object.fromEntries(createMainAddonIds.map((id) => [id, appointmentLineStaffSplits[`appointment-create:addon:${id}`] ?? createMainStaffSplits])),
          },
          ...createAppointmentExtraServiceBlocks
            .filter((block) => block.service?.id)
            .map((block) => {
              const blockAddonIds = getSelectedAddonIds(block.addonQuantities)
              const blockAddonOverrides = buildAddonSettlementSaveOverrides(
                blockAddonIds,
                block.addonQuantities,
                block.addon_price_overrides,
                block.addon_line_total_overrides,
              )
              const blockMainStaffSplits = appointmentLineStaffSplits[`appointment-create:block:${block.id}:main`] ?? [{ staff_id: createAppointmentAssignedStaffId, share_percent: 100 }]
              return {
                booking_service_id: Number(block.service?.id),
                selected_option_ids: blockAddonIds,
                selected_option_quantities: buildAddonQuantitiesPayload(block.addonQuantities),
                addon_price_overrides: blockAddonOverrides.addon_price_overrides,
                addon_line_total_overrides: blockAddonOverrides.addon_line_total_overrides,
                staff_splits: blockMainStaffSplits,
                addon_staff_splits: Object.fromEntries(blockAddonIds.map((id) => [id, appointmentLineStaffSplits[`appointment-create:block:${block.id}:addon:${id}`] ?? blockMainStaffSplits])),
              }
            }),
        ],
        start_at: createAppointmentSlotValue,
        notes: createAppointmentNotes.trim() ? createAppointmentNotes.trim() : null,
        staff_splits: createMainStaffSplits,
        qty: 1,
        deposit_amount: Math.max(0, createAppointmentDepositValue || 0),
        deposit_payments: createAppointmentDepositValue > 0 ? createAppointmentDepositRows : [],
        availability_override: true,
        availability_override_reason: null,
      }
      console.debug('[POS appointment-create staff-splits] payload before submit', {
        staff_splits: payload.staff_splits,
        main_service_items: payload.main_service_items,
      })
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
        reportCreateAppointmentError(formatPosAvailabilityErrorMessage({
          reasonCode: String(json?.data?.reason_code ?? json?.data?.validation_reason ?? 'booking_conflict'),
          staffName: activeStaffs.find((staff) => staff.id === createAppointmentAssignedStaffId)?.name,
          startAt: createAppointmentSlotValue,
          endAt: createAppointmentSelectedSlot?.end_at,
          conflictDebug: json?.data?.conflict_debug ?? null,
          backendMessage: json?.message ?? null,
        }))
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

      await fetchAppointments({ silent: true })

      const createdId = Number(json?.data?.id ?? json?.data?.booking_id ?? 0)
      if (createdId > 0) {
        const detailRes = await fetch(`/api/proxy/pos/appointments/${createdId}`, { cache: 'no-store' })
        const detailJson = await detailRes.json().catch(() => null)
        if (detailRes.ok) {
          const nextDetail = (detailJson?.data ?? null) as PosAppointmentDetail | null
          console.debug('[POS appointment-create staff-splits] appointment detail after create', {
            id: nextDetail?.id,
            staff_splits: nextDetail?.staff_splits ?? [],
            main_services: nextDetail?.main_services?.map((service) => ({
              id: service.id,
              staff_splits: service.staff_splits,
              add_ons: service.add_ons?.map((addon) => ({
                id: addon.id,
                staff_splits: addon.staff_splits,
              })),
            })),
            add_ons: nextDetail?.add_ons?.map((addon) => ({
              id: addon.id,
              staff_splits: addon.staff_splits,
            })),
          })
          setAppointmentDetail(nextDetail)
        }
      }
    } finally {
      setCreateAppointmentSubmitting(false)
    }
  }, [
    activeStaffs,
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
    createAppointmentAddonQuantities,
    createAppointmentAddonPriceOverrides,
    createAppointmentAddonLineTotalOverrides,
    createAppointmentSelectedServiceIds,
    createAppointmentSelectedSlot,
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
      setAppointmentSettlementPaymentAmounts({ cash: '', qrpay: '', credit_card: '', customer_balance: '' })
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
      const refreshed = json?.data as PosAppointmentDetail | null | undefined
      if (refreshed) {
        setEditSettlementDepositTotal(Number(refreshed.deposit_previously_collected_amount ?? refreshed.deposit_contribution ?? 0))
      }
    }
  }, [appointmentDetail?.id])

  useEffect(() => {
    if (!appointmentDetail?.id || typeof document === 'undefined') return

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshOpenedAppointmentDetail()
      }
    }

    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)

    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [appointmentDetail?.id, refreshOpenedAppointmentDetail])

  const loadCancellationRequestsModal = useCallback(async () => {
    setCancellationRequestsLoading(true)
    setCancellationRequestsError(null)
    try {
      const res = await fetch('/api/proxy/pos/cancellation-requests?status=pending&per_page=50', { cache: 'no-store' })
      const payload = (await res.json().catch(() => null)) as { data?: { data?: unknown }; message?: string } | null
      if (!res.ok) {
        setCancellationRequestsRows([])
        reportCancellationRequestsError(
          typeof payload?.message === 'string' ? payload.message : 'Failed to load cancellation requests.',
        )
        return
      }
      const rows = payload?.data?.data ?? payload?.data ?? []
      setCancellationRequestsRows(Array.isArray(rows) ? (rows as PosCancellationRequestRow[]) : [])
    } catch {
      setCancellationRequestsRows([])
      reportCancellationRequestsError('Failed to load cancellation requests.')
    } finally {
      setCancellationRequestsLoading(false)
    }
  }, [reportCancellationRequestsError])

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
        await fetchAppointments({ silent: true })
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
    if (appointmentDetailHasUnsettledRangePricing(appointmentDetail)) {
      reportAppointmentCheckoutError(UNSETTLED_RANGE_CHECKOUT_MESSAGE)
      return
    }
    const grossDueAmount = Number(appointmentDetail.amount_due_now ?? appointmentDetail.balance_due ?? 0)
    const discountDraftValue = Number(appointmentDiscountValueDraft || 0)
    if (!Number.isFinite(discountDraftValue) || discountDraftValue < 0) {
      reportAppointmentCheckoutError('Discount value must be 0 or higher.')
      return
    }
    if (appointmentDiscountTypeDraft === 'percentage' && discountDraftValue > 100) {
      reportAppointmentCheckoutError('Percentage discount must be between 0 and 100.')
      return
    }
    if (appointmentDiscountTypeDraft === 'fixed' && discountDraftValue > grossDueAmount) {
      reportAppointmentCheckoutError('Fixed discount must not exceed settlement amount due.')
      return
    }
    const discountAmount =
      appointmentDiscountTypeDraft === 'percentage'
        ? Math.min(grossDueAmount, (grossDueAmount * discountDraftValue) / 100)
        : Math.min(grossDueAmount, discountDraftValue)
    const dueAmount = Math.max(0, grossDueAmount - discountAmount)
    const settlementPaidSnapshot = Number(appointmentDetail?.settlement_paid ?? 0)
    const isZeroBalanceFinalize =
      settlementPaidSnapshot <= 0.0001 && dueAmount <= 0.0001 && appointmentNeedsZeroBalanceCheckout(appointmentDetail)
    const overpaidAmount = resolveSettlementRefundNeededAmount({
      refund_needed: appointmentDetail?.refund_needed,
      overpaid_amount: appointmentDetail?.overpaid_amount,
      refund_handled: appointmentDetail?.refund_handled,
    })
    const refundPending = overpaidAmount > 0.0001 && !appointmentDetail?.refund_handled
    if (isZeroBalanceFinalize && refundPending) {
      reportAppointmentCheckoutError('This booking has overpaid deposit. Please handle refund/credit in Edit Settlement before checkout.')
      return
    }
    const paymentRows = isZeroBalanceFinalize
      ? []
      : SPLIT_PAYMENT_METHODS
          .map(({ method }) => ({ method, amount: Number(appointmentSettlementPaymentAmounts[method] || 0) }))
          .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
    const settlementTotalPaid = paymentRows.reduce((sum, row) => sum + row.amount, 0)
    const settlementCashCents = toPaymentCents(appointmentSettlementPaymentAmounts.cash)
    const settlementQrPayCents = toPaymentCents(appointmentSettlementPaymentAmounts.qrpay)
    const settlementCreditCardCents = toPaymentCents(appointmentSettlementPaymentAmounts.credit_card)
    const settlementCustomerBalanceCents = toPaymentCents(appointmentSettlementPaymentAmounts.customer_balance)
    const settlementTotalPaidCents = settlementCashCents + settlementQrPayCents + settlementCreditCardCents + settlementCustomerBalanceCents
    const dueCents = toPaymentCents(dueAmount)
    const settlementCashOnlyOverpaid = settlementCashCents > dueCents && settlementQrPayCents === 0 && settlementCreditCardCents === 0
    const settlementMixedOverpaid = settlementTotalPaidCents > dueCents && (settlementQrPayCents > 0 || settlementCreditCardCents > 0)
    const settlementHasQrPay = settlementQrPayCents > 0
    const settlementChange = settlementCashOnlyOverpaid ? Math.max(0, (settlementTotalPaidCents - dueCents) / 100) : 0

    if (!isZeroBalanceFinalize && dueAmount <= 0) {
      reportAppointmentCheckoutError('No balance due for this appointment.')
      return
    }

    if (!isZeroBalanceFinalize) {
      if (paymentRows.length === 0 || (settlementTotalPaidCents !== dueCents && !settlementCashOnlyOverpaid)) {
        reportAppointmentCheckoutError(settlementMixedOverpaid ? 'Payment total cannot exceed grand total for split/non-cash payment.' : 'Total paid must equal the amount due.')
        return
      }
    }

    reportAppointmentCheckoutError(null)
    setAppointmentActionLoading(true)
    try {
      const resolveAppointmentCheckoutStaffSplits = () => {
        const fromDetail = (appointmentDetail.staff_splits ?? [])
          .filter((split) =>
            Number(split.staff_id) > 0
            && (Number(split.share_percent) > 0 || Number(split.share_amount) > 0),
          )
          .map(serializeStaffSplitForApi)
        if (fromDetail.length > 0) return fromDetail
        const staffId = Number(appointmentDetail.staff?.id ?? 0)
        if (staffId > 0) return [{ staff_id: staffId, share_percent: 100 }]
        return []
      }

      const appointmentMainSplits = resolveAppointmentCheckoutStaffSplits()
      const mainSettlementLines = appointmentDetail.main_service_settlement_items ?? []
      const splitKeyForServiceLine = (line: { is_original?: boolean; name?: string | null; line_key?: string | null; linked_booking_service_id?: number | null; id?: number | null }, idx: number) => (line.is_original ? 'original' : String(line.name ?? line.line_key ?? line.linked_booking_service_id ?? line.id ?? idx))
      const mainSplitsByServiceRef = new Map(mainSettlementLines.map((line, idx) => [splitKeyForServiceLine(line, idx), (line.staff_splits?.length ? line.staff_splits : appointmentMainSplits).map(serializeStaffSplitForApi)]))
      const settlementLineStaffSplits = [
        ...mainSettlementLines.map((line, idx) => {
          const lineKey = line.line_key ?? `service:${line.id ?? idx}`
          const splits = line.staff_splits?.length ? line.staff_splits : appointmentMainSplits
          return {
            line_key: lineKey,
            line_type: 'settlement_service',
            line_ref_id: String(line.id ?? lineKey),
            staff_splits: splits.map(serializeStaffSplitForApi),
          }
        }),
        ...(appointmentDetail.addon_settlement_items ?? appointmentDetail.add_ons ?? []).map((addon, idx) => {
          const lineKey = addon.line_key ?? `addon:${addon.id ?? idx}`
          const parentSplits = mainSplitsByServiceRef.get(String(addon.service_ref ?? 'original')) ?? appointmentMainSplits
          const splits = addon.staff_splits?.length ? addon.staff_splits : parentSplits
          return {
            line_key: lineKey,
            line_type: 'settlement_addon',
            line_ref_id: String(addon.id ?? lineKey),
            staff_splits: splits.map(serializeStaffSplitForApi),
          }
        }),
      ].filter((line) => line.staff_splits.length > 0)

      const payload = {
        payment_method: paymentRows.length > 1 ? 'split' : (paymentRows[0]?.method ?? appointmentPaymentMethod),
        payments: paymentRows,
        discount_type: discountDraftValue > 0 ? appointmentDiscountTypeDraft : null,
        discount_value: discountDraftValue > 0 ? discountDraftValue : 0,
        discount_remark: discountDraftValue > 0 ? appointmentDiscountRemarkDraft.trim() || null : null,
        settlement_line_staff_splits: settlementLineStaffSplits,
      }

      const endpoint = isZeroBalanceFinalize
        ? `/api/proxy/pos/appointments/${appointmentDetail.id}/finalize-zero-settlement`
        : `/api/proxy/pos/appointments/${appointmentDetail.id}/collect-payment`

      const zeroSettlementBody = {
        payment_method: mapZeroSettlementPaymentMethod(appointmentPaymentMethod),
      }
      const settlementBody = !isZeroBalanceFinalize && appointmentQrProofFile && settlementHasQrPay ? new FormData() : null
      if (settlementBody) {
        settlementBody.append('payload', JSON.stringify(payload))
        settlementBody.append('qr_payment_proof', appointmentQrProofFile as File)
      }

      const res = await fetch(endpoint, settlementBody
        ? { method: 'POST', body: settlementBody }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(isZeroBalanceFinalize ? zeroSettlementBody : payload),
          })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        reportAppointmentCheckoutError(String(json?.message ?? 'Unable to collect payment.'))
        return
      }

      showMsg(isZeroBalanceFinalize ? 'Appointment finalised.' : 'Appointment payment collected.', 'success')
      reportAppointmentCheckoutError(null)
      setAppointmentCheckoutConfirmationOpen(false)
      setAppointmentSettlementResult({
        order_id: Number(json?.data?.order_id ?? 0),
        order_number: String(json?.data?.order_number ?? '-'),
        receipt_public_url: json?.data?.receipt_public_url ?? null,
        payment_method: paymentRows.length > 1 ? 'split' : (paymentRows[0]?.method ?? appointmentPaymentMethod),
        paid_amount: isZeroBalanceFinalize ? 0 : dueAmount,
        cash_received: isZeroBalanceFinalize ? 0 : settlementTotalPaid,
        change_amount: isZeroBalanceFinalize ? 0 : settlementChange,
        refund_no: json?.data?.refund?.refund_no ?? null,
        refund_amount: Number(json?.data?.refund?.amount ?? 0),
      })
      setAppointmentReceiptEmail(formatAppointmentReceiptDefaultEmail(appointmentDetail))
      setAppointmentReceiptEmailError(null)
      setAppointmentReceiptCooldownUntil(0)
      setAppointmentQrCodeFullscreen(false)
      setAppointmentReceiptQrLoaded(false)
      setAppointmentSettlementPaymentAmounts({ cash: '', qrpay: '', credit_card: '', customer_balance: '' })
      if (appointmentQrProofPreviewUrl) {
        URL.revokeObjectURL(appointmentQrProofPreviewUrl)
      }
      setAppointmentQrProofFile(null)
      setAppointmentQrProofPreviewUrl(null)
      setAppointmentQrProofFileName(null)
      await fetchAppointments({ silent: true })
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

  const rebalanceEditSettlementPrimaryShare = useCallback((rows: SettlementInlineStaffSplitRow[]) =>
    rebalanceSettlementInlineStaffRows(rows, editStaffSplitMode, editOriginalLineTotal, true),
  [editStaffSplitMode, editOriginalLineTotal])

  const resolveEditAddedMainBlockLineTotal = useCallback((block: (typeof editAddedMainBlocks)[number]): number | null => {
    const lineTotal = resolveEditSettlementAddedMainBlockLineTotal(block)
    return lineTotal != null ? roundMoney(lineTotal) : null
  }, [])

  const isEditAddedMainBlockPackageCovered = useCallback((block: (typeof editAddedMainBlocks)[number]): boolean => {
    if (!appointmentDetail) return false
    return bookingServiceIdCoveredByPackage(appointmentDetail as SettlementCartItemLike, block.service_id)
  }, [appointmentDetail])

  const rebalanceEditAddedMainBlockSplits = useCallback((
    rows: SettlementInlineStaffSplitRow[],
    block: (typeof editAddedMainBlocks)[number],
  ) => rebalanceSettlementInlineStaffRows(
    rows,
    block.split_mode,
    resolveEditAddedMainBlockLineTotal(block),
    block.auto_balance,
  ), [resolveEditAddedMainBlockLineTotal])

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

  const buildAppointmentMainServicePriceSource = useCallback(
    (service: (typeof appointmentDisplayMainServices)[number], idx: number): PosPriceDisplaySource => {
      const isOriginalService = Boolean(service.is_original ?? idx === 0)
      return {
        ...service,
        ...(isOriginalService && appointmentDetail?.settled_service_amount != null
          ? {
              extra_price: Number(appointmentDetail.settled_service_amount),
              settled_service_amount: appointmentDetail.settled_service_amount,
              price_finalized: true,
            }
          : {}),
        ...(isOriginalService && appointmentDetail?.settled_service_amount == null && appointmentDetail?.service
          ? {
              price_mode: service.price_mode ?? appointmentDetail.service.price_mode ?? null,
              service_price_mode: appointmentDetail.service.price_mode ?? null,
              price_range_min: service.price_range_min ?? appointmentDetail.service.price_range_min ?? null,
              price_range_max: service.price_range_max ?? appointmentDetail.service.price_range_max ?? null,
              service_price_range_min: appointmentDetail.service.price_range_min ?? null,
              service_price_range_max: appointmentDetail.service.price_range_max ?? null,
            }
          : {}),
        ...(service.price_finalized ? { price_finalized: true } : {}),
      }
    },
    [appointmentDetail?.service, appointmentDetail?.settled_service_amount],
  )

  const openEditSettlement = useCallback(async () => {
    if (!appointmentDetail?.service?.id) return
    reportEditSettlementError(null)
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

    setEditAddonQuantities(selectionFromAddonRows((appointmentDetail.add_ons ?? []).map((addon) => ({ id: addon.id, quantity: addon.quantity ?? 1 }))))
    setEditAddonPriceOverrides(seedFinalizedAddonPriceOverrides(appointmentDetail.add_ons ?? []))
    setEditAddonLineTotalOverrides(seedAddonLineTotalOverrides(appointmentDetail.add_ons ?? []))
    const originalSettlementSourceForSeed = bookingServiceSettlementSource(
      {
        price_mode: appointmentDetail.service.price_mode ?? null,
        price_range_min: appointmentDetail.service.price_range_min ?? null,
        price_range_max: appointmentDetail.service.price_range_max ?? null,
      },
      {
        is_range_priced: appointmentDetail.is_range_priced,
        requires_settled_amount: appointmentDetail.requires_settled_amount,
      },
    )
    const hasFinalOriginalServicePrice =
      !settlementNeedsSettledAmount(originalSettlementSourceForSeed) ||
      appointmentDetail.settled_service_amount != null ||
      posPriceDisplayHasFinalPrice({
        ...originalMainService,
        price_mode: originalMainService?.price_mode ?? appointmentDetail.service.price_mode,
        price_range_min: originalMainService?.price_range_min ?? appointmentDetail.service.price_range_min,
        price_range_max: originalMainService?.price_range_max ?? appointmentDetail.service.price_range_max,
        settled_service_amount: appointmentDetail.settled_service_amount,
      })
    setEditOriginalServicePriceOverride(
      hasFinalOriginalServicePrice
        ? Number(
            appointmentDetail.settled_service_amount
            ?? originalMainService?.extra_price
            ?? appointmentDetail.service_total
            ?? 0,
          )
        : null,
    )
    const addedMainBlocksSeed = appointmentDisplayMainServices
      .filter((service) => !service.is_original)
      .map((service) => {
        const settlementLine = matchAddedMainSettlementLine(service, appointmentDetail.main_service_settlement_items)
        const resolvedPrice = resolveAddedMainServiceSeedPrice(service, settlementLine)
        const referenceUnitPrice = resolveAddedMainServiceReferenceUnitPrice(service, settlementLine)
        return {
        tmp_id: `seed-${Number(service.linked_booking_service_id ?? service.id ?? 0)}-${Math.random()}`,
        service_id: Number(service.linked_booking_service_id ?? service.id ?? 0),
        service_name: String(service.name ?? 'Service'),
        service_cn_name: typeof service.cn_name === 'string' ? service.cn_name : null,
        price: resolvedPrice,
        reference_unit_price: referenceUnitPrice,
        price_mode: service.price_mode ?? settlementLine?.price_mode ?? null,
        price_range_min: service.price_range_min ?? settlementLine?.price_range_min ?? null,
        price_range_max: service.price_range_max ?? settlementLine?.price_range_max ?? null,
        price_finalized: resolveAddedMainServiceSeedFinalized(service, settlementLine, resolvedPrice),
        duration_min: Number(service.extra_duration_min ?? 0),
        addon_questions: [] as ServiceAddonQuestion[],
        selected_addon_ids: selectionFromAddonRows((service.add_ons ?? []).map((addon) => ({ id: addon.id, quantity: addon.quantity ?? 1 }))),
        addon_price_overrides: seedFinalizedAddonPriceOverrides(service.add_ons ?? []),
        addon_line_total_overrides: seedAddonLineTotalOverrides(service.add_ons ?? []),
        staff_splits: (service.staff_splits ?? []).map((split) => ({
          staff_id: Number(split.staff_id) > 0 ? Number(split.staff_id) : null,
          share_percent: String(split.share_percent ?? ''),
          share_amount: 'share_amount' in split && split.share_amount != null ? Number(split.share_amount).toFixed(2) : '0.00',
        })),
        split_mode: (() => {
          const blockBase = {
            price: resolvedPrice,
            price_mode: service.price_mode ?? settlementLine?.price_mode ?? null,
            price_range_min: service.price_range_min ?? settlementLine?.price_range_min ?? null,
            price_range_max: service.price_range_max ?? settlementLine?.price_range_max ?? null,
            price_finalized: resolveAddedMainServiceSeedFinalized(service, settlementLine, resolvedPrice),
          }
          const blockLineTotal = resolveEditSettlementAddedMainBlockLineTotal(blockBase)
          return resolveSavedSettlementStaffSplitMode(service.staff_splits, {
            allowAmount: blockLineTotal != null && blockLineTotal > 0,
          })
        })(),
        auto_balance: true,
      }})
      .filter((block) => block.service_id > 0)
    setAppointmentLineStaffSplits((prev) => {
      const next = { ...prev }
      ;(appointmentDetail.add_ons ?? []).forEach((addon) => {
        const addonId = Number(addon.id ?? 0)
        const splits = (addon.staff_splits ?? [])
          .map((split) => ({
            staff_id: Number(split.staff_id ?? 0),
            share_percent: Number(split.share_percent ?? 0),
          }))
          .filter((split) => split.staff_id > 0 && split.share_percent > 0)
        if (addonId > 0 && splits.length > 0) {
          next[`appointment-settlement:${appointmentDetail.id}:addon:${addonId}`] = splits
        }
      })
      addedMainBlocksSeed.forEach((block) => {
        getSelectedAddonIds(block.selected_addon_ids).forEach((addonId) => {
          const addon = appointmentDisplayMainServices
            .find((service) => Number(service.linked_booking_service_id ?? service.id ?? 0) === block.service_id)
            ?.add_ons?.find((row) => Number(row.id ?? 0) === addonId)
          const splits = (addon?.staff_splits ?? [])
            .map((split) => ({
              staff_id: Number(split.staff_id ?? 0),
              share_percent: Number(split.share_percent ?? 0),
            }))
            .filter((split) => split.staff_id > 0 && split.share_percent > 0)
          if (splits.length > 0) {
            next[`appointment-settlement:${appointmentDetail.id}:block:${block.tmp_id}:addon:${addonId}`] = splits
          }
        })
      })
      console.debug('[POS appointment settlement staff-splits] seeded saved add-on splits', {
        appointment_id: appointmentDetail.id,
        seeded_line_splits: Object.fromEntries(Object.entries(next).filter(([key]) => key.startsWith(`appointment-settlement:${appointmentDetail.id}:`))),
      })
      return next
    })
    setEditAddedMainBlocks(addedMainBlocksSeed)
    setEditMainServiceQuery('')
                  setEditMainServiceCategoryId(null)
    setEditMainServicePickerOpen(false)
    setEditMainServicePickerTargetId(null)

    const settled = appointmentDetail.settled_service_amount
    setEditSettledAmount(settled != null ? String(settled) : '')
    setEditStaffSplitAutoBalance(true)
    const seededLineTotal = hasFinalOriginalServicePrice
      ? Number(
          appointmentDetail.settled_service_amount
          ?? originalMainService?.extra_price
          ?? appointmentDetail.service_total
          ?? 0,
        )
      : null
    const seededOriginalCoveredByPackage = bookingServiceIdCoveredByPackage(
      appointmentDetail as SettlementCartItemLike,
      Number(appointmentDetail.service.id ?? 0),
      { treatAsOriginalMain: true },
    )
    const seededSplitMode = resolveSavedSettlementStaffSplitMode(appointmentDetail.staff_splits, {
      allowAmount: !seededOriginalCoveredByPackage && seededLineTotal != null && seededLineTotal > 0,
    })
    const initialSplits = seedSettlementInlineStaffRows(appointmentDetail.staff_splits ?? [], seededSplitMode, seededLineTotal)
    setEditStaffSplitMode(seededSplitMode)
    if (initialSplits.length > 0) {
      setEditStaffSplits(initialSplits)
      setEditSettlementOriginalPrimaryStaffId(Number(initialSplits[0].staff_id))
    } else {
      const fallbackStaffId = appointmentDetail.staff?.id ?? null
      setEditStaffSplits(fallbackStaffId ? [{ staff_id: fallbackStaffId, share_percent: '100', share_amount: '0.00' }] : [])
      setEditSettlementOriginalPrimaryStaffId(fallbackStaffId)
    }

    if (appointmentDetail.customer?.id) {
      setEditSettlementIdentityMode('member')
      setEditSettlementCustomerId(appointmentDetail.customer.id)
      setEditSettlementMemberSummary({
        id: appointmentDetail.customer.id,
        name: appointmentDetail.customer.name,
        phone: appointmentDetail.customer.phone ?? null,
      })
      setEditSettlementGuestName('')
      setEditSettlementGuestPhone('')
      setEditSettlementGuestEmail('')
    } else {
      setEditSettlementIdentityMode('guest')
      setEditSettlementCustomerId(null)
      setEditSettlementMemberSummary(null)
      const rawGuestName = String(appointmentDetail.guest_name ?? '').trim()
      setEditSettlementGuestName(rawGuestName.toUpperCase().startsWith('UNKNOWN') ? '' : rawGuestName)
      setEditSettlementGuestPhone(String(appointmentDetail.guest_phone ?? ''))
      setEditSettlementGuestEmail(String(appointmentDetail.guest_email ?? ''))
    }

    setEditSettlementDepositTotal(Number(appointmentDetail.deposit_previously_collected_amount ?? appointmentDetail.deposit_contribution ?? 0))
    setEditSettlementNoteDraft(String(appointmentDetail.settlement_notes ?? '').trim())

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
            return { ...block, addon_questions: questions, staff_splits: block.staff_splits.length > 0 ? rebalanceEditAddedMainBlockSplits(block.staff_splits, block) : [{ staff_id: null, share_percent: '100', share_amount: '0.00' }] }
          } catch {
            return { ...block, addon_questions: [], staff_splits: block.staff_splits.length > 0 ? rebalanceEditAddedMainBlockSplits(block.staff_splits, block) : [{ staff_id: null, share_percent: '100', share_amount: '0.00' }] }
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
  }, [appointmentDetail, appointmentDisplayMainServices, rebalanceEditAddedMainBlockSplits])

  const toggleEditAddon = useCallback((option: ServiceAddonOption, questionType: string, questionOptionIds: number[]) => {
    setEditAddonQuantities((prev) => {
      const wasSelected = (prev[option.id] ?? 0) > 0
      const next = toggleAddonSelection(prev, option, questionType, questionOptionIds)
      const nextQty = next[option.id] ?? 0
      if (wasSelected && nextQty <= 0 && appointmentDetail?.id) {
        const addonServiceId = Number(option.linked_booking_service_id ?? 0)
        if (addonServiceId > 0) {
          void releaseAppointmentPackageClaimsForService(
            appointmentDetail.id,
            appointmentDetail.package_claims,
            addonServiceId,
          ).then((result) => {
            if (!result.ok) {
              reportEditSettlementError(result.message ?? 'Unable to release package claims.')
              return
            }
            if (result.releasedUsageIds.length > 0) {
              setAppointmentDetail((detail) => {
                if (!detail) return detail
                const remainingClaims = pruneReleasedPackageClaims(detail.package_claims, result.releasedUsageIds)
                const hasActiveClaims = remainingClaims.some((claim) =>
                  ['reserved', 'consumed'].includes(String(claim.status ?? '').toLowerCase()),
                )
                return {
                  ...detail,
                  package_claims: remainingClaims,
                  package_status: hasActiveClaims ? detail.package_status : null,
                }
              })
            }
          })
        }
      }
      return next
    })
  }, [appointmentDetail?.id, appointmentDetail?.package_claims, reportEditSettlementError])

  const setEditAddonQuantity = useCallback((option: ServiceAddonOption, qty: number) => {
    setEditAddonQuantities((prev) => {
      const wasSelected = (prev[option.id] ?? 0) > 0
      const next = setAddonQuantity(prev, option, qty)
      const nextQty = next[option.id] ?? 0
      if (wasSelected && nextQty <= 0 && appointmentDetail?.id) {
        const addonServiceId = Number(option.linked_booking_service_id ?? 0)
        if (addonServiceId > 0) {
          void releaseAppointmentPackageClaimsForService(
            appointmentDetail.id,
            appointmentDetail.package_claims,
            addonServiceId,
          ).then((result) => {
            if (!result.ok) {
              reportEditSettlementError(result.message ?? 'Unable to release package claims.')
              return
            }
            if (result.releasedUsageIds.length > 0) {
              setAppointmentDetail((detail) => {
                if (!detail) return detail
                const remainingClaims = pruneReleasedPackageClaims(detail.package_claims, result.releasedUsageIds)
                const hasActiveClaims = remainingClaims.some((claim) =>
                  ['reserved', 'consumed'].includes(String(claim.status ?? '').toLowerCase()),
                )
                return {
                  ...detail,
                  package_claims: remainingClaims,
                  package_status: hasActiveClaims ? detail.package_status : null,
                }
              })
            }
          })
        }
      }
      return next
    })
  }, [appointmentDetail?.id, appointmentDetail?.package_claims, reportEditSettlementError])

  const releaseEditSettlementPackageForService = useCallback(async (bookingServiceId: number): Promise<boolean> => {
    if (!appointmentDetail?.id || bookingServiceId <= 0) return true
    const result = await releaseAppointmentPackageClaimsForService(
      appointmentDetail.id,
      appointmentDetail.package_claims,
      bookingServiceId,
    )
    if (!result.ok) {
      reportEditSettlementError(result.message ?? 'Unable to release package claims.')
      return false
    }
    if (result.releasedUsageIds.length > 0) {
      setAppointmentDetail((detail) => {
        if (!detail) return detail
        const remainingClaims = pruneReleasedPackageClaims(detail.package_claims, result.releasedUsageIds)
        const hasActiveClaims = remainingClaims.some((claim) =>
          ['reserved', 'consumed'].includes(String(claim.status ?? '').toLowerCase()),
        )
        return {
          ...detail,
          package_claims: remainingClaims,
          package_status: hasActiveClaims ? detail.package_status : null,
        }
      })
    }
    return true
  }, [appointmentDetail?.id, appointmentDetail?.package_claims, reportEditSettlementError])

  const removeEditAddedMainBlock = useCallback(async (tmpId: string) => {
    const block = editAddedMainBlocks.find((item) => item.tmp_id === tmpId)
    if (!block) return
    if (block.service_id > 0) {
      const released = await releaseEditSettlementPackageForService(block.service_id)
      if (!released) return
    }
    for (const question of block.addon_questions) {
      for (const option of question.options ?? []) {
        const qty = getAddonQuantity(block.selected_addon_ids, option.id)
        if (qty <= 0) continue
        const addonServiceId = Number(option.linked_booking_service_id ?? 0)
        if (addonServiceId > 0) {
          const released = await releaseEditSettlementPackageForService(addonServiceId)
          if (!released) return
        }
      }
    }
    setEditAddedMainBlocks((prev) => prev.filter((item) => item.tmp_id !== tmpId))
  }, [editAddedMainBlocks, releaseEditSettlementPackageForService])

  const toggleEditAddedMainBlockAddon = useCallback(async (
    blockTmpId: string,
    option: ServiceAddonOption,
    questionType: string,
    questionOptionIds: number[],
  ) => {
    const block = editAddedMainBlocks.find((item) => item.tmp_id === blockTmpId)
    if (!block) return
    const wasSelected = isAddonSelected(block.selected_addon_ids, option.id)
    setEditAddedMainBlocks((prev) => prev.map((item) => {
      if (item.tmp_id !== blockTmpId) return item
      return {
        ...item,
        selected_addon_ids: toggleAddonSelection(item.selected_addon_ids, option, questionType, questionOptionIds),
      }
    }))
    if (wasSelected) {
      const addonServiceId = Number(option.linked_booking_service_id ?? 0)
      if (addonServiceId > 0) {
        await releaseEditSettlementPackageForService(addonServiceId)
      }
    }
  }, [editAddedMainBlocks, releaseEditSettlementPackageForService])

  const setEditAddedMainBlockAddonQuantity = useCallback(async (
    blockTmpId: string,
    option: ServiceAddonOption,
    qty: number,
  ) => {
    const block = editAddedMainBlocks.find((item) => item.tmp_id === blockTmpId)
    if (!block) return
    const wasSelected = getAddonQuantity(block.selected_addon_ids, option.id) > 0
    setEditAddedMainBlocks((prev) => prev.map((item) => {
      if (item.tmp_id !== blockTmpId) return item
      return {
        ...item,
        selected_addon_ids: setAddonQuantity(item.selected_addon_ids, option, qty),
      }
    }))
    if (wasSelected && qty <= 0) {
      const addonServiceId = Number(option.linked_booking_service_id ?? 0)
      if (addonServiceId > 0) {
        await releaseEditSettlementPackageForService(addonServiceId)
      }
    }
  }, [editAddedMainBlocks, releaseEditSettlementPackageForService])

  const selectEditOriginalService = useCallback(async (service: BookingServiceOption) => {
    if (!service?.id) return
    reportEditSettlementError(null)

    const previousServiceId = Number(editOriginalService?.id ?? appointmentDetail?.service?.id ?? 0)
    const nextServiceId = Number(service.id)
    if (
      appointmentDetail?.id
      && previousServiceId > 0
      && nextServiceId > 0
      && nextServiceId !== previousServiceId
    ) {
      const usageIds = collectActivePackageClaimUsageIds(appointmentDetail.package_claims, previousServiceId)
      if (usageIds.length > 0) {
        setAppointmentActionLoading(true)
        try {
          const releaseResult = await batchReleaseAppointmentPackageClaims(appointmentDetail.id, usageIds)
          if (!releaseResult.ok) {
            reportEditSettlementError(releaseResult.message ?? 'Unable to release package claims.')
            return
          }
          const releasedIdSet = new Set(usageIds)
          setAppointmentDetail((prev) => {
            if (!prev) return prev
            const remainingClaims = (prev.package_claims ?? []).filter(
              (claim) => !releasedIdSet.has(Number(claim.usage_id)),
            )
            const hasActiveClaims = remainingClaims.some((claim) =>
              ['reserved', 'consumed'].includes(String(claim.status ?? '').toLowerCase()),
            )
            return {
              ...prev,
              package_claims: remainingClaims,
              package_status: hasActiveClaims ? prev.package_status : null,
            }
          })
          showMsg('Package released because the service was changed.', 'success')
          await fetchAppointments({ silent: true })
          await refreshOpenedAppointmentDetail()
        } finally {
          setAppointmentActionLoading(false)
        }
      }
    }

    setEditOriginalService(service)
    setEditOriginalServicePriceOverride(Number(service.service_price ?? service.price ?? 0))
    setEditAddonPriceOverrides({})
    setEditAddonLineTotalOverrides({})
    setEditAddonQuantities({})
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
  }, [
    appointmentDetail?.id,
    appointmentDetail?.package_claims,
    appointmentDetail?.service?.id,
    editOriginalService?.id,
    fetchAppointments,
    refreshOpenedAppointmentDetail,
    showMsg,
  ])

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
    const catalogPrice = Number(service.service_price ?? service.price ?? 0)
    const isRange = posPriceDisplayHasRange({
      price_mode: service.price_mode ?? null,
      price_range_min: service.price_range_min ?? null,
      price_range_max: service.price_range_max ?? null,
    })
    const rangeMin = Number(service.price_range_min ?? catalogPrice)
    setEditAddedMainBlocks((prev) => [...prev, {
      tmp_id: `added-${service.id}-${Math.random()}`,
      service_id: service.id,
      service_name: service.name,
      service_cn_name: service.cn_name ?? null,
      price: isRange ? 0 : catalogPrice,
      reference_unit_price: isRange ? rangeMin : catalogPrice,
      price_mode: service.price_mode ?? null,
      price_range_min: service.price_range_min ?? null,
      price_range_max: service.price_range_max ?? null,
      price_finalized: isRange ? false : (catalogPrice > 0.0001 ? true : null),
      duration_min: Number(service.duration_min ?? 0),
      addon_questions: questions,
      selected_addon_ids: {},
      addon_price_overrides: {},
      addon_line_total_overrides: {},
      staff_splits: [{ staff_id: null, share_percent: '100', share_amount: '0.00' }],
      split_mode: 'percent' as StaffSplitMode,
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
      const rebalanced = block.auto_balance ? rebalanceEditAddedMainBlockSplits(next, block) : next
      return { ...block, staff_splits: rebalanced }
    }))
  }, [rebalanceEditAddedMainBlockSplits])

  const updateEditAddedMainSplitShare = useCallback((tmpId: string, index: number, value: string) => {
    setEditAddedMainBlocks((prev) => prev.map((block) => {
      if (block.tmp_id !== tmpId) return block
      const next = block.staff_splits.map((row, rowIdx) => (rowIdx === index ? { ...row, share_percent: value } : row))
      if (!block.auto_balance || index === 0) return { ...block, staff_splits: next }
      return { ...block, staff_splits: rebalanceEditAddedMainBlockSplits(next, block) }
    }))
  }, [rebalanceEditAddedMainBlockSplits])

  const updateEditAddedMainSplitAmount = useCallback((tmpId: string, index: number, value: string) => {
    setEditAddedMainBlocks((prev) => prev.map((block) => {
      if (block.tmp_id !== tmpId) return block
      const next = block.staff_splits.map((row, rowIdx) => (rowIdx === index ? { ...row, share_amount: value } : row))
      if (!block.auto_balance || index === 0) return { ...block, staff_splits: next }
      return { ...block, staff_splits: rebalanceSettlementInlineStaffRows(next, 'amount', resolveEditAddedMainBlockLineTotal(block), true) }
    }))
  }, [resolveEditAddedMainBlockLineTotal])

  const updateEditAddedMainSplitMode = useCallback((tmpId: string, mode: StaffSplitMode) => {
    setEditAddedMainBlocks((prev) => prev.map((block) => {
      if (block.tmp_id !== tmpId) return block
      const lineTotal = resolveEditAddedMainBlockLineTotal(block)
      const nextMode = mode === 'amount' && lineTotal == null ? 'percent' : mode
      const nextSplits = nextMode === 'amount' && lineTotal != null
        ? block.staff_splits.map((row, index) => ({
            ...row,
            share_amount: percentsToAmounts(
              block.staff_splits.map((item) => Number.parseInt(item.share_percent || '0', 10)),
              lineTotal,
            )[index]?.toFixed(2) ?? row.share_amount,
          }))
        : block.staff_splits
      return {
        ...block,
        split_mode: nextMode,
        staff_splits: block.auto_balance ? rebalanceEditAddedMainBlockSplits(nextSplits, { ...block, split_mode: nextMode }) : nextSplits,
      }
    }))
  }, [rebalanceEditAddedMainBlockSplits, resolveEditAddedMainBlockLineTotal])

  const toggleEditAddedMainAutoBalance = useCallback((tmpId: string, enabled: boolean) => {
    setEditAddedMainBlocks((prev) => prev.map((block) => {
      if (block.tmp_id !== tmpId) return block
      const nextSplits = enabled ? rebalanceEditAddedMainBlockSplits(block.staff_splits, block) : block.staff_splits
      return { ...block, auto_balance: enabled, staff_splits: nextSplits }
    }))
  }, [rebalanceEditAddedMainBlockSplits])

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
    reportEditSettlementError(null)
    setEditStaffSplits((prev) => {
      const next = prev.map((row, rowIdx) => (rowIdx === index ? { ...row, share_percent: value } : row))
      if (!editStaffSplitAutoBalance || index === 0) return next
      return rebalanceEditSettlementPrimaryShare(next)
    })
  }, [editStaffSplitAutoBalance, rebalanceEditSettlementPrimaryShare])

  const removeEditSettlementSplitRow = useCallback((index: number) => {
    reportEditSettlementError(null)
    setEditStaffSplits((prev) => {
      const next = prev.filter((_, rowIdx) => rowIdx !== index)
      if (!editStaffSplitAutoBalance) return next
      return rebalanceEditSettlementPrimaryShare(next)
    })
  }, [editStaffSplitAutoBalance, rebalanceEditSettlementPrimaryShare])

  const updateEditSettlementSplitAmount = useCallback((index: number, value: string) => {
    reportEditSettlementError(null)
    setEditStaffSplits((prev) => {
      const next = prev.map((row, rowIdx) => (rowIdx === index ? { ...row, share_amount: value } : row))
      if (!editStaffSplitAutoBalance || index === 0) return next
      return rebalanceSettlementInlineStaffRows(next, 'amount', editOriginalLineTotal, true)
    })
  }, [editOriginalLineTotal, editStaffSplitAutoBalance, reportEditSettlementError])

  const submitEditSettlementPayload = useCallback(async (payload: Record<string, unknown>) => {
    if (!appointmentDetail?.id) return

    const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/edit-settlement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      reportEditSettlementError(json?.message ?? 'Failed to update settlement.')
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
    const warnings = Array.isArray(json?.data?.policy_warnings)
      ? json.data.policy_warnings.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
    showMsg(warnings.length ? 'Settlement updated with schedule override warning.' : 'Settlement updated.', 'success')
    setEditSettlementNoteDraft('')
    setEditSettlementOpen(false)
    setPrimaryStaffChangePrompt(null)
    setPendingEditSettlementPayload(null)
    await refreshOpenedAppointmentDetail()
    await fetchAppointments({ silent: true })
  }, [appointmentDetail?.id, fetchAppointments, refreshOpenedAppointmentDetail, reportEditSettlementError, showMsg])

  const saveEditSettlement = useCallback(async () => {
    if (!appointmentDetail?.id) return
    reportEditSettlementError(null)
    const isCompletedAppointment = String(appointmentDetail?.status ?? '').toUpperCase() === 'COMPLETED'
    const draftPrimaryStaffId = resolvePrimaryStaffIdFromSplits(editStaffSplits)
    const primaryStaffUnchanged = draftPrimaryStaffId === editSettlementOriginalPrimaryStaffId
    if (!isCompletedAppointment && primaryStaffUnchanged && editSettlementAvailability?.is_hard_block) {
      reportEditSettlementError(formatPosAvailabilityErrorMessage({
        reasonCode: String(editSettlementAvailability.reason_code ?? 'booking_conflict'),
        staffName: appointmentDetail.staff?.name ?? activeStaffs.find((staff) => staff.id === appointmentDetail.staff?.id)?.name,
        startAt: appointmentDetail.appointment_start_at,
        endAt: appointmentDetail.appointment_end_at,
      }))
      return
    }
    setEditSettlementLoading(true)
    try {
      const needsSettledAmount = settlementNeedsSettledAmount(editOriginalSettlementSource)
      let settledServiceAmount: number | undefined
      if (needsSettledAmount) {
        const settledValidation = validateSettlementAmountInput(editSettledAmount, editOriginalSettlementSource)
        if (!settledValidation.ok) {
          reportEditSettlementError(settledValidation.message)
          return
        }
        settledServiceAmount = settledValidation.amount
      }
      const normalizedResult = mapSettlementInlineStaffRowsForApi(editStaffSplits, editStaffSplitMode, editOriginalLineTotal)
      if (!normalizedResult.valid) {
        reportEditSettlementError(normalizedResult.error ?? 'Invalid staff split.')
        return
      }
      const normalizedSplits = normalizedResult.splits
      const blockStaffSplitsByTmpId = new Map<string, ReturnType<typeof serializeStaffSplitForApi>[]>()
      for (const block of editAddedMainBlocks) {
        const blockLineTotal = Number(block.price ?? 0) > 0.0001 ? roundMoney(Number(block.price)) : null
        const blockResult = mapSettlementInlineStaffRowsForApi(block.staff_splits, block.split_mode, blockLineTotal)
        if (!blockResult.valid) {
          reportEditSettlementError(blockResult.error ?? `Staff split for ${block.service_name} must be valid.`)
          return
        }
        blockStaffSplitsByTmpId.set(block.tmp_id, blockResult.splits)
      }

      const originalAddonIds = getSelectedAddonIds(editAddonQuantities)
      const originalAddonOverrides = buildAddonSettlementSaveOverrides(
        originalAddonIds,
        editAddonQuantities,
        editAddonPriceOverrides,
        editAddonLineTotalOverrides,
      )
      const payload: Record<string, unknown> = {
        addon_option_ids: originalAddonIds,
        addon_quantities: buildAddonQuantitiesPayload(editAddonQuantities),
        addon_price_overrides: originalAddonOverrides.addon_price_overrides,
        addon_line_total_overrides: originalAddonOverrides.addon_line_total_overrides,
        availability_override: true,
        availability_override_type: 'outside_staff_schedule',
        availability_override_reason: null,
        addon_staff_splits: Object.fromEntries(getSelectedAddonIds(editAddonQuantities).map((id) => [id, appointmentLineStaffSplits[`appointment-settlement:${appointmentDetail.id}:addon:${id}`] ?? []])),
        main_service_ids: editAddedMainBlocks.map((block) => block.service_id),
        main_service_items: editAddedMainBlocks.map((block) => {
          const blockAddonIds = getSelectedAddonIds(block.selected_addon_ids)
          const blockAddonOverrides = buildAddonSettlementSaveOverrides(
            blockAddonIds,
            block.selected_addon_ids,
            block.addon_price_overrides,
            block.addon_line_total_overrides,
          )
          return {
          booking_service_id: block.service_id,
          price: block.price,
          price_finalized: Boolean(block.price_finalized),
          addon_option_ids: blockAddonIds,
          addon_quantities: buildAddonQuantitiesPayload(block.selected_addon_ids),
          addon_price_overrides: blockAddonOverrides.addon_price_overrides,
          addon_line_total_overrides: blockAddonOverrides.addon_line_total_overrides,
          addon_staff_splits: Object.fromEntries(blockAddonIds.map((id) => [id, appointmentLineStaffSplits[`appointment-settlement:${appointmentDetail.id}:block:${block.tmp_id}:addon:${id}`] ?? []])),
          staff_splits: blockStaffSplitsByTmpId.get(block.tmp_id) ?? [],
        }}),
      }
      const originalServiceId = Number(editOriginalService?.id ?? appointmentDetail.service?.id ?? 0)
      if (originalServiceId > 0 && originalServiceId !== Number(appointmentDetail.service?.id ?? 0)) {
        payload.booking_service_id = originalServiceId
      }
      if (editOriginalServicePriceOverride != null && !needsSettledAmount) {
        payload.original_service_price = editOriginalServicePriceOverride
      }
      if (needsSettledAmount && settledServiceAmount != null) {
        payload.settled_service_amount = settledServiceAmount
      }
      payload.staff_splits = normalizedSplits

      const staffNameById = createStaffNameResolver(activeStaffs, { fallbackStaff: appointmentDetail.staff })
      const availabilityCheck = await verifyEditSettlementPrimaryStaffAvailability({
        nextSplits: normalizedSplits,
        startAt: appointmentDetail.appointment_start_at,
        endAt: appointmentDetail.appointment_end_at,
        ignoreBookingId: appointmentDetail.id,
        verifyMode: posAvailabilityVerifyMode,
        staffNameById,
      })
      if (!availabilityCheck.ok) {
        reportEditSettlementError(availabilityCheck.message)
        return
      }

      const staffChangePrompt = buildEditSettlementPrimaryStaffChangePrompt({
        originalStaffId: editSettlementOriginalPrimaryStaffId,
        nextSplits: normalizedSplits,
        staffNameById,
      })
      if (staffChangePrompt) {
        payload.settlement_note = editSettlementNoteDraft.trim()

        const phonePattern = /^\+?[0-9]{8,15}$/
        if (editSettlementIdentityMode === 'member') {
          if (!editSettlementCustomerId) {
            reportEditSettlementError('Please assign a member.')
            return
          }
          payload.customer_id = editSettlementCustomerId
        } else {
          const guestName = editSettlementGuestName.trim()
          const guestPhone = normalizeInternationalPhone(editSettlementGuestPhone)
          const guestEmail = editSettlementGuestEmail.trim()
          if (guestPhone && !phonePattern.test(guestPhone)) {
            reportEditSettlementError('Please enter a valid guest phone number (8-15 digits, optional + prefix).')
            return
          }
          payload.customer_id = null
          payload.guest_name = guestName || 'UNKNOWN'
          payload.guest_phone = guestPhone || null
          payload.guest_email = guestEmail || null
        }

        setPrimaryStaffChangePrompt(staffChangePrompt)
        setPendingEditSettlementPayload(payload)
        return
      }

      payload.settlement_note = editSettlementNoteDraft.trim()

      const phonePattern = /^\+?[0-9]{8,15}$/
      if (editSettlementIdentityMode === 'member') {
        if (!editSettlementCustomerId) {
          reportEditSettlementError('Please assign a member.')
          return
        }
        payload.customer_id = editSettlementCustomerId
      } else {
        const guestName = editSettlementGuestName.trim()
        const guestPhone = normalizeInternationalPhone(editSettlementGuestPhone)
        const guestEmail = editSettlementGuestEmail.trim()
        if (guestPhone && !phonePattern.test(guestPhone)) {
          reportEditSettlementError('Please enter a valid guest phone number (8-15 digits, optional + prefix).')
          return
        }
        payload.customer_id = null
        payload.guest_name = guestName || 'UNKNOWN'
        payload.guest_phone = guestPhone || null
        payload.guest_email = guestEmail || null
      }

      await submitEditSettlementPayload(payload)
    } finally {
      setEditSettlementLoading(false)
    }
  }, [appointmentDetail, appointmentLineStaffSplits, editAddedMainBlocks, editOriginalService, editOriginalSettlementSource, editAddonQuantities, editSettledAmount, editStaffSplits, editStaffSplitMode, editOriginalLineTotal, editSettlementOriginalPrimaryStaffId, editAddonPriceOverrides, editAddonLineTotalOverrides, editOriginalServicePriceOverride, editSettlementAvailability, editSettlementCustomerId, editSettlementGuestEmail, editSettlementGuestName, editSettlementGuestPhone, editSettlementIdentityMode, editSettlementNoteDraft, posAvailabilityVerifyMode, activeStaffs, fetchAppointments, reportEditSettlementError, submitEditSettlementPayload])

  const confirmPrimaryStaffChangeForEditSettlement = useCallback(async () => {
    if (!pendingEditSettlementPayload) return
    setEditSettlementLoading(true)
    try {
      await submitEditSettlementPayload(pendingEditSettlementPayload)
    } finally {
      setEditSettlementLoading(false)
    }
  }, [pendingEditSettlementPayload, submitEditSettlementPayload])


  const openAppointmentPriceEditModal = useCallback((target: AppointmentPriceEditTarget) => {
    const qty = resolvePriceEditQuantity(target.quantity)
    const unit = Math.max(0, Number(target.currentUnitPrice ?? 0))
    const addonTarget = getAppointmentAddonPriceEditTarget(target)
    const hasLineTotalOverrideKey = Boolean(addonTarget?.hasLineTotalOverrideKey)
    const lineTotalOverride = hasLineTotalOverrideKey ? Number(addonTarget?.lineTotalOverride ?? 0) : null
    setAppointmentPriceEditTarget({ ...target, quantity: qty })
    setAppointmentPriceEditMode('unit')
    const hasFinalPrice = !target.priceSource || posPriceDisplayHasFinalPrice(target.priceSource)
    setAppointmentPriceEditValueDraft(hasFinalPrice ? unit.toFixed(2) : '')
    setAppointmentPriceEditLineTotalDraft(
      hasFinalPrice
        ? (hasLineTotalOverrideKey && lineTotalOverride != null
          ? lineTotalOverride.toFixed(2)
          : (unit * qty).toFixed(2))
        : '',
    )
    setAppointmentPriceEditReasonDraft('')
  }, [])

  const submitAppointmentPriceEditModal = useCallback(() => {
    if (!appointmentPriceEditTarget) return
    const reportPriceEditError = (message: string | null) => {
      if (appointmentPriceEditTarget.kind === 'createMainAddon' || appointmentPriceEditTarget.kind === 'createBlockAddon') {
        reportCreateAppointmentError(message)
      } else {
        reportEditSettlementError(message)
      }
    }
    const rawValue = appointmentPriceEditMode === 'line' ? appointmentPriceEditLineTotalDraft : appointmentPriceEditValueDraft
    const amount = parseSettlementAmountInput(rawValue)
    if (amount == null) {
      reportPriceEditError(appointmentPriceEditMode === 'line' ? 'Please enter a valid line total.' : 'Please enter a valid unit price.')
      return
    }
    const qty = appointmentPriceEditTarget.kind === 'originalAddon'
      ? resolvePriceEditQuantity(getAddonQuantity(editAddonQuantities, appointmentPriceEditTarget.optionId))
      : appointmentPriceEditTarget.kind === 'addedAddon'
        ? resolvePriceEditQuantity(getAddonQuantity(
          editAddedMainBlocks.find((block) => block.tmp_id === appointmentPriceEditTarget.tmpId)?.selected_addon_ids ?? {},
          appointmentPriceEditTarget.optionId,
        ))
        : appointmentPriceEditTarget.kind === 'createMainAddon'
          ? resolvePriceEditQuantity(getAddonQuantity(createAppointmentAddonQuantities, appointmentPriceEditTarget.optionId))
          : appointmentPriceEditTarget.kind === 'createBlockAddon'
            ? resolvePriceEditQuantity(getAddonQuantity(
              createAppointmentExtraServiceBlocks.find((block) => block.id === appointmentPriceEditTarget.blockId)?.addonQuantities ?? {},
              appointmentPriceEditTarget.optionId,
            ))
            : resolvePriceEditQuantity(appointmentPriceEditTarget.quantity)
    const unitPrice = appointmentPriceEditMode === 'line' ? amount / qty : amount
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      reportPriceEditError('Price cannot be negative.')
      return
    }
    const rounded = Number(unitPrice.toFixed(2))
    const roundedLineTotal = appointmentPriceEditMode === 'line' ? Number(amount.toFixed(2)) : null
    if (appointmentPriceEditTarget.kind === 'originalService') {
      setEditOriginalServicePriceOverride(rounded)
      if (settlementNeedsSettledAmount(editOriginalSettlementSource)) {
        setEditSettledAmount(rounded.toFixed(2))
      }
    } else if (appointmentPriceEditTarget.kind === 'originalAddon') {
      setEditAddonPriceOverrides((prev) => ({ ...prev, [appointmentPriceEditTarget.optionId]: rounded }))
      setEditAddonLineTotalOverrides((prev) => {
        const next = { ...prev }
        if (roundedLineTotal != null) next[appointmentPriceEditTarget.optionId] = roundedLineTotal
        else delete next[appointmentPriceEditTarget.optionId]
        return next
      })
    } else if (appointmentPriceEditTarget.kind === 'addedService') {
      setEditAddedMainBlocks((prev) => prev.map((block) => block.tmp_id === appointmentPriceEditTarget.tmpId ? { ...block, price: rounded, price_finalized: true } : block))
    } else if (appointmentPriceEditTarget.kind === 'addedAddon') {
      setEditAddedMainBlocks((prev) => prev.map((block) => block.tmp_id === appointmentPriceEditTarget.tmpId ? {
        ...block,
        addon_price_overrides: { ...block.addon_price_overrides, [appointmentPriceEditTarget.optionId]: rounded },
        addon_line_total_overrides: (() => {
          const next = { ...block.addon_line_total_overrides }
          if (roundedLineTotal != null) next[appointmentPriceEditTarget.optionId] = roundedLineTotal
          else delete next[appointmentPriceEditTarget.optionId]
          return next
        })(),
      } : block))
    } else if (appointmentPriceEditTarget.kind === 'createMainAddon') {
      setCreateAppointmentAddonPriceOverrides((prev) => ({ ...prev, [appointmentPriceEditTarget.optionId]: rounded }))
      setCreateAppointmentAddonLineTotalOverrides((prev) => {
        const next = { ...prev }
        if (roundedLineTotal != null) next[appointmentPriceEditTarget.optionId] = roundedLineTotal
        else delete next[appointmentPriceEditTarget.optionId]
        return next
      })
    } else if (appointmentPriceEditTarget.kind === 'createBlockAddon') {
      setCreateAppointmentExtraServiceBlocks((prev) => prev.map((block) => block.id === appointmentPriceEditTarget.blockId ? {
        ...block,
        addon_price_overrides: { ...block.addon_price_overrides, [appointmentPriceEditTarget.optionId]: rounded },
        addon_line_total_overrides: (() => {
          const next = { ...block.addon_line_total_overrides }
          if (roundedLineTotal != null) next[appointmentPriceEditTarget.optionId] = roundedLineTotal
          else delete next[appointmentPriceEditTarget.optionId]
          return next
        })(),
      } : block))
    }
    reportPriceEditError(null)
    setAppointmentPriceEditTarget(null)
  }, [appointmentPriceEditLineTotalDraft, appointmentPriceEditMode, appointmentPriceEditTarget, appointmentPriceEditValueDraft, createAppointmentAddonQuantities, createAppointmentExtraServiceBlocks, editAddedMainBlocks, editAddonQuantities, editOriginalSettlementSource, reportCreateAppointmentError, reportEditSettlementError])

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
      await fetchAppointments({ silent: true })
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
      await fetchAppointments({ silent: true })
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
      await fetchAppointments({ silent: true })
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
    async (status: AppointmentTerminalStatusAction, voidDeposit = false) => {
      if (!appointmentDetail?.id) return
      setAppointmentActionLoading(true)
      try {
        const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, void_deposit: voidDeposit }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          showMsg(json?.message ?? 'Unable to update status.', 'error')
          return
        }
        showMsg(
          typeof json?.message === 'string' && json.message.trim()
            ? json.message
            : voidDeposit
              ? 'Appointment status updated and deposit receipt(s) voided.'
              : 'Appointment status updated.',
          'success',
        )
        setAppointmentStatusConfirmOpen(false)
        setAppointmentStatusConfirmTarget(null)
        setAppointmentStatusVoidDeposit(false)
        await fetchAppointments({ silent: true })
        await refreshOpenedAppointmentDetail()
      } finally {
        setAppointmentActionLoading(false)
      }
    },
    [appointmentDetail?.id, fetchAppointments, refreshOpenedAppointmentDetail, showMsg],
  )

  const requestAppointmentStatusUpdate = useCallback(
    (status: AppointmentTerminalStatusAction) => {
      const hasActiveDeposit = (appointmentDetail?.deposit_transactions ?? []).some(
        (tx) => Number(tx.amount ?? 0) > 0.0001,
      )
      if (hasActiveDeposit) {
        setAppointmentStatusVoidDeposit(false)
        setAppointmentStatusConfirmTarget(status)
        setAppointmentStatusConfirmOpen(true)
        return
      }
      void updateAppointmentStatus(status, false)
    },
    [appointmentDetail?.deposit_transactions, updateAppointmentStatus],
  )

  const approveHoldAppointment = useCallback(async () => {
    if (!appointmentDetail?.id) return
    setAppointmentActionLoading(true)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/approve-hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_note: holdReviewNote.trim() || null }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to approve booking.', 'error')
        return
      }
      setHoldApproveConfirmOpen(false)
      setHoldReviewNote('')
      showMsg('Booking approved and confirmed.', 'success')
      await fetchAppointments({ silent: true })
      await refreshOpenedAppointmentDetail()
    } finally {
      setAppointmentActionLoading(false)
    }
  }, [appointmentDetail?.id, fetchAppointments, holdReviewNote, refreshOpenedAppointmentDetail, showMsg])

  const cancelHoldAppointment = useCallback(async () => {
    if (!appointmentDetail?.id) return
    setAppointmentActionLoading(true)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/cancel-hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: holdCancelReason.trim() || null }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to cancel hold booking.', 'error')
        return
      }
      setHoldCancelConfirmOpen(false)
      setHoldCancelReason('')
      showMsg('Hold booking cancelled.', 'success')
      await fetchAppointments({ silent: true })
      await refreshOpenedAppointmentDetail()
    } finally {
      setAppointmentActionLoading(false)
    }
  }, [appointmentDetail?.id, fetchAppointments, holdCancelReason, refreshOpenedAppointmentDetail, showMsg])

  const rejectHoldPaymentProof = useCallback(async () => {
    if (!appointmentDetail?.id) return
    const note = holdRejectNote.trim()
    if (!note) {
      showMsg('Please enter a reason for rejecting the payment proof.', 'error')
      return
    }
    setAppointmentActionLoading(true)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${appointmentDetail.id}/reject-hold-payment-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_note: note }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to reject payment proof.', 'error')
        return
      }
      setHoldRejectConfirmOpen(false)
      setHoldRejectNote('')
      showMsg('Payment proof rejected. Customer can upload again.', 'success')
      await fetchAppointments({ silent: true })
      await refreshOpenedAppointmentDetail()
    } finally {
      setAppointmentActionLoading(false)
    }
  }, [appointmentDetail?.id, fetchAppointments, holdRejectNote, refreshOpenedAppointmentDetail, showMsg])

  const openAppointmentRescheduleModal = useCallback(() => {
    if (!appointmentDetail) return
    setAppointmentReschedulePolicyWarnings([])
    setAppointmentRescheduleStaffId(appointmentDetail.staff?.id ?? null)
    const currentStartAt = appointmentDetail.appointment_start_at ? new Date(appointmentDetail.appointment_start_at) : null
    setAppointmentRescheduleDate(currentStartAt ? currentStartAt.toISOString().slice(0, 10) : '')
    setAppointmentRescheduleSlotValue('')
    setAppointmentRescheduleReason('')
    setAppointmentRescheduleSlots([])
    setAppointmentRescheduleError(null)
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
    if (appointmentRescheduleSelectedSlot?.unavailable_reason && posAvailabilityShouldHardBlock(appointmentRescheduleSelectedSlot.unavailable_reason, posAvailabilityVerifyMode)) {
      showMsg(formatPosAvailabilityErrorMessage({
        reasonCode: appointmentRescheduleSelectedSlot.unavailable_reason,
        staffName: activeStaffs.find((staff) => staff.id === appointmentRescheduleStaffId)?.name,
        startAt: appointmentRescheduleSlotValue,
        endAt: appointmentRescheduleSelectedSlot.end_at,
      }), 'error')
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
          availability_override: true,
          availability_override_reason: null,
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
      setEditSettlementOpen(false)
      setAppointmentLineStaffSplits((prev) => {
        const prefix = `appointment-settlement:${appointmentDetail.id}:`
        const next: typeof prev = {}
        for (const [key, value] of Object.entries(prev)) {
          if (!key.startsWith(prefix)) next[key] = value
        }
        return next
      })
      await fetchAppointments({ silent: true })
      await openAppointmentDetail(appointmentDetail.id)
    } finally {
      setAppointmentRescheduleSubmitting(false)
    }
  }, [
    appointmentDetail?.id,
    appointmentRescheduleDate,
    appointmentRescheduleReason,
    appointmentRescheduleSelectedSlot,
    appointmentRescheduleSlotValue,
    appointmentRescheduleStaffId,
    fetchAppointments,
    openAppointmentDetail,
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
        const durationMin = durationMinutesFromRange(appointmentDetail.appointment_start_at, appointmentDetail.appointment_end_at)
          || Number(appointmentDetail.estimated_duration_min ?? 0)
          || Number(appointmentDetail.service?.duration_min ?? 0)
          || POS_SLOT_INTERVAL_MIN
        const extraDurationMin = Math.max(0, durationMin - Number(appointmentDetail.service?.duration_min ?? 0))
        const params = new URLSearchParams({
          service_id: String(appointmentDetail.service.id),
          date: appointmentRescheduleDate,
          extra_duration_min: String(extraDurationMin),
          ignore_booking_id: String(appointmentDetail.id),
        })
        const res = await fetch(`/api/proxy/pos/availability/pooled?${params.toString()}`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (json?.data?.verify_mode != null) {
          setPosAvailabilityVerifyMode(parsePosAvailabilityVerifyMode(json.data.verify_mode))
        }
        const rows: unknown[] = Array.isArray(json?.data?.visible_slots)
          ? json.data.visible_slots
          : (Array.isArray(json?.data?.slots) ? json.data.slots : [])
        const slotMeta = rows
          .map((row: unknown) => {
            if (!row || typeof row !== 'object') return null
            const maybe = row as Record<string, unknown>
            const startAt = String(maybe.start_at ?? '')
            const endAt = String(maybe.end_at ?? '')
            if (!startAt || !endAt) return null
            const scheduledStaffIds = Array.isArray(maybe.scheduled_staff_ids)
              ? (maybe.scheduled_staff_ids as unknown[]).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
              : []
            const unavailableReasons = maybe.unavailable_staff_reasons && typeof maybe.unavailable_staff_reasons === 'object'
              ? (maybe.unavailable_staff_reasons as Record<string, unknown>)
              : {}
            return {
              start_at: startAt,
              end_at: endAt,
              is_in_schedule: scheduledStaffIds.includes(appointmentRescheduleStaffId),
              unavailable_reason: String(unavailableReasons[String(appointmentRescheduleStaffId)] ?? ''),
            }
          })
          .filter((row): row is { start_at: string; end_at: string; is_in_schedule: boolean; unavailable_reason: string } => Boolean(row))
        const metaByStart = new Map(slotMeta.map((slot) => [slot.start_at, slot]))
        const fullDaySlots = buildPosAppointmentSlots(appointmentRescheduleDate, durationMin, POS_SLOT_INTERVAL_MIN)
          .map((slot) => {
            const meta = metaByStart.get(slot.start_at)
            return { ...slot, is_in_schedule: meta?.is_in_schedule ?? false, unavailable_reason: meta?.unavailable_reason ?? '' }
          })

        setAppointmentRescheduleSlots(fullDaySlots)
        setAppointmentRescheduleSlotValue((prev) => (fullDaySlots.some((slot) => slot.start_at === prev) ? prev : ''))
      } finally {
        setAppointmentRescheduleSlotsLoading(false)
      }
    }

    void loadRescheduleSlots()
  }, [
    appointmentDetail?.appointment_end_at,
    appointmentDetail?.appointment_start_at,
    appointmentDetail?.estimated_duration_min,
    appointmentDetail?.id,
    appointmentDetail?.service?.duration_min,
    appointmentDetail?.service?.id,
    appointmentRescheduleDate,
    appointmentRescheduleOpen,
    appointmentRescheduleStaffId,
  ])

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
        if (json?.data?.verify_mode != null) {
          setPosAvailabilityVerifyMode(parsePosAvailabilityVerifyMode(json.data.verify_mode))
        }
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
            const scheduledStaffIds = Array.isArray(maybe.scheduled_staff_ids)
              ? (maybe.scheduled_staff_ids as unknown[]).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
              : undefined
            const unavailableStaffReasons = maybe.unavailable_staff_reasons && typeof maybe.unavailable_staff_reasons === 'object'
              ? Object.fromEntries(Object.entries(maybe.unavailable_staff_reasons as Record<string, unknown>).map(([id, reason]) => [id, String(reason ?? '')]))
              : undefined
            return { start_at: startAt, end_at: endAt, available_staff_ids: staffIds, scheduled_staff_ids: scheduledStaffIds, unavailable_staff_reasons: unavailableStaffReasons } as {
              start_at: string
              end_at: string
              available_staff_ids?: number[]
            }
          })
          .filter((row): row is { start_at: string; end_at: string; available_staff_ids?: number[]; scheduled_staff_ids?: number[]; unavailable_staff_reasons?: Record<string, string> } => row !== null)
        const slotByStart = new Map(slots.map((slot) => [slot.start_at, slot]))
        const fullDaySlots = buildPosAppointmentSlots(
          createAppointmentDate,
          Math.max(
            1,
            Number(createAppointmentServiceDraft?.duration_min ?? 0) +
            (createAppointmentAddonDurationTotal || 0) +
            createAppointmentExtraTotals.baseDuration +
            createAppointmentExtraTotals.addonDuration,
          ),
        ).map((slot) => ({ ...slot, available_staff_ids: slotByStart.get(slot.start_at)?.available_staff_ids ?? [], scheduled_staff_ids: slotByStart.get(slot.start_at)?.scheduled_staff_ids ?? [], unavailable_staff_reasons: slotByStart.get(slot.start_at)?.unavailable_staff_reasons ?? {} }))

        setCreateAppointmentSlots(fullDaySlots)
        setCreateAppointmentSlotValue((prev) => (fullDaySlots.some((slot) => slot.start_at === prev) ? prev : ''))
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
    createAppointmentServiceDraft?.duration_min,
    createAppointmentServiceDraft?.id,
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
    scheduleScope,
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
    scheduleScope,
  ])

  useEffect(() => {
    if (!appointmentListAutoRefresh) return
    const id = window.setInterval(() => {
      setAppointmentListRefreshCountdown((c) => {
        if (c <= 1) {
          void fetchAppointments({ silent: true })
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

  const scheduleAppointments = useMemo(
    () => appointments.filter((row) => posAppointmentShowOnScheduleCalendar(row, scheduleScope)),
    [appointments, scheduleScope],
  )

  const onSelectAppointmentQrProof: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (appointmentQrProofPreviewUrl) {
      URL.revokeObjectURL(appointmentQrProofPreviewUrl)
    }
    const url = URL.createObjectURL(file)
    setAppointmentQrProofFile(file)
    reportAppointmentCheckoutError(null)
    setAppointmentQrProofFileName(file.name)
    setAppointmentQrProofPreviewUrl(url)
    event.currentTarget.value = ''
  }

  const clearAppointmentQrProof = () => {
    if (appointmentQrProofPreviewUrl) {
      URL.revokeObjectURL(appointmentQrProofPreviewUrl)
    }
    reportAppointmentCheckoutError(null)
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
    if (contribution > 0.0001) return contribution
    if (appointmentDetail?.deposit_previously_collected) {
      return Number(appointmentDetail?.deposit_previously_collected_amount ?? 0)
    }
    return 0
  }, [
    appointmentDetail?.deposit_contribution,
    appointmentDetail?.deposit_paid,
    appointmentDetail?.deposit_previously_collected,
    appointmentDetail?.deposit_previously_collected_amount,
  ])

  const appointmentPreviouslyCollectedDeposit = useMemo(() => {
    const wasCollected = Boolean(appointmentDetail?.deposit_previously_collected)
    const amount = Number(appointmentDetail?.deposit_previously_collected_amount ?? 0)
    return appointmentIsFullyPackageCovered && wasCollected ? amount : 0
  }, [appointmentDetail?.deposit_previously_collected, appointmentDetail?.deposit_previously_collected_amount, appointmentIsFullyPackageCovered])

  const appointmentAddonBoundsForBreakdown = useMemo(
    () => accumulatePosPriceBounds((appointmentDetail?.add_ons ?? []).map((addon) => ({ source: addon }))),
    [appointmentDetail?.add_ons],
  )

  const editSettlementLiveAddonBounds = useMemo(() => {
    const hasPendingLineOverrides = Object.keys(editAddonLineTotalOverrides).length > 0
    if (!editSettlementOpen && !hasPendingLineOverrides) return null
    const originalOptions = editAddonQuestions.flatMap((question) => question.options)
    const selectedOriginal = originalOptions.filter((option) => isAddonSelected(editAddonQuantities, option.id))
    const originalBounds = accumulatePosPriceBounds(
      selectedOriginal.map((option) => ({
        source: { ...option, quantity: getAddonQuantity(editAddonQuantities, option.id) },
        overrideAmount: editAddonPriceOverrides[option.id],
        hasOverrideKey: Object.prototype.hasOwnProperty.call(editAddonPriceOverrides, option.id),
        lineTotalOverride: editAddonLineTotalOverrides[option.id],
        hasLineTotalOverrideKey: Object.prototype.hasOwnProperty.call(editAddonLineTotalOverrides, option.id),
      })),
    )
    const addedBounds = editAddedMainBlocks.reduce(
      (acc, block) => {
        const blockOptions = block.addon_questions.flatMap((question) => question.options)
        const selectedBlockAddons = blockOptions.filter((option) => isAddonSelected(block.selected_addon_ids, option.id))
        const blockBounds = accumulatePosPriceBounds(
          selectedBlockAddons.map((option) => ({
            source: { ...option, quantity: getAddonQuantity(block.selected_addon_ids, option.id) },
            overrideAmount: block.addon_price_overrides[option.id],
            hasOverrideKey: Object.prototype.hasOwnProperty.call(block.addon_price_overrides, option.id),
            lineTotalOverride: block.addon_line_total_overrides[option.id],
            hasLineTotalOverrideKey: Object.prototype.hasOwnProperty.call(block.addon_line_total_overrides, option.id),
          })),
        )
        return {
          min: acc.min + blockBounds.min,
          max: acc.max + blockBounds.max,
          hasRange: acc.hasRange || blockBounds.hasRange,
        }
      },
      { min: 0, max: 0, hasRange: false },
    )
    return {
      min: originalBounds.min + addedBounds.min,
      max: originalBounds.max + addedBounds.max,
      hasRange: originalBounds.hasRange || addedBounds.hasRange,
    }
  }, [editAddedMainBlocks, editAddonLineTotalOverrides, editAddonPriceOverrides, editAddonQuantities, editAddonQuestions, editSettlementOpen])

  const displayAppointmentAddonBounds = editSettlementLiveAddonBounds ?? appointmentAddonBoundsForBreakdown

  const appointmentAddonTotal = useMemo(() => {
    if (editSettlementLiveAddonBounds) {
      return editSettlementLiveAddonBounds.hasRange
        ? editSettlementLiveAddonBounds.max
        : editSettlementLiveAddonBounds.min
    }
    if (!appointmentDetail) return 0
    if (appointmentDetail.addon_total_price != null && appointmentDetail.addon_total_price !== undefined) {
      return Number(appointmentDetail.addon_total_price)
    }
    return (appointmentDetail.add_ons ?? []).reduce((sum, a) => sum + storedAddonLinePrice(a), 0)
  }, [appointmentDetail, editSettlementLiveAddonBounds])

  const appointmentServiceAmount = useMemo(
    () => Number(appointmentDetail?.service_total ?? 0),
    [appointmentDetail?.service_total],
  )

  const appointmentServiceValueBounds = useMemo(() => {
    if (appointmentDisplayMainServices.length === 0) {
      if (appointmentDetail?.is_range_priced && appointmentDetail.settled_service_amount == null) {
        return {
          min: Number(appointmentDetail.service?.price_range_min ?? 0),
          max: Number(appointmentDetail.service?.price_range_max ?? 0),
          hasRange: true,
        }
      }
      return { min: appointmentServiceAmount, max: appointmentServiceAmount, hasRange: false }
    }

    return accumulatePosPriceBounds(
      appointmentDisplayMainServices.map((service, idx) => ({
        source: buildAppointmentMainServicePriceSource(service, idx),
      })),
    )
  }, [
    appointmentDetail?.is_range_priced,
    appointmentDetail?.service?.price_range_max,
    appointmentDetail?.service?.price_range_min,
    appointmentDetail?.settled_service_amount,
    appointmentDisplayMainServices,
    appointmentServiceAmount,
    buildAppointmentMainServicePriceSource,
  ])

  const appointmentServiceValueDisplay = useMemo(() => {
    if (appointmentServiceValueBounds.hasRange) {
      return formatPosAccumulatedPriceDisplay(appointmentServiceValueBounds)
    }
    const amount = appointmentServiceValueBounds.min > 0.0001 ? appointmentServiceValueBounds.min : appointmentServiceAmount
    return `RM ${amount.toFixed(2)}`
  }, [appointmentServiceAmount, appointmentServiceValueBounds])

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
    const originalAddonDuration = sumSelectedAddonDuration(
      editAddonQuestions.flatMap((question) => question.options),
      editAddonQuantities,
    )
    const addedBlockDuration = editAddedMainBlocks.reduce((sum, block) => {
      const blockAddonDuration = sumSelectedAddonDuration(
        block.addon_questions.flatMap((question) => question.options),
        block.selected_addon_ids,
      )
      return sum + Number(block.duration_min ?? 0) + blockAddonDuration
    }, 0)
    return Math.max(0, baseDuration + originalAddonDuration + addedBlockDuration)
  }, [appointmentDetail, appointmentDisplayMainServices, appointmentSettlementDurationMin, editAddedMainBlocks, editAddonQuestions, editOriginalService?.duration_min, editAddonQuantities])

  const editSettlementEstimatedEndAt = useMemo(() => {
    const startAt = appointmentDetail?.appointment_start_at
    if (!startAt || editSettlementEstimatedDurationMin <= 0) return appointmentDetail?.appointment_end_at ?? null
    const start = new Date(startAt)
    if (Number.isNaN(start.getTime())) return appointmentDetail?.appointment_end_at ?? null
    return new Date(start.getTime() + editSettlementEstimatedDurationMin * 60 * 1000).toISOString()
  }, [appointmentDetail?.appointment_end_at, appointmentDetail?.appointment_start_at, editSettlementEstimatedDurationMin])

  useEffect(() => {
    const checkEditSettlementAvailability = async () => {
      if (!editSettlementOpen || !appointmentDetail?.id || !appointmentDetail.appointment_start_at || !editSettlementEstimatedEndAt) {
        setEditSettlementAvailability(null)
        return
      }
      if (String(appointmentDetail.status ?? '').toUpperCase() === 'COMPLETED') {
        setEditSettlementAvailability(null)
        return
      }
      const staffId = resolvePrimaryStaffIdFromSplits(editStaffSplits) ?? appointmentDetail.staff?.id
      if (!staffId) {
        setEditSettlementAvailability(null)
        return
      }
      const params = new URLSearchParams({
        staff_id: String(staffId),
        start_at: appointmentDetail.appointment_start_at,
        end_at: editSettlementEstimatedEndAt,
        ignore_booking_id: String(appointmentDetail.id),
      })
      const res = await fetch(`/api/proxy/pos/availability/check?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setEditSettlementAvailability(null)
        return
      }
      if (json?.data?.verify_mode != null) {
        setPosAvailabilityVerifyMode(parsePosAvailabilityVerifyMode(json.data.verify_mode))
      }
      setEditSettlementAvailability((json?.data ?? null) as { reason_code?: string | null; is_hard_block?: boolean; is_outside_staff_schedule?: boolean } | null)
    }
    void checkEditSettlementAvailability()
  }, [appointmentDetail?.appointment_start_at, appointmentDetail?.id, appointmentDetail?.staff?.id, appointmentDetail?.status, editSettlementEstimatedEndAt, editSettlementOpen, editStaffSplits])

  /** Add-on amount still due at settlement (list total minus add-on deposits already paid on orders). */
  const appointmentAddonDueForBreakdown = useMemo(() => {
    if (!appointmentDetail) return 0
    const hasPendingLineOverrides = Object.keys(editAddonLineTotalOverrides).length > 0
    if ((editSettlementOpen || hasPendingLineOverrides) && editSettlementLiveAddonBounds) {
      const liveTotal = editSettlementLiveAddonBounds.hasRange
        ? editSettlementLiveAddonBounds.max
        : editSettlementLiveAddonBounds.min
      const paid = Number(appointmentDetail.addon_paid_online ?? 0)
      return Math.max(0, liveTotal - paid)
    }
    const bal = appointmentDetail.addon_balance_due
    if (bal != null && Number.isFinite(Number(bal))) return Number(bal)
    return appointmentAddonTotal
  }, [appointmentAddonTotal, appointmentDetail, editAddonLineTotalOverrides, editSettlementLiveAddonBounds, editSettlementOpen])

  const appointmentAddonBreakdownDisplay = useMemo(() => {
    const hasPendingLineOverrides = Object.keys(editAddonLineTotalOverrides).length > 0
    if ((editSettlementOpen || hasPendingLineOverrides) && editSettlementLiveAddonBounds) {
      if (editSettlementLiveAddonBounds.hasRange) {
        const paid = Number(appointmentDetail?.addon_paid_online ?? 0)
        if (paid > 0.005) {
          return formatPosAccumulatedPriceDisplay({
            min: Math.max(0, editSettlementLiveAddonBounds.min - paid),
            max: Math.max(0, editSettlementLiveAddonBounds.max - paid),
            hasRange: editSettlementLiveAddonBounds.hasRange,
          })
        }
        return formatPosAccumulatedPriceDisplay(editSettlementLiveAddonBounds)
      }
      return `RM ${appointmentAddonDueForBreakdown.toFixed(2)}`
    }
    if (!(appointmentDetail?.add_ons?.length ?? 0)) return null
    if (displayAppointmentAddonBounds.hasRange) {
      const paid = Number(appointmentDetail?.addon_paid_online ?? 0)
      if (paid > 0.005) {
        return formatPosAccumulatedPriceDisplay({
          min: Math.max(0, displayAppointmentAddonBounds.min - paid),
          max: Math.max(0, displayAppointmentAddonBounds.max - paid),
          hasRange: displayAppointmentAddonBounds.hasRange,
        })
      }
      return formatPosAccumulatedPriceDisplay(displayAppointmentAddonBounds)
    }
    return `RM ${appointmentAddonDueForBreakdown.toFixed(2)}`
  }, [appointmentAddonDueForBreakdown, appointmentDetail?.add_ons?.length, appointmentDetail?.addon_paid_online, displayAppointmentAddonBounds, editAddonLineTotalOverrides, editSettlementLiveAddonBounds, editSettlementOpen])

  const appointmentSubtotalBeforeCredits = useMemo(
    () => appointmentServiceAmount + appointmentAddonTotal,
    [appointmentAddonTotal, appointmentServiceAmount],
  )

  /**
   * Deposit credited against this visit’s service balance only.
   * Do not add linked_booking_deposit: that is the same pool of money; the API already splits it into deposit_contribution per booking.
   */
  const appointmentDepositTotalForBreakdown = useMemo(
    () => Number(appointmentDepositContributionForSettlement),
    [appointmentDepositContributionForSettlement],
  )

  const appointmentHasUnsettledRangePricing = useMemo(
    () => appointmentDetailHasUnsettledRangePricing(appointmentDetail),
    [appointmentDetail],
  )

  const appointmentDueAmountNow = Number(appointmentDetail?.amount_due_now ?? appointmentDetail?.balance_due ?? 0)
  const appointmentSettlementPaid = Number(appointmentDetail?.settlement_paid ?? 0)
  const appointmentPackageApplied =
    ['reserved', 'consumed'].includes(String(appointmentDetail?.package_status?.status ?? '').toLowerCase()) ||
    (appointmentDetail?.package_claims?.length ?? 0) > 0
  const appointmentPackageCoveredBounds = useMemo(() => {
    const claims = appointmentDetail?.package_claims ?? []
    const claimedIds = new Set(claims.map((c) => c.booking_service_id))
    const hasPerLineClaims = claims.length > 0

    if (!hasPerLineClaims && !appointmentPackageApplied) {
      return { min: 0, max: 0, hasRange: false }
    }

    const coveredItems: Array<{
      source?: PosPriceDisplaySource | null
      overrideAmount?: number
      hasOverrideKey?: boolean
      lineTotalOverride?: number
      hasLineTotalOverrideKey?: boolean
    }> = []

    appointmentDisplayMainServices.forEach((service, idx) => {
      const isOriginalService = Boolean(service.is_original ?? idx === 0)
      const serviceBookingServiceId = Number(service.linked_booking_service_id ?? service.id ?? 0)
      const packageCovers = hasPerLineClaims
        ? claimedIds.has(serviceBookingServiceId)
        : appointmentPackageApplied && isOriginalService
      if (!packageCovers) return

      coveredItems.push({
        source: buildAppointmentMainServicePriceSource(service, idx),
      })
    })

    for (const service of appointmentDisplayMainServices) {
      for (const addon of service.add_ons ?? []) {
        const addonServiceId = Number(addon.linked_booking_service_id ?? addon.id ?? 0)
        if (!hasPerLineClaims || !claimedIds.has(addonServiceId)) continue
        coveredItems.push({ source: posPriceDisplayForAddonLine(addon) ?? addon })
      }
    }

    if (coveredItems.length === 0) {
      const offset = Number(appointmentDetail?.package_offset ?? 0)
      return { min: offset, max: offset, hasRange: false }
    }

    return accumulatePosPriceBounds(coveredItems)
  }, [
    appointmentDetail?.package_claims,
    appointmentDetail?.package_offset,
    appointmentDisplayMainServices,
    appointmentPackageApplied,
    buildAppointmentMainServicePriceSource,
  ])
  const appointmentPackageCoveredBreakdown = useMemo((): { show: boolean; display: string } => {
    const claims = appointmentDetail?.package_claims ?? []
    const hasPerLineClaims = claims.length > 0

    if (!hasPerLineClaims && !appointmentPackageApplied) {
      return { show: false, display: '' }
    }

    const { min, max, hasRange } = appointmentPackageCoveredBounds
    const offset = Number(appointmentDetail?.package_offset ?? 0)

    if (hasRange && Math.abs(min - max) > 0.0001) {
      return {
        show: true,
        display: `− RM ${min.toFixed(2)} - RM ${max.toFixed(2)}`,
      }
    }

    const amount = min > 0.0001 ? min : offset
    return {
      show: true,
      display: amount > 0.0001 ? `− RM ${amount.toFixed(2)}` : '− RM 0.00',
    }
  }, [
    appointmentDetail?.package_claims,
    appointmentDetail?.package_offset,
    appointmentPackageApplied,
    appointmentPackageCoveredBounds,
  ])
  const appointmentTotalCovered =
    appointmentDepositTotalForBreakdown + appointmentSettlementPaid + appointmentPackageCoveredBounds.min
  /** Package reserved on booking but settlement not recorded yet — treat as unpaid until POS/main checkout finalises. */
  const packageReservedPendingRegister = useMemo(
    () =>
      String(appointmentDetail?.package_status?.status ?? '').toLowerCase() === 'reserved' &&
      appointmentSettlementPaid <= 0.0001,
    [appointmentDetail?.package_status?.status, appointmentSettlementPaid],
  )
  /** Reserved package, remaining balance, or non-PAID status ⇒ still unpaid at register. */
  const appointmentCheckoutCompleted = appointmentVisitCheckoutFinalized(appointmentDetail)
  const appointmentPaymentBadgeIsPaid =
    appointmentCheckoutCompleted &&
    !appointmentHasUnsettledRangePricing &&
    appointmentDueAmountNow <= 0.0001
  const appointmentShowApplyPackageButton = useMemo(
    () =>
      !appointmentCheckoutCompleted &&
      Boolean(appointmentDetail?.customer),
    [appointmentCheckoutCompleted, appointmentDetail?.customer],
  )
  const appointmentPackageDisabledReason =
    appointmentDetail?.package_disabled_reason &&
    appointmentDetail.package_disabled_reason !== 'No eligible package available.'
      ? appointmentDetail.package_disabled_reason
      : null
  const appointmentCanApplyPackage = Boolean(appointmentDetail?.can_apply_package)
  const appointmentStatusUpper = String(appointmentDetail?.status ?? '').toUpperCase()
  const appointmentRefundSummary = useMemo(
    () => computeSettlementRefundSummary(
      {
        overpaid_amount: appointmentDetail?.overpaid_amount,
        refund_needed: appointmentDetail?.refund_needed,
        refund_handled: appointmentDetail?.refund_handled,
        refund_handled_amount: appointmentDetail?.refund_handled_amount,
        refund_transactions: appointmentDetail?.refund_transactions,
      },
      {
        mode:
          appointmentStatusUpper === 'COMPLETED' && appointmentPaymentBadgeIsPaid
            ? 'history'
            : 'active',
      },
    ),
    [
      appointmentDetail?.overpaid_amount,
      appointmentDetail?.refund_handled,
      appointmentDetail?.refund_handled_amount,
      appointmentDetail?.refund_needed,
      appointmentDetail?.refund_transactions,
      appointmentPaymentBadgeIsPaid,
      appointmentStatusUpper,
    ],
  )
  const appointmentRefundNeededAmount = appointmentRefundSummary.remainingRefund
  const appointmentIsHold = appointmentStatusUpper === 'HOLD'
  const appointmentHoldProofCount = appointmentDetail?.payment_proofs?.length ?? 0
  const appointmentHoldDepositOrder = appointmentDetail?.hold_deposit_order ?? null
  const appointmentActiveDepositTransactions = useMemo(
    () => (appointmentDetail?.deposit_transactions ?? []).filter((tx) => Number(tx.amount ?? 0) > 0.0001),
    [appointmentDetail?.deposit_transactions],
  )
  const appointmentActiveDepositTotal = useMemo(
    () => appointmentActiveDepositTransactions.reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0),
    [appointmentActiveDepositTransactions],
  )
  const canRejectHoldPaymentProof = Boolean(
    appointmentIsHold &&
      ((appointmentHoldDepositOrder?.status === 'processing' &&
        appointmentHoldDepositOrder.payment_status !== 'paid') ||
        (appointmentHoldProofCount > 0 && !appointmentHoldDepositOrder)),
  )
  /** Cancelled / no-show / late cancel — no checkout or “complete visit” CTAs. */
  const appointmentIsTerminalCancelled = ['CANCELLED', 'NO_SHOW', 'LATE_CANCELLATION'].includes(appointmentStatusUpper)

  const appointmentShowPaymentBadge =
    !appointmentIsTerminalCancelled && ['CONFIRMED', 'COMPLETED'].includes(appointmentStatusUpper)
  const canMarkAppointmentCompleted =
    canRunAppointmentLifecycleActions &&
    !appointmentActionLoading &&
    !appointmentIsTerminalCancelled &&
    appointmentStatusUpper !== 'COMPLETED' &&
    !cashShiftActionDisabled

  /** Reserved package, amount to collect is RM 0 — finalise in place (receipt) without sending the user to Main POS. */
  const checkoutZeroBalanceSettlement = appointmentNeedsZeroBalanceCheckout(appointmentDetail)
  const checkoutZeroBalanceHint = packageReservedPendingRegister
    ? 'Package covers this visit—tap Checkout to confirm and issue the receipt (same flow as when collecting payment).'
    : Number(appointmentDetail?.deposit_paid ?? 0) > 0.0001
      ? 'Deposit covers the balance—tap Checkout to confirm and issue the receipt (RM 0 to collect now).'
      : 'No amount to collect—tap Checkout to confirm and issue the receipt.'

  const showAppointmentCollectPayment =
    canAppointmentCheckoutAndPackage &&
    !appointmentIsTerminalCancelled &&
    appointmentStatusUpper === 'COMPLETED' &&
    !appointmentCheckoutCompleted &&
    (appointmentDueAmountNow > 0.0001 || checkoutZeroBalanceSettlement || appointmentHasUnsettledRangePricing)

  const showAppointmentMarkCompletedBlock =
    canRunAppointmentLifecycleActions &&
    !appointmentIsTerminalCancelled &&
    appointmentStatusUpper === 'CONFIRMED'

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
  const appointmentSettlementCustomerBalanceCents = toPaymentCents(appointmentSettlementPaymentAmounts.customer_balance)
  const appointmentSettlementTotalPaidCents = appointmentSettlementCashCents + appointmentSettlementQrPayCents + appointmentSettlementCreditCardCents + appointmentSettlementCustomerBalanceCents
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


  const hasAppointmentSettlementTarget = appointmentDetailLoading || Boolean(appointmentDetail)
  const settlementActivitySignatureRef = useRef('')
  const settlementPulseReadyRef = useRef(false)

  useEffect(() => {
    if (!hasAppointmentSettlementTarget) {
      setSettlementSheetOpen(false)
      settlementActivitySignatureRef.current = ''
      settlementPulseReadyRef.current = false
      return
    }

    const signature = appointmentDetail
      ? `${appointmentDetail.id}:${appointmentDueAfterDiscount.toFixed(2)}`
      : 'loading'

    if (!settlementPulseReadyRef.current) {
      settlementPulseReadyRef.current = true
      settlementActivitySignatureRef.current = signature
      return
    }

    if (settlementActivitySignatureRef.current === signature) return

    settlementActivitySignatureRef.current = signature
    setSettlementBarPulse(true)
    const timer = window.setTimeout(() => setSettlementBarPulse(false), 550)
    return () => window.clearTimeout(timer)
  }, [appointmentDetail, appointmentDueAfterDiscount, hasAppointmentSettlementTarget])

  useEffect(() => {
    if (isCompactLayout === null) return
    setAppointmentFiltersOpen(!isCompactLayout)
  }, [isCompactLayout])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.createElement('div')
    root.className = 'pos-appt-body-modals'
    root.setAttribute('data-pos-appt-body-modals', '')
    document.body.appendChild(root)
    setBodyModalRoot(root)
    return () => {
      root.remove()
      setBodyModalRoot(null)
    }
  }, [])

  const compactPosBodyModalOpen = useMemo(
    () =>
      createAppointmentModalOpen ||
      createAppointmentMemberPickerOpen ||
      cancellationRequestsModalOpen ||
      appointmentRescheduleOpen ||
      editSettlementOpen ||
      appointmentLineSplitTarget != null ||
      appointmentPriceEditTarget != null ||
      editMainServicePickerOpen ||
      appointmentCheckoutConfirmationOpen ||
      holdApproveConfirmOpen ||
      holdRejectConfirmOpen ||
      holdCancelConfirmOpen ||
      cancellationConfirmOpen ||
      appointmentStatusConfirmOpen ||
      appointmentSettlementResult != null ||
      appointmentQrCodeFullscreen,
    [
      appointmentCheckoutConfirmationOpen,
      appointmentLineSplitTarget,
      appointmentPriceEditTarget,
      appointmentQrCodeFullscreen,
      appointmentRescheduleOpen,
      appointmentSettlementResult,
      appointmentStatusConfirmOpen,
      cancellationConfirmOpen,
      cancellationRequestsModalOpen,
      createAppointmentMemberPickerOpen,
      createAppointmentModalOpen,
      editMainServicePickerOpen,
      editSettlementOpen,
      holdApproveConfirmOpen,
      holdCancelConfirmOpen,
      holdRejectConfirmOpen,
    ],
  )

  useEffect(() => {
    if (!settlementSheetOpen || typeof document === 'undefined') return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [settlementSheetOpen])

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return
    if (!bodyModalRoot) return
    document.body.appendChild(bodyModalRoot)
  }, [compactPosBodyModalOpen, bodyModalRoot])

  useLayoutEffect(() => {
    if (typeof document === 'undefined' || isCompactLayout === null) return
    const node = settlementColumnRef.current
    const host = settlementHostRef.current
    if (!node) return

    if (isCompactLayout === true) {
      if (node.parentNode !== document.body) {
        if (bodyModalRoot?.parentNode === document.body) {
          document.body.insertBefore(node, bodyModalRoot)
        } else {
          document.body.appendChild(node)
        }
      } else if (bodyModalRoot?.parentNode === document.body && node.nextSibling !== bodyModalRoot) {
        document.body.insertBefore(node, bodyModalRoot)
      }
      return
    }

    if (host && node.parentNode !== host) {
      host.appendChild(node)
    }
  }, [isCompactLayout, bodyModalRoot])

  const appointmentActiveFilterCount = useMemo(
    () =>
      [appointmentQuery, appointmentCustomerFilter, appointmentStaffFilter, appointmentStatusFilter].filter(
        (value) => value.trim().length > 0,
      ).length,
    [appointmentQuery, appointmentCustomerFilter, appointmentStaffFilter, appointmentStatusFilter],
  )

  const appointmentCustomerFilterOptions = useMemo(
    () =>
      appointmentCustomerOptions.map((customer) => {
        const maskedPhone = formatCustomerPhoneMasked(customer.phone)
        return {
          value: String(customer.id),
          label: maskedPhone ? `${customer.name} · ${maskedPhone}` : customer.name,
          searchText: [customer.name, customer.phone ?? '', customer.email ?? '', maskedPhone ?? '']
            .filter(Boolean)
            .join(' '),
        }
      }),
    [appointmentCustomerOptions],
  )

  const appointmentStaffFilterOptions = useMemo(
    () =>
      appointmentStaffOptions.map((staff) => ({
        value: String(staff.id),
        label: staff.name,
        searchText: staff.name,
      })),
    [appointmentStaffOptions],
  )

  const appointmentStatusFilterOptions = useMemo(
    () =>
      APPOINTMENT_STATUS_FILTER_OPTIONS.filter((option) => option.value !== '').map((option) => ({
        value: option.value,
        label: option.label,
        searchText: option.label,
      })),
    [],
  )

  return (
      <div className="pos-appt-workspace min-w-0">
      <div className="lg:hidden">
        <h2 className="mb-3 text-xl font-bold text-gray-900 sm:mb-4 sm:text-2xl">POS Appointments</h2>
      </div>

      <div
        className={[
          'pos-appt-layout min-w-0 gap-3 lg:gap-5',
          isCompactLayout === true ? 'flex min-h-0 flex-col' : 'grid min-h-0 flex-1',
        ].join(' ')}
      >
        <div
          className={[
            'pos-appt-left flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:gap-4 lg:gap-5',
            isCompactLayout === true && 'pos-appt-left--compact pos-appt-left--floating-bar',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="pos-appt-panel flex min-h-0 flex-col overflow-visible rounded-xl border-2 border-gray-200 bg-white p-3 shadow-md sm:p-4 lg:p-5">
            <h3 className="pos-appt-panel-header mb-2 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 text-lg font-bold text-gray-900 sm:mb-3 sm:text-xl">
              <div className="flex items-center gap-2">
                <svg className="h-6 w-6 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Appointments
              </div>
              <div className="pos-appt-toolbar flex flex-wrap items-center gap-2 sm:gap-3">
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
                  <span className="pos-appt-auto-refresh-label">Auto refresh</span>
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
                    void fetchAppointments({ silent: true })
                  }}
                  disabled={appointmentsRefreshing}
                  title={
                    appointmentListAutoRefresh
                      ? 'Refresh now (countdown resets to 5)'
                      : 'Refresh list'
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-900 disabled:pointer-events-none disabled:opacity-50"
                >
                  <svg
                    className={`h-4 w-4 shrink-0 ${appointmentsRefreshing ? 'animate-spin text-blue-600' : 'text-gray-600'}`}
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
                {canCreateMember ? (
                  <button
                    type="button"
                    onClick={() => setIsCreateMemberModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                  >
                    <i className="fa-solid fa-user-plus" />
                    Create Member
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openCreateAppointmentModal}
                  disabled={cashShiftActionDisabled}
                  title={cashShiftActionTitle}
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create Appointment
                </button>
                <PosRequestCenter
                  permissions={permissions}
                  disabled={cashShiftActionDisabled}
                  disabledTitle={cashShiftActionTitle}
                  canReviewBookingRequests={canReviewCancellationRequests}
                  onBookingRequestsChanged={async () => {
                    await fetchAppointments({ silent: true })
                    await refreshOpenedAppointmentDetail()
                  }}
                />
                {cashShiftActionDisabled ? (
                  <p className="basis-full text-right text-xs font-semibold text-amber-700">{requireOpenShiftMessage}</p>
                ) : null}
              </div>
            </h3>
            <div className="pos-appt-schedule-host min-h-0 overflow-visible">
            <PosAppointmentsSchedule
              viewMode={posApptViewMode}
              onViewModeChange={(mode) => {
                setPosApptViewMode(mode)
                if (mode === 'day') {
                  const cal = posApptCalendarMonth
                  const n = new Date()
                  const todayYmd = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
                  const [filterY, filterM] = appointmentDateFilter.split('-').map(Number)
                  const filterInCalendarMonth =
                    filterY === cal.getFullYear() && filterM === cal.getMonth() + 1 && appointmentDateFilter

                  if (filterInCalendarMonth) {
                    return
                  }

                  const isViewingCurrentMonth = cal.getFullYear() === n.getFullYear() && cal.getMonth() === n.getMonth()
                  setAppointmentDateFilter(
                    isViewingCurrentMonth
                      ? todayYmd
                      : `${cal.getFullYear()}-${String(cal.getMonth() + 1).padStart(2, '0')}-01`,
                  )
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
              appointments={scheduleAppointments}
              appointmentsLoading={appointmentsLoading}
              scheduleScope={scheduleScope}
              onScheduleScopeChange={setScheduleScope}
              onOpenAppointment={(id) => void openAppointmentDetail(id)}
              scheduleStaff={scheduleStaffForDayGrid}
              staffOffTodayIds={staffOffTodayIds}
              filterSlot={(
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setAppointmentFiltersOpen((open) => !open)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                    aria-expanded={appointmentFiltersOpen}
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      Filters
                      {appointmentActiveFilterCount > 0 ? (
                        <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                          {appointmentActiveFilterCount}
                        </span>
                      ) : null}
                    </span>
                    <svg
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${appointmentFiltersOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {appointmentFiltersOpen ? (
                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  <input
                    value={appointmentQuery}
                    onChange={(e) => setAppointmentQuery(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Search booking no (e.g. BK-20260327233637-15FFBC)"
                  />
                  <SearchableFilterSelect
                    value={appointmentCustomerFilter}
                    onChange={setAppointmentCustomerFilter}
                    options={appointmentCustomerFilterOptions}
                    allLabel="All Customers"
                    loading={appointmentCustomerLoading}
                    loadingLabel="Loading customers…"
                    searchPlaceholder="Search customer…"
                    aria-label="Customer filter"
                  />
                  <SearchableFilterSelect
                    value={appointmentStaffFilter}
                    onChange={setAppointmentStaffFilter}
                    options={appointmentStaffFilterOptions}
                    allLabel="All Staffs"
                    loading={appointmentStaffLoading}
                    loadingLabel="Loading staffs…"
                    searchPlaceholder="Search staff…"
                    aria-label="Staff filter"
                  />
                  <SearchableFilterSelect
                    value={appointmentStatusFilter}
                    onChange={(next) => setAppointmentStatusFilter(next as AppointmentStatusFilterValue)}
                    options={appointmentStatusFilterOptions}
                    allLabel="All statuses"
                    searchPlaceholder="Search status…"
                    aria-label="Appointment status filter"
                  />
                    </div>
                  ) : null}
                </div>
              )}
            />
            </div>
          </div>
        </div>

        <div ref={settlementHostRef} className="pos-appt-right-host min-w-0">
        <div
          ref={settlementColumnRef}
          className={[
            'pos-appt-right min-w-0',
            settlementSheetOpen && 'pos-appt-settlement-sheet-open',
            isCompactLayout === true && compactPosBodyModalOpen && 'pos-appt-settlement-sheet-under-modal',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div
            className={[
              'pos-appt-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-900/5',
              isCompactLayout === true && 'rounded-b-none rounded-t-2xl border-b-0 shadow-[0_-12px_40px_rgba(15,23,42,0.18)]',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="pos-settlement-sheet-handle" aria-hidden="true" />
            <div className="flex-shrink-0 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold tracking-tight text-slate-900">Appointment Settlement</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Review the breakdown, collect payment, or update the booking.</p>
                </div>
                <button
                  type="button"
                  aria-label="Close settlement"
                  onClick={() => setSettlementSheetOpen(false)}
                  className="pos-settlement-sheet-close inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {appointmentDetailLoading ? (
              <div className="flex flex-1 flex-col items-center justify-start gap-3 px-6 py-8 sm:justify-center sm:py-16">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" aria-hidden />
                <p className="text-sm text-slate-500">Loading booking details…</p>
              </div>
            ) : !appointmentDetail ? (
              <div className="flex flex-1 flex-col items-center justify-start px-6 py-8 text-center sm:justify-center sm:py-14">
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
              <div className="pos-appt-settlement-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5">
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
                      {getAppointmentDisplayRemarkLines(appointmentDetail).map((line) => (
                        <p key={`appointment-remark-${line.key}`} className="text-xs font-medium text-slate-600">
                          <span className="text-slate-500">{line.label}:</span>{' '}
                          <span className="whitespace-pre-wrap">{line.value}</span>
                          {line.key === 'reschedule_reason' && appointmentDetail.rescheduled_at ? (
                            <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
                              Last rescheduled {formatDateTime12Hour(appointmentDetail.rescheduled_at)}
                              {(appointmentDetail.reschedule_count ?? 0) > 1
                                ? ` · ${appointmentDetail.reschedule_count} time(s)`
                                : ''}
                            </span>
                          ) : null}
                        </p>
                      ))}
                    </div>

                    {appointmentIsHold ? (
                      <div className="mt-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-4 shadow-sm ring-1 ring-violet-100">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-900">Deposit review</p>
                            {appointmentHoldDepositOrder ? (
                              <>
                                <p className="mt-2 text-xs font-semibold text-violet-900">
                                  {appointmentHoldDepositOrder.order_number}
                                </p>
                                <p className="mt-1 text-xs text-violet-900/80">
                                  {appointmentHoldDepositOrder.status === 'processing'
                                    ? 'Waiting for verification'
                                    : appointmentHoldDepositOrder.status === 'reject_payment_proof'
                                      ? 'Payment proof rejected'
                                      : appointmentHoldDepositOrder.status.replaceAll('_', ' ')}
                                </p>
                              </>
                            ) : (
                              <p className="mt-2 text-xs text-violet-800/80">No pending deposit order linked to this hold.</p>
                            )}
                            {appointmentDetail.hold_expires_at ? (
                              <p className="mt-2 text-xs font-medium text-violet-800/90">
                                Hold expires {formatDateTime12Hour(appointmentDetail.hold_expires_at)}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            disabled={!appointmentHoldDepositOrder}
                            onClick={() => {
                              if (appointmentHoldDepositOrder) {
                                setDepositReviewViewOrderId(appointmentHoldDepositOrder.id)
                              }
                            }}
                            title={
                              appointmentHoldDepositOrder
                                ? `View order ${appointmentHoldDepositOrder.order_number}`
                                : 'No deposit order available'
                            }
                            className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-white text-violet-800 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={
                              appointmentHoldDepositOrder
                                ? `View order ${appointmentHoldDepositOrder.order_number}`
                                : 'No deposit order available'
                            }
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1 1 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        </div>
                        {!appointmentHoldDepositOrder ? (
                          <p className="mt-2 text-[11px] font-medium text-violet-800/80">
                            Deposit order is not available yet for this hold.
                          </p>
                        ) : (
                          <p className="mt-2 text-[11px] font-medium text-violet-800/80">
                            Tap the eye icon to open booking order details, review payment proof, and confirm or reject from there.
                          </p>
                        )}
                      </div>
                    ) : null}

                    {/* <div className="mt-4 rounded-lg border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-white px-3 py-3 shadow-sm ring-1 ring-indigo-100/80">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-900">Services</p>
                      <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-900">{appointmentDetail.service?.name ?? '—'}</p>
                    </div>

                    {appointmentDetail.add_ons?.length && !(appointmentDetail.main_services?.length) ? (
                      <div className="mt-3 rounded-lg border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white px-3 py-3 shadow-sm ring-1 ring-violet-100/80">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-900">Add-ons</p>
                        <ul className="mt-2 space-y-2 text-sm text-slate-800">
                          {appointmentDetail.add_ons.map((addon, idx) => {
                            console.debug('[POS appointment detail staff-splits] add-on row render input', {
                              appointment_id: appointmentDetail.id,
                              addon_id: addon.id ?? null,
                              addon_staff_splits: addon.staff_splits ?? [],
                              appointment_staff_splits: appointmentDetail.staff_splits ?? [],
                            })
                            return (
                              <li
                                key={`${addon.id ?? addon.name}-${idx}`}
                                className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-white/80 px-2 py-1.5 ring-1 ring-violet-100"
                              >
                                <span className="min-w-0 font-medium">{addon.name}</span>
                                <span className="shrink-0 text-xs tabular-nums text-violet-900/80">
                                  +RM {Number(addon.extra_price ?? 0).toFixed(2)}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ) : null} */}

                    {appointmentDisplayMainServices.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3 shadow-sm ring-1 ring-slate-200/80">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-800">Service</p>
                        <div className="mt-2 space-y-2">
                          {(() => {
                            const claims = appointmentDetail.package_claims ?? []
                            const hasPerLineClaims = claims.length > 0

                            return appointmentDisplayMainServices.map((service, serviceIdx) => {
                              const isOriginalService = Boolean(service.is_original ?? serviceIdx === 0)
                              const servicePriceSource = {
                                ...service,
                                ...(isOriginalService && appointmentDetail?.settled_service_amount != null
                                  ? {
                                      extra_price: Number(appointmentDetail.settled_service_amount),
                                      settled_service_amount: appointmentDetail.settled_service_amount,
                                      price_finalized: true,
                                    }
                                  : {}),
                                ...(service.price_finalized ? { price_finalized: true } : {}),
                              }
                              const servicePrice = Number(servicePriceSource.extra_price ?? 0)
                              const serviceBookingServiceId = Number(service.linked_booking_service_id ?? service.id ?? 0)
                              const serviceIsRangePriced = posPriceDisplayHasRange(servicePriceSource) && !posPriceDisplayHasFinalPrice(servicePriceSource)
                              const packageCoversMainService = hasPerLineClaims
                                ? claims.some((c) => c.booking_service_id === serviceBookingServiceId)
                                : appointmentPackageApplied && isOriginalService

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
                                          {hasPerLineClaims
                                            ? formatPackageClaimLineText(claims.find((c) => c.booking_service_id === serviceBookingServiceId))
                                            : 'Included in your package'}
                                        </p>
                                      ) : null}
                                    </div>
                                    <span className="text-right text-xs font-semibold tabular-nums text-slate-900">
                                      {packageCoversMainService ? (
                                        <>
                                          <span className="block text-slate-400 line-through">{formatPosCurrentOrRangeDisplay(servicePriceSource)}</span>
                                          <span className="block text-emerald-800">RM 0.00</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="block">{formatPosCurrentOrRangeDisplay(servicePriceSource)}</span>
                                          {serviceIsRangePriced ? <span className="block text-[10px] font-medium text-amber-700">Range pricing — please set final price before checkout.</span> : null}
                                        </>
                                      )}
                                    </span>
                                  </div>
                                  {(service.add_ons ?? []).length > 0 ? (
                                    <ul className="mt-1.5 space-y-1.5 text-xs text-slate-700">
                                      {(service.add_ons ?? []).map((addon, addonIdx) => {
                                        const addonOptionId = Number(addon.id ?? 0)
                                        const hasPendingEditLineOverride = Object.prototype.hasOwnProperty.call(editAddonLineTotalOverrides, addonOptionId)
                                        const useEditAddonPreview = editSettlementOpen || hasPendingEditLineOverride
                                        const editAddonContext = useEditAddonPreview && addonOptionId > 0
                                          ? isOriginalService
                                            ? {
                                                selection: editAddonQuantities,
                                                unitOverrides: editAddonPriceOverrides,
                                                lineTotalOverrides: editAddonLineTotalOverrides,
                                                quantity: getAddonQuantity(editAddonQuantities, addonOptionId),
                                              }
                                            : (() => {
                                                const block = editAddedMainBlocks.find((item) => item.service_id === Number(service.linked_booking_service_id ?? service.id ?? 0))
                                                if (!block) return null
                                                return {
                                                  selection: block.selected_addon_ids,
                                                  unitOverrides: block.addon_price_overrides,
                                                  lineTotalOverrides: block.addon_line_total_overrides,
                                                  quantity: getAddonQuantity(block.selected_addon_ids, addonOptionId),
                                                }
                                              })()
                                          : null
                                        const hasEditLineOverride = Boolean(
                                          editAddonContext
                                          && Object.prototype.hasOwnProperty.call(editAddonContext.lineTotalOverrides, addonOptionId),
                                        )
                                        const addonLinePrice = editAddonContext
                                          ? (
                                            resolveEditSettlementAddonLineAmount(
                                              addonOptionId,
                                              Number(addon.extra_price ?? 0),
                                              editAddonContext.selection,
                                              editAddonContext.unitOverrides,
                                              editAddonContext.lineTotalOverrides,
                                            ) ?? storedAddonLinePrice(addon)
                                          )
                                          : storedAddonLinePrice(addon)
                                        const addonPriceSource = editAddonContext
                                          ? posPriceDisplayForAddonLine({
                                            ...addon,
                                            quantity: editAddonContext.quantity,
                                            line_total_override: hasEditLineOverride
                                              ? editAddonContext.lineTotalOverrides[addonOptionId]
                                              : null,
                                            line_gross_amount: hasEditLineOverride
                                              ? editAddonContext.lineTotalOverrides[addonOptionId]
                                              : addon.line_gross_amount,
                                            gross_amount: hasEditLineOverride ? null : addon.gross_amount,
                                          })
                                          : posPriceDisplayForAddonLine(addon)
                                        const hasExplicitAddonLinePrice = hasEditLineOverride
                                          || hasPendingEditLineOverride
                                          || posAddonHasStoredLineTotal(addon)
                                        const showAddonUnsettledRange = posPriceDisplayHasRange(addon)
                                          && !posPriceDisplayHasFinalPrice(addon)
                                          && !hasExplicitAddonLinePrice
                                        const packageCoversAddon = hasPerLineClaims
                                          ? claims.some((c) => c.booking_service_id === Number(addon.linked_booking_service_id ?? addon.id ?? 0))
                                          : false

                                        return (
                                          <li key={`appt-main-addon-${service.id ?? service.name}-${addon.id ?? addon.name}-${addonIdx}`} className="flex items-start justify-between gap-3">
                                            <PosAddonLineName
                                              layout="stacked"
                                              prefix=""
                                              name={addon.name}
                                              cnName={addon.cn_name}
                                              quantity={editAddonContext?.quantity ?? addon.quantity}
                                              cnClassName="block text-[11px] text-slate-500"
                                              quantityClassName="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-500"
                                              trailing={packageCoversAddon ? (
                                                <span className="mt-1 block text-[11px] font-medium leading-snug text-emerald-700">
                                                  {hasPerLineClaims
                                                    ? formatPackageClaimLineText(claims.find((c) => c.booking_service_id === Number(addon.linked_booking_service_id ?? addon.id ?? 0)))
                                                    : 'Included in your package'}
                                                </span>
                                              ) : null}
                                            />
                                            <span className="text-right tabular-nums">
                                              {packageCoversAddon ? (
                                                <>
                                                  <span className="block text-slate-400 line-through">{formatPosCurrentOrRangeDisplay(addonPriceSource)}</span>
                                                  <span className="block font-semibold text-emerald-800">RM 0.00</span>
                                                </>
                                              ) : (
                                                <>
                                                  <span className="block">
                                                    {showAddonUnsettledRange
                                                      ? formatPosCurrentOrRangeDisplay(addonPriceSource)
                                                      : `RM ${addonLinePrice.toFixed(2)}`}
                                                  </span>
                                                  {showAddonUnsettledRange ? (
                                                    <span className="block text-[10px] font-medium text-amber-700">Range pricing — please set final price before checkout.</span>
                                                  ) : null}
                                                </>
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
                    canEditAppointmentSettlement &&
                    !(appointmentStatusUpper === 'COMPLETED' && appointmentPaymentBadgeIsPaid) ? (
                      <div className="pos-edit-settlement-sticky mt-3">
                        {appointmentHasUnsettledRangePricing ? (
                          <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                            <p className="text-xs font-semibold text-amber-900">{UNSETTLED_RANGE_CHECKOUT_MESSAGE}</p>
                            {canAppointmentCheckoutAndPackage ? (
                              <p className="mt-1 text-[11px] leading-snug text-amber-800">
                                You can save settlement changes first. Checkout stays disabled until every range-priced service and add-on has a final price.
                              </p>
                            ) : (
                              <p className="mt-1 text-[11px] leading-snug text-amber-800">
                                Save settlement changes and set a final price for every range-priced service and add-on.
                              </p>
                            )}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void openEditSettlement()}
                          disabled={appointmentActionLoading}
                          className="pos-edit-settlement-action w-full rounded-lg border-2 border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 shadow-sm transition-colors hover:bg-indigo-100 disabled:opacity-50"
                        >
                          Edit Settlement
                        </button>
                      </div>
                    ) : null}

                    {!appointmentIsTerminalCancelled ? (
                      <div className="mt-3">
                        <PosAppointmentPaymentLinksSection
                          bookingId={appointmentDetail.id}
                          bookingCode={appointmentDetail.booking_code}
                          bookingCustomer={{
                            name:
                              appointmentDetail.customer_name
                              ?? appointmentDetail.guest_name
                              ?? appointmentDetail.customer?.name
                              ?? null,
                            phone:
                              appointmentDetail.customer_phone
                              ?? appointmentDetail.guest_phone
                              ?? appointmentDetail.customer?.phone
                              ?? null,
                            email:
                              appointmentDetail.customer_email
                              ?? appointmentDetail.guest_email
                              ?? appointmentDetail.customer?.email
                              ?? null,
                          }}
                          defaultAmount={Number(appointmentDueAmountNow ?? appointmentDetail.balance_due ?? 0)}
                          showMsg={showMsg}
                          onDepositRecorded={() => {
                            void refreshOpenedAppointmentDetail()
                            void fetchAppointments({ silent: true })
                          }}
                        />
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
                      {/* {appointmentDetail.schedule_override?.used ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <p className="font-semibold">Schedule override</p>
                          <p>Staff schedule: {formatTimeRange(appointmentDetail.schedule_override.scheduled_staff_start_at, appointmentDetail.schedule_override.scheduled_staff_end_at)}</p>
                          <p>Booking time: {formatTimeRange(appointmentDetail.schedule_override.actual_booking_start_at, appointmentDetail.schedule_override.actual_booking_end_at)}</p>
                        </div>
                      ) : null} */}
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
                        <span className="text-slate-600">Service Value</span>
                        <span className="font-medium tabular-nums text-slate-900">
                          {appointmentServiceValueDisplay}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 py-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600">Add-ons</span>
                          <span className="font-medium tabular-nums text-slate-900">
                            {appointmentAddonBreakdownDisplay ?? 'RM 0.00'}
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
                        <span className="text-slate-600">Deposit Paid</span>
                        <span className="font-medium tabular-nums text-slate-800">
                          {appointmentDepositTotalForBreakdown > 0 ? `− RM ${appointmentDepositTotalForBreakdown.toFixed(2)}` : '—'}
                        </span>
                      </div>
                      {appointmentPackageCoveredBreakdown.show ? (
                        <div className="flex items-center justify-between gap-3 py-3.5">
                          <span className="text-slate-600">Package Covered</span>
                          <span className="font-medium tabular-nums text-emerald-800">
                            {appointmentPackageCoveredBreakdown.display}
                          </span>
                        </div>
                      ) : null}

                      {/* <div className="flex items-center justify-between gap-3 py-3.5">
                        <span className="text-slate-600">Total Covered</span>
                        <span className="font-semibold tabular-nums text-slate-900">RM {appointmentTotalCovered.toFixed(2)}</span>
                      </div> */}
                      <SettlementRefundBreakdownRows
                        summary={appointmentRefundSummary}
                        variant="checkout"
                        rowClass="py-3.5"
                      />

                      <div className="-mx-4 flex items-center justify-between gap-3 border-t-2 border-slate-200 bg-emerald-50/50 px-4 py-4">
                        <span className="text-base font-bold text-slate-900">Amount To Pay</span>
                        <span className="text-xl font-bold tabular-nums text-emerald-800">
                          {appointmentDetail.is_range_priced && appointmentDetail.settled_service_amount == null
                            || displayAppointmentAddonBounds.hasRange
                            ? (() => {
                                const rangeMin = appointmentDetail.is_range_priced && appointmentDetail.settled_service_amount == null
                                  ? Number(appointmentDetail.service?.price_range_min ?? 0)
                                  : appointmentServiceAmount
                                const rangeMax = appointmentDetail.is_range_priced && appointmentDetail.settled_service_amount == null
                                  ? Number(appointmentDetail.service?.price_range_max ?? 0)
                                  : appointmentServiceAmount
                                const addonMin = displayAppointmentAddonBounds.hasRange
                                  ? displayAppointmentAddonBounds.min
                                  : appointmentAddonDueForBreakdown
                                const addonMax = displayAppointmentAddonBounds.hasRange
                                  ? displayAppointmentAddonBounds.max
                                  : appointmentAddonDueForBreakdown
                                const totalMin = Math.max(0, rangeMin + addonMin - appointmentDepositTotalForBreakdown - appointmentPackageCoveredBounds.min)
                                const totalMax = Math.max(0, rangeMax + addonMax - appointmentDepositTotalForBreakdown - appointmentPackageCoveredBounds.max)
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
                          {checkoutZeroBalanceSettlement
                            ? checkoutZeroBalanceHint
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
                              appointmentHasUnsettledRangePricing ||
                              (appointmentDueAmountNow <= 0.0001 && !checkoutZeroBalanceSettlement)
                            }
                            onClick={() => {
                              const due = appointmentDueAmountNow
                              if (checkoutZeroBalanceSettlement) {
                                setAppointmentPaymentMethod('qrpay')
                                setAppointmentSettlementPaymentAmounts({ cash: '', qrpay: '', credit_card: '', customer_balance: '' })
                              } else {
                                setAppointmentPaymentMethod('cash')
                                setAppointmentSettlementPaymentAmounts({ cash: due > 0 ? due.toFixed(2) : '', qrpay: '', credit_card: '', customer_balance: '' })
                              }
                              setAppointmentDiscountTypeDraft('fixed')
                              setAppointmentDiscountValueDraft('')
                              setAppointmentDiscountRemarkDraft('')
                              reportAppointmentCheckoutError(null)
                              setAppointmentCheckoutConfirmationOpen(true)
                            }}
                            className="min-h-[44px] rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"
                            title={
                              cashShiftActionDisabled
                                ? requireOpenShiftMessage
                                : appointmentHasUnsettledRangePricing
                                ? UNSETTLED_RANGE_CHECKOUT_MESSAGE
                                : checkoutZeroBalanceSettlement
                                  ? 'Confirm checkout and receipt'
                                  : undefined
                            }
                          >
                            Checkout
                          </button>
                          {appointmentShowApplyPackageButton ? (
                            <button
                              type="button"
                              disabled={cashShiftActionDisabled || appointmentActionLoading}
                              title={cashShiftActionTitle ?? undefined}
                              onClick={() => setApplyPackageModalOpen(true)}
                              className="min-h-[44px] rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:pointer-events-none disabled:opacity-50"
                            >
                              Apply package
                            </button>
                          ) : packageReservedPendingRegister ? (
                            <button
                              type="button"
                              disabled={cashShiftActionDisabled || appointmentActionLoading}
                              title={cashShiftActionTitle}
                              onClick={() => setApplyPackageModalOpen(true)}
                              className="min-h-[44px] rounded-lg border-2 border-amber-600 bg-white py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50 disabled:pointer-events-none disabled:opacity-50"
                            >
                              Manage packages
                            </button>
                          ) : null}
                        </div>
                        {appointmentShowApplyPackageButton && appointmentPackageDisabledReason ? (
                          <p className="text-[11px] font-medium text-amber-700">{appointmentPackageDisabledReason}</p>
                        ) : null}
                        {appointmentHasUnsettledRangePricing ? (
                          <p className="text-[11px] font-medium text-amber-700">{UNSETTLED_RANGE_CHECKOUT_MESSAGE}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {showAppointmentMarkCompletedBlock ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Complete visit</p>
                        <p className="text-xs text-slate-500">
                          {canAppointmentCheckoutAndPackage
                            ? 'Mark as Completed first to enable Checkout / Apply package.'
                            : 'Mark as Completed when the visit is finished.'}
                        </p>
                        <button
                          type="button"
                          disabled={!canMarkAppointmentCompleted || appointmentActionLoading}
                          title={cashShiftActionDisabled && requiresOpenCashShift ? requireOpenShiftMessage : 'Mark appointment as completed'}
                          onClick={() => void markAppointmentCompleted()}
                          className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
                        >
                          Mark as Completed
                        </button>
                      </div>
                    ) : null}
                  </section>
                  ) : null}

                  {/* Booking actions */}
                  {canRunAppointmentLifecycleActions &&
                  appointmentDetail.status === 'CONFIRMED' &&
                  !appointmentCheckoutCompleted ? (
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
                          onClick={() => requestAppointmentStatusUpdate('CANCELLED')}
                          className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={cashShiftActionDisabled || appointmentActionLoading}
                          title={cashShiftActionDisabled && requiresOpenCashShift ? requireOpenShiftMessage : 'Customer did not attend the scheduled appointment (DNA / no-show).'}
                          onClick={() => requestAppointmentStatusUpdate('NO_SHOW')}
                          className="min-h-[48px] rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          No Show
                        </button>
                        <button
                          type="button"
                          disabled={cashShiftActionDisabled || appointmentActionLoading}
                          title={cashShiftActionTitle}
                          onClick={() => requestAppointmentStatusUpdate('LATE_CANCELLATION')}
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
                        canManage={(canManagePosAppointments || canPosCheckout) && !cashShiftActionDisabled}
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
                              {item.paid_at ? ` · ${formatDateTime12Hour(item.paid_at)}` : ''}
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
      </div>

      {isCompactLayout === true &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            {!hasAppointmentSettlementTarget ? (
              <div
                className={[
                  'pos-floating-settlement-bar pos-floating-settlement-bar--placeholder touch-manipulation',
                  compactPosBodyModalOpen && 'pos-floating-settlement-bar--hidden',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug text-slate-700">Select an appointment in the schedule</span>
                  <span className="pos-floating-settlement-bar-hint mt-0.5 block text-xs leading-snug text-slate-500">
                    After selecting, tap <strong className="font-bold text-emerald-700">View Details</strong> to open settlement
                  </span>
                </span>
              </div>
            ) : null}
            {hasAppointmentSettlementTarget && !settlementSheetOpen ? (
              <button
                type="button"
                aria-label="View appointment settlement details"
                aria-expanded={settlementSheetOpen}
                onClick={() => setSettlementSheetOpen(true)}
                className={[
                  'pos-floating-settlement-bar touch-manipulation',
                  settlementBarPulse ? 'pos-floating-settlement-bar--pulse' : '',
                  compactPosBodyModalOpen && 'pos-floating-settlement-bar--hidden',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="pos-floating-settlement-bar-leading flex min-w-0 items-center gap-3">
                  <span className="pos-floating-settlement-bar-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span className="flex min-w-0 flex-col items-start text-left">
                    <span className="pos-floating-settlement-bar-subtitle text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      {appointmentDetailLoading
                        ? 'Loading appointment…'
                        : appointmentDetail?.booking_code ?? 'Appointment selected'}
                    </span>
                    <span className="pos-floating-settlement-bar-title truncate text-sm font-bold text-gray-900">
                      {appointmentDetailLoading
                        ? 'Loading…'
                        : appointmentDetail
                          ? formatAppointmentCustomerDisplayName(appointmentDetail)
                          : 'Appointment selected'}
                    </span>
                  </span>
                </span>
                <span className="pos-floating-settlement-bar-trailing flex shrink-0 flex-col items-end gap-1.5 text-right">
                  <span>
                    <span className="pos-floating-settlement-bar-due-label block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Due</span>
                    <span className="pos-floating-settlement-bar-due-value text-lg font-extrabold tabular-nums text-emerald-700">
                      {appointmentDetailLoading ? '…' : `RM ${appointmentDueAfterDiscount.toFixed(2)}`}
                    </span>
                  </span>
                  <span className="pos-floating-settlement-bar-action inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                    View Details
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </span>
              </button>
            ) : null}
            {hasAppointmentSettlementTarget && settlementSheetOpen ? (
              <div
                className={[
                  'pos-settlement-sheet-backdrop pos-settlement-sheet-backdrop--open',
                  compactPosBodyModalOpen && 'pos-settlement-sheet-backdrop--under-modal',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSettlementSheetOpen(false)}
                aria-hidden={false}
              />
            ) : null}
          </>,
          document.body,
        )}

      {renderPosBodyModalPortal(
        createAppointmentModalOpen ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative mx-auto flex w-full max-w-5xl lg:max-w-7xl max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
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
              {createAppointmentError ? (
                <div
                  ref={createAppointmentErrorRef}
                  role="alert"
                  tabIndex={-1}
                  className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
                >
                  {createAppointmentError}
                </div>
              ) : null}
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
                              ...getSelectedAddonIds(createAppointmentAddonQuantities).map((id) => `appointment-create:addon:${id}`),
                              ...createAppointmentExtraServiceBlocks.flatMap((block) => [
                                ...(block.service ? [`appointment-create:block:${block.id}:main`] : []),
                                ...getSelectedAddonIds(block.addonQuantities).map((id) => `appointment-create:block:${block.id}:addon:${id}`),
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
                            { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, service: null, questions: [], addonQuantities: {}, addon_price_overrides: {}, addon_line_total_overrides: {} },
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
                        setCreateAppointmentAddonQuantities({})
                        setCreateAppointmentAddonPriceOverrides({})
                        setCreateAppointmentAddonLineTotalOverrides({})
                      }
                    }}
                    searchQuery={createAppointmentServiceQuery}
                    onSearchQueryChange={setCreateAppointmentServiceQuery}
                    selectedServiceId={createAppointmentServiceDraft?.id ?? null}
                    onSelectService={(service) => {
                      const selected = service as BookingServiceOption
                      setCreateAppointmentServiceDraft(selected)
                      setCreateAppointmentAddonQuantities({})
                      setCreateAppointmentAddonPriceOverrides({})
                      setCreateAppointmentAddonLineTotalOverrides({})
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
                            <button type="button" onClick={() => void openAppointmentLineSplitEditor(lineKey, createAppointmentServiceDraft.name ?? 'Main service', inherited, resolveBookingServiceLineTotal(createAppointmentServiceDraft))} className="rounded border border-indigo-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                          </div>
                        )
                      })()}
                    </div>
                  ) : null}

                  {createAppointmentQuestions.map((question) => (
                    <div key={question.id} className="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
                      <div className="mb-2.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-700">{question.title}</p>
                        {question.cn_title ? <p className="mt-0.5 text-[11px] text-gray-500">{question.cn_title}</p> : null}
                      </div>
                      <div className="space-y-2">
                        {question.options.map((option) => (
                          <BookingAddonOptionRow
                            key={option.id}
                            variant="settlement"
                            option={option}
                            selection={createAppointmentAddonQuantities}
                            onToggle={() => setCreateAppointmentAddonQuantities((prev) => toggleAddonSelection(prev, option, question.question_type, question.options.map((row) => row.id)))}
                            onQuantityChange={(qty) => setCreateAppointmentAddonQuantities((prev) => setAddonQuantity(prev, option, qty))}
                            durationLabel={<PosAddonSelectionDurationLabel option={option} selection={createAppointmentAddonQuantities} />}
                            priceLabel={
                              <PosAddonSettlementPriceLabel
                                option={option}
                                selection={createAppointmentAddonQuantities}
                                useRangeDisplay
                                emphasis
                                overrideAmount={createAppointmentAddonPriceOverrides[option.id]}
                                hasOverrideKey={Object.prototype.hasOwnProperty.call(createAppointmentAddonPriceOverrides, option.id)}
                                lineTotalOverride={createAppointmentAddonLineTotalOverrides[option.id]}
                                hasLineTotalOverrideKey={Object.prototype.hasOwnProperty.call(createAppointmentAddonLineTotalOverrides, option.id)}
                              />
                            }
                            trailing={createAppointmentServiceDraft ? (() => {
                              const lineKey = `appointment-create:addon:${option.id}`
                              const inherited = appointmentLineStaffSplits[`appointment-create:main:${createAppointmentServiceDraft.id}`] ?? assignedStaffDefaultSplit(createAppointmentAssignedStaffId)
                              const qty = getAddonQuantity(createAppointmentAddonQuantities, option.id)
                              return (
                                <div className="space-y-2.5">
                                  {renderAppointmentLineSplitStack(lineKey, inherited, 'main service')}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); openAppointmentPriceEditModal({ kind: 'createMainAddon', optionId: option.id, name: option.label ?? 'Add-on', currentUnitPrice: resolveEditSettlementAddonUnitDisplay(option.id, qty, Number(option.extra_price ?? 0), createAppointmentAddonPriceOverrides, createAppointmentAddonLineTotalOverrides), originalUnitPrice: Number(option.extra_price ?? 0), quantity: qty, priceSource: posPriceDisplayWithOverride(option, createAppointmentAddonPriceOverrides[option.id], Object.prototype.hasOwnProperty.call(createAppointmentAddonPriceOverrides, option.id)) ?? option, lineTotalOverride: createAppointmentAddonLineTotalOverrides[option.id], hasLineTotalOverrideKey: Object.prototype.hasOwnProperty.call(createAppointmentAddonLineTotalOverrides, option.id) }) }} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">Edit Price</button>
                                    <button type="button" onClick={(event) => { event.preventDefault(); void openAppointmentLineSplitEditor(lineKey, option.label, inherited) }} className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                                  </div>
                                </div>
                              )
                            })() : null}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {createAppointmentServiceDraft ? (
                    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                      <p>Duration: {Number(createAppointmentServiceDraft.duration_min ?? 0) + createAppointmentAddonDurationTotal + createAppointmentExtraTotals.baseDuration + createAppointmentExtraTotals.addonDuration} min</p>
                      <p>
                        Total price:{' '}
                        {formatPosAccumulatedPriceDisplay(createAppointmentGrandTotalBounds, { prefix: 'RM' })}
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
                                    <button type="button" onClick={() => void openAppointmentLineSplitEditor(lineKey, block.service?.name ?? 'Service block', inherited, resolveAppointmentEditLineTotal(lineKey))} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
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
                                    setCreateAppointmentExtraServiceBlocks((prev) => prev.map((row) => row.id === block.id ? { ...row, service: null, questions: [], addonQuantities: {}, addon_price_overrides: {}, addon_line_total_overrides: {} } : row))
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
                                        ? { ...row, service: selected, questions, addonQuantities: {}, addon_price_overrides: {}, addon_line_total_overrides: {} }
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
                        <div key={`${block.id}-${question.id}`} className="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
                          <div className="mb-2.5">
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-700">
                              {question.title}
                              {question.is_required ? <span className="ml-1 text-red-600">*</span> : null}
                            </p>
                            {question.cn_title ? <p className="mt-0.5 text-[11px] text-gray-500">{question.cn_title}</p> : null}
                          </div>
                          <div className="space-y-2">
                            {question.options.map((option) => (
                              <BookingAddonOptionRow
                                key={`${block.id}-option-${option.id}`}
                                variant="settlement"
                                option={option}
                                selection={block.addonQuantities}
                                onToggle={() => setCreateAppointmentExtraServiceBlocks((prev) => prev.map((row) => row.id === block.id
                                  ? { ...row, addonQuantities: toggleAddonSelection(row.addonQuantities, option, question.question_type, question.options.map((item) => item.id)) }
                                  : row))}
                                onQuantityChange={(qty) => setCreateAppointmentExtraServiceBlocks((prev) => prev.map((row) => row.id === block.id
                                  ? { ...row, addonQuantities: setAddonQuantity(row.addonQuantities, option, qty) }
                                  : row))}
                                durationLabel={<PosAddonSelectionDurationLabel option={option} selection={block.addonQuantities} />}
                                priceLabel={
                                  <PosAddonSettlementPriceLabel
                                    option={option}
                                    selection={block.addonQuantities}
                                    useRangeDisplay
                                    emphasis
                                    overrideAmount={block.addon_price_overrides[option.id]}
                                    hasOverrideKey={Object.prototype.hasOwnProperty.call(block.addon_price_overrides, option.id)}
                                    lineTotalOverride={block.addon_line_total_overrides[option.id]}
                                    hasLineTotalOverrideKey={Object.prototype.hasOwnProperty.call(block.addon_line_total_overrides, option.id)}
                                  />
                                }
                                trailing={(() => {
                                  const lineKey = `appointment-create:block:${block.id}:addon:${option.id}`
                                  const inherited = appointmentLineStaffSplits[`appointment-create:block:${block.id}:main`] ?? assignedStaffDefaultSplit(createAppointmentAssignedStaffId)
                                  const qty = getAddonQuantity(block.addonQuantities, option.id)
                                  return (
                                    <div className="space-y-2.5">
                                      {renderAppointmentLineSplitStack(lineKey, inherited, 'service block')}
                                      <div className="flex flex-wrap items-center gap-2">
                                        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); openAppointmentPriceEditModal({ kind: 'createBlockAddon', blockId: block.id, optionId: option.id, name: option.label ?? 'Add-on', currentUnitPrice: resolveEditSettlementAddonUnitDisplay(option.id, qty, Number(option.extra_price ?? 0), block.addon_price_overrides, block.addon_line_total_overrides), originalUnitPrice: Number(option.extra_price ?? 0), quantity: qty, priceSource: posPriceDisplayWithOverride(option, block.addon_price_overrides[option.id], Object.prototype.hasOwnProperty.call(block.addon_price_overrides, option.id)) ?? option, lineTotalOverride: block.addon_line_total_overrides[option.id], hasLineTotalOverrideKey: Object.prototype.hasOwnProperty.call(block.addon_line_total_overrides, option.id) }) }} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">Edit Price</button>
                                        <button type="button" onClick={(event) => { event.preventDefault(); void openAppointmentLineSplitEditor(lineKey, option.label, inherited) }} className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                                      </div>
                                    </div>
                                  )
                                })()}
                              />
                            ))}
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
                        onChange={(e) => {
                          setCreateAppointmentSlotValue(e.target.value)
                          setCreateAppointmentAssignedStaffId(null)
                        }}
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
                      {/* <p className="mt-1 text-[11px] text-gray-500">POS shows the full day; save still blocks leave, inactive staff, and booking conflicts.</p> */}
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
                    {createAppointmentNoStaffAvailableMessage ? (
                      <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                        {createAppointmentNoStaffAvailableMessage}
                      </div>
                    ) : null}
                    {createAppointmentStaffScheduleWarningMessage ? (
                      <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        {createAppointmentStaffScheduleWarningMessage}
                      </div>
                    ) : null}
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
                              max={method === 'customer_balance' ? (createAppointmentMemberWalletBalance ?? 0).toFixed(2) : undefined}
                              disabled={method === 'customer_balance' && !createAppointmentMemberSummary?.id}
                              onChange={(e) => {
                                const value = method === 'customer_balance' ? String(Math.min(Number(e.target.value || 0), createAppointmentMemberWalletBalance ?? 0)) : e.target.value
                                setCreateAppointmentDepositPayments((prev) => ({ ...prev, [method]: value }))
                                reportCreateAppointmentError(null)
                              }}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                              placeholder="0.00"
                            />
                            {method === 'customer_balance' ? <p className="mt-1 text-[11px] font-semibold text-emerald-700">{createAppointmentMemberSummary ? `Available: RM ${(createAppointmentMemberWalletBalance ?? 0).toFixed(2)}` : 'Assign a member to use Customer Balance'}</p> : null}
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

            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-5 py-3">
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
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        createAppointmentMemberPickerOpen ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={closeCreateAppointmentMemberPicker}
            aria-label="Close assign member"
          />
          <div className="relative mx-auto flex w-full max-w-2xl max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border-2 border-gray-100 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4">
              <h4 className="text-xl font-bold text-gray-900">assign member</h4>
              <div className="flex items-center gap-2">
                {canCreateMember && memberPickerForEditSettlement ? (
                  <button
                    type="button"
                    onClick={() => setIsCreateMemberModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                  >
                    <i className="fa-solid fa-user-plus" />
                    Create Member
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeCreateAppointmentMemberPicker}
                  className="rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
                >
                  <span className="text-2xl leading-none">×</span>
                </button>
              </div>
            </div>

            <div className="shrink-0 border-b-2 border-gray-200 bg-white p-5">
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

            <div className="min-h-0 flex-1 overflow-y-auto">
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
                      if (memberPickerForEditSettlement) {
                        setEditSettlementCustomerId(member.id)
                        setEditSettlementMemberSummary({
                          id: member.id,
                          name: member.name,
                          phone,
                        })
                        setEditSettlementIdentityMode('member')
                        showMsg('Member assigned.', 'success')
                      } else {
                        setCreateAppointmentCustomerId(member.id)
                        setCreateAppointmentMemberSummary({
                          id: member.id,
                          name: member.name,
                          phone,
                        })
                        showMsg('Member assigned.', 'success')
                      }
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
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        cancellationRequestsModalOpen ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div
            className="relative mx-auto flex w-full max-w-lg max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
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
                <div
                  ref={cancellationRequestsErrorRef}
                  role="alert"
                  tabIndex={-1}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
                >
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
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        holdApproveConfirmOpen && appointmentDetail ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm">
          <div
            className="relative mx-auto flex w-full max-w-md max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-hold-approve-title"
          >
            <div className="shrink-0 border-b border-gray-200 px-5 py-4">
              <h3 id="pos-hold-approve-title" className="text-lg font-bold text-gray-900">Approve booking?</h3>
              <p className="mt-1 text-sm text-gray-600">
                This confirms the deposit and changes <span className="font-mono font-semibold">{appointmentDetail.booking_code}</span> to{' '}
                <span className="font-semibold text-emerald-700">CONFIRMED</span>.
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label htmlFor="pos-hold-approve-note" className="text-xs font-semibold text-gray-600">
                  Internal note (optional)
                </label>
                <textarea
                  id="pos-hold-approve-note"
                  rows={2}
                  value={holdReviewNote}
                  onChange={(e) => setHoldReviewNote(e.target.value)}
                  disabled={appointmentActionLoading}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  placeholder="e.g. Verified QRPay slip"
                />
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                disabled={appointmentActionLoading}
                onClick={() => {
                  setHoldApproveConfirmOpen(false)
                  setHoldReviewNote('')
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={appointmentActionLoading}
                onClick={() => void approveHoldAppointment()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {appointmentActionLoading ? 'Approving…' : 'Confirm approve'}
              </button>
            </div>
          </div>
        </div>
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        holdRejectConfirmOpen && appointmentDetail ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm">
          <div
            className="relative mx-auto flex w-full max-w-md max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-hold-reject-title"
          >
            <div className="shrink-0 border-b border-gray-200 px-5 py-4">
              <h3 id="pos-hold-reject-title" className="text-lg font-bold text-gray-900">Reject payment proof?</h3>
              <p className="mt-1 text-sm text-gray-600">
                The deposit order stays open and <span className="font-mono font-semibold">{appointmentDetail.booking_code}</span> remains on{' '}
                <span className="font-semibold text-violet-700">HOLD</span>. The customer can upload a new slip from their account.
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label htmlFor="pos-hold-reject-note" className="text-xs font-semibold text-gray-600">
                  Reason for rejection <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="pos-hold-reject-note"
                  rows={3}
                  value={holdRejectNote}
                  onChange={(e) => setHoldRejectNote(e.target.value)}
                  disabled={appointmentActionLoading}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  placeholder="e.g. Slip amount does not match deposit"
                />
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                disabled={appointmentActionLoading}
                onClick={() => {
                  setHoldRejectConfirmOpen(false)
                  setHoldRejectNote('')
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={appointmentActionLoading || !holdRejectNote.trim()}
                onClick={() => void rejectHoldPaymentProof()}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {appointmentActionLoading ? 'Rejecting…' : 'Reject payment proof'}
              </button>
            </div>
          </div>
        </div>
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        holdCancelConfirmOpen && appointmentDetail ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm">
          <div
            className="relative mx-auto flex w-full max-w-md max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-hold-cancel-title"
          >
            <div className="shrink-0 border-b border-gray-200 px-5 py-4">
              <h3 id="pos-hold-cancel-title" className="text-lg font-bold text-gray-900">Cancel hold booking?</h3>
              <p className="mt-1 text-sm text-gray-600">
                This cancels <span className="font-mono font-semibold">{appointmentDetail.booking_code}</span> and releases the slot.
                {appointmentHoldDepositOrder ? ' The pending deposit order will be cancelled too.' : ''}
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label htmlFor="pos-hold-cancel-reason" className="text-xs font-semibold text-gray-600">
                  Reason (optional)
                </label>
                <textarea
                  id="pos-hold-cancel-reason"
                  rows={2}
                  value={holdCancelReason}
                  onChange={(e) => setHoldCancelReason(e.target.value)}
                  disabled={appointmentActionLoading}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  placeholder="e.g. Invalid payment proof"
                />
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                disabled={appointmentActionLoading}
                onClick={() => {
                  setHoldCancelConfirmOpen(false)
                  setHoldCancelReason('')
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={appointmentActionLoading}
                onClick={() => void cancelHoldAppointment()}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {appointmentActionLoading ? 'Cancelling…' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        appointmentStatusConfirmOpen && appointmentDetail && appointmentStatusConfirmTarget ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm">
          <div
            className="relative mx-auto flex w-full max-w-md max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-appointment-status-confirm-title"
          >
            <div className="shrink-0 border-b border-gray-200 px-5 py-4">
              <h3 id="pos-appointment-status-confirm-title" className="text-lg font-bold text-gray-900">
                {APPOINTMENT_TERMINAL_STATUS_ACTION_LABELS[appointmentStatusConfirmTarget]} appointment?
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                This will mark <span className="font-mono font-semibold">{appointmentDetail.booking_code}</span> as{' '}
                {APPOINTMENT_TERMINAL_STATUS_ACTION_LABELS[appointmentStatusConfirmTarget].toLowerCase()}.
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
                <p className="text-sm font-semibold">Deposit collected</p>
                <p className="text-xs text-amber-900/90">
                  RM {appointmentActiveDepositTotal.toFixed(2)} across {appointmentActiveDepositTransactions.length}{' '}
                  deposit receipt{appointmentActiveDepositTransactions.length === 1 ? '' : 's'}. Choose whether to void the deposit order(s) or keep them on record.
                </p>
                <ul className="space-y-1 text-xs text-amber-900/80">
                  {appointmentActiveDepositTransactions.map((tx) => (
                    <li key={`${tx.order_id ?? tx.id}`} className="flex items-center justify-between gap-2">
                      <span className="font-mono">{tx.order_number || `Order #${tx.order_id ?? tx.id}`}</span>
                      <span className="font-semibold tabular-nums">RM {Number(tx.amount ?? 0).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <label className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left">
                  <input
                    type="radio"
                    name="appointment_status_void_deposit"
                    checked={!appointmentStatusVoidDeposit}
                    onChange={() => setAppointmentStatusVoidDeposit(false)}
                    disabled={appointmentActionLoading}
                    className="mt-1 shrink-0"
                  />
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-semibold text-slate-900">Keep deposit</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                      Update the appointment status only. Deposit receipt(s) stay active.
                    </span>
                  </span>
                </label>
                <label className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-rose-200 bg-rose-50/40 px-3 py-2.5 text-left">
                  <input
                    type="radio"
                    name="appointment_status_void_deposit"
                    checked={appointmentStatusVoidDeposit}
                    onChange={() => setAppointmentStatusVoidDeposit(true)}
                    disabled={appointmentActionLoading}
                    className="mt-1 shrink-0"
                  />
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-semibold text-slate-900">Void deposit receipt(s)</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                      Void the linked deposit order(s) and update the appointment status.
                    </span>
                  </span>
                </label>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                disabled={appointmentActionLoading}
                onClick={() => {
                  setAppointmentStatusConfirmOpen(false)
                  setAppointmentStatusConfirmTarget(null)
                  setAppointmentStatusVoidDeposit(false)
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={appointmentActionLoading}
                onClick={() => void updateAppointmentStatus(appointmentStatusConfirmTarget, appointmentStatusVoidDeposit)}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {appointmentActionLoading
                  ? 'Processing…'
                  : `Confirm ${APPOINTMENT_TERMINAL_STATUS_ACTION_LABELS[appointmentStatusConfirmTarget]}`}
              </button>
            </div>
          </div>
        </div>
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        cancellationConfirmOpen && cancellationConfirmRow && cancellationConfirmAction ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm">
          <div
            className="relative mx-auto flex w-full max-w-md max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-cancellation-confirm-title"
          >
            <div className="shrink-0 border-b border-gray-200 px-5 py-4">
              <h3 id="pos-cancellation-confirm-title" className="text-lg font-bold text-gray-900">
                {cancellationConfirmAction === 'approve' ? 'Approve cancellation?' : 'Reject cancellation?'}
              </h3>
              <p className="mt-1 text-xs text-gray-500">Review the details and add an optional note before confirming.</p>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
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
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-5 py-3">
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
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        appointmentRescheduleOpen && appointmentDetail ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="relative mx-auto flex w-full max-w-lg max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="shrink-0 px-5 pt-5">
              <h3 className="text-lg font-bold text-gray-900">Reschedule Appointment</h3>
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
              <p>
                <span className="font-semibold">Booking:</span> {appointmentDetail.booking_code}
              </p>
              <p>
                <span className="font-semibold">Customer:</span> {formatAppointmentCustomerDisplayName(appointmentDetail)}
              </p>
              <p>
                <span className="font-semibold">Current Staff:</span> {formatAppointmentStaffLabel(appointmentDetail)}
              </p>
              <p>
                <span className="font-semibold">Current Date/Time:</span>{' '}
                {formatDateTimeRange(appointmentDetail.appointment_start_at, appointmentDetail.appointment_end_at)}
              </p>
            </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5">
            {appointmentRescheduleError ? (
              <div
                ref={appointmentRescheduleErrorRef}
                role="alert"
                tabIndex={-1}
                className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
              >
                {appointmentRescheduleError}
              </div>
            ) : null}
            <div className="space-y-3">
              {activeStaffs.length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No active staff available. Assign staff in settings before rescheduling.
                </div>
              ) : null}

              <div>
                <label className="text-xs font-semibold text-gray-600">Assigned Staff</label>
                <select
                  value={appointmentRescheduleStaffId ?? ''}
                  onChange={(e) => {
                    setAppointmentRescheduleStaffId(Number(e.target.value) || null)
                    setAppointmentRescheduleSlotValue('')
                  }}
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
                  onChange={(e) => {
                    setAppointmentRescheduleDate(e.target.value)
                    setAppointmentRescheduleSlotValue('')
                  }}
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
                {/* <p className="mt-1 text-[11px] text-gray-500">POS shows the full day; save still blocks leave, inactive staff, and booking conflicts.</p> */}
              </div>
              {appointmentRescheduleOutsideStaffSchedule ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  Selected time is outside staff schedule. POS can continue if this is a walk-in / overtime appointment.
                </div>
              ) : null}
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
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-5 py-3">
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
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        editSettlementOpen && appointmentDetail ? (
        <div className="pos-body-stack-modal flex items-end justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-2 sm:items-center sm:p-4">
          <div className="relative mx-auto flex h-full max-h-[95dvh] w-full max-w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-h-[min(90dvh,calc(100vh-2rem))] sm:max-w-5xl sm:rounded-2xl lg:max-w-7xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-3 sm:px-5 sm:py-4">
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

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
              {editSettlementError ? (
                <div
                  ref={editSettlementErrorRef}
                  role="alert"
                  tabIndex={-1}
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
                >
                  {editSettlementError}
                </div>
              ) : null}
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold">Estimated duration after save: {editSettlementEstimatedDurationMin > 0 ? `${editSettlementEstimatedDurationMin} min` : '—'}</p>
                    <p className="text-xs text-amber-800">
                      {String(appointmentDetail.status ?? '').toUpperCase() === 'COMPLETED'
                        ? 'Completed appointments no longer hold the calendar slot; duration updates are for records only.'
                        : 'Backend will validate the updated time range before saving.'}
                    </p>
                  </div>
                  <div className="text-xs font-semibold tabular-nums text-amber-950">
                    {formatTimeRange(appointmentDetail.appointment_start_at, editSettlementEstimatedEndAt)}
                  </div>
                </div>
                {String(appointmentDetail.status ?? '').toUpperCase() !== 'COMPLETED' && editSettlementAvailability?.is_outside_staff_schedule ? (
                  <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-amber-900">
                    Updated appointment time is outside staff schedule. POS can continue if this is a walk-in / overtime appointment.
                  </p>
                ) : null}
                {String(appointmentDetail.status ?? '').toUpperCase() !== 'COMPLETED' && editSettlementAvailability?.is_hard_block ? (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                    Updated appointment time is blocked by staff leave/off day, inactive staff, or another booking conflict.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-5">
              <div className="space-y-3">
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Staff Split Bulk Setup</p>
                      <p className="mt-0.5 text-[11px] text-indigo-700">Apply one split to the original main service, added service blocks, and all selected add-ons.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!appointmentDetail?.id) return
                        const lineKeys = [
                          ...getSelectedAddonIds(editAddonQuantities).map((id) => `appointment-settlement:${appointmentDetail.id}:addon:${id}`),
                          ...editAddedMainBlocks.flatMap((block) => getSelectedAddonIds(block.selected_addon_ids).map((id) => `appointment-settlement:${appointmentDetail.id}:block:${block.tmp_id}:addon:${id}`)),
                        ]
                        void openAppointmentBulkLineSplitEditor('Edit Settlement Lines', lineKeys, editStaffSplitsToLineSplits(editStaffSplits), { applyEditSettlementMainServices: true })
                      }}
                      className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      Apply Staff Split to All Lines
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Service Block · Original</p>
                      <PosServiceNameStack
                        name={editOriginalService?.name ?? appointmentDetail.service?.name ?? 'Service'}
                        cnName={editOriginalService?.cn_name ?? appointmentDetail.service?.cn_name}
                        primaryClassName="mt-1 text-sm font-semibold text-gray-900"
                        secondaryClassName="mt-0.5 text-xs text-gray-500"
                      />
                      {settlementNeedsSettledAmount(editOriginalSettlementSource) ? (
                        <>
                          <p className="mt-2 text-xs text-gray-500">
                            Ref range: RM {getSettlementRangeBounds(editOriginalSettlementSource).min.toFixed(2)} – RM{' '}
                            {getSettlementRangeBounds(editOriginalSettlementSource).max.toFixed(2)}
                          </p>
                          <div className="relative mt-2 max-w-xs">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">RM</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={editSettledAmount}
                              onChange={(e) => {
                                reportEditSettlementError(null)
                                setEditSettledAmount(e.target.value)
                              }}
                              className="w-full rounded-lg border-2 border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              placeholder={`${getSettlementRangeBounds(editOriginalSettlementSource).min.toFixed(2)} - ${getSettlementRangeBounds(editOriginalSettlementSource).max.toFixed(2)}`}
                            />
                          </div>
                          <p className="mt-1 text-[10px] text-gray-500">
                            Enter the final service amount within the reference range.
                            {Number(editOriginalService?.duration_min ?? 0) > 0 ? ` · ${editOriginalService?.duration_min}min` : ''}
                          </p>
                        </>
                      ) : (
                        <div className="mt-1 flex flex-col items-start gap-1">
                          <p className="text-xs text-gray-600">
                            RM {Number(
                              editOriginalServicePriceOverride
                                ?? editOriginalService?.service_price
                                ?? editOriginalService?.price
                                ?? appointmentDetail.service_total
                                ?? 0,
                            ).toFixed(2)}
                            {Number(editOriginalService?.duration_min ?? 0) > 0 ? ` · ${editOriginalService?.duration_min}min` : ''}
                          </p>
                          <button type="button" onClick={() => openAppointmentPriceEditModal({ kind: 'originalService', name: editOriginalService?.name ?? appointmentDetail.service?.name ?? 'Service', currentUnitPrice: Number(editOriginalServicePriceOverride ?? editOriginalService?.service_price ?? editOriginalService?.price ?? appointmentDetail.service_total ?? 0), originalUnitPrice: Number(editOriginalService?.service_price ?? editOriginalService?.price ?? appointmentDetail.service_total ?? 0), quantity: 1, priceSource: editOriginalService ?? editOriginalSettlementSource })} className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button>
                        </div>
                      )}
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
                      const next = [...prev, { staff_id: null, share_percent: '', share_amount: '0.00' }]
                      if (!editStaffSplitAutoBalance) return next
                      return rebalanceSettlementInlineStaffRows(next, editStaffSplitMode, editOriginalLineTotal, true)
                    })}
                    className="rounded-md border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    + Add Staff
                  </button>
                </div>
                <StaffSplitModeToggle
                  mode={editStaffSplitMode}
                  allowAmountMode={editSettlementStaffSplitAllowAmountMode}
                  showAmountOption={editOriginalLineTotal != null && editOriginalLineTotal > 0}
                  className="mb-2 flex flex-wrap gap-2"
                  onModeChange={setEditStaffSplitMode}
                  onSelectAmount={() => {
                    if (editOriginalLineTotal == null) return
                    setEditStaffSplitMode('amount')
                    setEditStaffSplits((prev) => prev.map((row, index) => ({
                      ...row,
                      share_amount: percentsToAmounts(
                        prev.map((item) => Number.parseInt(item.share_percent || '0', 10)),
                        editOriginalLineTotal,
                      )[index]?.toFixed(2) ?? row.share_amount,
                    })))
                  }}
                />
                {editStaffSplitMode === 'amount' && editOriginalLineTotal != null ? (
                  <p className="mb-2 text-xs text-gray-600">
                    Line total: <span className="font-bold">{editOriginalLineTotal.toFixed(2)}</span>
                  </p>
                ) : null}
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={editStaffSplitAutoBalance}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setEditStaffSplitAutoBalance(checked)
                      if (checked) {
                        setEditStaffSplits((prev) => rebalanceSettlementInlineStaffRows(prev, editStaffSplitMode, editOriginalLineTotal, true))
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Auto Balance (lock first row{editStaffSplitMode === 'amount' ? ', auto adjust to line total' : ', auto adjust to 100%'})
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
                            reportEditSettlementError(null)
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
                      {editStaffSplitMode === 'amount' ? (
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">RM</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={split.share_amount}
                            disabled={editStaffSplitAutoBalance && idx === 0}
                            onChange={(e) => updateEditSettlementSplitAmount(idx, e.target.value)}
                            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-2 text-sm"
                          />
                        </div>
                      ) : (
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
                      )}
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
                  <div className="space-y-4">
                    {editAddonQuestions.map((question) => (
                      <div key={question.id} className="rounded-xl border border-gray-200 bg-gray-50/40 p-2.5 sm:p-3">
                        <div className="mb-2.5">
                          <p className="text-xs font-bold uppercase tracking-wide text-gray-700">{question.title}</p>
                          {question.cn_title ? <p className="mt-0.5 text-[11px] text-gray-500">{question.cn_title}</p> : null}
                        </div>
                        <div className="space-y-2">
                          {question.options.map((opt) => (
                            <BookingAddonOptionRow
                              key={opt.id}
                              variant="settlement"
                              option={opt}
                              selection={editAddonQuantities}
                              onToggle={() => toggleEditAddon(opt, question.question_type, question.options.map((row) => row.id))}
                              onQuantityChange={(qty) => setEditAddonQuantity(opt, qty)}
                              durationLabel={<PosAddonSelectionDurationLabel option={opt} selection={editAddonQuantities} />}
                              priceLabel={
                                <PosAddonSettlementPriceLabel
                                  option={opt}
                                  selection={editAddonQuantities}
                                  useRangeDisplay
                                  emphasis
                                  overrideAmount={editAddonPriceOverrides[opt.id]}
                                  hasOverrideKey={Object.prototype.hasOwnProperty.call(editAddonPriceOverrides, opt.id)}
                                  lineTotalOverride={editAddonLineTotalOverrides[opt.id]}
                                  hasLineTotalOverrideKey={Object.prototype.hasOwnProperty.call(editAddonLineTotalOverrides, opt.id)}
                                />
                              }
                              trailing={appointmentDetail?.id ? (() => {
                                const lineKey = `appointment-settlement:${appointmentDetail.id}:addon:${opt.id}`
                                const inherited = editStaffSplitsToLineSplits(editStaffSplits)
                                const qty = getAddonQuantity(editAddonQuantities, opt.id)
                                return (
                                  <div className="space-y-2.5">
                                    {renderAppointmentLineSplitStack(lineKey, inherited, 'main service')}
                                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); openAppointmentPriceEditModal({ kind: 'originalAddon', optionId: opt.id, name: opt.label ?? 'Add-on', currentUnitPrice: resolveEditSettlementAddonUnitDisplay(opt.id, qty, Number(opt.extra_price ?? 0), editAddonPriceOverrides, editAddonLineTotalOverrides), originalUnitPrice: Number(opt.extra_price ?? 0), quantity: qty, priceSource: posPriceDisplayWithOverride(opt, editAddonPriceOverrides[opt.id], Object.prototype.hasOwnProperty.call(editAddonPriceOverrides, opt.id)) ?? opt, lineTotalOverride: editAddonLineTotalOverrides[opt.id], hasLineTotalOverrideKey: Object.prototype.hasOwnProperty.call(editAddonLineTotalOverrides, opt.id) }) }} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">Edit Price</button>
                                      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void openAppointmentLineSplitEditor(lineKey, opt.label, inherited, resolveAppointmentEditLineTotal(lineKey)) }} className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                                    </div>
                                  </div>
                                )
                              })() : null}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>

                <div className="space-y-5">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-sm font-bold text-gray-900">Customer</p>
                    <p className="mt-0.5 text-xs text-gray-500">Update member or guest details for settlement and receipts.</p>
                    <div
                      className="mt-3 flex w-full rounded-lg border border-gray-300 bg-gray-100 p-1"
                      role="tablist"
                      aria-label="Customer type"
                    >
                      <button
                        type="button"
                        onClick={() => setEditSettlementIdentityMode('member')}
                        role="tab"
                        aria-selected={editSettlementIdentityMode === 'member'}
                        className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                          editSettlementIdentityMode === 'member'
                            ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Member
                      </button>
                      <button
                        type="button"
                        disabled={appointmentPackageApplied}
                        title={appointmentPackageApplied ? 'Cannot switch to guest while a package is applied.' : undefined}
                        onClick={() => {
                          if (appointmentPackageApplied) return
                          setEditSettlementIdentityMode('guest')
                          setEditSettlementCustomerId(null)
                          setEditSettlementMemberSummary(null)
                          setMemberPickerForEditSettlement(false)
                          closeCreateAppointmentMemberPicker()
                        }}
                        role="tab"
                        aria-selected={editSettlementIdentityMode === 'guest'}
                        className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                          editSettlementIdentityMode === 'guest'
                            ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Guest
                      </button>
                    </div>

                    {editSettlementIdentityMode === 'member' ? (
                      <div className="mt-3">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-semibold text-gray-600">Member</label>
                          <div className="flex items-center gap-2">
                            {canCreateMember ? (
                              <button
                                type="button"
                                disabled={appointmentPackageApplied}
                                title={appointmentPackageApplied ? 'Cannot change member while a package is applied.' : undefined}
                                onClick={() => {
                                  if (appointmentPackageApplied) return
                                  setIsCreateMemberModalOpen(true)
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                              >
                                <i className="fa-solid fa-user-plus" />
                                Create
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={appointmentPackageApplied}
                              title={appointmentPackageApplied ? 'Cannot change member while a package is applied.' : undefined}
                              onClick={() => {
                                if (appointmentPackageApplied) return
                                setMemberPickerForEditSettlement(true)
                                setCreateAppointmentMemberQuery('')
                                setCreateAppointmentMemberResults([])
                                setCreateAppointmentMemberPickerOpen(true)
                              }}
                              className="rounded-md border border-indigo-300 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700"
                            >
                              {editSettlementMemberSummary ? 'change member' : 'assign member'}
                            </button>
                          </div>
                        </div>
                        <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                          {editSettlementMemberSummary
                            ? `${editSettlementMemberSummary.name}${
                                editSettlementMemberSummary.phone ? ` (${editSettlementMemberSummary.phone})` : ''
                              }`
                            : 'No member selected'}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <input
                          value={editSettlementGuestName}
                          onChange={(e) => {
                            reportEditSettlementError(null)
                            setEditSettlementGuestName(e.target.value)
                          }}
                          placeholder="Guest name"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        />
                        <InternationalPhoneInput
                          value={editSettlementGuestPhone}
                          onChange={(value) => {
                            reportEditSettlementError(null)
                            setEditSettlementGuestPhone(value)
                          }}
                          placeholder="Guest phone"
                        />
                        <input
                          value={editSettlementGuestEmail}
                          onChange={(e) => {
                            reportEditSettlementError(null)
                            setEditSettlementGuestEmail(e.target.value)
                          }}
                          placeholder="Guest email"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        />
                        <p className="text-[11px] text-gray-500">Leave name empty for walk-in / unknown guest. Phone or email required for named guests.</p>
                      </div>
                    )}
                  </div>

                  {canEditAppointmentSettlement ? (
                  <PosAppointmentDepositCreditSection
                    bookingId={appointmentDetail.id}
                    initialTransactions={appointmentDetail.deposit_transactions}
                    initialTotal={Number(appointmentDetail.deposit_previously_collected_amount ?? appointmentDetail.deposit_contribution ?? 0)}
                    onTotalChange={setEditSettlementDepositTotal}
                    onError={reportEditSettlementError}
                    showMsg={showMsg}
                    onAppointmentUpdated={(payload) => {
                      const appointmentPatch = (payload.appointment ?? {}) as Partial<PosAppointmentDetail>
                      const nextDepositTotal = Number(
                        appointmentPatch.deposit_previously_collected_amount
                        ?? appointmentPatch.deposit_contribution
                        ?? payload.deposit_total
                        ?? 0,
                      )
                      setAppointmentDetail((current) => current ? {
                        ...current,
                        ...appointmentPatch,
                        deposit_transactions: payload.deposit_transactions ?? current.deposit_transactions,
                        deposit_contribution: Number(appointmentPatch.deposit_contribution ?? nextDepositTotal),
                        deposit_previously_collected_amount: Number(appointmentPatch.deposit_previously_collected_amount ?? nextDepositTotal),
                        deposit_previously_collected: Boolean(
                          appointmentPatch.deposit_previously_collected ?? nextDepositTotal > 0.0001,
                        ),
                        deposit_paid: Number(appointmentPatch.deposit_paid ?? appointmentPatch.deposit_contribution ?? nextDepositTotal),
                        payment_history: appointmentPatch.payment_history ?? current.payment_history,
                        receipts: appointmentPatch.receipts ?? current.receipts,
                        balance_due: Number(payload.balance_due ?? appointmentPatch.balance_due ?? current.balance_due ?? 0),
                        amount_due_now: Number(payload.amount_due_now ?? appointmentPatch.amount_due_now ?? current.amount_due_now ?? 0),
                      } : current)
                      setEditSettlementDepositTotal(nextDepositTotal)
                      void refreshOpenedAppointmentDetail()
                      void fetchAppointments({ silent: true })
                    }}
                  />
                  ) : null}

                  {canEditAppointmentSettlement ? (
                  <PosAppointmentRefundCreditSection
                    bookingId={appointmentDetail.id}
                    refundNeeded={appointmentRefundNeededAmount}
                    initialTransactions={appointmentDetail.refund_transactions}
                    onError={reportEditSettlementError}
                    showMsg={showMsg}
                    onAppointmentUpdated={(payload) => {
                      const appointmentPatch = (payload.appointment ?? {}) as Partial<PosAppointmentDetail>
                      setAppointmentDetail((current) => current ? {
                        ...current,
                        ...appointmentPatch,
                        refund_transactions: payload.refund_transactions ?? current.refund_transactions,
                        overpaid_amount: Number(payload.overpaid_amount ?? appointmentPatch.overpaid_amount ?? current.overpaid_amount ?? 0),
                        refund_needed: Number(payload.refund_needed ?? appointmentPatch.refund_needed ?? current.refund_needed ?? 0),
                        refund_handled: Boolean(payload.refund_handled ?? appointmentPatch.refund_handled ?? current.refund_handled),
                        refund_handled_amount: Number(payload.refund_handled_amount ?? appointmentPatch.refund_handled_amount ?? current.refund_handled_amount ?? 0),
                        balance_due: Number(payload.balance_due ?? appointmentPatch.balance_due ?? current.balance_due ?? 0),
                        amount_due_now: Number(payload.amount_due_now ?? appointmentPatch.amount_due_now ?? current.amount_due_now ?? 0),
                      } : current)
                      void refreshOpenedAppointmentDetail()
                      void fetchAppointments({ silent: true })
                    }}
                  />
                  ) : null}

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <label className="text-xs font-semibold text-gray-700">Settlement Note</label>
                    <textarea
                      value={editSettlementNoteDraft}
                      onChange={(e) => setEditSettlementNoteDraft(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Edit settlement note..."
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">Changes replace the current note when you save.</p>
                  </div>

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
                const selectedAddons = addonOptions.filter((opt) => isAddonSelected(block.selected_addon_ids, opt.id))
                const addonTotal = selectedAddons.reduce((sum, opt) => {
                  const qty = getAddonQuantity(block.selected_addon_ids, opt.id)
                  const unit = Number(block.addon_price_overrides[opt.id] ?? opt.extra_price ?? 0)
                  const hasLineOverride = Object.prototype.hasOwnProperty.call(block.addon_line_total_overrides, opt.id)
                  const line = hasLineOverride
                    ? Number(block.addon_line_total_overrides[opt.id] ?? 0)
                    : unit * qty
                  return sum + line
                }, 0)
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
                            <div className="mt-1 flex flex-wrap items-center gap-2"><p className="text-xs text-gray-600">{formatPosCurrentOrRangeDisplay({ ...block, extra_price: block.price, price_finalized: block.price_finalized })}{block.duration_min > 0 ? ` · ${block.duration_min}min` : ''}{posPriceDisplayHasRange(block) && posPriceDisplayHasFinalPrice({ ...block, extra_price: block.price, price_finalized: block.price_finalized }) ? <span className="block text-[10px] font-medium text-gray-500">Ref range: {formatPosPriceDisplay(block)}</span> : null}{posPriceDisplayHasRange(block) && !posPriceDisplayHasFinalPrice({ ...block, extra_price: block.price, price_finalized: block.price_finalized }) ? <span className="block text-[10px] font-medium text-amber-700">Range pricing — please set final price before checkout.</span> : null}</p><button type="button" onClick={() => openAppointmentPriceEditModal(buildAddedServicePriceEditTarget(block))} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">Edit Price</button></div>
                          </>
                        ) : (
                          <p className="text-sm font-semibold text-gray-700">Select a service</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeEditAddedMainBlock(block.tmp_id)}
                        className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Added blocks are only created after selecting a service. */}

                    {block.service_id > 0 ? (
                      <>
                    <div className="space-y-2">
                      <StaffSplitModeToggle
                        mode={block.split_mode === 'amount' && resolveEditAddedMainBlockLineTotal(block) == null ? 'percent' : block.split_mode}
                        allowAmountMode={resolveEditAddedMainBlockLineTotal(block) != null && !isEditAddedMainBlockPackageCovered(block)}
                        showAmountOption={resolveEditAddedMainBlockLineTotal(block) != null}
                        onModeChange={(mode) => updateEditAddedMainSplitMode(block.tmp_id, mode)}
                        onSelectAmount={() => updateEditAddedMainSplitMode(block.tmp_id, 'amount')}
                      />
                      {block.split_mode === 'amount' && resolveEditAddedMainBlockLineTotal(block) != null ? (
                        <p className="text-xs text-gray-600">
                          Line total: <span className="font-bold">{resolveEditAddedMainBlockLineTotal(block)!.toFixed(2)}</span>
                        </p>
                      ) : null}
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={block.auto_balance}
                          onChange={(e) => toggleEditAddedMainAutoBalance(block.tmp_id, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Auto Balance (lock first row{block.split_mode === 'amount' ? ', auto adjust to line total' : ', auto adjust to 100%'})
                      </label>
                      {block.staff_splits.map((split, idx) => (
                        <div key={`added-split-${block.tmp_id}-${idx}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto]">
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
                          {block.split_mode === 'amount' ? (
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">RM</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={split.share_amount}
                                disabled={block.auto_balance && idx === 0}
                                onChange={(e) => updateEditAddedMainSplitAmount(block.tmp_id, idx, e.target.value)}
                                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-2 text-sm"
                              />
                            </div>
                          ) : (
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={split.share_percent}
                              disabled={block.auto_balance && idx === 0}
                              onChange={(e) => updateEditAddedMainSplitShare(block.tmp_id, idx, e.target.value)}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setEditAddedMainBlocks((prev) => prev.map((item) => item.tmp_id === block.tmp_id
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
                        onClick={() => setEditAddedMainBlocks((prev) => prev.map((item) => item.tmp_id === block.tmp_id ? { ...item, staff_splits: [...item.staff_splits, { staff_id: null, share_percent: '', share_amount: '0.00' }] } : item))}
                        className="rounded-md border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-700"
                      >
                        + Add Staff
                      </button>
                    </div>
                      <div className="mt-3 space-y-2">
                      {block.addon_questions.map((question) => (
                        <div key={`added-q-${block.service_id}-${question.id}`} className="rounded-xl border border-gray-200 bg-gray-50/40 p-2.5 sm:p-3">
                          <div className="mb-2.5">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-700">{question.title}</p>
                            {question.cn_title ? <p className="mt-0.5 text-[11px] text-gray-500">{question.cn_title}</p> : null}
                          </div>
                          <div className="space-y-2">
                          {question.options.map((opt) => (
                            <BookingAddonOptionRow
                              key={`added-opt-${block.service_id}-${opt.id}`}
                              variant="settlement"
                              option={opt}
                              selection={block.selected_addon_ids}
                              onToggle={() => void toggleEditAddedMainBlockAddon(block.tmp_id, opt, question.question_type, question.options.map((row) => row.id))}
                              onQuantityChange={(qty) => void setEditAddedMainBlockAddonQuantity(block.tmp_id, opt, qty)}
                              durationLabel={<PosAddonSelectionDurationLabel option={opt} selection={block.selected_addon_ids} />}
                              priceLabel={
                                <PosAddonSettlementPriceLabel
                                  option={opt}
                                  selection={block.selected_addon_ids}
                                  useRangeDisplay
                                  emphasis
                                  overrideAmount={block.addon_price_overrides[opt.id]}
                                  hasOverrideKey={Object.prototype.hasOwnProperty.call(block.addon_price_overrides, opt.id)}
                                  lineTotalOverride={block.addon_line_total_overrides[opt.id]}
                                  hasLineTotalOverrideKey={Object.prototype.hasOwnProperty.call(block.addon_line_total_overrides, opt.id)}
                                />
                              }
                              trailing={appointmentDetail?.id ? (() => {
                                const lineKey = `appointment-settlement:${appointmentDetail.id}:block:${block.tmp_id}:addon:${opt.id}`
                                const inherited = editStaffSplitsToLineSplits(block.staff_splits)
                                const qty = getAddonQuantity(block.selected_addon_ids, opt.id)
                                return (
                                  <div className="space-y-2.5">
                                    {renderAppointmentLineSplitStack(lineKey, inherited, 'service block')}
                                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); openAppointmentPriceEditModal({ kind: 'addedAddon', tmpId: block.tmp_id, optionId: opt.id, name: opt.label ?? 'Add-on', currentUnitPrice: resolveEditSettlementAddonUnitDisplay(opt.id, qty, Number(opt.extra_price ?? 0), block.addon_price_overrides, block.addon_line_total_overrides), originalUnitPrice: Number(opt.extra_price ?? 0), quantity: qty, priceSource: posPriceDisplayWithOverride(opt, block.addon_price_overrides[opt.id], Object.prototype.hasOwnProperty.call(block.addon_price_overrides, opt.id)) ?? opt, lineTotalOverride: block.addon_line_total_overrides[opt.id], hasLineTotalOverrideKey: Object.prototype.hasOwnProperty.call(block.addon_line_total_overrides, opt.id) }) }} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">Edit Price</button>
                                      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void openAppointmentLineSplitEditor(lineKey, opt.label, inherited, resolveAppointmentEditLineTotal(lineKey)) }} className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100">{appointmentLineStaffSplits[lineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                                    </div>
                                  </div>
                                )
                              })() : null}
                            />
                          ))}
                          </div>
                        </div>
                      ))}
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
                  const selectedAddons = allOptions.filter((o) => isAddonSelected(editAddonQuantities, o.id))
                  const addonBounds = accumulatePosPriceBounds(
                    selectedAddons.map((option) => ({
                      source: { ...option, quantity: getAddonQuantity(editAddonQuantities, option.id) },
                      overrideAmount: editAddonPriceOverrides[option.id],
                      hasOverrideKey: Object.prototype.hasOwnProperty.call(editAddonPriceOverrides, option.id),
                      lineTotalOverride: editAddonLineTotalOverrides[option.id],
                      hasLineTotalOverrideKey: Object.prototype.hasOwnProperty.call(editAddonLineTotalOverrides, option.id),
                    })),
                  )
                  const selectedMainServices = editAddedMainBlocks
                  const addedMainTotal = selectedMainServices.reduce((sum, service) => {
                    const addonOptions = service.addon_questions.flatMap((q) => q.options)
                    const blockAddonBounds = accumulatePosPriceBounds(
                      addonOptions
                        .filter((opt) => isAddonSelected(service.selected_addon_ids, opt.id))
                        .map((opt) => ({
                          source: { ...opt, quantity: getAddonQuantity(service.selected_addon_ids, opt.id) },
                          overrideAmount: service.addon_price_overrides[opt.id],
                          hasOverrideKey: Object.prototype.hasOwnProperty.call(service.addon_price_overrides, opt.id),
                          lineTotalOverride: service.addon_line_total_overrides[opt.id],
                          hasLineTotalOverrideKey: Object.prototype.hasOwnProperty.call(service.addon_line_total_overrides, opt.id),
                        })),
                    )
                    return sum + Number(service.price ?? 0) + blockAddonBounds.min
                  }, 0)
                  const isRange = settlementNeedsSettledAmount(editOriginalSettlementSource)
                  const settledAmt = parseSettlementAmountInput(editSettledAmount)
                  const originalServiceAmt = isRange
                    ? (settledAmt ?? 0)
                    : Number(
                      editOriginalServicePriceOverride
                        ?? editOriginalService?.service_price
                        ?? editOriginalService?.price
                        ?? appointmentDisplayMainServices
                          .find((service) => service.is_original)?.extra_price
                        ?? appointmentDetail.service_total
                        ?? 0,
                    )
                  const serviceMin = isRange && settledAmt == null
                    ? getSettlementRangeBounds(editOriginalSettlementSource).min
                    : originalServiceAmt
                  const serviceMax = isRange && settledAmt == null
                    ? getSettlementRangeBounds(editOriginalSettlementSource).max
                    : originalServiceAmt
                  const depositOffset = editSettlementDepositTotal
                  const packageOffset = Number(appointmentDetail.package_offset ?? 0)
                  const finalMin = Math.max(0, serviceMin + addedMainTotal + addonBounds.min - depositOffset - packageOffset)
                  const finalMax = Math.max(0, serviceMax + addedMainTotal + addonBounds.max - depositOffset - packageOffset)
                  const summaryHasRange = (isRange && settledAmt == null) || addonBounds.hasRange
                  const finalTotalLabel = summaryHasRange && Math.abs(finalMin - finalMax) > 0.0001
                    ? `RM ${finalMin.toFixed(2)} - ${finalMax.toFixed(2)}`
                    : `RM ${finalMax.toFixed(2)}`
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
                            <span className="font-semibold tabular-nums text-gray-900">+{formatPosAccumulatedPriceDisplay(addonBounds, { prefix: 'RM' })}</span>
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
                          <span className="font-bold tabular-nums text-gray-900">{finalTotalLabel}</span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-4">
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
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        primaryStaffChangePrompt ? (
          <PosPrimaryStaffChangeConfirmModal
            prompt={primaryStaffChangePrompt}
            loading={editSettlementLoading}
            onCancel={() => {
              setPrimaryStaffChangePrompt(null)
              setPendingEditSettlementPayload(null)
            }}
            onConfirm={() => void confirmPrimaryStaffChangeForEditSettlement()}
          />
        ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        appointmentLineSplitTarget ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative mx-auto flex w-full max-w-xl max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3">
              <h4 className="text-lg font-bold text-gray-900">
                {appointmentLineSplitTarget.type === 'bulk' ? `Apply Staff Split: ${appointmentLineSplitTarget.title}` : `Line Staff Split: ${appointmentLineSplitTarget.title}`}
              </h4>
              <button type="button" onClick={() => setAppointmentLineSplitTarget(null)} className="text-2xl leading-none text-gray-500">×</button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              {appointmentLineSplitTarget.type === 'bulk' && !appointmentLineSplitTarget.applyEditSettlementMainServices ? (
                <label className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  <input type="checkbox" checked={appointmentLineSplitOverwrite} onChange={(event) => setAppointmentLineSplitOverwrite(event.target.checked)} className="h-4 w-4" />
                  Overwrite existing explicit staff splits
                </label>
              ) : null}
              {appointmentLineSplitTarget.type === 'line' ? (
                <StaffSplitModeToggle
                  mode={appointmentLineSplitMode}
                  allowAmountMode={appointmentLineSplitAllowAmountMode}
                  showAmountOption={appointmentLineSplitLineTotal != null && appointmentLineSplitLineTotal > 0}
                  onModeChange={setAppointmentLineSplitMode}
                  onSelectAmount={() => {
                    setAppointmentLineSplitMode('amount')
                    if (appointmentLineSplitLineTotal != null) {
                      setAppointmentLineSplitDraftRows((prev) =>
                        prev.map((row, index) => ({
                          ...row,
                          share_amount: percentsToAmounts(
                            prev.map((item) => Number.parseInt(item.share_percent || '0', 10)),
                            appointmentLineSplitLineTotal,
                          )[index]?.toFixed(2) ?? row.share_amount,
                        })),
                      )
                    }
                  }}
                />
              ) : null}
              {appointmentLineSplitMode === 'amount' && appointmentLineSplitLineTotal != null ? (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                  Line total: <span className="font-bold">{appointmentLineSplitLineTotal.toFixed(2)}</span>
                </div>
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
                      {appointmentLineSplitMode === 'amount' ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.share_amount}
                          disabled={appointmentLineSplitAutoBalance && index === 0}
                          onChange={(event) => {
                            const value = event.target.value
                            setAppointmentLineSplitDraftRows((prev) => {
                              const next = prev.map((item, itemIndex) => itemIndex === index ? { ...item, share_amount: value } : item)
                              if (!appointmentLineSplitAutoBalance || index === 0 || appointmentLineSplitLineTotal == null) return next
                              const othersTotal = next.slice(1).reduce((sum, item) => sum + parseMoneyInput(item.share_amount), 0)
                              return next.map((item, itemIndex) => itemIndex === 0 ? { ...item, share_amount: Math.max(0, appointmentLineSplitLineTotal - othersTotal).toFixed(2) } : item)
                            })
                          }}
                          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
                        />
                      ) : (
                        <>
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
                        </>
                      )}
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
              <button type="button" onClick={() => setAppointmentLineSplitDraftRows((prev) => [...prev, { staff_id: null, share_percent: '', share_amount: '0.00' }])} className="rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700">+ Add Staff</button>
              {appointmentLineSplitError ? (
                <div
                  ref={appointmentLineSplitErrorRef}
                  role="alert"
                  tabIndex={-1}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                >
                  {appointmentLineSplitError}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4">
              <button type="button" onClick={() => setAppointmentLineSplitTarget(null)} className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
              <button type="button" onClick={saveAppointmentLineSplitEditor} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        appointmentPriceEditTarget ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative mx-auto flex w-full max-w-md max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <h4 className="text-lg font-bold text-gray-900">Edit Price</h4>
            <p className="mt-1 text-sm text-gray-600">{appointmentPriceEditTarget.name}</p>
            {(() => {
              const addonPriceTarget = getAppointmentAddonPriceEditTarget(appointmentPriceEditTarget)
              return (
            <PosPriceEditSummaryGrid
              kind={appointmentPriceEditTarget.kind}
              originalUnitPrice={Number(appointmentPriceEditTarget.originalUnitPrice ?? 0)}
              currentUnitPrice={Number(appointmentPriceEditTarget.currentUnitPrice ?? 0)}
              quantity={appointmentPriceEditTarget.quantity}
              priceSource={appointmentPriceEditTarget.priceSource}
              lineTotalOverride={addonPriceTarget?.hasLineTotalOverrideKey ? addonPriceTarget.lineTotalOverride ?? null : null}
              hasLineTotalOverrideKey={Boolean(addonPriceTarget?.hasLineTotalOverrideKey)}
            />
              )
            })()}
            {priceEditTargetUsesSimpleServicePriceLayout(appointmentPriceEditTarget.kind) ? (
              <div className="mt-4 rounded-lg border border-gray-200 p-3">
                <label className="block text-sm font-semibold text-gray-700">New Price
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={appointmentPriceEditValueDraft}
                    onChange={(event) => setAppointmentPriceEditValueDraft(event.target.value)}
                    placeholder={appointmentPriceEditTarget.priceSource && posPriceDisplayHasRange(appointmentPriceEditTarget.priceSource) && !posPriceDisplayHasFinalPrice(appointmentPriceEditTarget.priceSource) ? 'Enter final price' : '0.00'}
                    className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm tabular-nums"
                  />
                </label>
              </div>
            ) : (
              <>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Edit Method</p>
                  <div className="flex flex-wrap gap-4 text-sm font-semibold text-gray-700">
                    <label className="inline-flex items-center gap-2"><input type="radio" checked={appointmentPriceEditMode === 'unit'} onChange={() => setAppointmentPriceEditMode('unit')} /> Unit Price</label>
                    <label className="inline-flex items-center gap-2"><input type="radio" checked={appointmentPriceEditMode === 'line'} onChange={() => setAppointmentPriceEditMode('line')} /> Line Total</label>
                  </div>
                </div>
                {appointmentPriceEditMode === 'unit' ? (
                  <div className="mt-4"><label className="text-xs font-semibold text-gray-600">New Unit Price</label><input type="number" min={0} step="0.01" value={appointmentPriceEditValueDraft} onChange={(event) => setAppointmentPriceEditValueDraft(event.target.value)} placeholder={appointmentPriceEditTarget.priceSource && posPriceDisplayHasRange(appointmentPriceEditTarget.priceSource) && !posPriceDisplayHasFinalPrice(appointmentPriceEditTarget.priceSource) ? 'Enter final price' : '0.00'} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" /><p className="mt-1 text-xs text-gray-500">Calculated Line Total: RM {(Math.max(0, Number(appointmentPriceEditValueDraft || 0)) * resolvePriceEditQuantity(appointmentPriceEditTarget.quantity)).toFixed(2)}</p></div>
                ) : (
                  <div className="mt-4"><label className="text-xs font-semibold text-gray-600">New Line Total</label><input type="number" min={0} step="0.01" value={appointmentPriceEditLineTotalDraft} onChange={(event) => setAppointmentPriceEditLineTotalDraft(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" /><p className="mt-1 text-xs text-gray-500">Calculated Unit Price: RM {(Math.max(0, Number(appointmentPriceEditLineTotalDraft || 0)) / resolvePriceEditQuantity(appointmentPriceEditTarget.quantity)).toFixed(2)}</p></div>
                )}
              </>
            )}
            <div className="mt-4"><label className="text-xs font-semibold text-gray-600">Reason / remark</label><textarea value={appointmentPriceEditReasonDraft} onChange={(event) => setAppointmentPriceEditReasonDraft(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Optional reason" /></div>
            </div>
            <div className="flex shrink-0 gap-3 border-t border-gray-200 p-5">
              <button type="button" onClick={() => setAppointmentPriceEditTarget(null)} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700">Cancel</button><button type="button" onClick={() => submitAppointmentPriceEditModal()} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        editMainServicePickerOpen && editMainServicePickerTargetId ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4">
          <div className="relative mx-auto flex w-full max-w-2xl max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
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
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
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
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        appointmentCheckoutConfirmationOpen && appointmentDetail ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4">
          <div className="relative mx-auto flex w-full max-w-4xl max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h4 className="text-lg font-bold text-gray-900">Checkout Confirmation</h4>
                <p className="text-xs text-gray-500">
                  {checkoutZeroBalanceSettlement
                    ? 'Confirm payment method (cash or QRPay). QR proof is optional. RM 0 to collect — this step issues the settlement receipt.'
                    : 'Select payment method before collecting settlement. QR proof is optional.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  reportAppointmentCheckoutError(null)
                  setAppointmentCheckoutConfirmationOpen(false)
                }}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {appointmentCheckoutError ? (
                <div
                  ref={appointmentCheckoutErrorRef}
                  role="alert"
                  tabIndex={-1}
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
                  {checkoutZeroBalanceSettlement ? (
                    <span className="block pt-1 text-[11px] font-normal text-slate-500">
                      {packageReservedPendingRegister
                        ? 'Covered by package — RM 0 to collect at checkout.'
                        : Number(appointmentDetail.deposit_paid ?? 0) > 0.0001
                          ? 'Covered by deposit — RM 0 to collect at checkout.'
                          : 'RM 0 to collect at checkout.'}
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
              {!checkoutZeroBalanceSettlement ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-3 text-sm font-bold text-gray-900">Settlement Discount</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Discount Type
                      <select
                        value={appointmentDiscountTypeDraft}
                        onChange={(event) => {
                          reportAppointmentCheckoutError(null)
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
                          reportAppointmentCheckoutError(null)
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
                        reportAppointmentCheckoutError(null)
                        setAppointmentDiscountRemarkDraft(event.target.value)
                      }}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                      placeholder="VIP discount / goodwill adjustment"
                    />
                  </label>
                </div>
              ) : null}
              {checkoutZeroBalanceSettlement && appointmentRefundNeededAmount > 0.0001 && !appointmentDetail?.refund_handled ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-bold text-rose-900">Refund / Credit Required</p>
                  <p className="mt-2 text-xs text-rose-800">
                    Overpaid by RM {appointmentRefundNeededAmount.toFixed(2)}. Open <span className="font-semibold">Edit Settlement</span> and use the refund section to record Cash Refund or Customer Credit before checkout.
                  </p>
                </div>
              ) : null}
              {checkoutZeroBalanceSettlement ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-3 text-sm font-bold text-gray-900">Payment Method (for receipt)</p>
                  <p className="mb-3 text-xs text-slate-600">RM 0 to collect — choose how this settlement is recorded on the receipt.</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {SPLIT_PAYMENT_METHODS.map(({ method, label }) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          reportAppointmentCheckoutError(null)
                          setAppointmentPaymentMethod(method === 'credit_card' ? 'credit_card' : method)
                        }}
                        className={`rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition ${
                          isAppointmentPaymentMethodSelected(appointmentPaymentMethod, method)
                            ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/40'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
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
                          disabled={method === 'customer_balance' && !appointmentDetail?.customer?.id}
                          onClick={() => {
                            if (method === 'customer_balance' && !appointmentDetail?.customer?.id) return
                            reportAppointmentCheckoutError(null)
                            setAppointmentPaymentMethod(method === 'credit_card' ? 'credit_card' : method)
                            setAppointmentSettlementPaymentAmounts({ cash: '', qrpay: '', credit_card: '', customer_balance: '', [method]: Math.min(appointmentDueAfterDiscount, method === 'customer_balance' ? (appointmentMemberWalletBalance ?? 0) : appointmentDueAfterDiscount).toFixed(2) })
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
                          max={method === 'customer_balance' ? Math.min(appointmentMemberWalletBalance ?? 0, appointmentDueAfterDiscount).toFixed(2) : undefined}
                          disabled={method === 'customer_balance' && !appointmentDetail?.customer?.id}
                          onChange={(e) => {
                            reportAppointmentCheckoutError(null)
                            if (method === 'customer_balance' && !appointmentDetail?.customer?.id) return
                            setAppointmentPaymentMethod(method === 'credit_card' ? 'credit_card' : method)
                            const value = method === 'customer_balance' ? String(Math.min(Number(e.target.value || 0), appointmentMemberWalletBalance ?? 0, appointmentDueAfterDiscount)) : e.target.value
                            setAppointmentSettlementPaymentAmounts((prev) => ({ ...prev, [method]: value }))
                          }}
                          className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none"
                          placeholder="0.00"
                        />
                        {method === 'customer_balance' ? <p className="mt-1 text-[11px] font-semibold text-emerald-700">{appointmentDetail?.customer?.id ? `Available: RM ${(appointmentMemberWalletBalance ?? 0).toFixed(2)}` : 'Member required'}</p> : null}
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
              )}
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
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    reportAppointmentCheckoutError(null)
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
                    (checkoutZeroBalanceSettlement && appointmentRefundNeededAmount > 0.0001 && !appointmentDetail?.refund_handled) ||
                    (!checkoutZeroBalanceSettlement && (appointmentDueAfterDiscount <= 0 || !appointmentSettlementPaymentValid))
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
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        appointmentSettlementResult ? (
        <div className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
          <div className={`relative mx-auto flex w-full max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border-2 border-gray-100 bg-white shadow-2xl ${appointmentSettlementHasCashChange ? 'max-w-4xl' : 'max-w-lg'}`}>
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-green-600 to-green-700 px-6 py-5">
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
            <div className={`min-h-0 flex-1 overflow-y-auto ${appointmentSettlementHasCashChange ? 'grid gap-6 p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : 'p-6'}`}>
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
      ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        depositReviewViewOrderId !== null ? (
          <OrderViewPanel
            key={depositReviewViewOrderId}
            orderId={depositReviewViewOrderId}
            onClose={() => setDepositReviewViewOrderId(null)}
            onOrderUpdated={() => void refreshOpenedAppointmentDetail()}
            zIndexClassName="pos-body-stack-modal-detail"
          />
        ) : null,
        bodyModalRoot,
      )}

      {renderPosBodyModalPortal(
        appointmentQrCodeFullscreen && appointmentSettlementResult?.receipt_public_url ? (
        <div
          className="pos-body-stack-modal flex items-center justify-center overflow-y-auto bg-black/90 p-4 backdrop-blur-sm"
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
      ) : null,
        bodyModalRoot,
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

      {isCreateMemberModalOpen ? (
        <CustomerCreateModal
          zIndexClass="z-[200]"
          onClose={() => setIsCreateMemberModalOpen(false)}
          onSuccess={handleMemberCreated}
        />
      ) : null}

      <ApplyPackageModal
        open={applyPackageModalOpen}
        onClose={() => setApplyPackageModalOpen(false)}
        bookingId={appointmentDetail?.id ?? 0}
        customerName={appointmentDetail?.customer_name ?? appointmentDetail?.customer?.name ?? undefined}
        onSuccess={async () => {
          showMsg('Package updated successfully.', 'success')
          await fetchAppointments({ silent: true })
          await refreshOpenedAppointmentDetail()
        }}
      />
    </div>
  )
}
