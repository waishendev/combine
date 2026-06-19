'use client'

import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import BookingPackageItemServicePicker from '@/components/booking/BookingPackageItemServicePicker'
import BookingServicePhotosModal from '@/components/booking/BookingServicePhotosModal'
import InternationalPhoneInput from '@/components/common/InternationalPhoneInput'
import BookingServicePicker, { bookingServiceMatchesPickerCategory } from '@/components/pos/BookingServicePicker'
import PosModalRemarkField, { type PosModalRemarkFieldHandle } from '@/components/pos/PosModalRemarkField'
import {
  bookingServiceSettlementSource,
  getSettlementRangeBounds,
  parseSettlementAmountInput,
  settlementNeedsSettledAmount,
  validateSettlementAmountInput,
} from '@/components/pos/settlementAmountUtils'
import { usePosCashShift } from '@/components/pos/PosCashShiftGate'
import { normalizeInternationalPhone } from '@/lib/phone'
import OrderViewPanel from './OrderViewPanel'
import {
  printReceipt,
  printReceiptBluetooth,
  printReceiptWifi,
  testWifiPrinterConnection,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  isBluetoothPrinterConnected,
  type ReceiptLineItem,
} from '@/utils/printReceipt'
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

type CartItem = {
  id: number
  item_type?: 'PRODUCT' | 'BOOKING_PRODUCT'
  qty: number
  unit_price: number
  line_total: number
  unit_price_snapshot?: number
  line_total_snapshot?: number
  is_staff_free_applied?: boolean
  product_id?: number | null
  variant_id?: number | null
  product_name?: string | null
  product_cn_name?: string | null
  variant_name?: string | null
  variant_cn_name?: string | null
  variant_sku?: string | null
  discount_type?: 'percentage' | 'fixed' | null
  discount_value?: number
  discount_remark?: string | null
  discount_amount?: number
  line_total_after_discount?: number
  promotion_applied?: boolean
  promotion_name?: string | null
  promotion_summary?: string | null
  promotion_snapshot?: {
    summary?: string | null
    selected_tier?: {
      min_qty?: number
      discount_value?: number
    } | null
  } | null
  manual_discount_allowed?: boolean
  booking_product_id?: number | null
  booking_product_category?: string | null
  selected_booking_product_options?: Array<{
    question_id?: number
    title?: string
    cn_title?: string | null
    options?: Array<{ id?: number; label?: string; cn_label?: string | null; extra_price?: number; discount_type?: 'percentage' | 'fixed' | null; discount_value?: number; discount_amount?: number; line_total_after_discount?: number; discount_remark?: string | null; original_unit_price_snapshot?: number | null; line_total_override?: number | null; staff_splits?: CheckoutItemStaffSplit[] }>
  }>
}

type AppliedPromotion = {
  promotion_id?: number
  promotion_name?: string
  selected_tier?: {
    min_qty?: number
    discount_value?: number
  } | null
  summary?: string | null
  discount_amount?: number
  remaining_qty_charged_normal?: number
}

type Cart = {
  id: number
  items: CartItem[]
  service_items?: ServiceCartItem[]
  package_items?: PackageCartItem[]
  appointment_settlement_items?: AppointmentSettlementCartItem[]
  subtotal: number
  grand_total: number
  booking_deposit_total?: number
  booking_addon_total?: number
  booking_deposit_breakdown?: { premium_count?: number; standard_count?: number; deposit_total?: number; per_premium_amount?: number; premium_deposit_total?: number; standard_base_amount?: number }
  voucher?: {
    id?: number | null
    customer_voucher_id?: number | null
    code?: string | null
    discount_amount?: number
    scope_snapshot?: {
      display_scope_text?: string | null
      eligible_subtotal?: number
    } | null
  } | null
  promotions?: AppliedPromotion[]
}

type GuestContactSource = {
  customer_id?: number | null
  guest_phone?: string | null
  guest_email?: string | null
}

const getGuestContactLines = (source: GuestContactSource): string[] => {
  if (source.customer_id) return []

  const phone = source.guest_phone?.trim()
  const email = source.guest_email?.trim()
  const lines: string[] = []

  if (phone) lines.push(`Phone: ${phone}`)
  if (email) lines.push(`Email: ${email}`)

  return lines
}

type AppointmentSettlementCartItem = {
  id: number
  booking_id: number
  booking_service_id?: number
  booking_code: string
  customer_id?: number | null
  customer_name?: string | null
  guest_name?: string | null
  guest_phone?: string | null
  guest_email?: string | null
  service_name?: string | null
  service_cn_name?: string | null
  service_price_mode?: string | null
  service_price_range_min?: number | null
  service_price_range_max?: number | null
  settled_service_amount?: number | null
  is_range_priced?: boolean
  requires_settled_amount?: boolean
  staff_name?: string | null
  staff_splits?: Array<{ staff_id: number; staff_name?: string | null; share_percent: number }>
  appointment_start_at?: string | null
  appointment_end_at?: string | null
  balance_due: number
  service_total?: number
  main_services?: Array<{ id?: number | null; name: string; cn_name?: string | null; extra_duration_min?: number; extra_price: number; linked_booking_service_id?: number | null; is_original?: boolean; add_ons?: Array<{ id?: number | null; name: string; cn_name?: string | null; extra_duration_min?: number; extra_price: number; linked_deposit_amount?: number | null; staff_splits?: Array<{ staff_id: number; share_percent: number }> }>; staff_splits?: Array<{ staff_id: number; share_percent: number }> }>
  main_service_settlement_items?: Array<{ id?: number | null; line_key?: string | null; name: string; cn_name?: string | null; extra_duration_min?: number; extra_price: number; gross_amount?: number; balance_due?: number; paid_amount?: number; linked_booking_service_id?: number | null; is_original?: boolean; discount_type?: 'percentage' | 'fixed' | null; discount_value?: number; discount_amount?: number; line_total_after_discount?: number; discount_remark?: string | null; price_override?: PriceOverrideSnapshot | null; staff_splits?: Array<{ staff_id: number; share_percent: number }> }>
  addon_total_price?: number
  deposit_contribution?: number
  package_offset?: number
  amount_due_now?: number
  balance_due_snapshot?: number
  discount_type?: 'percentage' | 'fixed' | null
  discount_value?: number
  discount_amount?: number
  line_total_after_discount?: number
  discount_remark?: string | null
  service_balance_due?: number
  addon_settlement_items?: Array<{
    id?: number | null
    line_key?: string | null
    name: string
    cn_name?: string | null
    extra_duration_min?: number
    extra_price: number
    gross_amount?: number
    paid_amount?: number
    balance_due: number
    discount_type?: 'percentage' | 'fixed' | null
    discount_value?: number
    discount_amount?: number
    line_total_after_discount?: number
    discount_remark?: string | null
    price_override?: PriceOverrideSnapshot | null
    staff_splits?: Array<{ staff_id: number; share_percent: number }>
  }>
  package_status?: { status?: 'reserved' | 'consumed' | 'released' | null } | null
  can_apply_package?: boolean
  package_disabled_reason?: string | null
  eligible_package_count?: number
}


type ServiceCartItem = {
  id: number
  type?: 'service'
  booking_service_id: number
  service_name: string
  service_cn_name?: string | null
  qty: number
  unit_price: number
  line_total: number
  addon_duration_min?: number
  addon_price?: number
  addon_items?: Array<{
    id?: number | null
    name: string
    cn_name?: string | null
    extra_duration_min: number
    extra_price: number
    linked_deposit_amount?: number
    item_kind?: string | null
    linked_booking_service_id?: number | null
  }>
  service_type?: string | null
  /** Main service deposit only (excludes add-on deposits) */
  deposit_contribution?: number
  /** When package covers main service: booking service deposit_amount for strikethrough UI */
  deposit_main_reference?: number | null
  deposit_addon_lines?: Array<{ id?: number | null; name: string; cn_name?: string | null; deposit: number; price_override?: PriceOverrideSnapshot | null }>
  deposit_addon_total?: number
  /** Main + add-on deposits due at checkout for this line */
  deposit_payable_total?: number
  deposit_price_override?: PriceOverrideSnapshot | null
  package_claim_status?: 'reserved' | 'consumed' | 'released' | null
  claimed_by_package?: boolean
  assigned_staff_id?: number | null
  assigned_staff_name?: string | null
  customer_id?: number | null
  customer_name?: string | null
  guest_name?: string | null
  guest_phone?: string | null
  guest_email?: string | null
  start_at?: string | null
  end_at?: string | null
  notes?: string | null
  staff_splits?: Array<{ staff_id: number; share_percent: number; service_commission_rate_snapshot?: number }>
  commission_rate_used?: number
  main_services?: Array<{
    id?: number | string | null
    name: string
    cn_name?: string | null
    extra_duration_min?: number
    extra_price?: number
    linked_booking_service_id?: number | null
    is_original?: boolean
    add_ons?: Array<{ id?: number | null; name: string; cn_name?: string | null; extra_duration_min?: number; extra_price: number; linked_deposit_amount?: number | null; staff_splits?: Array<{ staff_id: number; share_percent: number }> }>
    staff_splits?: Array<{ staff_id: number; share_percent: number }>
  }>
}

function formatPosServiceCartIdentity(
  item: ServiceCartItem,
  selectedMember: { id: number; name: string } | null,
): string | null {
  if (item.customer_id) {
    const name =
      (item.customer_name && item.customer_name.trim()) ||
      (selectedMember?.id === item.customer_id ? selectedMember.name.trim() : '') ||
      ''
    return name ? `Member: ${name}` : `Member: (#${item.customer_id})`
  }
  const g = item.guest_name?.trim()
  if (g) return `Guest: ${g}`
  return null
}

function getPosServiceMainBlocks(item: ServiceCartItem): NonNullable<ServiceCartItem['main_services']> {
  const blocks = (item.main_services ?? []).filter((service) => String(service.name ?? '').trim() !== '')
  if (blocks.length > 0) return blocks

  return [{
    id: item.booking_service_id,
    name: item.service_name,
    cn_name: item.service_cn_name ?? null,
    extra_duration_min: undefined,
    extra_price: item.unit_price,
    linked_booking_service_id: item.booking_service_id,
    is_original: true,
    add_ons: (item.addon_items ?? [])
      .filter((addon) => Number(addon.id ?? 0) > 0 && String(addon.item_kind ?? '').toLowerCase() !== 'main_service')
      .map((addon) => ({
        id: addon.id ?? null,
        name: addon.name,
        cn_name: addon.cn_name ?? null,
        extra_duration_min: Number(addon.extra_duration_min ?? 0),
        extra_price: Number(addon.extra_price ?? 0),
        linked_deposit_amount: Number(addon.linked_deposit_amount ?? 0),
      })),
    staff_splits: item.staff_splits?.map((split) => ({
      staff_id: Number(split.staff_id),
      share_percent: Number(split.share_percent),
    })),
  }]
}

function getPosServiceAddonDeposit(item: ServiceCartItem, addonId?: number | null): number {
  const id = Number(addonId ?? 0)
  if (id <= 0) return 0

  const depositLine = (item.deposit_addon_lines ?? []).find((line) => Number(line.id ?? 0) === id)
  if (depositLine) return Number(depositLine.deposit ?? 0)

  const addonSnapshot = (item.addon_items ?? []).find((addon) => Number(addon.id ?? 0) === id)
  return Number(addonSnapshot?.linked_deposit_amount ?? 0)
}

function getPosServiceAddonDepositReference(
  item: ServiceCartItem,
  addon: NonNullable<NonNullable<ServiceCartItem['main_services']>[number]['add_ons']>[number],
): number {
  const id = Number(addon.id ?? 0)
  const addonSnapshot = id > 0
    ? (item.addon_items ?? []).find((row) => Number(row.id ?? 0) === id)
    : null
  const linkedDeposit = Number(addonSnapshot?.linked_deposit_amount ?? addon.linked_deposit_amount ?? 0)
  if (linkedDeposit > 0.0001) return linkedDeposit

  const depositLine = id > 0
    ? (item.deposit_addon_lines ?? []).find((line) => Number(line.id ?? 0) === id)
    : null
  return Number(depositLine?.deposit ?? 0)
}

function getPosServiceDepositBlocks(item: ServiceCartItem) {
  const isMainPackageClaimed = Boolean(
    item.claimed_by_package ||
    item.package_claim_status === 'reserved' ||
    item.package_claim_status === 'consumed',
  )
  const mainDepositReference = Number(item.deposit_main_reference ?? item.deposit_contribution ?? 0)

  return getPosServiceMainBlocks(item).map((service, idx) => {
    const isOriginal = service.is_original ?? idx === 0
    const deposit = isOriginal ? Number(item.deposit_contribution ?? 0) : 0
    const referenceDeposit = isOriginal && isMainPackageClaimed
      ? Math.max(mainDepositReference, deposit)
      : deposit
    const coveredByPackage = isOriginal && isMainPackageClaimed && deposit < 0.0001

    return {
      ...service,
      deposit,
      line_key: 'main',
      price_override: item.deposit_price_override ?? null,
      reference_deposit: referenceDeposit,
      covered_by_package: coveredByPackage,
      package_note: coveredByPackage ? 'Included in your package (main service)' : null,
      add_ons: (service.add_ons ?? []).map((addon) => {
        const addonDeposit = getPosServiceAddonDeposit(item, addon.id)
        const addonReferenceDeposit = getPosServiceAddonDepositReference(item, addon)
        const addonCoveredByPackage = isMainPackageClaimed && addonReferenceDeposit > addonDeposit + 0.0001 && addonDeposit < 0.0001
        const depositLine = (item.deposit_addon_lines ?? []).find((line) => Number(line.id ?? 0) === Number(addon.id ?? 0))

        return {
          ...addon,
          deposit: addonDeposit,
          line_key: `addon:${Number(addon.id ?? 0)}`,
          price_override: depositLine?.price_override ?? null,
          reference_deposit: Math.max(addonReferenceDeposit, addonDeposit),
          covered_by_package: addonCoveredByPackage,
          package_note: addonCoveredByPackage ? 'Included in your package (add-on)' : null,
        }
      }),
    }
  })
}

function PosDepositAmount({
  amount,
  referenceAmount,
  className = 'font-semibold text-gray-900',
}: {
  amount: number
  referenceAmount?: number | null
  className?: string
}) {
  const payable = Number(amount ?? 0)
  const reference = Number(referenceAmount ?? payable)

  if (reference > payable + 0.0001) {
    return (
      <span className={`inline-flex flex-wrap items-baseline justify-end gap-x-1.5 ${className}`}>
        <span className="text-gray-400 line-through">RM {reference.toFixed(2)}</span>
        <span>RM {payable.toFixed(2)}</span>
      </span>
    )
  }

  return <span className={className}>RM {payable.toFixed(2)}</span>
}

function resolveSettlementLineOriginalPrice(
  line: { extra_price?: number; gross_amount?: number; balance_due?: number },
  ...fallbacks: Array<number | null | undefined>
): number {
  const candidates = [
    Number(line.extra_price ?? 0),
    ...fallbacks.map((value) => Number(value ?? 0)),
    Number(line.gross_amount ?? 0),
    Number(line.balance_due ?? 0),
  ]
  return candidates.find((amount) => amount > 0.0001) ?? 0
}

function PosPackageIncludedAmount({
  originalAmount,
  inline = false,
  unitClassName = 'text-xs font-semibold text-gray-700',
  lineClassName = 'text-lg font-bold leading-tight text-orange-700',
}: {
  originalAmount: number
  inline?: boolean
  unitClassName?: string
  lineClassName?: string
}) {
  const original = Math.max(0, Number(originalAmount ?? 0))

  if (inline) {
    return (
      <span className={unitClassName}>
        {original > 0.0001 ? (
          <>
            <span className="font-normal text-gray-400 line-through">RM {original.toFixed(2)}</span>{' '}
          </>
        ) : null}
        <span>RM 0.00</span>
      </span>
    )
  }

  return (
    <div className="space-y-0.5">
      {original > 0.0001 ? <p className="text-xs text-gray-400 line-through">RM {original.toFixed(2)}</p> : null}
      <p className={lineClassName}>RM 0.00</p>
    </div>
  )
}

function formatPosServiceStaffSplitSummary(item: ServiceCartItem): string {
  const splits = (item.staff_splits ?? [])
    .map((split) => ({
      staff_id: Number(split.staff_id),
      share_percent: Number(split.share_percent),
    }))
    .filter((split) => split.staff_id > 0 && split.share_percent > 0)

  if (splits.length === 0) {
    return item.assigned_staff_name ? `${item.assigned_staff_name} 100%` : '—'
  }

  return splits.map((split) => {
    const staffName = split.staff_id === Number(item.assigned_staff_id ?? 0) && item.assigned_staff_name
      ? item.assigned_staff_name
      : `Staff #${split.staff_id}`
    return `${staffName} ${split.share_percent}%`
  }).join(' · ')
}

type PackageCartItem = {
  id: number
  type?: 'service_package'
  service_package_id: number
  package_name: string
  qty: number
  unit_price: number
  line_total: number
  line_total_snapshot?: number
  discount_type?: 'percentage' | 'fixed' | null
  discount_value?: number
  discount_amount?: number
  line_total_after_discount?: number
  discount_remark?: string | null
  customer_id?: number | null
  customer_name?: string | null
  staff_splits?: Array<{
    staff_id: number
    share_percent: number
    split_sales_amount?: number
    service_commission_rate_snapshot?: number
    commission_amount_snapshot?: number
  }>
}

type PriceOverrideSnapshot = { original_unit_price?: number; final_unit_price?: number; price_override_amount?: number; price_override_reason?: string | null; price_overridden_by?: number | null; price_overridden_at?: string | null }

type PriceEditTarget =
  | { kind: 'product'; id: number; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number; currentLineTotal?: number }
  | { kind: 'bookingProductOption'; id: number; optionId: number; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number; currentLineTotal?: number }
  | { kind: 'package'; id: number; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number; currentLineTotal?: number }
  | { kind: 'serviceDeposit'; id: number; lineKey: string; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number; currentLineTotal?: number }
  | { kind: 'settlementLine'; id: number; lineKey: string; name: string; currentUnitPrice: number; originalUnitPrice: number; quantity?: number; currentLineTotal?: number }

type DiscountTarget =
  | { kind: 'product'; id: number; name: string; lineTotal: number; discountType?: 'percentage' | 'fixed' | null; discountValue?: number; discountRemark?: string | null; promotionApplied?: boolean; manualDiscountAllowed?: boolean }
  | { kind: 'package'; id: number; name: string; lineTotal: number; discountType?: 'percentage' | 'fixed' | null; discountValue?: number; discountRemark?: string | null }
  | { kind: 'settlementLine'; id: number; lineKey: string; name: string; lineTotal: number; discountType?: 'percentage' | 'fixed' | null; discountValue?: number; discountRemark?: string | null }
  | { kind: 'bookingProductOption'; id: number; optionId: number; name: string; lineTotal: number; discountType?: 'percentage' | 'fixed' | null; discountValue?: number; discountRemark?: string | null }

function formatPosPackageMemberLabel(
  packageItem: PackageCartItem,
  selectedMember: { id: number; name: string } | null,
): string {
  if (!packageItem.customer_id) return 'Member: Not assigned'
  const name =
    (packageItem.customer_name && packageItem.customer_name.trim()) ||
    (selectedMember?.id === packageItem.customer_id ? selectedMember.name.trim() : '') ||
    ''
  return name ? `Member: ${name}` : `Member: (#${packageItem.customer_id})`
}


function ServiceNameStack({
  name,
  cnName,
  primaryClassName = 'text-sm font-semibold text-gray-900',
  secondaryClassName = 'mt-0.5 text-xs text-gray-500',
  reserveSecondaryLine = false,
}: {
  name?: string | null
  cnName?: string | null
  primaryClassName?: string
  secondaryClassName?: string
  reserveSecondaryLine?: boolean
}) {
  const showSecondary = reserveSecondaryLine || Boolean(cnName)

  return (
    <div className="min-w-0 text-left">
      <p className={primaryClassName}>{name || '—'}</p>
      {showSecondary ? (
        <p className={`${secondaryClassName}${cnName ? '' : ' invisible'}`} aria-hidden={!cnName}>
          {cnName || '\u00a0'}
        </p>
      ) : null}
    </div>
  )
}

type BookingProductSelectedOption = NonNullable<NonNullable<CartItem['selected_booking_product_options']>[number]['options']>[number]

function getBookingProductSelectedOptions(item: CartItem): BookingProductSelectedOption[] {
  return Array.isArray(item.selected_booking_product_options)
    ? item.selected_booking_product_options.flatMap((question) => question.options ?? [])
    : []
}

function getBookingProductBaseUnitPrice(item: CartItem, options = getBookingProductSelectedOptions(item)): number {
  const optionUnitTotal = options.reduce((sum, opt) => sum + Number(opt.extra_price ?? 0), 0)
  return Math.max(0, Number(item.unit_price_snapshot ?? item.unit_price ?? 0) - optionUnitTotal)
}

function getBookingProductBaseLineTotal(item: CartItem, options = getBookingProductSelectedOptions(item)): number {
  return getBookingProductBaseUnitPrice(item, options) * Number(item.qty ?? 1)
}

function getBookingProductOptionGrossLineTotal(item: CartItem, option: BookingProductSelectedOption): number {
  return Number(option.line_total_override ?? (Number(option.extra_price ?? 0) * Number(item.qty ?? 1)))
}

function getBookingProductOptionNetLineTotal(item: CartItem, option: BookingProductSelectedOption): number {
  const gross = getBookingProductOptionGrossLineTotal(item, option)
  return Math.max(0, Number(option.line_total_after_discount ?? gross))
}

function PosCartDiscountAmount({
  gross,
  net,
  className = 'shrink-0 text-right tabular-nums text-gray-900',
}: {
  gross: number
  net: number
  className?: string
}) {
  const original = Math.max(0, Number(gross ?? 0))
  const final = Math.max(0, Number(net ?? 0))

  if (original > final + 0.0001) {
    return (
      <span className={`${className} space-y-0.5`}>
        <span className="block text-[11px] font-normal text-gray-500 line-through">RM {original.toFixed(2)}</span>
        <span className="block font-bold text-orange-700">RM {final.toFixed(2)}</span>
      </span>
    )
  }

  return <span className={className}>RM {final.toFixed(2)}</span>
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

type BookingServiceQuestionOption = {
  id: number
  label: string
  cn_name?: string | null
  cn_label?: string | null
  linked_cn_name?: string | null
  extra_duration_min: number
  extra_price: number
  is_active?: boolean
}

type BookingServiceQuestion = {
  id: number
  title: string
  cn_title?: string | null
  description?: string | null
  cn_description?: string | null
  question_type: 'single_choice' | 'multi_choice'
  is_required?: boolean
  is_active?: boolean
  options: BookingServiceQuestionOption[]
}
type BookingExtraServiceBlock = {
  id: string
  service: BookingServiceOption | null
  questions: BookingServiceQuestion[]
  selectedOptionIds: number[]
}

type ServicePackageOption = {
  id: number
  name: string
  description?: string | null
  selling_price?: number
  valid_days?: number
  items_summary?: string[]
  is_active?: boolean
  allowed_staffs?: Array<{ id: number; name: string }>
}

type PosCatalogTab = 'products' | 'booking-products' | 'book-service' | 'service-packages' | 'settlement'
type BookingProductOption = { id: number; name: string; cn_name?: string | null; barcode?: string | null; price: number; price_mode?: 'fixed' | 'range'; price_range_min?: number | null; price_range_max?: number | null; image_url?: string | null; category?: { name?: string | null } | null; is_active?: boolean; questions?: BookingServiceQuestion[] }

const formatBookingProductCatalogPrice = (item: BookingProductOption) => item.price_mode === 'range' ? `RM ${Number(item.price_range_min ?? 0).toFixed(2)} - RM ${Number(item.price_range_max ?? 0).toFixed(2)}` : `RM ${Number(item.price ?? 0).toFixed(2)}`

const getInitialBookingProductBasePrice = (item: BookingProductOption) => (item.price_mode === 'range' ? Number(item.price_range_min ?? 0).toFixed(2) : '')

const validateBookingProductBaseSellingPrice = (item: BookingProductOption, value: string) => {
  const actualPrice = Number(value)
  const min = Number(item.price_range_min ?? 0)
  const max = Number(item.price_range_max ?? 0)
  if (!Number.isFinite(actualPrice) || actualPrice < min || actualPrice > max) {
    return { ok: false as const, message: `Enter a product base price between RM ${min.toFixed(2)} and RM ${max.toFixed(2)}.` }
  }
  return { ok: true as const, value: actualPrice }
}

type BookingProductOptionsModalProps = {
  draft: BookingProductOption
  onClose: () => void
  onAdd: (row: BookingProductOption, selectedOptionIds: number[], baseSellingPrice?: number) => Promise<void>
}

const BookingProductOptionsModal = memo(function BookingProductOptionsModal({ draft, onClose, onAdd }: BookingProductOptionsModalProps) {
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([])
  const [basePriceDraft, setBasePriceDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedOptionIds([])
    setBasePriceDraft(getInitialBookingProductBasePrice(draft))
    setError(null)
  }, [draft.id, draft.price_mode, draft.price_range_min])

  const handleAdd = async () => {
    for (const q of (draft.questions ?? [])) {
      if (!q.is_required) continue
      const has = q.options.some((o) => selectedOptionIds.includes(o.id))
      if (!has) {
        setError('Please answer all required questions.')
        return
      }
    }

    const basePriceValidation = draft.price_mode === 'range' ? validateBookingProductBaseSellingPrice(draft, basePriceDraft) : null
    if (basePriceValidation && !basePriceValidation.ok) {
      setError(basePriceValidation.message)
      return
    }

    setError(null)
    await onAdd(draft, selectedOptionIds, basePriceValidation?.ok ? basePriceValidation.value : undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[180] bg-black/40">
      <div className="mx-auto mt-16 w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h4 className="text-lg font-bold text-gray-900">Booking Product Options</h4>
            <p className="mt-1 text-sm font-semibold text-gray-800">{draft.name}</p>
            {draft.cn_name ? <p className="text-xs text-gray-500">{draft.cn_name}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">×</button>
        </div>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {draft.price_mode === 'range' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Product Base Price</p>
              <p className="mt-1 text-xs text-gray-600">Price Range: {formatBookingProductCatalogPrice(draft)}</p>
              <p className="mt-1 text-xs text-gray-500">This base price is validated independently. Selected options are added separately.</p>
              <div className="relative mt-2 max-w-xs"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">RM</span><input type="text" inputMode="decimal" value={basePriceDraft} onChange={(e) => setBasePriceDraft(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900" /></div>
            </div>
          ) : null}
          {(draft.questions ?? []).length > 0 ? <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Questions / Add-ons</p> : null}
          {(draft.questions ?? []).map((q) => (
            <div key={`bpq-${q.id}`} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
              <p className="text-sm font-semibold text-gray-900">
                {q.title}
                {q.is_required ? <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Required</span> : null}
              </p>
              {q.cn_title ? <p className="mt-0.5 text-xs text-gray-500">{q.cn_title}</p> : null}
              {q.cn_description ? <p className="mt-1 text-xs text-gray-500">{q.cn_description}</p> : null}
              <div className="mt-2 space-y-1.5">
                {q.options.filter((o) => o.is_active !== false).map((opt) => {
                  const checked = selectedOptionIds.includes(opt.id)
                  return (
                    <label key={`bpop-${opt.id}`} className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                      <span className="flex items-start gap-2">
                        <input
                          type={q.question_type === 'multi_choice' ? 'checkbox' : 'radio'}
                          name={`bp-q-${q.id}`}
                          checked={checked}
                          onChange={(e) => {
                            setSelectedOptionIds((prev) => {
                              if (q.question_type === 'multi_choice') {
                                return e.target.checked ? [...prev, opt.id] : prev.filter((id) => id !== opt.id)
                              }
                              const withoutQuestion = prev.filter((id) => !q.options.some((o) => o.id === id))
                              return e.target.checked ? [...withoutQuestion, opt.id] : withoutQuestion
                            })
                          }}
                        />
                        <span>
                          <span className="block text-sm text-gray-800">{opt.label}</span>
                          {opt.cn_label ? <span className="block text-xs text-gray-500">{opt.cn_label}</span> : null}
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-blue-700">+RM {Number(opt.extra_price ?? 0).toFixed(2)}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {error ? <p className="mt-2 px-5 text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">
          <button type="button" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700" onClick={onClose}>Cancel</button>
          <button type="button" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white" onClick={() => { void handleAdd() }}>Add to Cart</button>
        </div>
      </div>
    </div>
  )
})
type BookingProductCategoryOption = { id: number; name: string; cn_name?: string | null; sort_order?: number; is_active?: boolean }

type ProductOption = {
  id: number
  product_id: number
  name: string
  cn_name?: string | null
  sku: string
  barcode: string
  price: number
  is_staff_free: boolean
  thumbnail_url?: string | null
  main_image_url?: string | null
  cover_image_url?: string | null
  image_url?: string | null
  variants: ProductVariantOption[]
  variants_count?: number
  default_variant_id?: number | null
  /** Product-level inventory when there are no variants (simple products). */
  track_stock?: boolean | null
  stock?: number | null
}

type ProductSearchHit = {
  product: ProductOption
  matchedVariantId?: number
  matchedVariantSku?: string
  matchedVariantName?: string
}

type ProductSearchMode = 'name' | 'barcode'

type CategoryOption = {
  id: number
  name: string
  cn_name: string | null
}

type FetchProductOptions = {
  silent?: boolean
  resetHighlight?: boolean
}

type ProductVariantOption = {
  id: number
  name: string
  cn_name?: string | null
  sku: string
  barcode: string
  price: number
  thumbnail_url?: string | null
  image_url?: string | null
  image_path?: string | null
  is_active: boolean
  track_stock?: boolean | null
  stock?: number | null
  is_bundle?: boolean
}

function posVariantHasSellableStock(
  trackStock: boolean | null | undefined,
  stock: number | null | undefined,
) {
  if (!(trackStock ?? true)) return true
  if (stock === null || stock === undefined) return true
  return typeof stock === 'number' && Number.isFinite(stock) && stock > 0
}

function PosCartVariantSelect({
  itemId,
  variants,
  loading,
  disabled,
  selectedVariantId,
  fallbackName,
  fallbackCnName,
  fallbackSku,
  productName,
  isOpen,
  onToggle,
  onClose,
  onOpen,
  onSelect,
}: {
  itemId: number
  variants: ProductVariantOption[]
  loading: boolean
  disabled: boolean
  selectedVariantId?: number | null
  fallbackName?: string | null
  fallbackCnName?: string | null
  fallbackSku?: string | null
  productName?: string | null
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onOpen: () => void
  onSelect: (variantId: number) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [useSheet, setUseSheet] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    maxHeight: number
  } | null>(null)

  const selected = variants.find((variant) => variant.id === selectedVariantId)
  const name = selected?.name ?? fallbackName ?? (loading ? 'Loading variants...' : 'Select variant')
  const cnName = selected?.cn_name ?? fallbackCnName ?? null
  const sku = selected?.sku ?? fallbackSku ?? null

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const syncSheetMode = () => setUseSheet(mediaQuery.matches)

    syncSheetMode()
    mediaQuery.addEventListener('change', syncSheetMode)
    return () => mediaQuery.removeEventListener('change', syncSheetMode)
  }, [])

  useLayoutEffect(() => {
    if (!isOpen || useSheet) {
      setMenuStyle(null)
      return
    }

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const maxHeight = 240
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const openUp = spaceBelow < maxHeight + 12 && spaceAbove > spaceBelow

      setMenuStyle({
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(maxHeight, openUp ? spaceAbove - 12 : spaceBelow - 12),
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, useSheet, variants.length])

  useEffect(() => {
    if (!isOpen || !useSheet || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, useSheet])

  const variantOptions = variants.map((variant) => {
    const variantHasStock = posVariantHasSellableStock(variant.track_stock, variant.stock)
    const isDisabled = !variantHasStock || !variant.is_active
    const isSelected = variant.id === selectedVariantId

    return (
      <button
        key={variant.id}
        type="button"
        disabled={isDisabled}
        onClick={() => onSelect(variant.id)}
        className={`block w-full border-b border-gray-100 px-3 py-3 text-left last:border-b-0 sm:px-2.5 sm:py-2 ${
          isSelected
            ? 'bg-blue-50'
            : isDisabled
              ? 'cursor-not-allowed bg-gray-50 opacity-60'
              : 'hover:bg-gray-50 active:bg-gray-100'
        }`}
      >
        <ServiceNameStack
          name={variant.name}
          cnName={variant.cn_name ?? null}
          primaryClassName="text-sm font-semibold text-gray-900 sm:text-xs"
          secondaryClassName="mt-0.5 text-xs text-gray-500 sm:text-[11px]"
        />
        {variant.sku ? <p className="mt-1 break-all text-xs font-mono text-gray-500 sm:text-[11px]">{variant.sku}</p> : null}
        {!variantHasStock ? <p className="mt-1 text-[10px] font-bold text-red-600">Out of Stock</p> : null}
      </button>
    )
  })

  const sheetPortal = isOpen && useSheet && variants.length > 0 && typeof document !== 'undefined'
    ? createPortal(
        <>
          <button
            type="button"
            aria-label="Close variant picker"
            className="fixed inset-0 z-[120] bg-black/40"
            onClick={onClose}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[121] flex max-h-[min(72vh,560px)] flex-col rounded-t-2xl border border-gray-200 bg-white shadow-2xl"
            data-cart-variant-select={itemId}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">Select variant</p>
                {productName ? <p className="mt-0.5 truncate text-xs text-gray-500">{productName}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {variantOptions}
            </div>
          </div>
        </>,
        document.body,
      )
    : null

  const menuPortal = isOpen && !useSheet && menuStyle && variants.length > 0 && typeof document !== 'undefined'
    ? createPortal(
        <div
          data-cart-variant-select={itemId}
          style={{
            position: 'fixed',
            left: menuStyle.left,
            width: menuStyle.width,
            top: menuStyle.top,
            bottom: menuStyle.bottom,
            maxHeight: menuStyle.maxHeight,
            zIndex: 120,
          }}
          className="overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {variantOptions}
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <div className="relative" data-cart-variant-select={itemId}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (disabled || loading) return
            onOpen()
            onToggle()
          }}
          disabled={disabled || loading}
          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2.5 text-left text-xs sm:py-2 ${
            disabled || loading
              ? 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400'
              : 'border-slate-300 bg-white text-gray-900 hover:border-blue-400 active:bg-gray-50'
          }`}
        >
          <div className="min-w-0 flex-1">
            <ServiceNameStack
              name={name}
              cnName={cnName}
              primaryClassName="text-xs font-semibold text-gray-900"
              secondaryClassName="mt-0.5 text-[11px] text-gray-500"
            />
            {sku ? <p className="mt-1 break-all text-[11px] font-mono text-gray-500">{sku}</p> : null}
          </div>
          <svg
            className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {sheetPortal}
      {menuPortal}
    </>
  )
}

type CheckoutMeta = {
  paid_amount: number
  change_amount: number
}

type PosCurrentUser = {
  id: number
  name: string
  staff_id?: number | null
  staff_name?: string | null
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


type CheckoutItemAssignment = {
  cart_item_id: number
  splits: CheckoutItemStaffSplit[]
  is_default: boolean
}

type CheckoutItemStaffSplit = {
  staff_id: number
  share_percent: number
}

type CheckoutItemSplitDraft = {
  id: string
  staff_id: number | null
  share_percent: number
  search: string
  options: StaffOption[]
  loading: boolean
  open: boolean
}

type Member = {
  id: number
  name: string
  phone?: string | null
  phone_masked?: string | null
  email?: string | null
  member_code?: string | null
  avatar_url?: string | null
}

type MemberRecentOrder = {
  id: number
  order_number?: string | null
  order_date?: string | null
  status?: string | null
  total_amount?: number | null
  channel?: string | null
}

type MemberDetail = {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  member_code?: string | null
  join_date?: string | null
  customer_type?: string | null
  total_orders?: number
  total_spent?: number
  last_order_date?: string | null
  points_balance?: number
}

type MemberRecentOrdersMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type MemberActivePackage = {
  id: number
  package_name?: string | null
  expires_at?: string | null
}

type MemberUpcomingAppointment = {
  id: number
  booking_code?: string | null
  status?: string | null
  start_at?: string | null
  end_at?: string | null
  service_name?: string | null
  service_cn_name?: string | null
  staff_name?: string | null
}

type MemberUpcomingAppointmentsMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type PosVoucherOption = {
  id: number
  customer_voucher_id?: number
  status?: string
  expires_at?: string | null
  voucher?: {
    id: number
    code: string
    type: 'fixed' | 'percent'
    value: number
    min_order_amount?: number
    max_discount_amount?: number | null
    scope_type?: string
    start_at?: string | null
    end_at?: string | null
    is_active?: boolean
  } | null
}

type PublicVoucherApiItem = {
  id?: number
  code?: string
  type?: 'fixed' | 'percent' | string
  value?: number
  min_order_amount?: number
  max_discount_amount?: number | null
  scope_type?: string
  start_at?: string | null
  end_at?: string | null
  is_active?: boolean | number | string
}

type PageResponse<T> = {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}


type VariantPayload = {
  id?: number | string
  title?: string | null
  name?: string | null
  cn_name?: string | null
  sku?: string | null
  barcode?: string | null
  price?: number | string | null
  sale_price?: number | string | null
  image_url?: string | null
  image_path?: string | null
  is_active?: boolean | string | number
  track_stock?: boolean | string | number | null
  stock?: number | string | null
  is_bundle?: boolean | string | number | null
  derived_available_qty?: number | string | null
  bundle_items?: Array<{
    quantity?: number | string | null
    component_variant?: {
      stock?: number | string | null
      derived_available_qty?: number | string | null
    } | null
  }> | null
}

type ProductApiItem = {
  id: number
  product_id?: number | string | null
  name?: string
  cn_name?: string | null
  sku?: string
  barcode?: string | null
  price?: number | string
  is_staff_free?: boolean | number | string | null
  variants_count?: number | string | null
  stock?: number | string | null
  stock_quantity?: number | string | null
  track_stock?: boolean | string | number | null
  cover_image_url?: string | null
  main_image_url?: string | null
  image_url?: string | null
  images?: Array<{ url?: string | null; image_path?: string | null }>
  variants?: Array<{
    id?: number
    name?: string | null
    title?: string | null
    cn_name?: string | null
    sku?: string | null
    barcode?: string | null
    price?: number | string | null
    sale_price?: number | string | null
    image_url?: string | null
    image_path?: string | null
    is_active?: boolean | string | number
    track_stock?: boolean | string | number | null
    stock?: number | string | null
    is_bundle?: boolean | string | number | null
    derived_available_qty?: number | string | null
    bundle_items?: VariantPayload['bundle_items']
  }>
}

function extractPaged<T>(json: unknown): PageResponse<T> {
  const payloadAny: any =
    typeof json === 'object' && json !== null && 'data' in json ? (json as any).data : undefined

  if (payloadAny && typeof payloadAny === 'object' && Array.isArray(payloadAny.data)) {
    return {
      data: payloadAny.data as T[],
      current_page: Number(payloadAny.current_page ?? 1),
      last_page: Number(payloadAny.last_page ?? 1),
      per_page: Number(payloadAny.per_page ?? payloadAny.data.length ?? 0),
      total: Number(payloadAny.total ?? payloadAny.data.length ?? 0),
    }
  }

  if (payloadAny && Array.isArray(payloadAny)) {
    return {
      data: payloadAny as T[],
      current_page: 1,
      last_page: 1,
      per_page: payloadAny.length,
      total: payloadAny.length,
    }
  }

  return {
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 0,
    total: 0,
  }
}

type PosPageContentProps = {
  currentUser: PosCurrentUser
}

const getModalImageUrl = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export default function PosPageContent({ currentUser }: PosPageContentProps) {
  const { hasOpenShift, cashShiftLoading } = usePosCashShift()
  const scannerInputRef = useRef<HTMLInputElement | null>(null)
  const productsGridRef = useRef<HTMLDivElement | null>(null)
  const qrUploadInputRef = useRef<HTMLInputElement | null>(null)
  const qrCameraBackInputRef = useRef<HTMLInputElement | null>(null)
  const qrCameraFrontInputRef = useRef<HTMLInputElement | null>(null)
  const scanBufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const scanModeRef = useRef<'idle' | 'possible' | 'confirmed'>('idle')
  const possibleTimerRef = useRef<number | null>(null)
  const activeTargetRef = useRef<HTMLElement | null>(null)
  const scanTimeoutRef = useRef<number | null>(null)
  const lastScanMessageTimeoutRef = useRef<number | null>(null)
  const addByBarcodeRef = useRef<(barcode: string, qty?: number) => Promise<boolean>>(async () => false)
  const latestProductRequestRef = useRef(0)
  const previousCategoryIdRef = useRef<number | null>(null)

  const [cart, setCart] = useState<Cart | null>(null)

  const [productQuery, setProductQuery] = useState('')
  const [debouncedSkuQuery, setDebouncedSkuQuery] = useState('')
  const [productSearchMode, setProductSearchMode] = useState<ProductSearchMode>('name')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [productPage, setProductPage] = useState(1)
  const [productLastPage, setProductLastPage] = useState(1)
  const [productLoading, setProductLoading] = useState(false)
  const [productHighlighted, setProductHighlighted] = useState(0)
  const [productSelectModalOpen, setProductSelectModalOpen] = useState(false)
  const [catalogTab, setCatalogTab] = useState<PosCatalogTab>('products')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [productVariantLoading, setProductVariantLoading] = useState(false)
  const [selectedProductQty, setSelectedProductQty] = useState(1)
  const [fullProductData, setFullProductData] = useState<any>(null)
  const [serviceQuery, setServiceQuery] = useState('')
  const [bookingServiceCategories, setBookingServiceCategories] = useState<BookingServiceCategoryOption[]>([])
  const [selectedBookingServiceCategoryId, setSelectedBookingServiceCategoryId] = useState<number | null>(null)
  const [cartEditMainServicePickerQuery, setCartEditMainServicePickerQuery] = useState('')
  const [services, setServices] = useState<BookingServiceOption[]>([])
  const [bookingProducts, setBookingProducts] = useState<BookingProductOption[]>([])
  const [bookingProductsLoading, setBookingProductsLoading] = useState(false)
  const [bookingProductCategories, setBookingProductCategories] = useState<BookingProductCategoryOption[]>([])
  const [bookingProductQuery, setBookingProductQuery] = useState('')
  const [debouncedBookingProductQuery, setDebouncedBookingProductQuery] = useState('')
  const [selectedBookingProductCategoryId, setSelectedBookingProductCategoryId] = useState<number | null>(null)
  const [servicesLoading, setServicesLoading] = useState(false)
  const [servicePackages, setServicePackages] = useState<ServicePackageOption[]>([])
  const [servicePackagesLoading, setServicePackagesLoading] = useState(false)
  const [packageQuery, setPackageQuery] = useState('')
  const [settlementQuery, setSettlementQuery] = useState('')
  const [settlementAppointments, setSettlementAppointments] = useState<
    Array<{
      id: number
      booking_code: string
      customer_id?: number | null
      customer_name: string
      guest_name?: string | null
      guest_phone?: string | null
      guest_email?: string | null
      staff_name?: string | null
      status: string
      appointment_start_at?: string | null
      appointment_end_at?: string | null
      balance_due: number
      amount_due_now: number
      service_names?: string[]
      service_cn_names?: string[]
      service_total?: number
      addon_total_price?: number
      deposit_contribution?: number
      package_offset?: number
      add_ons?: Array<{ id?: number | null; name: string; extra_duration_min?: number; extra_price: number }>
    }>
  >([])
  const [settlementLoading, setSettlementLoading] = useState(false)
  const [packageModalOpen, setPackageModalOpen] = useState(false)
  const [packageDraft, setPackageDraft] = useState<ServicePackageOption | null>(null)
  const [packageSelectedMember, setPackageSelectedMember] = useState<Member | null>(null)
  const [packageMemberQuery, setPackageMemberQuery] = useState('')
  const [packageMembers, setPackageMembers] = useState<Member[]>([])
  const [packageMembersLoading, setPackageMembersLoading] = useState(false)
  const [packageMemberPickerOpen, setPackageMemberPickerOpen] = useState(false)
  const [assignMemberContext, setAssignMemberContext] = useState<'checkout' | 'service' | 'package'>('checkout')
  const [packageModalError, setPackageModalError] = useState<string | null>(null)
  const packageRemarkRef = useRef<PosModalRemarkFieldHandle>(null)
  const [packageSubmitting, setPackageSubmitting] = useState(false)
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingServiceDraft, setBookingServiceDraft] = useState<BookingServiceOption | null>(null)
  const [bookingAssignedStaffId, setBookingAssignedStaffId] = useState<number | null>(null)
  const [bookingDate, setBookingDate] = useState('')
  const [bookingSlots, setBookingSlots] = useState<Array<{ start_at: string; end_at: string; available_staff_ids?: number[] }>>([])
  const [bookingSlotValue, setBookingSlotValue] = useState('')
  const [bookingQuestions, setBookingQuestions] = useState<BookingServiceQuestion[]>([])
  const bookingRemarkRef = useRef<PosModalRemarkFieldHandle>(null)
  const [bookingSelectedOptionIds, setBookingSelectedOptionIds] = useState<number[]>([])
  const [bookingExtraServiceBlocks, setBookingExtraServiceBlocks] = useState<BookingExtraServiceBlock[]>([])
  const [bookingExtraServiceCategoryIds, setBookingExtraServiceCategoryIds] = useState<Record<string, number | null>>({})
  const [bookingExtraServiceQueries, setBookingExtraServiceQueries] = useState<Record<string, string>>({})
  const [bookingSlotsLoading, setBookingSlotsLoading] = useState(false)
  const [bookingModalError, setBookingModalError] = useState<string | null>(null)
  const [bookingIdentityMode, setBookingIdentityMode] = useState<'member' | 'guest'>('member')
  const bookingGuestNameRef = useRef<HTMLInputElement>(null)
  const bookingGuestEmailRef = useRef<HTMLInputElement>(null)
  /** Last guest contact used for Book Services — reused for the next service add & checkout guest mode */
  const [guestContactCache, setGuestContactCache] = useState({ name: '', phone: '', email: '' })
  const [bookingGuestPhoneValue, setBookingGuestPhoneValue] = useState('')
  /** Checkout confirmation: member vs guest when book services exist without packages */
  const [checkoutIdentityMode, setCheckoutIdentityMode] = useState<'member' | 'guest'>('member')
  const [serviceAvailabilityMap, setServiceAvailabilityMap] = useState<Record<number, number>>({})
  const [settlementAvailabilityMap, setSettlementAvailabilityMap] = useState<Record<number, number>>({})
  const [serviceRedeemingIds, setServiceRedeemingIds] = useState<Record<number, boolean>>({})
  const [serviceUnclaimingIds, setServiceUnclaimingIds] = useState<Record<number, boolean>>({})
  const [settlementRedeemingIds, setSettlementRedeemingIds] = useState<Record<number, boolean>>({})
  const [settlementUnclaimingIds, setSettlementUnclaimingIds] = useState<Record<number, boolean>>({})

  const [cartEditSettlementOpen, setCartEditSettlementOpen] = useState(false)
  const [cartEditSettlementBookingId, setCartEditSettlementBookingId] = useState<number | null>(null)
  const [cartEditSettlementServiceId, setCartEditSettlementServiceId] = useState<number | null>(null)
  const [cartEditSettlementLoading, setCartEditSettlementLoading] = useState(false)
  const [cartEditSettlementError, setCartEditSettlementError] = useState<string | null>(null)
  const [cartEditAddonQuestions, setCartEditAddonQuestions] = useState<Array<{ id: number; title: string; cn_title?: string | null; question_type: string; is_required: boolean; options: Array<{ id: number; label: string; cn_label?: string | null; cn_name?: string | null; linked_cn_name?: string | null; extra_duration_min: number; extra_price: number }> }>>([])
  const [cartEditSelectedAddonIds, setCartEditSelectedAddonIds] = useState<Set<number>>(new Set())
  const [cartEditMainServiceCatalog, setCartEditMainServiceCatalog] = useState<BookingServiceOption[]>([])
  const [cartEditMainServiceCatalogLoading, setCartEditMainServiceCatalogLoading] = useState(false)
  const [cartEditMainServiceCategoryId, setCartEditMainServiceCategoryId] = useState<number | null>(null)
  const [cartEditMainServicePickerOpen, setCartEditMainServicePickerOpen] = useState(false)
  const [cartEditMainServicePickerTargetId, setCartEditMainServicePickerTargetId] = useState<'__new__' | '__original__' | null>(null)
  const [cartEditOriginalService, setCartEditOriginalService] = useState<BookingServiceOption | null>(null)
  const [cartEditAddedMainBlocks, setCartEditAddedMainBlocks] = useState<Array<{
    tmp_id: string
    service_id: number
    service_name: string
    service_cn_name?: string | null
    price: number
    duration_min: number
    addon_questions: Array<{ id: number; title: string; cn_title?: string | null; question_type: string; is_required: boolean; options: Array<{ id: number; label: string; cn_label?: string | null; cn_name?: string | null; linked_cn_name?: string | null; extra_duration_min: number; extra_price: number }> }>
    selected_addon_ids: Set<number>
    staff_splits: Array<{ staff_id: number | null; share_percent: string }>
    auto_balance: boolean
  }>>([])
  const [cartEditSettledAmount, setCartEditSettledAmount] = useState('')
  const [cartEditStaffSplits, setCartEditStaffSplits] = useState<Array<{ staff_id: number | null; share_percent: string }>>([])
  const [cartEditStaffSplitAutoBalance, setCartEditStaffSplitAutoBalance] = useState(true)
  const [cartEditAddonOptionsLoading, setCartEditAddonOptionsLoading] = useState(false)
  const [cartEditSettlementItem, setCartEditSettlementItem] = useState<AppointmentSettlementCartItem | null>(null)
  const [cartEditOriginalServicePrice, setCartEditOriginalServicePrice] = useState<number | null>(null)
  const [cartEditAddonPriceOverrides, setCartEditAddonPriceOverrides] = useState<Record<number, number>>({})

  const [memberOpen, setMemberOpen] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [memberPage, setMemberPage] = useState(1)
  const [memberLastPage, setMemberLastPage] = useState(1)
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberDetailLoading, setMemberDetailLoading] = useState(false)
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null)
  const [memberRecentOrders, setMemberRecentOrders] = useState<MemberRecentOrder[]>([])
  const [memberRecentOrdersMeta, setMemberRecentOrdersMeta] = useState<MemberRecentOrdersMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 5,
    total: 0,
  })
  const [memberOrdersLoadingMore, setMemberOrdersLoadingMore] = useState(false)
  const [memberActivePackages, setMemberActivePackages] = useState<MemberActivePackage[]>([])
  const [memberActivePackagesTotal, setMemberActivePackagesTotal] = useState(0)
  const [memberUpcomingAppointments, setMemberUpcomingAppointments] = useState<MemberUpcomingAppointment[]>([])
  const [memberUpcomingAppointmentsMeta, setMemberUpcomingAppointmentsMeta] = useState<MemberUpcomingAppointmentsMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 2,
    total: 0,
  })
  const [memberAppointmentsLoadingMore, setMemberAppointmentsLoadingMore] = useState(false)
  const [memberOrderViewId, setMemberOrderViewId] = useState<number | null>(null)
  const [lookupMember, setLookupMember] = useState<Member | null>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [voucherModalOpen, setVoucherModalOpen] = useState(false)
  const [voucherLoading, setVoucherLoading] = useState(false)
  const [voucherApplying, setVoucherApplying] = useState(false)
  const [availableVouchers, setAvailableVouchers] = useState<PosVoucherOption[]>([])
  const [selectedVoucherKey, setSelectedVoucherKey] = useState<string>('')

  const [activeStaffs, setActiveStaffs] = useState<StaffOption[]>([])
  const [checkoutConfirmationOpen, setCheckoutConfirmationOpen] = useState(false)
  const [bookingProductOptionModalOpen, setBookingProductOptionModalOpen] = useState(false)
  const [bookingProductDraft, setBookingProductDraft] = useState<BookingProductOption | null>(null)
  const [checkoutItemAssignments, setCheckoutItemAssignments] = useState<CheckoutItemAssignment[]>([])
  const [packageCheckoutSplits, setPackageCheckoutSplits] = useState<Record<number, CheckoutItemStaffSplit[]>>({})
  const [checkoutLineSplits, setCheckoutLineSplits] = useState<Record<string, CheckoutItemStaffSplit[]>>({})
  const [itemSplitEditorOpen, setItemSplitEditorOpen] = useState(false)
  const [itemSplitEditorTarget, setItemSplitEditorTarget] = useState<{ type: 'product' | 'package' | 'settlement' | 'line' | 'bulk'; id: number; lineKey?: string; lineKeys?: string[]; productCartItemIds?: number[]; packageItemIds?: number[]; title?: string } | null>(null)
  const [itemSplitDraftRows, setItemSplitDraftRows] = useState<CheckoutItemSplitDraft[]>([])
  const [itemSplitAutoBalance, setItemSplitAutoBalance] = useState(true)
  const [bulkSplitOverwrite, setBulkSplitOverwrite] = useState(false)
  const [globalBulkSelectedOnly, setGlobalBulkSelectedOnly] = useState(false)
  const [globalBulkSelectedKeys, setGlobalBulkSelectedKeys] = useState<Set<string>>(new Set())
  const [itemSplitError, setItemSplitError] = useState<string | null>(null)
  const [priceEditTarget, setPriceEditTarget] = useState<PriceEditTarget | null>(null)
  const [priceEditValueDraft, setPriceEditValueDraft] = useState('')
  const [priceEditReasonDraft, setPriceEditReasonDraft] = useState('')
  const [priceEditMode, setPriceEditMode] = useState<'unit' | 'line'>('unit')
  const [priceEditLineTotalDraft, setPriceEditLineTotalDraft] = useState('')
  const [priceEditSaving, setPriceEditSaving] = useState(false)
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const [discountSaving, setDiscountSaving] = useState(false)
  const [discountTarget, setDiscountTarget] = useState<DiscountTarget | null>(null)
  const [discountTypeDraft, setDiscountTypeDraft] = useState<'percentage' | 'fixed'>('fixed')
  const [discountValueDraft, setDiscountValueDraft] = useState('')
  const [discountRemarkDraft, setDiscountRemarkDraft] = useState('')
  const staffSearchTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qrpay' | 'billplz_credit_card'>('cash')
  const [splitPaymentAmounts, setSplitPaymentAmounts] = useState<Record<SplitPaymentMethod, string>>({ cash: '', qrpay: '', credit_card: '' })
  const [qrProofFile, setQrProofFile] = useState<File | null>(null)
  const [qrProofFileName, setQrProofFileName] = useState<string | null>(null)
  const [qrProofPreviewUrl, setQrProofPreviewUrl] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)

  const [cartVariantOptions, setCartVariantOptions] = useState<Record<number, ProductVariantOption[]>>({})
  const [cartVariantLoading, setCartVariantLoading] = useState<Record<number, boolean>>({})
  const [cartVariantFetched, setCartVariantFetched] = useState<Record<number, boolean>>({})
  const [openCartVariantItemId, setOpenCartVariantItemId] = useState<number | null>(null)
  const [checkoutResult, setCheckoutResult] = useState<null | {
    order_id: number
    order_number: string
    receipt_public_url: string | null
    total: number
    payment_method: 'cash' | 'qrpay' | 'billplz_credit_card' | 'split'
    paid_amount: number
    change_amount: number
  }>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [qrCodeFullscreen, setQrCodeFullscreen] = useState(false)
  const [receiptEmail, setReceiptEmail] = useState('')
  const [receiptEmailError, setReceiptEmailError] = useState<string | null>(null)
  const [sendingReceiptEmail, setSendingReceiptEmail] = useState(false)
  const [receiptCooldownUntil, setReceiptCooldownUntil] = useState<number>(0)
  const [receiptQrLoaded, setReceiptQrLoaded] = useState(false)
  const [autoPrint, setAutoPrint] = useState(false)
  const [printMode, setPrintMode] = useState<'usb' | 'bluetooth' | 'wifi'>('bluetooth')
  const [btPrinterName, setBtPrinterName] = useState<string | null>(null)
  const [btConnecting, setBtConnecting] = useState(false)
  const [wifiPrinterIp, setWifiPrinterIp] = useState('')
  const [wifiPrinterPort, setWifiPrinterPort] = useState('9100')
  const [wifiTesting, setWifiTesting] = useState(false)
  const [wifiTestOk, setWifiTestOk] = useState<boolean | null>(null)
  const [lastScanValue, setLastScanValue] = useState('')
  const [lastScanVisible, setLastScanVisible] = useState(false)

  const formatTimeRange = useCallback((startAt?: string | null, endAt?: string | null) => {
    if (!startAt) return '-'
    const start = new Date(startAt)
    if (!endAt) return start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const end = new Date(endAt)
    return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }, [])

  const formatSettlementStaffLabel = useCallback((settlement: AppointmentSettlementCartItem): string => {
    const splits = (settlement.staff_splits ?? [])
      .filter((split) => Number(split.staff_id) > 0 && Number(split.share_percent) > 0)
    if (splits.length > 0) {
      return splits
        .map((split) => {
          const fallbackName = activeStaffs.find((staff) => staff.id === split.staff_id)?.name ?? `Staff #${split.staff_id}`
          const staffName = (split.staff_name ?? '').trim() || fallbackName
          return `${staffName} (${Number(split.share_percent)}%)`
        })
        .join(', ')
    }

    const fallbackName = (settlement.staff_name ?? '').trim()
    return fallbackName ? `${fallbackName} (100%)` : '—'
  }, [activeStaffs])

  const formatDateTimeRange = useCallback((startAt?: string | null, endAt?: string | null) => {
    if (!startAt) return '-'
    const start = new Date(startAt)
    if (!endAt) return start.toLocaleString()
    return `${start.toLocaleString()} - ${new Date(endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }, [])

  const getSettlementDurationMin = useCallback((settlement: AppointmentSettlementCartItem): number => {
    const mainDuration = (settlement.main_services ?? []).reduce((sum, service) => {
      const own = Number(service.extra_duration_min ?? 0)
      const addonDuration = (service.add_ons ?? []).reduce((addonSum, addon) => addonSum + Number(addon.extra_duration_min ?? 0), 0)
      return sum + own + addonDuration
    }, 0)
    if (mainDuration > 0) return mainDuration
    return 0
  }, [])

  const getSettlementDisplayEndAt = useCallback((settlement: AppointmentSettlementCartItem): string | null => {
    const startAt = settlement.appointment_start_at
    if (!startAt) return settlement.appointment_end_at ?? null
    const durationMin = getSettlementDurationMin(settlement)
    if (durationMin <= 0) return settlement.appointment_end_at ?? null
    const start = new Date(startAt)
    if (Number.isNaN(start.getTime())) return settlement.appointment_end_at ?? null
    return new Date(start.getTime() + durationMin * 60 * 1000).toISOString()
  }, [getSettlementDurationMin])

  const normalizedProductQuery = useMemo(() => {
    const source = productSearchMode === 'barcode' ? debouncedSkuQuery : productQuery
    return source.trim().toLowerCase()
  }, [debouncedSkuQuery, productQuery, productSearchMode])
  const normalizeSkuSearchValue = useCallback((value: string | null | undefined) => value?.trim().toLowerCase() ?? '', [])
  const effectiveServerProductQuery = useMemo(
    () => (productSearchMode === 'barcode' ? debouncedSkuQuery.trim() : ''),
    [debouncedSkuQuery, productSearchMode],
  )
  const findMatchedVariantBarcode = useCallback((item: ProductOption, keyword: string) => {
    if (!keyword) return null

    const activeVariants = (item.variants ?? []).filter((variant) => variant.is_active !== false)
    for (const variant of activeVariants) {
      const variantBarcode = normalizeSkuSearchValue(variant.barcode || variant.sku)
      if (variantBarcode && variantBarcode.includes(keyword)) {
        return variant
      }
    }

    return null
  }, [normalizeSkuSearchValue])
  const visibleProductHits = useMemo<ProductSearchHit[]>(() => {
    if (!normalizedProductQuery) {
      return products.map((product) => ({ product }))
    }

    if (productSearchMode === 'name') {
      return products.flatMap((product) => {
        const productName = product.name?.toLowerCase() ?? ''
        const productCnName = product.cn_name?.toLowerCase() ?? ''

        if (
          productName.includes(normalizedProductQuery) ||
          productCnName.includes(normalizedProductQuery)
        ) {
          return [{ product }]
        }

        const matchedVariant = (product.variants ?? []).find((variant) => {
          if (variant.is_active === false) return false
          const variantName = variant.name?.toLowerCase() ?? ''
          const variantCnName = variant.cn_name?.toLowerCase() ?? ''
          return (
            variantName.includes(normalizedProductQuery) ||
            variantCnName.includes(normalizedProductQuery)
          )
        })

        if (!matchedVariant) return []

        return [{
          product,
          matchedVariantId: matchedVariant.id,
          matchedVariantSku: matchedVariant.sku,
          matchedVariantName: matchedVariant.name,
        }]
      })
    }

    return products.flatMap((product) => {
      const productBarcode = normalizeSkuSearchValue(product.barcode || product.sku)
      if (productBarcode && productBarcode.includes(normalizedProductQuery)) {
        return [{ product }]
      }

      const matchedVariant = findMatchedVariantBarcode(product, normalizedProductQuery)
      if (!matchedVariant) return []

      return [{
        product,
        matchedVariantId: matchedVariant.id,
        matchedVariantSku: matchedVariant.sku,
        matchedVariantName: matchedVariant.name,
      }]
    })
  }, [findMatchedVariantBarcode, normalizeSkuSearchValue, normalizedProductQuery, productSearchMode, products])
  const firstActiveVariantSku = useCallback((item: ProductOption) => {
    const firstActive = (item.variants ?? []).find((variant) => variant.is_active !== false && Boolean(variant.sku?.trim()))
    return firstActive?.sku?.trim() ?? ''
  }, [])

  const cartItems = useMemo(() => cart?.items ?? [], [cart?.items])
  const cartServiceItems = useMemo(() => cart?.service_items ?? [], [cart?.service_items])
  const cartPackageItems = useMemo(() => cart?.package_items ?? [], [cart?.package_items])
  const cartAppointmentSettlementItems = useMemo(
    () => cart?.appointment_settlement_items ?? [],
    [cart?.appointment_settlement_items],
  )

  const hasCartProducts = cartItems.length > 0
  const hasCartBookServices = cartServiceItems.length > 0
  const hasCartPackages = cartPackageItems.length > 0
  const hasCartAppointmentSettlements = cartAppointmentSettlementItems.length > 0
  const hasCartGuestSettlement = useMemo(() => {
    return cartAppointmentSettlementItems.some((row) => {
      if (row.customer_id) return false
      const guestEmail = row.guest_email?.trim() ?? ''
      const guestName = row.guest_name?.trim().toUpperCase() ?? ''
      return Boolean(guestEmail) || guestName === 'UNKNOWN'
    })
  }, [cartAppointmentSettlementItems])
  const settlementLockedIdentityMode = useMemo<'member' | 'guest' | null>(() => {
    if (!hasCartAppointmentSettlements) return null
    return hasCartGuestSettlement ? 'guest' : 'member'
  }, [hasCartAppointmentSettlements, hasCartGuestSettlement])
  /** Member/guest validation before pay (product-only carts skip) */
  const checkoutRequiresCustomerValidation = hasCartBookServices || hasCartPackages || hasCartAppointmentSettlements
  /** Rules C,E,F,G: any package ⇒ member only, no guest */
  const checkoutRequiresMemberOnly = hasCartPackages || (hasCartAppointmentSettlements && !hasCartGuestSettlement)
  /** Rules B,D: book services without packages ⇒ member or guest */
  const checkoutAllowsGuestToggle = hasCartBookServices && !hasCartPackages
  /** Same Member / Guest UI as booking flow; product-only adds optional context + Clear */
  const showMemberGuestToggleInCheckout = checkoutAllowsGuestToggle || !checkoutRequiresCustomerValidation

  /** When settlement exists, customer context is locked (must remove settlement to change). */
  const settlementLockedCustomerId = useMemo(() => {
    if (!hasCartAppointmentSettlements) return null
    const ids = new Set<number>()
    for (const row of cartAppointmentSettlementItems) {
      const id = Number((row as any)?.customer_id ?? 0)
      if (Number.isFinite(id) && id > 0) ids.add(id)
    }
    if (ids.size === 1) return Array.from(ids)[0] ?? null
    return null
  }, [cartAppointmentSettlementItems, hasCartAppointmentSettlements])

  useEffect(() => {
    if (!hasCartAppointmentSettlements) return
    if (hasCartGuestSettlement) {
      setCheckoutIdentityMode('guest')
      setBookingIdentityMode('guest')
      const guestRow = cartAppointmentSettlementItems.find((row) => !row.customer_id && (row.guest_name || row.guest_phone || row.guest_email))
      if (guestRow) {
        setGuestContactCache((prev) => ({
          name: prev.name.trim() ? prev.name : (guestRow.guest_name ?? ''),
          phone: prev.phone.trim() ? prev.phone : (guestRow.guest_phone ?? ''),
          email: prev.email.trim() ? prev.email : (guestRow.guest_email ?? ''),
        }))
        // Booking modal guest fields are kept in sync when possible.
        if (bookingGuestNameRef.current && !bookingGuestNameRef.current.value.trim() && guestRow.guest_name) {
          bookingGuestNameRef.current.value = guestRow.guest_name
        }
        if (!bookingGuestPhoneValue.trim() && guestRow.guest_phone) {
          setBookingGuestPhoneValue(guestRow.guest_phone)
        }
        if (bookingGuestEmailRef.current && !bookingGuestEmailRef.current.value.trim() && guestRow.guest_email) {
          bookingGuestEmailRef.current.value = guestRow.guest_email
        }
      }
      return
    }
    // Settlement is member-only and should freeze identity switching.
    setCheckoutIdentityMode('member')
    setBookingIdentityMode('member')
    if (settlementLockedCustomerId && selectedMember?.id !== settlementLockedCustomerId) {
      const raw = cartAppointmentSettlementItems[0]?.customer_name?.trim()
      const name = raw && raw.length > 0 ? raw : `Member (#${settlementLockedCustomerId})`
      setSelectedMember({ id: settlementLockedCustomerId, name, phone: null, email: null })
    }
  }, [
    bookingGuestPhoneValue,
    cartAppointmentSettlementItems,
    hasCartGuestSettlement,
    hasCartAppointmentSettlements,
    selectedMember?.id,
    settlementLockedCustomerId,
  ])


  const checkoutGuestIsUnknown = useMemo(() => {
    if (checkoutIdentityMode !== 'guest') return false
    const name = guestContactCache.name.trim().toUpperCase()
    const phone = normalizeInternationalPhone(guestContactCache.phone)
    const email = guestContactCache.email.trim()
    return name === 'UNKNOWN' && phone === '' && email === ''
  }, [checkoutIdentityMode, guestContactCache.email, guestContactCache.name, guestContactCache.phone])

  const guestContactIsComplete = useMemo(() => {
    const name = guestContactCache.name.trim()
    const phone = normalizeInternationalPhone(guestContactCache.phone)
    const email = guestContactCache.email.trim()
    const phoneOk = /^\+?[0-9]{8,15}$/.test(phone)
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    return Boolean(name && phoneOk && emailOk)
  }, [guestContactCache.email, guestContactCache.name, guestContactCache.phone])

  const totalItems = useMemo(() => {
    const productQty = cartItems.reduce((sum, item) => sum + item.qty, 0)
    const serviceQty = cartServiceItems.reduce((sum, item) => sum + item.qty, 0)
    return productQty + serviceQty
  }, [cartItems, cartServiceItems])
  const cartSubtotal = Number(cart?.subtotal ?? cart?.grand_total ?? 0)
  const cartTotal = Number(cart?.grand_total ?? 0)
  const bookingDepositTotal = Number(cart?.booking_deposit_total ?? 0)
  const bookingDepositBreakdown = cart?.booking_deposit_breakdown ?? null
  
  // Calculate promotion discount from items
  const promotionDiscount = useMemo(() => {
    if (!cart?.items) return 0
    return cart.items.reduce((sum, item) => {
      if (item.promotion_applied && item.line_total_snapshot) {
        return sum + (Number(item.line_total_snapshot) - Number(item.line_total))
      }
      return sum
    }, 0)
  }, [cart?.items])
  
  // Calculate voucher discount
  const voucherDiscount = useMemo(() => {
    return Number(cart?.voucher?.discount_amount ?? 0)
  }, [cart?.voucher?.discount_amount])
  
  const discount = Math.max(0, cartSubtotal - cartTotal)
  const appliedVoucher = cart?.voucher ?? null

  const receiptQrImageUrl = useMemo(() => {
    if (!checkoutResult?.receipt_public_url) return null
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkoutResult.receipt_public_url)}`
  }, [checkoutResult?.receipt_public_url])

  const receiptQrFullscreenImageUrl = useMemo(() => {
    if (!checkoutResult?.receipt_public_url) return null
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(checkoutResult.receipt_public_url)}`
  }, [checkoutResult?.receipt_public_url])

  const receiptCooldownActive = receiptCooldownUntil > Date.now()



  useEffect(() => {
    if (!receiptQrImageUrl && !receiptQrFullscreenImageUrl) {
      setReceiptQrLoaded(false)
      return
    }

    setReceiptQrLoaded(false)
    const smallImage = new Image()
    smallImage.src = receiptQrImageUrl ?? ''
    smallImage.onload = () => setReceiptQrLoaded(true)
    smallImage.onerror = () => setReceiptQrLoaded(true)

    if (receiptQrFullscreenImageUrl) {
      const fullImage = new Image()
      fullImage.src = receiptQrFullscreenImageUrl
    }
  }, [receiptQrImageUrl, receiptQrFullscreenImageUrl])



  useEffect(() => {
    if (!receiptCooldownUntil) return

    const remaining = receiptCooldownUntil - Date.now()
    if (remaining <= 0) {
      setReceiptCooldownUntil(0)
      return
    }

    const timer = window.setTimeout(() => setReceiptCooldownUntil(0), remaining)

    return () => window.clearTimeout(timer)
  }, [receiptCooldownUntil])

  const selectedStaffSplitsByCartItemId = useMemo(() => {
    const map = new Map<number, CheckoutItemStaffSplit[]>()
    checkoutItemAssignments.forEach((assignment) => {
      map.set(assignment.cart_item_id, assignment.splits)
    })
    return map
  }, [checkoutItemAssignments])

  type ToastKind = 'success' | 'error' | 'info' | 'warning'
  type ToastItem = { id: string; kind: ToastKind; text: string }

  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback((kind: ToastKind, text: string) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const nextToast: ToastItem = { id, kind, text }

    setToasts((prev) => {
      const next = [...prev, nextToast]
      return next.slice(-4) // keep it tidy on iPad
    })

    window.setTimeout(() => dismissToast(id), 3200)
  }, [dismissToast])


  const handleConnectBtPrinter = async () => {
    setBtConnecting(true)
    try {
      const name = await connectBluetoothPrinter()
      setBtPrinterName(name)
      pushToast('success', `Connected: ${name}`)
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to connect printer')
      setBtPrinterName(null)
    } finally {
      setBtConnecting(false)
    }
  }

  const handleDisconnectBtPrinter = () => {
    disconnectBluetoothPrinter()
    setBtPrinterName(null)
    pushToast('info', 'Printer disconnected')
  }

  const handleTestWifiPrinter = async () => {
    const ip = wifiPrinterIp.trim()
    if (!ip) {
      pushToast('error', 'Please enter printer IP address')
      return
    }
    setWifiTesting(true)
    setWifiTestOk(null)
    try {
      await testWifiPrinterConnection(ip, Number(wifiPrinterPort) || 9100)
      setWifiTestOk(true)
      pushToast('success', `Test print sent to ${ip}`)
    } catch (err) {
      setWifiTestOk(false)
      pushToast('error', err instanceof Error ? err.message : 'WiFi print test failed')
    } finally {
      setWifiTesting(false)
    }
  }

  const focusScanner = () => {
    scannerInputRef.current?.focus()
  }

  const clearScannerInput = () => {
    if (scannerInputRef.current) {
      scannerInputRef.current.value = ''
    }
  }

  const showMsg = (text: string, kind: ToastKind = 'info') => pushToast(kind, text)

  const formatVoucherLabel = (item: PosVoucherOption) => {
    const voucher = item.voucher
    if (!voucher) return 'Unknown voucher'
    const value = Number(voucher.value ?? 0)
    const discountText = voucher.type === 'percent' ? `${value}% OFF` : `RM ${value.toFixed(2)} OFF`
    return `${voucher.code} · ${discountText}`
  }

  const getVoucherRuleStatus = (item: PosVoucherOption) => {
    const voucher = item.voucher
    if (!voucher) return { eligible: false, reason: 'Invalid voucher data.' }

    const now = new Date()
    const startAt = voucher.start_at ? new Date(voucher.start_at) : null
    const endAt = item.expires_at ? new Date(item.expires_at) : (voucher.end_at ? new Date(voucher.end_at) : null)

    const isActiveValue = voucher.is_active
    const isInactive = 
      (typeof isActiveValue === 'boolean' && isActiveValue === false) ||
      (typeof isActiveValue === 'number' && isActiveValue === 0) ||
      (typeof isActiveValue === 'string' && (isActiveValue === '0' || isActiveValue === 'false'))
    if (isInactive) {
      return { eligible: false, reason: 'Voucher is inactive.' }
    }

    if (startAt && !Number.isNaN(startAt.getTime()) && startAt > now) {
      return { eligible: false, reason: 'Voucher is not started yet.' }
    }

    if (endAt && !Number.isNaN(endAt.getTime()) && endAt < now) {
      return { eligible: false, reason: 'Voucher has expired.' }
    }

    const minSpend = Number(voucher.min_order_amount ?? 0)
    if (minSpend > 0 && cartSubtotal < minSpend) {
      return { eligible: false, reason: `Minimum spend RM ${minSpend.toFixed(2)} required.` }
    }

    return { eligible: true, reason: null }
  }


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

  const fetchActiveStaffs = useCallback(async () => {
    const params = new URLSearchParams({ page: '1', per_page: '50', is_active: '1' })
    const res = await fetch(`/api/proxy/staffs?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) return

    const json = await res.json().catch(() => null)
    setActiveStaffs(mapStaffOptions(json))
  }, [mapStaffOptions])

  const fetchStaffOptions = useCallback(async (search: string) => {
    const params = new URLSearchParams({ page: '1', per_page: '20', is_active: '1' })
    if (search.trim()) params.set('search', search.trim())
    const res = await fetch(`/api/proxy/staffs?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) return [] as StaffOption[]
    const json = await res.json().catch(() => null)
    return mapStaffOptions(json)
  }, [mapStaffOptions])

  const fetchVouchers = useCallback(async (memberId?: number | null) => {
    setVoucherLoading(true)
    try {
      if (memberId) {
        const res = await fetch(`/api/proxy/pos/members/${memberId}/vouchers`, { cache: 'no-store' })
        const json = await res.json()
        const paged = extractPaged<PosVoucherOption>(json)
        setAvailableVouchers(paged.data)
        return
      }

      const params = new URLSearchParams({
        page: '1',
        per_page: '50',
        is_reward_only: 'false',
      })
      const res = await fetch(`/api/proxy/ecommerce/vouchers?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      const paged = extractPaged<PosVoucherOption>(json)
      const mapped = paged.data.map((item) => {
        if (item.voucher) return item
        const raw = item as unknown as PublicVoucherApiItem
        const fallbackCode = raw.code
        const fallbackId = Number(raw.id ?? item.id)
        return {
          ...item,
          voucher: {
            id: fallbackId,
            code: typeof fallbackCode === 'string' ? fallbackCode : `Voucher #${fallbackId}`,
            type: (raw.type === 'percent' ? 'percent' : 'fixed') as 'fixed' | 'percent',
            value: Number(raw.value ?? 0),
            min_order_amount: Number(raw.min_order_amount ?? 0),
            max_discount_amount: raw.max_discount_amount != null ? Number(raw.max_discount_amount) : null,
            scope_type: raw.scope_type ?? 'all',
            start_at: raw.start_at ?? null,
            end_at: raw.end_at ?? null,
            is_active: raw.is_active === true || raw.is_active === 1 || raw.is_active === '1' || raw.is_active === 'true',
          },
        }
      })
      setAvailableVouchers(mapped)
    } catch {
      setAvailableVouchers([])
    } finally {
      setVoucherLoading(false)
    }
  }, [])

  const removeVoucher = useCallback(async (silent = false) => {
    const res = await fetch('/api/proxy/pos/cart/voucher', { method: 'DELETE' })
    const json = await res.json()
    if (res.ok && json?.data?.cart) {
      setCart(json.data.cart)
      if (!silent) showMsg('Voucher removed.', 'info')
      return true
    }

    if (!silent) showMsg(json?.message ?? 'Unable to remove voucher.', 'error')
    return false
  }, [showMsg])

  const selectedVoucher = useMemo(
    () => availableVouchers.find((item) => String(item.id) === selectedVoucherKey || String(item.customer_voucher_id) === selectedVoucherKey) ?? null,
    [availableVouchers, selectedVoucherKey],
  )
  const selectedVoucherRule = useMemo(
    () => (selectedVoucher ? getVoucherRuleStatus(selectedVoucher) : null),
    [selectedVoucher, cartSubtotal],
  )

  const applyVoucher = useCallback(async () => {
    if (!selectedVoucherKey) return

    const selected = availableVouchers.find((item) => String(item.id) === selectedVoucherKey || String(item.customer_voucher_id) === selectedVoucherKey)
    if (!selected) return

    const rule = getVoucherRuleStatus(selected)
    if (!rule.eligible) {
      showMsg(rule.reason ?? 'Voucher does not meet rules.', 'warning')
      return
    }

    const payload: Record<string, number | string> = {}
    if (selected.customer_voucher_id) {
      payload.customer_voucher_id = selected.customer_voucher_id
      if (selectedMember?.id) payload.member_id = selectedMember.id
    } else if (selected.voucher?.code) {
      payload.voucher_code = selected.voucher.code
      if (selectedMember?.id) payload.member_id = selectedMember.id
    } else {
      showMsg('Invalid voucher selection.', 'error')
      return
    }

    setVoucherApplying(true)
    const res = await fetch('/api/proxy/pos/cart/voucher/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setVoucherApplying(false)

    if (res.ok && json?.data?.cart) {
      setCart(json.data.cart)
      setVoucherModalOpen(false)
      showMsg('Voucher applied.', 'success')
      return
    }

    showMsg(json?.message ?? 'Unable to apply voucher.', 'error')
  }, [availableVouchers, selectedMember?.id, selectedVoucherKey, showMsg])

  async function loadCart() {
    const res = await fetch('/api/proxy/pos/cart', { cache: 'no-store' })
    const json = await res.json()
    if (res.ok && json?.data?.cart) {
      setCart(json.data.cart)
    }
  }

  async function addByBarcode(barcode: string, qty = 1) {
    const trimmed = barcode.trim()
    if (!trimmed) return false

    try {
      const res = await fetch('/api/proxy/pos/cart/add-by-barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: trimmed, qty }),
      })
      const json = await res.json().catch(() => null)

      if (res.ok && json?.data?.cart) {
        setCart(json.data.cart)
        showMsg(`Added barcode ${trimmed} to cart.`, 'success')
        return true
      }

      if (res.status === 404) {
        showMsg(`No POS product found for barcode ${trimmed}.`, 'error')
        return false
      }

      showMsg(typeof json?.message === 'string' ? json.message : `Unable to add barcode ${trimmed}.`, 'error')
      return false
    } catch (err) {
      showMsg(err instanceof Error ? err.message : `Unable to add barcode ${trimmed}.`, 'error')
      return false
    }
  }
  addByBarcodeRef.current = addByBarcode

  async function addBySelection(payload: { variant_id?: number; product_id?: number }, qty = 1) {
    const variantId = Number(payload.variant_id)
    const productId = Number(payload.product_id)

    if ((!Number.isFinite(variantId) || variantId <= 0) && (!Number.isFinite(productId) || productId <= 0)) {
      return false
    }

    const body: Record<string, number> = { qty }
    if (Number.isFinite(variantId) && variantId > 0) {
      body.variant_id = variantId
    } else if (Number.isFinite(productId) && productId > 0) {
      body.product_id = productId
    }

    const res = await fetch('/api/proxy/pos/cart/add-by-variant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()

    if (res.ok) {
      setCart(json.data.cart)
      showMsg('Added to cart.', 'success')
      return true
    }

    showMsg(json?.message ?? 'Unable to add selected product.', 'error')
    return false
  }

  const resolveVariantIdFromPayload = (payload: unknown): number | null => {
    if (!payload || typeof payload !== 'object' || !('variants' in payload)) return null

    const payloadWithVariants = payload as { variants?: unknown }
    if (!Array.isArray(payloadWithVariants.variants)) return null

    const variants = payloadWithVariants.variants as VariantPayload[]
    const activeVariant = variants.find((variant) => variant && (variant.is_active === true || variant.is_active === '1' || variant.is_active === 1 || variant.is_active === 'true'))
    const fallbackVariant = variants[0]
    const variantId = Number((activeVariant ?? fallbackVariant)?.id)

    return Number.isFinite(variantId) && variantId > 0 ? variantId : null
  }


  const toOptionalNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const toApiBoolean = (value: unknown) =>
    value === true || value === '1' || value === 1 || value === 'true'

  /**
   * Bundle variants often keep `stock` at 0 while sellable qty is in `derived_available_qty`
   * or derivable from `bundle_items`. Prefer derived / bundle math before raw `stock`.
   */
  const resolveVariantAvailableQty = (variant: VariantPayload): number | null => {
    const rawDerived = variant.derived_available_qty
    if (rawDerived !== null && rawDerived !== undefined && rawDerived !== '') {
      return toOptionalNumber(rawDerived)
    }

    const rows = variant.bundle_items
    const bundleLike =
      toApiBoolean(variant.is_bundle) || (Array.isArray(rows) && rows.length > 0)

    if (bundleLike && Array.isArray(rows) && rows.length > 0) {
      let minBundles = Infinity
      for (const row of rows) {
        const needRaw = row?.quantity
        const need =
          typeof needRaw === 'number' ? needRaw : Number(needRaw ?? 0)
        if (!Number.isFinite(need) || need <= 0) continue

        const comp = row?.component_variant
        if (!comp || typeof comp !== 'object') continue

        const rd = comp.derived_available_qty
        const compQty =
          rd !== null && rd !== undefined && rd !== ''
            ? toOptionalNumber(rd)
            : toOptionalNumber(comp.stock)
        if (compQty === null) continue

        minBundles = Math.min(minBundles, Math.floor(compQty / need))
      }
      if (Number.isFinite(minBundles) && minBundles !== Infinity) {
        return minBundles
      }
    }

    return toOptionalNumber(variant.stock)
  }

  const normalizeVariantTrackStock = (variant: VariantPayload): boolean | null => {
    if (
      variant.track_stock === false ||
      variant.track_stock === '0' ||
      variant.track_stock === 0 ||
      variant.track_stock === 'false'
    ) {
      return false
    }
    return toApiBoolean(variant.track_stock) ? true : null
  }

  /** Variant row: OOS only when tracking and quantity is a known number ≤ 0 (null ≠ 0 for bundles). */
  const isVariantOutOfStockForDisplay = (variant: ProductVariantOption | null | undefined) => {
    if (!variant) return false
    if (!(variant.track_stock ?? true)) return false
    const q = variant.stock
    if (q === null || q === undefined) return false
    return typeof q === 'number' && Number.isFinite(q) && q <= 0
  }

  const variantHasSellableStock = (
    trackStock: boolean | null | undefined,
    stock: number | null | undefined,
  ) => {
    if (!(trackStock ?? true)) return true
    if (stock === null || stock === undefined) return true
    return typeof stock === 'number' && Number.isFinite(stock) && stock > 0
  }

  /**
   * Catalog card: show Out of stock only for simple products (no variants).
   * If the API reports variants (rows or variants_count), OOS is shown only inside the picker modal.
   */
  const isPosSimpleProductOutOfStock = (item: ProductOption) => {
    const variantRows = item.variants?.length ?? 0
    const declared =
      typeof item.variants_count === 'number'
        ? item.variants_count
        : Number(item.variants_count ?? 0) || 0
    if (variantRows > 0 || declared > 0) return false

    if (!(item.track_stock ?? true)) return false
    const q = item.stock
    if (q === null || q === undefined) return false
    return typeof q === 'number' && Number.isFinite(q) && q <= 0
  }

  const normalizeProductFromApi = (item: ProductApiItem): ProductOption | null => {
    const productId = Number(item.id)
    if (!Number.isFinite(productId) || productId <= 0) return null

    const variants: ProductVariantOption[] = Array.isArray(item.variants)
      ? item.variants
          .map((variant): ProductVariantOption | null => {
            const variantId = Number(variant?.id)
            if (!Number.isFinite(variantId) || variantId <= 0) return null

            const sku = variant?.sku?.trim() || ''
            if (!sku) return null

            const priceRaw = variant?.sale_price ?? variant?.price ?? item.price ?? 0
            const parsedPrice = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw || 0)

            const variantAny = variant as VariantPayload
            const barcode = typeof variantAny?.barcode === 'string' ? variantAny.barcode.trim() : ''
            const availableQty = resolveVariantAvailableQty(variantAny)
            const isBundle =
              toApiBoolean(variantAny?.is_bundle) ||
              (Array.isArray(variantAny.bundle_items) && variantAny.bundle_items.length > 0)
            return {
              id: variantId,
              name: variant?.name?.trim() || variant?.title?.trim() || `Variant #${variantId}`,
              cn_name: typeof variant?.cn_name === 'string' ? variant.cn_name.trim() || null : null,
              sku,
              barcode: barcode || sku,
              price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
              thumbnail_url: variant?.image_url ?? variant?.image_path ?? item.cover_image_url ?? null,
              image_url: variant?.image_url ?? null,
              image_path: variant?.image_path ?? null,
              is_active: toApiBoolean(variant?.is_active),
              track_stock: normalizeVariantTrackStock(variantAny),
              stock: availableQty,
              is_bundle: isBundle,
            }
          })
          .filter((variant): variant is ProductVariantOption => Boolean(variant))
      : []

    const activeVariant = variants.find((variant) => variant.is_active) ?? variants[0] ?? null
    const baseSku = item.sku?.trim() || ''
    const sku = activeVariant?.sku || baseSku
    if (!sku) return null

    const itemBarcode = typeof (item as any)?.barcode === 'string' ? String((item as any).barcode).trim() : ''
    const activeBarcode = typeof (activeVariant as any)?.barcode === 'string' ? String((activeVariant as any).barcode).trim() : ''

    const priceRaw = activeVariant?.price ?? item.price ?? 0
    const price = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw || 0)

    const declaredVariantCount =
      typeof item.variants_count === 'number'
        ? item.variants_count
        : Number(item.variants_count ?? 0) || 0
    const isSimpleProduct = variants.length === 0 && declaredVariantCount === 0

    return {
      // IMPORTANT: keep the list/grid unique by product id (like Shop).
      // Variants should only be selected inside the modal / cart item variant selector.
      id: productId,
      product_id: productId,
      name: item.name ?? '-',
      cn_name: typeof item.cn_name === 'string' ? item.cn_name.trim() || null : null,
      sku,
      barcode: activeBarcode || itemBarcode || sku,
      price: Number.isFinite(price) ? price : 0,
      is_staff_free: item.is_staff_free === true || item.is_staff_free === 1 || item.is_staff_free === '1' || item.is_staff_free === 'true',
      thumbnail_url: activeVariant?.thumbnail_url ?? item.cover_image_url ?? item.main_image_url ?? item.image_url ?? null,
      main_image_url: item.main_image_url ?? null,
      cover_image_url: item.cover_image_url ?? null,
      image_url: item.image_url ?? null,
      variants,
      variants_count: typeof item.variants_count === 'number'
        ? item.variants_count
        : Number(item.variants_count ?? variants.length) || variants.length,
      default_variant_id: activeVariant?.id ?? variants[0]?.id ?? null,
      ...(isSimpleProduct
        ? {
            track_stock:
              item.track_stock === false ||
              item.track_stock === '0' ||
              item.track_stock === 0 ||
              item.track_stock === 'false'
                ? false
                : toApiBoolean(item.track_stock)
                  ? true
                  : null,
            stock: toOptionalNumber(item.stock ?? item.stock_quantity),
          }
        : {}),
    }
  }

  const hydrateProductVariants = async (item: ProductOption) => {
    const productId = Number(item.product_id || item.id)
    if (!Number.isFinite(productId) || productId <= 0) return

    setProductVariantLoading(true)

    try {
      const res = await fetch(`/api/proxy/ecommerce/products/${productId}`, { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok) return

      const payload = json?.data?.product ?? json?.data ?? json?.product
      if (!payload || typeof payload !== 'object') return

      // Store full product data for the modal
      setFullProductData(payload)

      const normalized = normalizeProductFromApi(payload as ProductApiItem)
      if (!normalized) return

      // Update selected product with correct data, preserving the original product_id
      setSelectedProduct((current) => {
        if (!current) return current
        const currentProductId = Number(current.product_id || current.id)
        if (currentProductId !== productId) return current
        
        // Merge normalized data but keep the original product_id
        return {
          ...normalized,
          product_id: productId, // Ensure product_id is correct
          name: payload.name ?? current.name, // Use payload name to ensure correctness
          cn_name: normalized.cn_name ?? current.cn_name ?? null,
        }
      })
      
      // Auto-select variant if there's only one, or if no variants and we need to find the first variant from payload
      setSelectedVariantId((currentVariantId) => {
        if (currentVariantId) return currentVariantId
        
        if (normalized.variants.length === 1) {
          return normalized.variants[0].id
        }
        
        // If no variants in normalized but payload has variants, use the first one
        if (normalized.variants.length === 0 && Array.isArray(payload.variants) && payload.variants.length > 0) {
          const firstVariant = payload.variants[0]
          const variantId = Number(firstVariant?.id)
          if (Number.isFinite(variantId) && variantId > 0) {
            return variantId
          }
        }
        
        return null
      })
    } catch {
      // no-op; keep fallback product information
    } finally {
      setProductVariantLoading(false)
    }
  }

  const dedupeByProductId = (items: ProductOption[]) => {
    const map = new Map<number, ProductOption>()
    for (const item of items) {
      const pid = Number(item.product_id || item.id)
      if (!Number.isFinite(pid) || pid <= 0) continue

      if (!map.has(pid)) {
        map.set(pid, item)
        continue
      }

      // Prefer the one that has variants / image / better price if duplicates show up from API/search.
      const existing = map.get(pid)!
      const existingScore =
        (existing.variants?.length ? 10 : 0) +
        (existing.thumbnail_url ? 3 : 0) +
        (Number(existing.price ?? 0) > 0 ? 1 : 0)
      const nextScore =
        (item.variants?.length ? 10 : 0) +
        (item.thumbnail_url ? 3 : 0) +
        (Number(item.price ?? 0) > 0 ? 1 : 0)

      if (nextScore > existingScore) {
        map.set(pid, item)
      }
    }
    return Array.from(map.values())
  }

  const fetchProductPage = useCallback(async (
    page: number,
    keyword: string,
    append: boolean,
    options?: FetchProductOptions & { categoryId?: number | null },
  ) => {
    const requestId = latestProductRequestRef.current + 1
    latestProductRequestRef.current = requestId
    const silent = options?.silent ?? false
    const resetHighlight = options?.resetHighlight ?? true

    if (!silent) {
      setProductLoading(true)
    }

    try {
      let mapped: ProductOption[] = []
      let currentPage = page
      let lastPage = page

      const normalizedCategoryId = Number(options?.categoryId)
      const hasCategoryFilter = Number.isFinite(normalizedCategoryId) && normalizedCategoryId > 0

      if (keyword.trim()) {
        const trimmedKeyword = keyword.trim()
        const searchParams = new URLSearchParams({
          q: trimmedKeyword,
          page: String(page),
          per_page: '100',
          is_reward_only: 'false',
        })
        if (productSearchMode === 'barcode') {
          searchParams.set('barcode', trimmedKeyword)
          searchParams.set('barcode_search', 'true')
        }
        if (hasCategoryFilter) {
          searchParams.set('category_id', String(normalizedCategoryId))
        }
        const res = await fetch(`/api/proxy/pos/products/search?${searchParams.toString()}`)
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(typeof json?.message === 'string' ? json.message : 'Unable to search POS products.')
        }
        const paged = extractPaged<ProductOption>(json)
        mapped = paged.data.map((item) => {
          const resolvedProductId = Number(item.product_id)

          return {
            ...item,
            product_id: Number.isFinite(resolvedProductId) && resolvedProductId > 0 ? resolvedProductId : Number(item.id),
            variants: Array.isArray(item.variants) ? item.variants : [],
          }
        })
        currentPage = paged.current_page
        lastPage = paged.last_page
      } else {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('per_page', '100')
        params.set('is_active', 'true')
        params.set('is_reward_only', 'false')
        if (hasCategoryFilter) {
          params.set('category_id', String(normalizedCategoryId))
        }

        const res = await fetch(`/api/proxy/ecommerce/products?${params.toString()}`, { cache: 'no-store' })
        const json = await res.json()
        const paged = extractPaged<ProductApiItem>(json)

        mapped = paged.data
          .map((item): ProductOption | null => normalizeProductFromApi(item))
          .filter((item): item is ProductOption => Boolean(item))

        currentPage = paged.current_page
        lastPage = paged.last_page
      }

      if (requestId !== latestProductRequestRef.current) return

      // Ensure we never display variants as extra "products" in the grid.
      setProducts((prev) => {
        const next = append ? [...prev, ...mapped] : mapped
        return dedupeByProductId(next)
      })
      setProductPage(currentPage)
      setProductLastPage(lastPage)
      if (resetHighlight) {
        setProductHighlighted(0)
      }
    } catch {
      if (requestId !== latestProductRequestRef.current) return
      if (!append) {
        setProducts([])
      }
      setProductPage(1)
      setProductLastPage(1)
      if (resetHighlight) {
        setProductHighlighted(0)
      }
    } finally {
      if (!silent && requestId === latestProductRequestRef.current) {
        setProductLoading(false)
      }
    }
  }, [productSearchMode])

  const fetchMemberPage = useCallback(async (page: number, keyword: string, append: boolean) => {
    const trimmedKeyword = keyword.trim()
    if (trimmedKeyword.length < 3) {
      setMembers([])
      setMemberPage(1)
      setMemberLastPage(1)
      setMemberLoading(false)
      return
    }

    setMemberLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('per_page', '10')
    params.set('q', trimmedKeyword)

    const res = await fetch(`/api/proxy/pos/members/search?${params.toString()}`)
    const json = await res.json()
    const paged = extractPaged<Member>(json)

    setMembers((prev) => (append ? [...prev, ...paged.data] : paged.data))
    setMemberPage(paged.current_page)
    setMemberLastPage(paged.last_page)
    setMemberLoading(false)
  }, [])

  const fetchMemberDetail = useCallback(async (memberId: number, options?: { page?: number; append?: boolean; silent?: boolean; appointmentsPage?: number; appendAppointments?: boolean; updateSelectedMember?: boolean }) => {
    const page = Math.max(1, options?.page ?? 1)
    const appointmentsPage = Math.max(1, options?.appointmentsPage ?? 1)
    const append = Boolean(options?.append)
    const appendAppointments = Boolean(options?.appendAppointments)
    const updateSelectedMember = options?.updateSelectedMember ?? true
    const silent = Boolean(options?.silent)
    if (append) {
      setMemberOrdersLoadingMore(true)
    }
    if (appendAppointments) {
      setMemberAppointmentsLoadingMore(true)
    } else if (!silent) {
      setMemberDetailLoading(true)
    }
    try {
      const params = new URLSearchParams({
        recent_orders_page: String(page),
        recent_orders_per_page: '5',
        appointments_page: String(appointmentsPage),
        appointments_per_page: '2',
      })
      const res = await fetch(`/api/proxy/pos/members/${memberId}?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(String(json?.message ?? 'Unable to load member profile.'))
      }
      const payload = (json && typeof json === 'object' && 'data' in json)
        ? (json as {
          data?: {
            member?: MemberDetail
            active_packages?: { total_active?: number; items?: MemberActivePackage[] }
            upcoming_appointments?: MemberUpcomingAppointment[]
            upcoming_appointments_meta?: Partial<MemberUpcomingAppointmentsMeta>
            recent_orders?: MemberRecentOrder[]
            recent_orders_meta?: Partial<MemberRecentOrdersMeta>
          }
        }).data
        : null
      const loadedMember = payload?.member ?? null
      setMemberDetail(loadedMember)
      const fetchedOrders = Array.isArray(payload?.recent_orders) ? payload.recent_orders : []
      if (!appendAppointments || append) {
        setMemberRecentOrders((previous) => (append ? [...previous, ...fetchedOrders] : fetchedOrders))
        const meta = payload?.recent_orders_meta
        setMemberRecentOrdersMeta({
          current_page: Number(meta?.current_page ?? page),
          last_page: Number(meta?.last_page ?? page),
          per_page: Number(meta?.per_page ?? 5),
          total: Number(meta?.total ?? fetchedOrders.length),
        })
      }
      const activePackages = payload?.active_packages
      setMemberActivePackages(Array.isArray(activePackages?.items) ? activePackages.items : [])
      setMemberActivePackagesTotal(Number(activePackages?.total_active ?? 0))

      const appointments = Array.isArray(payload?.upcoming_appointments) ? payload.upcoming_appointments : []
      if (!append || appendAppointments) {
        setMemberUpcomingAppointments((previous) => (appendAppointments ? [...previous, ...appointments] : appointments))
        const appointmentsMeta = payload?.upcoming_appointments_meta
        setMemberUpcomingAppointmentsMeta({
          current_page: Number(appointmentsMeta?.current_page ?? appointmentsPage),
          last_page: Number(appointmentsMeta?.last_page ?? appointmentsPage),
          per_page: Number(appointmentsMeta?.per_page ?? 2),
          total: Number(appointmentsMeta?.total ?? appointments.length),
        })
      }

      if (loadedMember && updateSelectedMember) {
        setSelectedMember((previous) => {
          if (previous && previous.id !== loadedMember.id) return previous
          return {
            id: loadedMember.id,
            name: loadedMember.name,
            phone: loadedMember.phone ?? null,
            email: loadedMember.email ?? null,
            member_code: loadedMember.member_code ?? null,
          }
        })
      }
    } catch {
      if (!append && !appendAppointments) {
        setMemberDetail(null)
        setMemberRecentOrders([])
        setMemberRecentOrdersMeta({
          current_page: 1,
          last_page: 1,
          per_page: 5,
          total: 0,
        })
        setMemberActivePackages([])
        setMemberActivePackagesTotal(0)
        setMemberUpcomingAppointments([])
        setMemberUpcomingAppointmentsMeta({
          current_page: 1,
          last_page: 1,
          per_page: 2,
          total: 0,
        })
      }
    } finally {
      setMemberDetailLoading(false)
      setMemberOrdersLoadingMore(false)
      setMemberAppointmentsLoadingMore(false)
    }
  }, [])

  const fetchServices = useCallback(async () => {
    setServicesLoading(true)
    try {
      const res = await fetch('/api/proxy/booking/services', { cache: 'no-store' })
      if (!res.ok) {
        setServices([])
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

      setServices(mapped)
    } catch {
      setServices([])
    } finally {
      setServicesLoading(false)
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

  const fetchBookingProducts = useCallback(async (categoryId: number | null = null) => {
    setBookingProductsLoading(true)
    try {
      const params = new URLSearchParams({
        is_active: '1',
        per_page: '200',
      })
      if (categoryId != null) params.set('category_id', String(categoryId))
      const res = await fetch(`/api/proxy/admin/booking/products?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) return setBookingProducts([])
      const json = await res.json().catch(() => null)
      const payload = (json && typeof json === 'object' && 'data' in json) ? (json as { data?: unknown }).data : json
      const rows = Array.isArray(payload) ? payload : Array.isArray((payload as any)?.data) ? (payload as any).data : []
      setBookingProducts(
        rows
          .map((row: any) => ({
            id: Number(row.id),
            name: String(row.name ?? ''),
            price: Number(row.price ?? 0),
            price_mode: row.price_mode === 'range' ? 'range' : 'fixed',
            price_range_min: row.price_range_min == null ? null : Number(row.price_range_min),
            price_range_max: row.price_range_max == null ? null : Number(row.price_range_max),
            cn_name: typeof row.cn_name === 'string' ? row.cn_name : null,
            barcode: typeof row.barcode === 'string' ? row.barcode : null,
            questions: Array.isArray(row.questions) ? row.questions : [],
            image_url: row.image_url ?? null,
            category: row.category ?? null,
            is_active: Boolean(row.is_active ?? true),
          }))
          .filter((row: { id: number; is_active: boolean }) => row.id > 0 && row.is_active),
      )
    } finally {
      setBookingProductsLoading(false)
    }
  }, [])

  const addBookingProductToCart = useCallback(async (row: BookingProductOption, selectedOptionIds: number[] = [], actualSellingPrice?: number) => {
    const res = await fetch('/api/proxy/pos/cart/add-booking-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_product_id: row.id, qty: 1, item_type: 'BOOKING_PRODUCT', selected_option_ids: selectedOptionIds, ...(actualSellingPrice != null ? { actual_selling_price: actualSellingPrice } : {}) }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      showMsg(json?.message ?? 'Unable to add booking product to cart.', 'error')
      return
    }
    const next = json?.data?.cart ?? json?.cart ?? null
    if (next) setCart(next)
  }, [])

  const fetchServicePackages = useCallback(async () => {
    setServicePackagesLoading(true)
    try {
      const res = await fetch('/api/proxy/service-packages?per_page=100', { cache: 'no-store' })
      if (!res.ok) {
        setServicePackages([])
        return
      }
      const json = await res.json().catch(() => null)
      console.log('service packages response', json)

      const payload = (json && typeof json === 'object' && 'data' in json)
        ? (json as { data?: { data?: unknown } }).data
        : null
      const packages = Array.isArray(payload?.data) ? payload.data : []
      console.log('parsed packages', packages)

      const mapped = packages
        .map((item): ServicePackageOption | null => {
          if (!item || typeof item !== 'object') return null
          const maybe = item as Record<string, unknown>
          const id = Number(maybe.id)
          if (!Number.isFinite(id) || id <= 0) return null

          const rawItems = Array.isArray(maybe.items)
            ? maybe.items
            : Array.isArray(maybe.service_package_items)
              ? maybe.service_package_items
              : []

          const itemsSummary = rawItems
            .map((rawItem) => {
              if (!rawItem || typeof rawItem !== 'object') return null
              const itemObj = rawItem as Record<string, unknown>
              const quantity = Number(itemObj.quantity ?? itemObj.qty ?? 0)

              const bookingService = itemObj.booking_service && typeof itemObj.booking_service === 'object'
                ? (itemObj.booking_service as Record<string, unknown>)
                : null

              const serviceName = String(
                bookingService?.name
                  ?? itemObj.booking_service_name
                  ?? itemObj.service_name
                  ?? itemObj.name
                  ?? ''
              ).trim()

              if (!serviceName) return null
              if (Number.isFinite(quantity) && quantity > 0) {
                return `${serviceName} x${Math.trunc(quantity)}`
              }

              return serviceName
            })
            .filter((value): value is string => Boolean(value))

          return {
            id,
            name: String(maybe.name ?? '').trim(),
            description: String(maybe.description ?? '').trim() || null,
            selling_price: Number(maybe.selling_price ?? 0),
            valid_days: Number(maybe.valid_days ?? 0),
            items_summary: itemsSummary,
            is_active: Boolean(maybe.is_active ?? true),
            allowed_staffs: Array.isArray(maybe.allowed_staffs)
              ? (maybe.allowed_staffs as Array<Record<string, unknown>>)
                .map((staff) => ({ id: Number(staff.id), name: String(staff.name ?? '').trim() }))
                .filter((staff) => staff.id > 0 && staff.name)
              : [],
          }
        })
        .filter((item): item is ServicePackageOption => Boolean(item && item.name && item.is_active !== false))

      setServicePackages(mapped)
    } catch {
      setServicePackages([])
    } finally {
      setServicePackagesLoading(false)
    }
  }, [])

  const fetchUnpaidCompletedAppointments = useCallback(async (keyword: string) => {
    setSettlementLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('per_page', '50')
      params.set('unpaid_only', '1')
      if (keyword.trim()) params.set('q', keyword.trim())

      const res = await fetch(`/api/proxy/pos/appointments?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      const paged = extractPaged<any>(json)
      const rows = Array.isArray(paged.data) ? paged.data : []
      setSettlementAppointments(rows)
    } catch {
      setSettlementAppointments([])
    } finally {
      setSettlementLoading(false)
    }
  }, [])

  const openBookingModal = useCallback(async (service: BookingServiceOption) => {
    setBookingServiceDraft(service)
    setBookingAssignedStaffId(null)
    setBookingDate('')
    setBookingSlots([])
    setBookingSlotValue('')
    setBookingQuestions([])
    setBookingSelectedOptionIds([])
    setBookingExtraServiceBlocks([])
    setBookingExtraServiceCategoryIds({})
    setBookingExtraServiceQueries({})
    setBookingModalError(null)
    setBookingGuestPhoneValue(guestContactCache.phone)
    if (selectedMember?.id) {
      setBookingIdentityMode('member')
    } else if (guestContactCache.name.trim() && guestContactCache.email.trim()) {
      setBookingIdentityMode('guest')
    } else {
      setBookingIdentityMode('member')
    }
    setBookingModalOpen(true)

    try {
      const res = await fetch(`/api/proxy/booking/services/${service.id}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      const questionsRaw: unknown[] = Array.isArray(json?.data?.questions) ? json.data.questions : []
      const mappedQuestions: BookingServiceQuestion[] = questionsRaw
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
              .map((optionRaw): BookingServiceQuestionOption | null => {
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
                }
              })
              .filter((option): option is BookingServiceQuestionOption => Boolean(option && option.id > 0)),
          } as BookingServiceQuestion
        })
        .filter((question): question is BookingServiceQuestion => Boolean(question && question.id > 0 && question.options.length > 0))
      setBookingQuestions(mappedQuestions)
    } catch {
      setBookingQuestions([])
    }
  }, [guestContactCache.email, guestContactCache.name, guestContactCache.phone, selectedMember?.id])

  const fetchBookingQuestions = useCallback(async (serviceId: number): Promise<BookingServiceQuestion[]> => {
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
              .map((optionRaw): BookingServiceQuestionOption | null => {
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
                }
              })
              .filter((option): option is BookingServiceQuestionOption => Boolean(option && option.id > 0)),
          } as BookingServiceQuestion
        })
        .filter((question): question is BookingServiceQuestion => Boolean(question && question.id > 0 && question.options.length > 0))
    } catch {
      return []
    }
  }, [])

  const bookingSelectedOptions = useMemo(() => {
    const selected = new Set(bookingSelectedOptionIds)
    return bookingQuestions.flatMap((question) => question.options.filter((option) => selected.has(option.id)))
  }, [bookingQuestions, bookingSelectedOptionIds])
  const bookingAddonDurationTotal = useMemo(
    () => bookingSelectedOptions.reduce((sum, option) => sum + Number(option.extra_duration_min ?? 0), 0),
    [bookingSelectedOptions],
  )
  const bookingAddonPriceTotal = useMemo(
    () => bookingSelectedOptions.reduce((sum, option) => sum + Number(option.extra_price ?? 0), 0),
    [bookingSelectedOptions],
  )
  const bookingExtraTotals = useMemo(() => {
    return bookingExtraServiceBlocks.reduce((acc, block) => {
      if (!block.service) return acc
      acc.baseDuration += Number(block.service.duration_min ?? 0)
      acc.basePrice += Number(block.service.price ?? block.service.service_price ?? 0)
      const selected = new Set(block.selectedOptionIds)
      const selectedOptions = block.questions.flatMap((question) => question.options.filter((option) => selected.has(option.id)))
      acc.addonDuration += selectedOptions.reduce((sum, option) => sum + Number(option.extra_duration_min ?? 0), 0)
      acc.addonPrice += selectedOptions.reduce((sum, option) => sum + Number(option.extra_price ?? 0), 0)
      return acc
    }, { baseDuration: 0, addonDuration: 0, basePrice: 0, addonPrice: 0 })
  }, [bookingExtraServiceBlocks])
  const bookingAllowedStaffs = useMemo(() => {
    if (!bookingServiceDraft) return []
    let allowed = bookingServiceDraft.allowed_staffs ?? []
    for (const block of bookingExtraServiceBlocks) {
      const ids = new Set((block.service?.allowed_staffs ?? []).map((staff) => staff.id))
      allowed = allowed.filter((staff) => ids.has(staff.id))
    }
    return allowed
  }, [bookingExtraServiceBlocks, bookingServiceDraft])

  const bookingStaffPickerOptions = useMemo(() => {
    if (!bookingDate || !bookingSlotValue) return []
    const slot = bookingSlots.find((s) => s.start_at === bookingSlotValue)
    const allowedIds = slot?.available_staff_ids ?? null
    const base = bookingAllowedStaffs
    if (Array.isArray(allowedIds) && allowedIds.length > 0) {
      return base.filter((s) => allowedIds.includes(s.id))
    }
    return []
  }, [bookingAllowedStaffs, bookingDate, bookingSlotValue, bookingSlots])

  const bookingStaffPickerReady = Boolean(bookingDate && bookingSlotValue)
  const bookingSelectedServiceIds = useMemo(
    () => [
      ...(bookingServiceDraft?.id ? [bookingServiceDraft.id] : []),
      ...bookingExtraServiceBlocks.map((block) => Number(block.service?.id ?? 0)).filter((id) => id > 0),
    ],
    [bookingExtraServiceBlocks, bookingServiceDraft?.id],
  )

  const submitBooking = useCallback(async () => {
    if (!bookingServiceDraft) return
    setBookingModalError(null)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const phonePattern = /^\+?[0-9]{8,15}$/

    if (bookingIdentityMode === 'member') {
      if (!selectedMember?.id) {
        setBookingModalError('Please assign member.')
        return
      }
    } else {
      const guestName = bookingGuestNameRef.current?.value ?? ''
      const guestPhone = normalizeInternationalPhone(bookingGuestPhoneValue)
      const guestEmail = bookingGuestEmailRef.current?.value ?? ''
      if (guestPhone.trim() && !phonePattern.test(guestPhone.trim())) {
        setBookingModalError('Please enter a valid phone number (8-15 digits, optional + prefix).')
        return
      }
      if (guestEmail.trim() && !emailPattern.test(guestEmail.trim())) {
        setBookingModalError('Please enter a valid email address.')
        return
      }
    }
    if (!bookingAssignedStaffId) {
      setBookingModalError('Please select assigned staff.')
      return
    }
    if (!bookingDate) {
      setBookingModalError('Please select appointment date.')
      return
    }
    if (!bookingSlotValue) {
      setBookingModalError('Please select appointment slot/time.')
      return
    }
    if (new Set(bookingSelectedServiceIds).size !== bookingSelectedServiceIds.length) {
      setBookingModalError('Duplicate main services are not allowed in the same booking.')
      return
    }
    for (const question of bookingQuestions) {
      if (!question.is_required) continue
      const hasSelection = question.options.some((option) => bookingSelectedOptionIds.includes(option.id))
      if (!hasSelection) {
        setBookingModalError(`Please answer required question: ${question.title}`)
        return
      }
    }
    for (const block of bookingExtraServiceBlocks) {
      if (!block.service) {
        setBookingModalError('Please select service for every added main service block.')
        return
      }
      for (const question of block.questions) {
        if (!question.is_required) continue
        const hasSelection = question.options.some((option) => block.selectedOptionIds.includes(option.id))
        if (!hasSelection) {
          setBookingModalError(`Please answer required question: ${question.title}`)
          return
        }
      }
    }

    setBookingSubmitting(true)
    const payload: Record<string, unknown> = {
      booking_service_id: bookingServiceDraft.id,
      assigned_staff_id: bookingAssignedStaffId,
      selected_option_ids: bookingSelectedOptionIds,
      main_service_items: [
        { booking_service_id: bookingServiceDraft.id, selected_option_ids: bookingSelectedOptionIds, staff_splits: [{ staff_id: bookingAssignedStaffId, share_percent: 100 }] },
        ...bookingExtraServiceBlocks
          .filter((block) => block.service?.id)
          .map((block) => ({
            booking_service_id: Number(block.service?.id),
            selected_option_ids: block.selectedOptionIds,
            staff_splits: [{ staff_id: bookingAssignedStaffId, share_percent: 100 }],
          })),
      ],
      start_at: bookingSlotValue,
      notes: bookingRemarkRef.current?.getValue().trim() || null,
      staff_splits: [{ staff_id: bookingAssignedStaffId, share_percent: 100 }],
      qty: 1,
    }
    if (bookingIdentityMode === 'member' && selectedMember?.id) {
      payload.customer_id = selectedMember.id
    } else {
      const guestName = (bookingGuestNameRef.current?.value ?? '').trim()
      const guestPhone = normalizeInternationalPhone(bookingGuestPhoneValue)
      const guestEmail = (bookingGuestEmailRef.current?.value ?? '').trim()
      payload.customer_id = null
      payload.guest_name = guestName || 'UNKNOWN'
      payload.guest_phone = guestPhone || null
      payload.guest_email = guestEmail || null
    }
    const res = await fetch('/api/proxy/pos/cart/add-service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => null)

    if (!res.ok) {
      setBookingModalError(json?.message ?? 'Unable to add service to cart.')
      setBookingSubmitting(false)
      return
    }

    setCart((json?.data?.cart ?? null) as Cart | null)
    if (bookingIdentityMode === 'guest') {
      setGuestContactCache({
        name: (bookingGuestNameRef.current?.value ?? '').trim(),
        phone: normalizeInternationalPhone(bookingGuestPhoneValue),
        email: (bookingGuestEmailRef.current?.value ?? '').trim(),
      })
    }
    showMsg('Service added to cart. Continue with checkout to collect payment.', 'success')
    setBookingModalOpen(false)
    setBookingModalError(null)
    setBookingSubmitting(false)
  }, [
    bookingAssignedStaffId,
    bookingDate,
    bookingGuestPhoneValue,
    bookingIdentityMode,
    bookingQuestions,
    bookingExtraServiceBlocks,
    bookingSelectedOptionIds,
    bookingServiceDraft,
    bookingSlotValue,
    bookingSelectedServiceIds,
    selectedMember?.id,
    showMsg,
  ])


  useEffect(() => {
    const loadSlots = async () => {
      if (!bookingModalOpen || !bookingServiceDraft?.id || !bookingDate) {
        setBookingSlots([])
        setBookingSlotValue('')
        return
      }

      setBookingSlotsLoading(true)
      try {
        const params = new URLSearchParams({
          service_id: String(bookingServiceDraft.id),
          date: bookingDate,
          extra_duration_min: String(
            (bookingAddonDurationTotal || 0) +
            bookingExtraTotals.baseDuration +
            bookingExtraTotals.addonDuration,
          ),
        })
        const res = await fetch(`/api/proxy/pos/availability/pooled?${params.toString()}`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        const rows: unknown[] = Array.isArray(json?.data?.visible_slots) ? json.data.visible_slots : (Array.isArray(json?.data?.slots) ? json.data.slots : [])
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

        setBookingSlots(slots)
        setBookingSlotValue((prev) => slots.some((slot) => slot.start_at === prev) ? prev : '')
      } finally {
        setBookingSlotsLoading(false)
      }
    }

    void loadSlots()
  }, [bookingAddonDurationTotal, bookingDate, bookingExtraTotals.addonDuration, bookingExtraTotals.baseDuration, bookingModalOpen, bookingServiceDraft?.id])

  useEffect(() => {
    if (!bookingModalOpen || !bookingDate || !bookingSlotValue) {
      setBookingAssignedStaffId(null)
      return
    }

    const slot = bookingSlots.find((s) => s.start_at === bookingSlotValue)
    const staffIds = slot?.available_staff_ids ?? []
    const options = Array.isArray(staffIds) && staffIds.length > 0
      ? bookingAllowedStaffs.filter((staff) => staffIds.includes(staff.id))
      : []

    setBookingAssignedStaffId((prev) => {
      if (prev && options.some((staff) => staff.id === prev)) return prev
      return options[0]?.id ?? null
    })
  }, [bookingAllowedStaffs, bookingDate, bookingModalOpen, bookingSlotValue, bookingSlots])

  const openPackageModal = useCallback(async (servicePackage: ServicePackageOption) => {
    let staffs = activeStaffs
    if (!staffs.length) {
      staffs = await fetchStaffOptions('')
      setActiveStaffs(staffs)
    }


    setPackageDraft(servicePackage)
    setPackageSelectedMember(selectedMember)
    setPackageMemberQuery('')
    if (hasCartAppointmentSettlements && selectedMember?.id) {
      // Settlement locks the member; modal is still allowed for pre-fill.
      setPackageSelectedMember(selectedMember)
      setPackageMemberQuery('')
    }
    setPackageMembers([])
    setPackageMembersLoading(false)
    setPackageMemberPickerOpen(false)
    setPackageModalError(null)
    setPackageModalOpen(true)
  }, [activeStaffs, fetchStaffOptions, hasCartAppointmentSettlements, selectedMember])

  const submitPackageToCart = useCallback(async () => {
    if (!packageDraft?.id) return

    const selectedModalMember = packageSelectedMember
    if (!selectedModalMember?.id) {
      setPackageModalError('Please select member.')
      return
    }


    setPackageSubmitting(true)
    const res = await fetch('/api/proxy/pos/cart/add-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_package_id: packageDraft.id,
        customer_id: selectedModalMember.id,
        qty: 1,
      }),
    })
    const json = await res.json().catch(() => null)

    if (!res.ok) {
      setPackageModalError(json?.message ?? 'Unable to add package.')
      setPackageSubmitting(false)
      return
    }

    setCart((json?.data?.cart ?? null) as Cart | null)
    setSelectedMember(selectedModalMember)
    setPackageModalOpen(false)
    setPackageSubmitting(false)
    setPackageModalError(null)
    showMsg('Package added to cart.', 'success')
  }, [packageDraft?.id, packageSelectedMember, showMsg])


  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!packageMemberPickerOpen) return
      if (packageMemberQuery.trim().length < 3) {
        setPackageMembers([])
        setPackageMembersLoading(false)
        return
      }
      setPackageMembersLoading(true)
      try {
        const params = new URLSearchParams({ page: '1', per_page: '20', q: packageMemberQuery.trim() })
        const res = await fetch(`/api/proxy/pos/members/search?${params.toString()}`)
        const json = await res.json().catch(() => null)
        const paged = extractPaged<Member>(json)
        if (!cancelled) setPackageMembers(paged.data)
      } finally {
        if (!cancelled) setPackageMembersLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [packageMemberPickerOpen, packageMemberQuery])

  const removePackageCartItem = useCallback(async (itemId: number) => {
    const res = await fetch(`/api/proxy/pos/cart/package-items/${itemId}`, { method: 'DELETE' })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      showMsg(json?.message ?? 'Unable to remove package.', 'error')
      return
    }

    setCart((json?.data?.cart ?? null) as Cart | null)
  }, [showMsg])

  const updatePackageCartQty = useCallback(
    async (itemId: number, qty: number) => {
      const next = Math.max(1, Math.min(10, Math.floor(qty)))
      const res = await fetch(`/api/proxy/pos/cart/package-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty: next }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to update package quantity.', 'error')
        return
      }
      setCart((json?.data?.cart ?? null) as Cart | null)
    },
    [showMsg],
  )



  const redeemServiceItem = useCallback(async (serviceItem: ServiceCartItem) => {
    if (!selectedMember?.id) {
      showMsg('Please assign member first before reserving package claim.', 'error')
      return
    }

    setServiceRedeemingIds((prev) => ({ ...prev, [serviceItem.id]: true }))
    try {
      const res = await fetch('/api/proxy/service-packages/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedMember.id,
          booking_service_id: serviceItem.booking_service_id,
          source: 'POS',
          source_ref_id: serviceItem.id,
          used_qty: 1,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to reserve package claim.', 'error')
        return
      }

      setServiceAvailabilityMap((prev) => ({ ...prev, [serviceItem.id]: Math.max(0, (prev[serviceItem.id] ?? 0) - 1) }))
      await loadCart()
      showMsg('Package claim reserved. It will be consumed once booking is completed.', 'success')
    } finally {
      setServiceRedeemingIds((prev) => ({ ...prev, [serviceItem.id]: false }))
    }
  }, [selectedMember?.id, showMsg])

  const unclaimServicePackage = useCallback(
    async (serviceItem: ServiceCartItem) => {
      if (serviceItem.package_claim_status !== 'reserved') {
        showMsg('Only a reserved package claim can be released here.', 'error')
        return
      }
      setServiceUnclaimingIds((prev) => ({ ...prev, [serviceItem.id]: true }))
      try {
        const res = await fetch(`/api/proxy/pos/cart/service-items/${serviceItem.id}/release-package-claim`, {
          method: 'POST',
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          showMsg(String(json?.message ?? 'Unable to unclaim package.'), 'error')
          return
        }
        setServiceAvailabilityMap((prev) => ({
          ...prev,
          [serviceItem.id]: (prev[serviceItem.id] ?? 0) + 1,
        }))
        if (json?.data?.cart) {
          setCart(json.data.cart as Cart)
        }
        showMsg('Package claim released. You can claim again or remove the line.', 'success')
      } finally {
        setServiceUnclaimingIds((prev) => ({ ...prev, [serviceItem.id]: false }))
      }
    },
    [showMsg],
  )

  const updateQty = async (itemId: number, qty: number) => {
    if (qty < 1) return
    const res = await fetch(`/api/proxy/pos/cart/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty }),
    })
    const json = await res.json()
    if (res.ok) {
      setCart(json.data.cart)
    }
  }



  const openPriceEditModal = (target: PriceEditTarget) => {
    setPriceEditTarget(target)
    setPriceEditValueDraft(Number(target.currentUnitPrice ?? 0).toFixed(2))
    setPriceEditLineTotalDraft(Number(target.currentLineTotal ?? (Number(target.currentUnitPrice ?? 0) * Math.max(1, Number(target.quantity ?? 1)))).toFixed(2))
    setPriceEditMode('unit')
    setPriceEditReasonDraft('')
  }

  const submitPriceEditModal = async () => {
    if (!priceEditTarget || priceEditSaving) return
    const quantity = Math.max(1, Number(priceEditTarget.quantity ?? 1))
    const nextInput = priceEditMode === 'line' ? Number(priceEditLineTotalDraft) : Number(priceEditValueDraft)
    if (!Number.isFinite(nextInput) || nextInput < 0) {
      showMsg(priceEditMode === 'line' ? 'New line total must be 0 or higher.' : 'New price must be 0 or higher.', 'error')
      return
    }
    const next = priceEditMode === 'line' ? nextInput / quantity : nextInput
    let endpoint = ''
    if (priceEditTarget.kind === 'product') endpoint = `/api/proxy/pos/cart/items/${priceEditTarget.id}/price`
    if (priceEditTarget.kind === 'bookingProductOption') endpoint = `/api/proxy/pos/cart/items/${priceEditTarget.id}/booking-product-options/${priceEditTarget.optionId}/price`
    if (priceEditTarget.kind === 'package') endpoint = `/api/proxy/pos/cart/package-items/${priceEditTarget.id}/price`
    if (priceEditTarget.kind === 'serviceDeposit') endpoint = `/api/proxy/pos/cart/service-items/${priceEditTarget.id}/price`
    if (priceEditTarget.kind === 'settlementLine') endpoint = `/api/proxy/pos/cart/appointment-settlements/${priceEditTarget.id}/price`
    if (!endpoint) return
    setPriceEditSaving(true)
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_price: next, ...(priceEditMode === 'line' ? { line_total: nextInput } : {}), reason: priceEditReasonDraft.trim() || null, ...('lineKey' in priceEditTarget ? { line_key: priceEditTarget.lineKey } : {}) }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to update price.', 'error')
        return
      }
      setCart((json?.data?.cart ?? null) as Cart | null)
      if (priceEditTarget.kind === 'settlementLine' && cartEditSettlementItem?.id === priceEditTarget.id) {
        const originalLineKey = (cartEditSettlementItem.main_service_settlement_items ?? []).find((line, idx) => line.is_original ?? idx === 0)?.line_key
        if (priceEditTarget.lineKey === originalLineKey) {
          setCartEditOriginalServicePrice(next)
        } else {
          const addon = (cartEditSettlementItem.addon_settlement_items ?? []).find((row) => row.line_key === priceEditTarget.lineKey)
          if (addon?.id != null) {
            setCartEditAddonPriceOverrides((prev) => ({ ...prev, [Number(addon.id)]: next }))
          }
        }
      }
      setPriceEditTarget(null)
      showMsg('Price updated.', 'success')
    } finally {
      setPriceEditSaving(false)
    }
  }

  const openDiscountModal = (target: DiscountTarget) => {
    if (target.kind === 'product' && (target.promotionApplied || target.manualDiscountAllowed === false)) {
      showMsg('Manual discount is disabled when promotion is applied.', 'error')
      return
    }
    setDiscountTarget(target)
    setDiscountTypeDraft(target.discountType ?? 'fixed')
    const nextValue = Number(target.discountValue ?? 0)
    setDiscountValueDraft(nextValue > 0 ? String(nextValue) : '')
    setDiscountRemarkDraft(target.discountRemark ?? '')
    setDiscountModalOpen(true)
  }

  const submitDiscountModal = async () => {
    if (!discountTarget || discountSaving) return
    const value = Number(discountValueDraft)
    if (!Number.isFinite(value) || value < 0) {
      showMsg('Discount value must be 0 or higher.', 'error')
      return
    }
    if (discountTypeDraft === 'percentage' && value > 100) {
      showMsg('Percentage discount must be between 0 and 100.', 'error')
      return
    }
    if (discountTypeDraft === 'fixed' && value > Number(discountTarget.lineTotal ?? 0)) {
      showMsg('Fixed discount must not exceed line total.', 'error')
      return
    }

    let endpoint = ''
    if (discountTarget.kind === 'product') endpoint = `/api/proxy/pos/cart/items/${discountTarget.id}/discount`
    if (discountTarget.kind === 'package') endpoint = `/api/proxy/pos/cart/package-items/${discountTarget.id}/discount`
    if (discountTarget.kind === 'settlementLine') endpoint = `/api/proxy/pos/cart/appointment-settlements/${discountTarget.id}/discount`
    if (discountTarget.kind === 'bookingProductOption') endpoint = `/api/proxy/pos/cart/items/${discountTarget.id}/booking-product-options/${discountTarget.optionId}/discount`
    if (!endpoint) return

    const payload = value <= 0
      ? { discount_type: null, discount_value: 0, discount_remark: null, ...(discountTarget.kind === 'settlementLine' ? { line_key: discountTarget.lineKey } : {}) }
      : { discount_type: discountTypeDraft, discount_value: value, discount_remark: discountRemarkDraft.trim() || null, ...(discountTarget.kind === 'settlementLine' ? { line_key: discountTarget.lineKey } : {}) }

    setDiscountSaving(true)
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg(json?.message ?? 'Unable to apply line discount.', 'error')
        return
      }
      setCart((json?.data?.cart ?? null) as Cart | null)
      setDiscountModalOpen(false)
      setDiscountTarget(null)
      showMsg('Item discount updated.', 'success')
    } finally {
      setDiscountSaving(false)
    }
  }

  const removeItem = async (itemId: number) => {
    const res = await fetch(`/api/proxy/pos/cart/items/${itemId}`, { method: 'DELETE' })
    const json = await res.json()
    if (res.ok) {
      setCart(json.data.cart)
    }
  }


  const removeServiceItem = async (itemId: number) => {
    const res = await fetch(`/api/proxy/pos/cart/service-items/${itemId}`, { method: 'DELETE' })
    const json = await res.json().catch(() => null)
    if (res.ok) {
      setCart((json?.data?.cart ?? null) as Cart | null)
    }
  }

  const removeAppointmentSettlementItem = async (itemId: number) => {
    const res = await fetch(`/api/proxy/pos/cart/appointment-settlements/${itemId}`, { method: 'DELETE' })
    const json = await res.json().catch(() => null)
    if (res.ok) {
      setCart((json?.data?.cart ?? null) as Cart | null)
      void fetchUnpaidCompletedAppointments(settlementQuery)
    } else {
      showMsg(json?.message ?? 'Unable to remove settlement item.', 'error')
    }
  }

  const addAppointmentSettlementToCart = async (bookingId: number) => {
    const res = await fetch('/api/proxy/pos/cart/add-appointment-settlement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      showMsg(json?.message ?? 'Unable to add appointment settlement.', 'error')
      return
    }
    setCart((json?.data?.cart ?? null) as Cart | null)
    showMsg('Added appointment settlement to cart.', 'success')
    void fetchUnpaidCompletedAppointments(settlementQuery)
  }

  const rebalanceSettlementPrimaryShare = (rows: Array<{ staff_id: number | null; share_percent: string }>) => {
    if (rows.length === 0) return rows
    const otherTotal = rows.slice(1).reduce((sum, row) => sum + Math.max(0, Number.parseInt(row.share_percent || '0', 10) || 0), 0)
    const primaryShare = Math.max(0, 100 - otherTotal)
    return rows.map((row, idx) => (idx === 0 ? { ...row, share_percent: String(primaryShare) } : row))
  }

  const updateCartEditSplitShare = (index: number, value: string) => {
    setCartEditSettlementError(null)
    setCartEditStaffSplits((prev) => {
      const next = prev.map((row, rowIdx) => (rowIdx === index ? { ...row, share_percent: value } : row))
      if (!cartEditStaffSplitAutoBalance || index === 0) return next
      return rebalanceSettlementPrimaryShare(next)
    })
  }

  const removeCartEditSplitRow = (index: number) => {
    setCartEditSettlementError(null)
    setCartEditStaffSplits((prev) => {
      const next = prev.filter((_, rowIdx) => rowIdx !== index)
      if (!cartEditStaffSplitAutoBalance) return next
      return rebalanceSettlementPrimaryShare(next)
    })
  }

  const openCartEditSettlement = async (settlement: AppointmentSettlementCartItem) => {
    setCartEditSettlementError(null)
    setCartEditSettlementLoading(false)
    setCartEditSettlementItem(settlement)
    setCartEditSettlementBookingId(settlement.booking_id)
    setCartEditSettlementServiceId(settlement.booking_service_id ?? null)

    const originalMainService = (settlement.main_services ?? []).find((service) => service.is_original)
    const originalSettlementLine = (settlement.main_service_settlement_items ?? []).find((line, idx) => line.is_original ?? idx === 0)
    setCartEditOriginalServicePrice(Number(originalSettlementLine?.gross_amount ?? originalSettlementLine?.balance_due ?? originalMainService?.extra_price ?? settlement.service_total ?? 0))
    setCartEditAddonPriceOverrides(Object.fromEntries((settlement.addon_settlement_items ?? []).filter((addon) => addon.id != null).map((addon) => [Number(addon.id), Number(addon.gross_amount ?? addon.balance_due ?? addon.extra_price ?? 0)])))
    setCartEditOriginalService({
      id: Number(settlement.booking_service_id ?? originalMainService?.linked_booking_service_id ?? originalMainService?.id ?? 0),
      name: String(originalMainService?.name ?? settlement.service_name ?? 'Service'),
      cn_name: originalMainService?.cn_name ?? settlement.service_cn_name ?? null,
      price_mode: settlement.service_price_mode ?? null,
      price_range_min: settlement.service_price_range_min ?? null,
      price_range_max: settlement.service_price_range_max ?? null,
      service_price: Number(originalSettlementLine?.gross_amount ?? originalSettlementLine?.balance_due ?? originalMainService?.extra_price ?? settlement.service_total ?? 0),
      price: Number(originalSettlementLine?.gross_amount ?? originalSettlementLine?.balance_due ?? originalMainService?.extra_price ?? settlement.service_total ?? 0),
      duration_min: Number(originalMainService?.extra_duration_min ?? 0),
    })

    const currentAddonIds = new Set(
      (settlement.addon_settlement_items ?? [])
        .map((a) => a.id)
        .filter((id): id is number => id != null),
    )
    setCartEditSelectedAddonIds(currentAddonIds)
    const addedMainBlocksSeed = (settlement.main_services ?? [])
      .filter((service) => !service.is_original)
      .map((service) => ({
        tmp_id: `seed-${Number(service.linked_booking_service_id ?? service.id ?? 0)}-${Math.random()}`,
        service_id: Number(service.linked_booking_service_id ?? service.id ?? 0),
        service_name: String(service.name ?? 'Service'),
        service_cn_name: typeof service.cn_name === 'string' ? service.cn_name : null,
        price: Number(service.extra_price ?? 0),
        duration_min: Number(service.extra_duration_min ?? 0),
        addon_questions: [] as typeof cartEditAddonQuestions,
        selected_addon_ids: new Set<number>((service.add_ons ?? []).map((addon) => Number(addon.id)).filter((id) => Number.isFinite(id) && id > 0)),
        staff_splits: (service.staff_splits ?? []).map((split) => ({
          staff_id: Number(split.staff_id) > 0 ? Number(split.staff_id) : null,
          share_percent: String(split.share_percent ?? ''),
        })),
        auto_balance: true,
      }))
      .filter((block) => block.service_id > 0)
    setCartEditAddedMainBlocks(addedMainBlocksSeed)
    setCartEditMainServicePickerQuery('')
                  setCartEditMainServiceCategoryId(null)
    setCartEditMainServicePickerOpen(false)
    setCartEditSettledAmount(settlement.settled_service_amount != null ? String(settlement.settled_service_amount) : '')
    setCartEditStaffSplitAutoBalance(true)
    const initialSplits = (settlement.staff_splits ?? [])
      .map((split) => ({
        staff_id: Number(split.staff_id) > 0 ? Number(split.staff_id) : null,
        share_percent: String(split.share_percent ?? ''),
      }))
      .filter((split) => split.staff_id != null)
    if (initialSplits.length > 0) {
      setCartEditStaffSplits(rebalanceSettlementPrimaryShare(initialSplits))
    } else {
      setCartEditStaffSplits([{ staff_id: settlement.staff_splits?.[0]?.staff_id ?? null, share_percent: '100' }])
    }

    setCartEditAddonOptionsLoading(true)
    setCartEditMainServiceCatalogLoading(true)
    setCartEditSettlementOpen(true)
    try {
      const serviceId = settlement.booking_service_id
      if (serviceId) {
        const [addonRes, servicesRes] = await Promise.all([
          fetch(`/api/proxy/pos/services/${serviceId}/addon-options`),
          fetch('/api/proxy/booking/services', { cache: 'no-store' }),
        ])
        const addonJson = await addonRes.json().catch(() => null)
        setCartEditAddonQuestions((addonJson?.data?.questions ?? []) as typeof cartEditAddonQuestions)
        const servicesJson = await servicesRes.json().catch(() => null)
        const catalog = (Array.isArray(servicesJson?.data) ? servicesJson.data : []) as BookingServiceOption[]
        setCartEditMainServiceCatalog(catalog)
        const originalServiceId = Number(settlement.booking_service_id ?? 0)
        const catalogOriginal = catalog.find((service) => service.id === originalServiceId)
        if (catalogOriginal) {
          setCartEditOriginalService((current) => current ? {
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
              return {
                ...block,
                addon_questions: (addonJson2?.data?.questions ?? []) as typeof cartEditAddonQuestions,
                staff_splits: block.staff_splits.length > 0 ? rebalanceSettlementPrimaryShare(block.staff_splits) : [{ staff_id: null, share_percent: '100' }],
              }
            } catch {
              return {
                ...block,
                addon_questions: [],
                staff_splits: block.staff_splits.length > 0 ? rebalanceSettlementPrimaryShare(block.staff_splits) : [{ staff_id: null, share_percent: '100' }],
              }
            }
          }))
          setCartEditAddedMainBlocks(hydrated)
        }
      } else {
        setCartEditAddonQuestions([])
        setCartEditMainServiceCatalog([])
        setCartEditAddedMainBlocks([])
      }
    } catch {
      setCartEditAddonQuestions([])
      setCartEditMainServiceCatalog([])
      setCartEditAddedMainBlocks([])
    } finally {
      setCartEditAddonOptionsLoading(false)
      setCartEditMainServiceCatalogLoading(false)
    }
  }

  const toggleCartEditAddon = (optionId: number) => {
    setCartEditSelectedAddonIds((prev) => {
      const next = new Set(prev)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return next
    })
  }

  const openCartEditMainServicePicker = () => {
    setCartEditMainServicePickerQuery('')
    setCartEditMainServicePickerTargetId('__new__')
    setCartEditMainServicePickerOpen(true)
  }

  const openCartEditOriginalServicePicker = () => {
    setCartEditMainServicePickerQuery('')
    setCartEditMainServicePickerTargetId('__original__')
    setCartEditMainServicePickerOpen(true)
  }

  const selectCartEditOriginalService = async (service: BookingServiceOption) => {
    if (!service?.id) return
    setCartEditSettlementError(null)
    setCartEditOriginalService(service)
    setCartEditSettlementServiceId(service.id)
    setCartEditSelectedAddonIds(new Set())
    setCartEditAddedMainBlocks((prev) => prev.filter((block) => block.service_id !== service.id))
    setCartEditSettledAmount('')
    setCartEditOriginalServicePrice(Number(service.service_price ?? service.price ?? 0))
    setCartEditAddonPriceOverrides({})
    setCartEditAddonOptionsLoading(true)
    try {
      const res = await fetch(`/api/proxy/pos/services/${service.id}/addon-options`)
      const json = await res.json().catch(() => null)
      setCartEditAddonQuestions((json?.data?.questions ?? []) as typeof cartEditAddonQuestions)
    } catch {
      setCartEditAddonQuestions([])
    } finally {
      setCartEditAddonOptionsLoading(false)
    }
    setCartEditMainServicePickerOpen(false)
    setCartEditMainServicePickerTargetId(null)
    setCartEditMainServicePickerQuery('')
  }

  const addCartEditMainServiceBlock = async (service: BookingServiceOption) => {
    if (!service?.id) return
    if (cartEditOriginalService?.id === service.id) return
    if (cartEditAddedMainBlocks.some((block) => block.service_id === service.id)) return
    let questions: typeof cartEditAddonQuestions = []
    try {
      const res = await fetch(`/api/proxy/pos/services/${service.id}/addon-options`)
      const json = await res.json().catch(() => null)
      questions = (json?.data?.questions ?? []) as typeof cartEditAddonQuestions
    } catch {
      questions = []
    }
    setCartEditAddedMainBlocks((prev) => [...prev, {
      tmp_id: `added-${service.id}-${Math.random()}`,
      service_id: service.id,
      service_name: service.name,
      service_cn_name: service.cn_name ?? null,
      price: Number(service.service_price ?? service.price ?? 0),
      duration_min: Number(service.duration_min ?? 0),
      addon_questions: questions,
      selected_addon_ids: new Set<number>(),
      staff_splits: [{ staff_id: null, share_percent: '100' }],
      auto_balance: true,
    }])
  }

  const updateCartEditAddedMainSplitStaff = (tmpId: string, index: number, staffId: number | null) => {
    setCartEditAddedMainBlocks((prev) => prev.map((block) => {
      if (block.tmp_id !== tmpId) return block
      const next = block.staff_splits.map((row, rowIdx) => (rowIdx === index ? { ...row, staff_id: staffId } : row))
      const rebalanced = block.auto_balance ? rebalanceSettlementPrimaryShare(next) : next
      return { ...block, staff_splits: rebalanced }
    }))
  }

  const updateCartEditAddedMainSplitShare = (tmpId: string, index: number, value: string) => {
    setCartEditAddedMainBlocks((prev) => prev.map((block) => {
      if (block.tmp_id !== tmpId) return block
      const next = block.staff_splits.map((row, rowIdx) => (rowIdx === index ? { ...row, share_percent: value } : row))
      if (!block.auto_balance || index === 0) return { ...block, staff_splits: next }
      return { ...block, staff_splits: rebalanceSettlementPrimaryShare(next) }
    }))
  }

  const toggleCartEditAddedMainAutoBalance = (tmpId: string, enabled: boolean) => {
    setCartEditAddedMainBlocks((prev) => prev.map((block) => {
      if (block.tmp_id !== tmpId) return block
      const nextSplits = enabled ? rebalanceSettlementPrimaryShare(block.staff_splits) : block.staff_splits
      return { ...block, auto_balance: enabled, staff_splits: nextSplits }
    }))
  }

  const cartEditOriginalSettlementSource = useMemo(
    () => bookingServiceSettlementSource(cartEditOriginalService),
    [cartEditOriginalService],
  )


  const editCartSettlementOriginalServicePrice = () => {
    if (!cartEditSettlementItem) return
    const line = (cartEditSettlementItem.main_service_settlement_items ?? []).find((row, idx) => row.is_original ?? idx === 0)
    const current = Number(cartEditOriginalServicePrice ?? line?.gross_amount ?? line?.balance_due ?? cartEditOriginalService?.service_price ?? cartEditOriginalService?.price ?? 0)
    if (line?.line_key) {
      openPriceEditModal({ kind: 'settlementLine', id: cartEditSettlementItem.id, lineKey: line.line_key, name: line.name ?? cartEditOriginalService?.name ?? 'Service', currentUnitPrice: current, originalUnitPrice: Number(line.price_override?.original_unit_price ?? line.extra_price ?? current) })
      return
    }
    const raw = window.prompt('New service price', current.toFixed(2))
    if (raw == null) return
    const next = Number(raw)
    if (Number.isFinite(next) && next >= 0) setCartEditOriginalServicePrice(next)
  }

  const editCartSettlementAddonPrice = (optionId: number, label: string, currentPrice: number) => {
    if (!cartEditSettlementItem) return
    const line = (cartEditSettlementItem.addon_settlement_items ?? []).find((row) => Number(row.id ?? 0) === Number(optionId))
    const current = Number(cartEditAddonPriceOverrides[optionId] ?? line?.gross_amount ?? line?.balance_due ?? currentPrice ?? 0)
    if (line?.line_key) {
      openPriceEditModal({ kind: 'settlementLine', id: cartEditSettlementItem.id, lineKey: line.line_key, name: label, currentUnitPrice: current, originalUnitPrice: Number(line.price_override?.original_unit_price ?? line.extra_price ?? current) })
      return
    }
    const raw = window.prompt('New add-on price', current.toFixed(2))
    if (raw == null) return
    const next = Number(raw)
    if (Number.isFinite(next) && next >= 0) setCartEditAddonPriceOverrides((prev) => ({ ...prev, [optionId]: next }))
  }

  const editCartAddedMainServicePrice = (tmpId: string, currentPrice: number) => {
    const raw = window.prompt('New service block price', Number(currentPrice ?? 0).toFixed(2))
    if (raw == null) return
    const next = Number(raw)
    if (!Number.isFinite(next) || next < 0) return
    setCartEditAddedMainBlocks((prev) => prev.map((block) => block.tmp_id === tmpId ? { ...block, price: next } : block))
  }

  const saveCartEditSettlement = async () => {
    if (!cartEditSettlementBookingId) return
    setCartEditSettlementError(null)
    setCartEditSettlementLoading(true)
    try {
      const needsSettledAmount = settlementNeedsSettledAmount(cartEditOriginalSettlementSource)
      const payload: Record<string, unknown> = {
        addon_option_ids: Array.from(cartEditSelectedAddonIds),
        main_service_ids: cartEditAddedMainBlocks.map((block) => block.service_id),
        main_service_items: cartEditAddedMainBlocks.map((block) => ({
          booking_service_id: block.service_id,
          addon_option_ids: Array.from(block.selected_addon_ids),
          staff_splits: block.staff_splits.map((row) => ({
            staff_id: Number(row.staff_id ?? 0),
            share_percent: Number.parseInt(row.share_percent || '0', 10),
          })),
        })),
      }
      const originalServiceId = Number(cartEditOriginalService?.id ?? cartEditSettlementItem?.booking_service_id ?? 0)
      if (originalServiceId > 0 && originalServiceId !== Number(cartEditSettlementItem?.booking_service_id ?? 0)) {
        payload.booking_service_id = originalServiceId
      }
      if (needsSettledAmount) {
        const amountCheck = validateSettlementAmountInput(cartEditSettledAmount, cartEditOriginalSettlementSource)
        if (!amountCheck.ok) {
          setCartEditSettlementError(amountCheck.message)
          return
        }
        payload.settled_service_amount = amountCheck.amount
      }
      const normalizedSplits = cartEditStaffSplits.map((row) => ({
        staff_id: Number(row.staff_id ?? 0),
        share_percent: Number.parseInt(row.share_percent || '0', 10),
      }))
      if (normalizedSplits.length < 1 || normalizedSplits.some((row) => row.staff_id <= 0 || row.share_percent <= 0)) {
        setCartEditSettlementError('Please select at least one staff and enter valid split percentages.')
        return
      }
      const uniqueIds = new Set(normalizedSplits.map((row) => row.staff_id))
      if (uniqueIds.size !== normalizedSplits.length) {
        setCartEditSettlementError('Duplicate staff is not allowed in split.')
        return
      }
      const splitSum = normalizedSplits.reduce((sum, row) => sum + row.share_percent, 0)
      if (splitSum !== 100) {
        setCartEditSettlementError(`Staff split total must equal 100% (current: ${splitSum}%).`)
        return
      }
      payload.staff_splits = normalizedSplits

      for (const block of cartEditAddedMainBlocks) {
        const blockSplits = block.staff_splits.map((row) => ({
          staff_id: Number(row.staff_id ?? 0),
          share_percent: Number.parseInt(row.share_percent || '0', 10),
        }))
        if (blockSplits.length < 1 || blockSplits.some((row) => row.staff_id <= 0 || row.share_percent <= 0)) {
          setCartEditSettlementError(`Please complete staff split for ${block.service_name}.`)
          return
        }
        const blockUnique = new Set(blockSplits.map((row) => row.staff_id))
        const blockSum = blockSplits.reduce((sum, row) => sum + row.share_percent, 0)
        if (blockUnique.size !== blockSplits.length || blockSum !== 100) {
          setCartEditSettlementError(`Staff split for ${block.service_name} must be valid and total 100%.`)
          return
        }
      }

      const res = await fetch(`/api/proxy/pos/appointments/${cartEditSettlementBookingId}/edit-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setCartEditSettlementError(json?.message ?? 'Failed to update settlement.')
        return
      }
      showMsg('Settlement updated.', 'success')
      setCartEditSettlementOpen(false)
      await loadCart()
      void fetchUnpaidCompletedAppointments(settlementQuery)
    } finally {
      setCartEditSettlementLoading(false)
    }
  }

  const claimSettlementPackage = async (bookingId: number, cartSettlementItemId: number) => {
    if (settlementRedeemingIds[cartSettlementItemId]) return
    setSettlementRedeemingIds((prev) => ({ ...prev, [cartSettlementItemId]: true }))
    const res = await fetch(`/api/proxy/pos/appointments/${bookingId}/apply-package`, { method: 'POST' })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      showMsg(json?.message ?? 'Unable to apply package.', 'error')
      setSettlementRedeemingIds((prev) => ({ ...prev, [cartSettlementItemId]: false }))
      return
    }
    showMsg(json?.message ?? 'Package applied.', 'success')
    await loadCart()
    void fetchUnpaidCompletedAppointments(settlementQuery)
    setSettlementRedeemingIds((prev) => ({ ...prev, [cartSettlementItemId]: false }))
  }

  const unclaimSettlementPackage = async (bookingId: number, cartSettlementItemId: number) => {
    if (settlementUnclaimingIds[cartSettlementItemId]) return
    setSettlementUnclaimingIds((prev) => ({ ...prev, [cartSettlementItemId]: true }))
    const res = await fetch(`/api/proxy/pos/appointments/${bookingId}/release-package`, { method: 'POST' })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      showMsg(json?.message ?? 'Unable to release package.', 'error')
      setSettlementUnclaimingIds((prev) => ({ ...prev, [cartSettlementItemId]: false }))
      return
    }
    showMsg(json?.message ?? 'Package released.', 'success')
    await loadCart()
    void fetchUnpaidCompletedAppointments(settlementQuery)
    setSettlementUnclaimingIds((prev) => ({ ...prev, [cartSettlementItemId]: false }))
  }

  useEffect(() => {
    focusScanner()
    void loadCart()
    const loadCategories = async () => {
      const params = new URLSearchParams({
        page: '1',
        per_page: '200',
        is_active: 'true',
      })
      try {
        const res = await fetch(`/api/proxy/ecommerce/categories?${params.toString()}`, { cache: 'no-store' })
        if (!res.ok) {
          setCategories([])
          return
        }
        const json = await res.json()
        const paged = extractPaged<{ id?: number | string; name?: string; cn_name?: string | null }>(json)
        const mapped = paged.data
          .map((item) => {
            const id = Number(item?.id)
            if (!Number.isFinite(id) || id <= 0 || !item?.name?.trim()) return null
            return {
              id,
              name: item.name.trim(),
              cn_name: typeof item?.cn_name === 'string' ? item.cn_name.trim() || null : null,
            }
          })
          .filter((item): item is CategoryOption => Boolean(item))
        setCategories(mapped)
      } catch {
        setCategories([])
      }
    }

    void loadCategories()
    void fetchActiveStaffs()
    void fetchServices()
      void fetchBookingServiceCategories()
    const loadBookingProductCategories = async () => {
      try {
        const res = await fetch('/api/proxy/admin/booking/product-categories', { cache: 'no-store' })
        if (!res.ok) {
          setBookingProductCategories([])
          return
        }
        const json = await res.json().catch(() => null)
        const payload = (json && typeof json === 'object' && 'data' in json)
          ? (json as { data?: unknown }).data
          : json
        const rows = Array.isArray(payload) ? payload : []
        const mapped = rows
          .map((row: any) => ({
            id: Number(row?.id),
            name: String(row?.name ?? '').trim(),
            cn_name: typeof row?.cn_name === 'string' ? row.cn_name.trim() || null : null,
            sort_order: Number(row?.sort_order ?? 0),
            is_active: Boolean(row?.is_active ?? true),
          }))
          .filter((row) => row.id > 0 && row.name && row.is_active)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
        setBookingProductCategories(mapped)
      } catch {
        setBookingProductCategories([])
      }
    }

    void loadBookingProductCategories()
    void fetchBookingProducts(null)
    void fetchServicePackages()
    void fetchUnpaidCompletedAppointments('')
  }, [fetchActiveStaffs, fetchBookingProducts, fetchServicePackages, fetchServices, fetchUnpaidCompletedAppointments])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedBookingProductQuery(bookingProductQuery)
    }, 220)
    return () => window.clearTimeout(handle)
  }, [bookingProductQuery])

  useEffect(() => {
    void fetchBookingProducts(selectedBookingProductCategoryId)
  }, [fetchBookingProducts, selectedBookingProductCategoryId])

  const filteredBookingProducts = useMemo(() => {
    const keyword = debouncedBookingProductQuery.trim().toLowerCase()
    if (!keyword) return bookingProducts
    return bookingProducts.filter((item) => item.name.toLowerCase().includes(keyword))
  }, [bookingProducts, debouncedBookingProductQuery])

  const showProductCategoryCnLine = useMemo(
    () => categories.some((category) => Boolean(category.cn_name?.trim())),
    [categories],
  )

  const showBookingProductCategoryCnLine = useMemo(
    () => bookingProductCategories.some((category) => Boolean(category.cn_name?.trim())),
    [bookingProductCategories],
  )

  useEffect(() => {
    const onPageShow = () => { void loadCart() }
    const onFocus = () => { void loadCart() }
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void loadCart()
      }
    }
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const filteredServices = useMemo(() => {
    const keyword = serviceQuery.trim().toLowerCase()
    const categoryFiltered = selectedBookingServiceCategoryId
      ? services.filter((service) => (service.category_ids ?? service.categories?.map((category) => category.id) ?? []).includes(selectedBookingServiceCategoryId))
      : services
    if (!keyword) return categoryFiltered

    return categoryFiltered.filter((service) =>
      service.name.toLowerCase().includes(keyword) ||
      (service.cn_name ?? '').toLowerCase().includes(keyword) ||
      String(service.service_type ?? '').toLowerCase().includes(keyword),
    )
  }, [selectedBookingServiceCategoryId, serviceQuery, services])


  const filteredServicePackages = useMemo(() => {
    const keyword = packageQuery.trim().toLowerCase()
    if (!keyword) return servicePackages

    return servicePackages.filter((item) =>
      item.name.toLowerCase().includes(keyword),
    )
  }, [packageQuery, servicePackages])

  /** After refresh, cart still has customer_id on lines but UI member picker is empty — restore selection for checkout & labels. */
  useEffect(() => {
    if (!cart) return
    if (selectedMember?.id) return
    const pkg = cart.package_items?.find((p) => p.customer_id)
    if (pkg?.customer_id) {
      const raw = pkg.customer_name?.trim()
      const name = raw && raw.length > 0 ? raw : `Member (#${pkg.customer_id})`
      setSelectedMember({ id: pkg.customer_id, name, phone: null, email: null })
      return
    }
    const svc = cart.service_items?.find((s) => s.customer_id)
    if (svc?.customer_id) {
      const raw = svc.customer_name?.trim()
      const name = raw && raw.length > 0 ? raw : `Member (#${svc.customer_id})`
      setSelectedMember({ id: svc.customer_id, name, phone: null, email: null })
      return
    }
    const st = cart.appointment_settlement_items?.find((s) => s.customer_id)
    if (st?.customer_id) {
      const raw = st.customer_name?.trim()
      const name = raw && raw.length > 0 ? raw : `Member (#${st.customer_id})`
      setSelectedMember({ id: st.customer_id, name, phone: null, email: null })
    }
  }, [cart, selectedMember?.id])

  useEffect(() => {
    const memberId = selectedMember?.id
    const serviceItems = cart?.service_items ?? []

    if (!memberId || serviceItems.length === 0) {
      setServiceAvailabilityMap({})
      return
    }

    let cancelled = false

    const run = async () => {
      const next: Record<number, number> = {}
      await Promise.all(serviceItems.map(async (item) => {
        try {
          const res = await fetch(`/api/proxy/customers/${memberId}/service-package-available-for/${item.booking_service_id}`, { cache: 'no-store' })
          if (!res.ok) {
            next[item.id] = 0
            return
          }
          const json = await res.json().catch(() => null)
          const rows = Array.isArray(json?.data) ? json.data : []
          next[item.id] = rows.reduce((sum: number, row: unknown) => {
            if (!row || typeof row !== 'object') return sum
            const maybe = row as Record<string, unknown>
            return sum + Number(maybe.remaining_qty ?? 0)
          }, 0)
        } catch {
          next[item.id] = 0
        }
      }))

      if (!cancelled) setServiceAvailabilityMap(next)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [cart?.service_items, selectedMember?.id])

  useEffect(() => {
    const memberId = selectedMember?.id
    const settlementItems = cart?.appointment_settlement_items ?? []

    if (!memberId || settlementItems.length === 0) {
      setSettlementAvailabilityMap({})
      return
    }

    let cancelled = false
    const run = async () => {
      const next: Record<number, number> = {}
      await Promise.all(settlementItems.map(async (item) => {
        const bookingServiceId = Number(item.booking_service_id ?? 0)
        if (!bookingServiceId) {
          next[item.id] = 0
          return
        }
        try {
          const res = await fetch(`/api/proxy/customers/${memberId}/service-package-available-for/${bookingServiceId}`, { cache: 'no-store' })
          if (!res.ok) {
            next[item.id] = 0
            return
          }
          const json = await res.json().catch(() => null)
          const rows = Array.isArray(json?.data) ? json.data : []
          next[item.id] = rows.reduce((sum: number, row: unknown) => {
            if (!row || typeof row !== 'object') return sum
            const maybe = row as Record<string, unknown>
            return sum + Number(maybe.remaining_qty ?? 0)
          }, 0)
        } catch {
          next[item.id] = 0
        }
      }))
      if (!cancelled) setSettlementAvailabilityMap(next)
    }

    void run()
    return () => { cancelled = true }
  }, [cart?.appointment_settlement_items, selectedMember?.id])

  const hasCartItems =
    cartItems.length > 0 ||
    cartServiceItems.length > 0 ||
    cartPackageItems.length > 0 ||
    cartAppointmentSettlementItems.length > 0

  useEffect(() => {
    if (productSearchMode !== 'barcode') {
      setDebouncedSkuQuery('')
      return
    }

    const handle = window.setTimeout(() => {
      setDebouncedSkuQuery(productQuery)
    }, 180)

    return () => window.clearTimeout(handle)
  }, [productQuery, productSearchMode])

  useEffect(() => {
    void fetchProductPage(1, effectiveServerProductQuery, false, { categoryId: selectedCategoryId })
  }, [effectiveServerProductQuery, fetchProductPage, selectedCategoryId])

  useEffect(() => {
    const previousCategoryId = Number(previousCategoryIdRef.current)
    if (previousCategoryId !== Number(selectedCategoryId)) {
      productsGridRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    previousCategoryIdRef.current = selectedCategoryId
  }, [selectedCategoryId])

  useEffect(() => {
    let timeoutId: number | null = null
    let cancelled = false

    const tick = async () => {
      if (cancelled) return

      if (!productSelectModalOpen && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        await fetchProductPage(1, effectiveServerProductQuery, false, {
          silent: true,
          resetHighlight: false,
          categoryId: selectedCategoryId,
        })
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(tick, 60_000)
      }
    }

    timeoutId = window.setTimeout(tick, 60_000)

    return () => {
      cancelled = true
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [effectiveServerProductQuery, fetchProductPage, productSelectModalOpen, selectedCategoryId])

  useEffect(() => {
    if (!memberOpen) return

    if (memberQuery.trim().length < 3) {
      setMembers([])
      setMemberPage(1)
      setMemberLastPage(1)
      setMemberLoading(false)
      return
    }

    const handle = setTimeout(() => {
      void fetchMemberPage(1, memberQuery, false)
    }, 300)

    return () => clearTimeout(handle)
  }, [fetchMemberPage, memberQuery, memberOpen])

  const onScannerEnter = async () => {
    const value = scannerInputRef.current?.value ?? ''
    clearScannerInput()

    if (!value.trim()) {
      focusScanner()
      return
    }

    await addByBarcode(value)
    focusScanner()
  }


  useEffect(() => {
    const MIN_LEN_START = 3
    const MIN_LEN_SUBMIT = 0 
    const SCAN_KEY_INTERVAL_MS = 50
    const SCAN_IDLE_RESET_MS = 150
    const POSSIBLE_SCAN_TIMEOUT_MS = 100

    const clearPossibleTimer = () => {
      if (possibleTimerRef.current) {
        window.clearTimeout(possibleTimerRef.current)
        possibleTimerRef.current = null
      }
    }

    const replayBufferToActiveTarget = (buffer: string) => {
      const target = activeTargetRef.current
      if (!target || !buffer) return

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const isUnsupportedSelectionInput =
          target instanceof HTMLInputElement &&
          ['number', 'date', 'time', 'datetime-local', 'month', 'week', 'color', 'range'].includes(
            String(target.type ?? '').toLowerCase(),
          )

        if (isUnsupportedSelectionInput) {
          target.value = `${target.value ?? ''}${buffer}`
          target.dispatchEvent(new Event('input', { bubbles: true }))
          return
        }

        try {
          const start = target.selectionStart ?? target.value.length
          const end = target.selectionEnd ?? target.value.length
          target.setRangeText(buffer, start, end, 'end')
          target.dispatchEvent(new Event('input', { bubbles: true }))
        } catch {
          target.value = `${target.value ?? ''}${buffer}`
          target.dispatchEvent(new Event('input', { bubbles: true }))
        }
        return
      }

      if (target.isContentEditable) {
        target.textContent = `${target.textContent ?? ''}${buffer}`
        target.dispatchEvent(new InputEvent('input', { bubbles: true, data: buffer, inputType: 'insertText' }))
      }
    }

    const resetScanState = () => {
      clearPossibleTimer()
      scanBufferRef.current = ''
      lastKeyTimeRef.current = 0
      scanModeRef.current = 'idle'
      activeTargetRef.current = null
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const hasOpenModal =
        memberOpen ||
        checkoutConfirmationOpen ||
        bookingModalOpen ||
        packageModalOpen ||
        discountModalOpen ||
        productSelectModalOpen ||
        voucherModalOpen ||
        itemSplitEditorOpen ||
        Boolean(checkoutResult) ||
        qrCodeFullscreen ||
        document.body.dataset.posCashShiftModalOpen === 'true'

      if (hasOpenModal) return

      const key = event.key
      const isPrintable = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
      const now = Date.now()

      if (lastKeyTimeRef.current && now - lastKeyTimeRef.current > SCAN_IDLE_RESET_MS) {
        if (scanModeRef.current === 'possible') {
          replayBufferToActiveTarget(scanBufferRef.current)
        }
        resetScanState()
      }

      if (isPrintable) {
        if (scanModeRef.current === 'idle') {
          scanModeRef.current = 'possible'
          scanBufferRef.current = key
          activeTargetRef.current = event.target instanceof HTMLElement ? event.target : null
          lastKeyTimeRef.current = now

          event.preventDefault()
          event.stopPropagation()

          clearPossibleTimer()
          possibleTimerRef.current = window.setTimeout(() => {
            if (scanModeRef.current === 'possible') {
              replayBufferToActiveTarget(scanBufferRef.current)
              resetScanState()
            }
          }, POSSIBLE_SCAN_TIMEOUT_MS)

          return
        }

        const elapsed = now - lastKeyTimeRef.current
        const isScannerSpeed = elapsed <= SCAN_KEY_INTERVAL_MS

        if (isScannerSpeed) {
          scanBufferRef.current += key
          lastKeyTimeRef.current = now

          event.preventDefault()
          event.stopPropagation()

          if (scanBufferRef.current.length >= MIN_LEN_START) {
            scanModeRef.current = 'confirmed'
            clearPossibleTimer()
          } else {
            clearPossibleTimer()
            possibleTimerRef.current = window.setTimeout(() => {
              if (scanModeRef.current === 'possible') {
                replayBufferToActiveTarget(scanBufferRef.current)
                resetScanState()
              }
            }, POSSIBLE_SCAN_TIMEOUT_MS)
          }

          if (scanTimeoutRef.current) {
            window.clearTimeout(scanTimeoutRef.current)
          }

          scanTimeoutRef.current = window.setTimeout(() => {
            resetScanState()
          }, SCAN_IDLE_RESET_MS)

          return
        }

        replayBufferToActiveTarget(`${scanBufferRef.current}${key}`)
        resetScanState()
        return
      }

      if (key === 'Enter') {
        if (scanTimeoutRef.current) {
          window.clearTimeout(scanTimeoutRef.current)
          scanTimeoutRef.current = null
        }

        const scanned = scanBufferRef.current.trim()
        const mode = scanModeRef.current

        if (mode === 'confirmed' && scanned.length > 0) { // 这个会觉得你的BARCODE 是多少的时候进去 如果一定要6 就要改
          event.preventDefault()
          event.stopPropagation()

          void addByBarcodeRef.current(scanned)
          setLastScanValue(scanned)
          setLastScanVisible(true)

          if (lastScanMessageTimeoutRef.current) {
            window.clearTimeout(lastScanMessageTimeoutRef.current)
          }

          lastScanMessageTimeoutRef.current = window.setTimeout(() => {
            setLastScanVisible(false)
          }, 2000)

          resetScanState()
          return
        }

        if (mode === 'possible') {
          replayBufferToActiveTarget(scanned)
        }

        resetScanState()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      if (scanTimeoutRef.current) {
        window.clearTimeout(scanTimeoutRef.current)
      }
      if (possibleTimerRef.current) {
        window.clearTimeout(possibleTimerRef.current)
      }
      if (lastScanMessageTimeoutRef.current) {
        window.clearTimeout(lastScanMessageTimeoutRef.current)
      }
    }
  }, [
    bookingModalOpen,
    checkoutConfirmationOpen,
    checkoutResult,
    discountModalOpen,
    itemSplitEditorOpen,
    memberOpen,
    packageModalOpen,
    productSelectModalOpen,
    qrCodeFullscreen,
    voucherModalOpen,
  ])

  const onSelectProduct = (item: ProductOption, preferredVariantId?: number | null) => {
    const resolvedPreferredVariantId = Number(preferredVariantId)
    const hasPreferredVariant = Number.isFinite(resolvedPreferredVariantId) && resolvedPreferredVariantId > 0

    setFullProductData(null)
    setSelectedProduct(item)
    setSelectedVariantId(hasPreferredVariant ? resolvedPreferredVariantId : (item.variants.length === 1 ? item.variants[0].id : null))
    setSelectedProductQty(1)
    setProductSelectModalOpen(true)
    void hydrateProductVariants(item)
  }

  const confirmAddSelectedProduct = async () => {
    if (!selectedProduct) return

    if (isPosSimpleProductOutOfStock(selectedProduct)) {
      showMsg('This product is out of stock.', 'error')
      return
    }

    let variantIdToUse: number | null = null

    if (selectedProduct.variants.length > 0) {
      variantIdToUse = selectedVariantId ?? selectedProduct.variants[0]?.id ?? null
    }

    if (!variantIdToUse) {
      variantIdToUse = resolveVariantIdFromPayload(fullProductData)
    }

    if (!variantIdToUse) {
      const productId = Number(selectedProduct.product_id || selectedProduct.id)
      if (Number.isFinite(productId) && productId > 0) {
        try {
          const res = await fetch(`/api/proxy/ecommerce/products/${productId}`, { cache: 'no-store' })
          const json = await res.json()
          if (res.ok) {
            const payload = json?.data?.product ?? json?.data ?? json?.product
            variantIdToUse = resolveVariantIdFromPayload(payload)
            if (payload) setFullProductData(payload)
          }
        } catch {
          // no-op
        }
      }
    }

    const productId = Number(selectedProduct.product_id || selectedProduct.id)
    const success = await addBySelection(
      variantIdToUse && variantIdToUse > 0
        ? { variant_id: variantIdToUse }
        : { product_id: productId },
      selectedProductQty,
    )
    if (!success) return

    setProductSelectModalOpen(false)
    setSelectedProduct(null)
    setSelectedVariantId(null)
    setProductVariantLoading(false)
    setFullProductData(null)
    focusScanner()
  }

  const quickAddProduct = async (item: ProductOption) => {
    if (item.variants.length > 0) {
      onSelectProduct(item)
      return
    }

    if (isPosSimpleProductOutOfStock(item)) {
      showMsg('This product is out of stock.', 'error')
      return
    }

    const productId = Number(item.product_id || item.id)
    if (!Number.isFinite(productId) || productId <= 0) {
      showMsg('Invalid product ID.', 'error')
      return
    }

    await addBySelection({ product_id: productId }, 1)
  }


  const fetchCartItemVariants = async (item: CartItem) => {
    if (!item.product_id || cartVariantOptions[item.id]?.length || cartVariantLoading[item.id] || cartVariantFetched[item.id]) return

    setCartVariantLoading((prev) => ({ ...prev, [item.id]: true }))

    try {
      const res = await fetch(`/api/proxy/ecommerce/products/${item.product_id}`, { cache: 'no-store' })
      const json = await res.json()
      const payload = json?.data?.product ?? json?.data ?? json?.product

      const options: ProductVariantOption[] = Array.isArray(payload?.variants)
        ? payload.variants
            .map((variant: VariantPayload): ProductVariantOption | null => {
              const id = Number(variant?.id)
              const sku = variant?.sku?.trim() || ''
              const price = Number(variant?.sale_price ?? variant?.price ?? 0)
              if (!Number.isFinite(id) || id <= 0 || !sku) return null

              const vPayload = variant as VariantPayload
              return {
                id,
                name: variant?.title?.trim() || variant?.name?.trim() || sku,
                cn_name: typeof variant?.cn_name === 'string' ? variant.cn_name.trim() || null : null,
                sku,
                barcode: (typeof (variant as any)?.barcode === 'string' && String((variant as any).barcode).trim())
                  ? String((variant as any).barcode).trim()
                  : sku,
                price: Number.isFinite(price) ? price : 0,
                thumbnail_url: variant?.image_url ?? variant?.image_path ?? payload?.cover_image_url ?? null,
                image_url: variant?.image_url ?? null,
                image_path: variant?.image_path ?? null,
                is_active: toApiBoolean(variant?.is_active),
                track_stock: normalizeVariantTrackStock(vPayload),
                stock: resolveVariantAvailableQty(vPayload),
                is_bundle:
                  toApiBoolean(variant?.is_bundle) ||
                  (Array.isArray(vPayload.bundle_items) && vPayload.bundle_items.length > 0),
              }
            })
            .filter((variant: ProductVariantOption | null): variant is ProductVariantOption => Boolean(variant))
        : []

      setCartVariantOptions((prev) => ({ ...prev, [item.id]: options }))
    } finally {
      setCartVariantLoading((prev) => ({ ...prev, [item.id]: false }))
      setCartVariantFetched((prev) => ({ ...prev, [item.id]: true }))
    }
  }

  const updateItemVariant = async (item: CartItem, variantId: number) => {
    if (!Number.isFinite(variantId) || variantId <= 0 || item.variant_id === variantId) return

    const res = await fetch(`/api/proxy/pos/cart/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant_id: variantId, qty: item.qty }),
    })
    const json = await res.json()

    if (!res.ok) {
      showMsg(json?.message ?? 'Unable to change variant.', 'error')
      return
    }

    setCart(json.data.cart)
    showMsg('Variant updated.', 'success')
    setCartVariantOptions((prev) => ({ ...prev, [item.id]: [] }))
    setCartVariantFetched((prev) => ({ ...prev, [item.id]: false }))
  }


  useEffect(() => {
    if (!cart?.items?.length) return

    const itemsToPrefetch = cart.items.filter((item) => {
      if (!item.product_id) return false
      // Single products don't have variant switchers and should not trigger variant prefetch loops.
      if (!item.variant_id) return false
      if (cartVariantOptions[item.id]?.length) return false
      if (cartVariantLoading[item.id]) return false
      if (cartVariantFetched[item.id]) return false
      return true
    })

    itemsToPrefetch.forEach((item) => {
      void fetchCartItemVariants(item)
    })
  }, [cart, cartVariantFetched, cartVariantOptions, cartVariantLoading])

  useEffect(() => {
    if (openCartVariantItemId == null) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (!target.closest(`[data-cart-variant-select="${openCartVariantItemId}"]`)) {
        setOpenCartVariantItemId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openCartVariantItemId])

  const checkoutPaymentRows = useMemo(() => SPLIT_PAYMENT_METHODS.map(({ method }) => ({ method, amount: Number(splitPaymentAmounts[method] || 0) })).filter((row) => Number.isFinite(row.amount) && row.amount > 0), [splitPaymentAmounts])
  const splitTotalPaid = useMemo(() => checkoutPaymentRows.reduce((sum, row) => sum + row.amount, 0), [checkoutPaymentRows])
  const splitCashCents = toPaymentCents(splitPaymentAmounts.cash)
  const splitQrPayCents = toPaymentCents(splitPaymentAmounts.qrpay)
  const splitCreditCardCents = toPaymentCents(splitPaymentAmounts.credit_card)
  const splitTotalPaidCents = splitCashCents + splitQrPayCents + splitCreditCardCents
  const cartTotalCents = toPaymentCents(cartTotal)
  const splitHasNonCashPayment = splitQrPayCents > 0 || splitCreditCardCents > 0
  const hasQrPayAmount = splitQrPayCents > 0
  const splitCashOnlyOverpaid = splitCashCents > cartTotalCents && splitQrPayCents === 0 && splitCreditCardCents === 0
  const splitMixedOverpaid = splitTotalPaidCents > cartTotalCents && splitHasNonCashPayment
  const splitRemaining = Math.max(0, (cartTotalCents - splitTotalPaidCents) / 100)
  const splitOverpaid = Math.max(0, (splitTotalPaidCents - cartTotalCents) / 100)
  const splitChange = splitCashOnlyOverpaid ? splitOverpaid : 0
  const splitPaymentMatchesTotal = splitTotalPaidCents === cartTotalCents
  const splitPaymentValid = checkoutPaymentRows.length > 0 && (splitPaymentMatchesTotal || splitCashOnlyOverpaid)

  const hasUnsettledRangeInCart = cartAppointmentSettlementItems.some((s) => s.requires_settled_amount)
  const cashShiftBlocksCheckout = cashShiftLoading || !hasOpenShift
  const canCheckout = hasCartItems && !checkingOut && !hasUnsettledRangeInCart && !cashShiftBlocksCheckout


  const checkoutBulkTargetKeys = useMemo(() => {
    const keys: string[] = []

    cartItems.forEach((item) => {
      keys.push(`product:${item.id}`)
      getBookingProductSelectedOptions(item).forEach((opt, idx) => {
        if (getBookingProductOptionNetLineTotal(item, opt) > 0.0001) {
          keys.push(`cart:${item.id}:booking_product_option:${Number(opt.id ?? idx)}`)
        }
      })
    })

    cartServiceItems.forEach((serviceItem) => {
      getPosServiceDepositBlocks(serviceItem).forEach((service, idx) => {
        if (Number(service.deposit ?? 0) > 0.0001) {
          keys.push(`service:${serviceItem.id}:main:${service.line_key ?? service.linked_booking_service_id ?? service.id ?? idx}`)
        }
        ;(service.add_ons ?? []).forEach((addon, addonIdx) => {
          if (Number(addon.deposit ?? 0) > 0.0001) {
            keys.push(`service:${serviceItem.id}:addon:${addon.line_key ?? addon.id ?? addonIdx}`)
          }
        })
      })
    })

    cartAppointmentSettlementItems.forEach((settlement) => {
      ;(settlement.main_service_settlement_items ?? []).forEach((service, idx) => {
        const amount = Number(service.line_total_after_discount ?? service.balance_due ?? service.gross_amount ?? service.extra_price ?? 0)
        if (amount > 0.0001) keys.push(`settlement:${settlement.id}:${service.line_key ?? `service:${service.id ?? idx}`}`)
      })
      ;(settlement.addon_settlement_items ?? []).forEach((addon, idx) => {
        const amount = Number(addon.line_total_after_discount ?? addon.balance_due ?? addon.gross_amount ?? addon.extra_price ?? 0)
        if (amount > 0.0001) keys.push(`settlement:${settlement.id}:${addon.line_key ?? `addon:${addon.id ?? idx}`}`)
      })
    })

    cartPackageItems.forEach((item) => {
      if (Number(item.line_total ?? 0) > 0.0001) keys.push(`package:${item.id}`)
    })

    return keys
  }, [cartAppointmentSettlementItems, cartItems, cartPackageItems, cartServiceItems])

  const resolveBulkApplyTargets = (keys: string[]) => ({
    lineKeys: keys.filter((key) => !key.startsWith('product:') && !key.startsWith('package:')),
    productCartItemIds: keys.filter((key) => key.startsWith('product:')).map((key) => Number(key.slice('product:'.length))).filter((id) => Number.isFinite(id) && id > 0),
    packageItemIds: keys.filter((key) => key.startsWith('package:')).map((key) => Number(key.slice('package:'.length))).filter((id) => Number.isFinite(id) && id > 0),
  })

  const toggleGlobalBulkKey = (key: string) => {
    setGlobalBulkSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }



  const renderGlobalBulkLineCheckbox = (key: string) => globalBulkSelectedOnly ? (
    <label className="mb-1 inline-flex items-center gap-1.5 rounded border border-indigo-200 bg-white px-2 py-1 text-[10px] font-semibold text-indigo-700">
      <input
        type="checkbox"
        checked={globalBulkSelectedKeys.has(key)}
        onChange={() => toggleGlobalBulkKey(key)}
        className="h-3.5 w-3.5"
      />
      Select line
    </label>
  ) : null

  const openGlobalBulkSplitEditor = () => {
    const keys = globalBulkSelectedOnly ? Array.from(globalBulkSelectedKeys).filter((key) => checkoutBulkTargetKeys.includes(key)) : checkoutBulkTargetKeys
    const targets = resolveBulkApplyTargets(keys)
    void openBulkSplitEditor('Checkout lines', targets.lineKeys, currentUser.staff_id ? [{ staff_id: currentUser.staff_id, share_percent: 100 }] : [], targets.productCartItemIds, targets.packageItemIds)
  }

  const finalizeCheckout = async (meta: CheckoutMeta) => {
    if (!cart || !hasCartItems || checkingOut) return
    if (cartPackageItems.length > 0 && !selectedMember?.id) {
      setCheckoutError('Please assign member before purchasing service package.')
      return
    }
    if (hasCartBookServices && !hasCartPackages) {
      if (checkoutIdentityMode === 'member' && !selectedMember?.id) {
        setCheckoutError('Please assign a member, or switch to guest details for checkout.')
        return
      }
      if (checkoutIdentityMode === 'guest' && !guestContactIsComplete && !checkoutGuestIsUnknown) {
        setCheckoutError('Please complete guest name, phone, and email before checkout.')
        return
      }
    }

    setCheckingOut(true)
    setCheckoutError(null)

    for (const packageItem of cartPackageItems) {
      const rows = packageCheckoutSplits[packageItem.id] ?? []
      if (rows.length === 0) {
        setCheckoutError(`Please assign at least one staff split for package ${packageItem.package_name}.`)
        setCheckingOut(false)
        return
      }
      const ids = new Set<number>()
      let total = 0
      for (const row of rows) {
        if (!row.staff_id || row.staff_id <= 0) {
          setCheckoutError(`Please select staff for all splits of package ${packageItem.package_name}.`)
          setCheckingOut(false)
          return
        }
        if (ids.has(row.staff_id)) {
          setCheckoutError(`Duplicate staff found in package split for ${packageItem.package_name}.`)
          setCheckingOut(false)
          return
        }
        ids.add(row.staff_id)
        total += Number(row.share_percent || 0)
      }
      if (total !== 100) {
        setCheckoutError(`Total split for package ${packageItem.package_name} must be 100%.`)
        setCheckingOut(false)
        return
      }
    }

    const guestCheckoutPayload =
      !selectedMember?.id && checkoutIdentityMode === 'guest' && (guestContactIsComplete || checkoutGuestIsUnknown)
        ? {
            guest_name: checkoutGuestIsUnknown ? 'UNKNOWN' : guestContactCache.name.trim(),
            guest_phone: checkoutGuestIsUnknown ? null : normalizeInternationalPhone(guestContactCache.phone),
            guest_email: checkoutGuestIsUnknown ? null : guestContactCache.email.trim(),
          }
        : {}

    const checkoutPayload = {
        payment_method: checkoutPaymentRows.length === 1 ? (checkoutPaymentRows[0].method === 'credit_card' ? 'billplz_credit_card' : checkoutPaymentRows[0].method) : 'split',
        payments: checkoutPaymentRows,
        member_id: checkoutGuestIsUnknown ? null : (selectedMember?.id ?? null),
        ...guestCheckoutPayload,
        items: cartItems.map((item) => ({
          cart_item_id: item.id,
          product_id: item.product_id,
          qty: item.qty,
          unit_price: item.unit_price,
          line_total: item.line_total,
          staff_splits: (selectedStaffSplitsByCartItemId.get(item.id) ?? []).map((split) => ({
            staff_id: split.staff_id,
            share_percent: split.share_percent,
          })),
          line_staff_splits: Object.entries(checkoutLineSplits)
            .filter(([key]) => key.startsWith(`cart:${item.id}:`))
            .map(([key, splits]) => ({
              line_key: key,
              line_type: key.includes(':booking_product_option:') ? 'booking_product_option' : 'booking_product_base',
              line_ref_id: Number(key.split(':').pop() ?? 0) || null,
              staff_splits: splits.map((split) => ({ staff_id: split.staff_id, share_percent: split.share_percent })),
            })),
        })),
        service_items: (cart.service_items ?? []).map((item) => ({
          type: 'service',
          cart_service_item_id: item.id,
          booking_service_id: item.booking_service_id,
          snapshot_name: item.service_name,
          snapshot_price: item.unit_price,
          quantity: item.qty,
          assigned_staff_id: item.assigned_staff_id ?? null,
          service_commission_rate_used: item.commission_rate_used ?? 0,
          line_staff_splits: Object.entries(checkoutLineSplits)
            .filter(([key]) => key.startsWith(`service:${item.id}:`))
            .map(([key, splits]) => ({
              line_key: key,
              line_type: key.includes(':addon:') ? 'service_addon_deposit' : 'service_deposit',
              line_ref_id: key.split(':').pop() ?? null,
              staff_splits: splits.map((split) => ({ staff_id: split.staff_id, share_percent: split.share_percent })),
            })),
        })),
        settlement_line_staff_splits: Object.entries(checkoutLineSplits)
          .filter(([key]) => key.startsWith('settlement:'))
          .map(([key, splits]) => ({
            settlement_cart_item_id: Number(key.split(':')[1] ?? 0) || null,
            line_key: key.split(':').slice(2).join(':'),
            line_type: key.includes(':addon:') ? 'settlement_addon' : 'settlement_service',
            line_ref_id: key.split(':').pop() ?? null,
            staff_splits: splits.map((split) => ({ staff_id: split.staff_id, share_percent: split.share_percent })),
          })),
        package_items: cartPackageItems.map((item) => ({
          type: 'service_package',
          cart_package_item_id: item.id,
          service_package_id: item.service_package_id,
          quantity: item.qty,
          snapshot_name: item.package_name,
          snapshot_price: item.unit_price,
          customer_id: item.customer_id ?? selectedMember?.id ?? null,
          staff_splits: (packageCheckoutSplits[item.id] ?? []).map((split) => ({
            staff_id: split.staff_id,
            share_percent: split.share_percent,
          })),
        })),
      }

    const checkoutBody = qrProofFile && hasQrPayAmount ? new FormData() : null
    if (checkoutBody) {
      checkoutBody.append('payload', JSON.stringify(checkoutPayload))
      checkoutBody.append('qr_payment_proof', qrProofFile as File)
    }

    const res = await fetch('/api/proxy/pos/checkout', checkoutBody
      ? { method: 'POST', body: checkoutBody }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checkoutPayload),
        })
    const json = await res.json()

    if (!res.ok) {
      setCheckoutError(json?.message ?? 'Checkout failed. Please try again.')
      setCheckingOut(false)
      return
    }

    const receiptLineItems: ReceiptLineItem[] = [
      ...cartItems.map((item) => ({
        name: item.product_name ?? item.variant_name ?? 'Product',
        qty: item.qty,
        amount: item.line_total,
      })),
      ...(cart.service_items ?? []).map((item) => ({
        name: item.service_name ?? 'Service',
        qty: item.qty,
        amount: item.line_total,
      })),
      ...(cart.package_items ?? []).map((item) => ({
        name: item.package_name ?? 'Package',
        qty: item.qty,
        amount: item.line_total,
      })),
      ...(cart.appointment_settlement_items ?? []).map((item) => ({
        name: item.service_name ?? `Booking ${item.booking_code}`,
        qty: 1,
        amount: item.balance_due,
      })),
    ]

    const clearedCartId = cart.id
    setCheckoutResult({
      order_id: Number(json.data.order.id),
      order_number: json.data.order.order_number,
      receipt_public_url: json.data.receipt_public_url,
      total: Number(json.data.order.grand_total ?? 0),
      payment_method: checkoutPaymentRows.length > 1 ? 'split' : paymentMethod,
      paid_amount: meta.paid_amount,
      change_amount: meta.change_amount,
    })
    setReceiptEmail((selectedMember?.email?.trim() || guestContactCache.email.trim()) ?? '')
    setReceiptEmailError(null)
    setReceiptCooldownUntil(0)
    setSelectedMember(null)
    setGuestContactCache({ name: '', phone: '', email: '' })
    setCheckoutIdentityMode('member')
    setMemberQuery('')
    setMembers([])
    setCart({
      id: clearedCartId,
      items: [],
      service_items: [],
      package_items: [],
      appointment_settlement_items: [],
      subtotal: 0,
      grand_total: 0,
      voucher: null,
      promotions: [],
      booking_deposit_total: 0,
      booking_addon_total: 0,
      booking_deposit_breakdown: undefined,
    })
    setCheckoutItemAssignments([])
    setPackageCheckoutSplits({})
    void fetchUnpaidCompletedAppointments(settlementQuery)
    try {
      await loadCart()
    } catch {
      /* keep optimistic empty cart above */
    }
    if (qrProofPreviewUrl) {
      URL.revokeObjectURL(qrProofPreviewUrl)
    }
    setQrProofFile(null)
    setQrProofPreviewUrl(null)
    setQrProofFileName(null)
    setCheckoutConfirmationOpen(false)
    setCheckingOut(false)

    if (autoPrint) {
      const receiptPayload = {
        order_number: json.data.order.order_number,
        payment_method: paymentMethod,
        total: Number(json.data.order.grand_total ?? 0),
        paid_amount: meta.paid_amount,
        change_amount: meta.change_amount,
        items: receiptLineItems,
      }

      if (printMode === 'bluetooth' && isBluetoothPrinterConnected()) {
        printReceiptBluetooth(receiptPayload).catch(() => pushToast('error', 'Bluetooth print failed'))
      } else if (printMode === 'wifi' && wifiPrinterIp.trim()) {
        printReceiptWifi(wifiPrinterIp.trim(), Number(wifiPrinterPort) || 9100, receiptPayload)
          .catch(() => pushToast('error', 'WiFi print failed'))
      } else if (printMode === 'usb' && json.data.receipt_public_url) {
        printReceipt(json.data.receipt_public_url)
      }
    }

    focusScanner()
  }


  const sendReceiptToEmail = async () => {
    if (!checkoutResult) return

    const normalizedEmail = receiptEmail.trim()
    if (!normalizedEmail) {
      setReceiptEmailError('Email is required.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setReceiptEmailError('Please enter a valid email.')
      return
    }

    setSendingReceiptEmail(true)
    setReceiptEmailError(null)

    try {
      const res = await fetch(`/api/proxy/orders/${checkoutResult.order_id}/send-receipt-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const json = await res.json()

      if (!res.ok) {
        setReceiptEmailError(json?.message ?? 'Unable to send receipt email.')
        return
      }

      setReceiptCooldownUntil(Date.now() + 10_000)
      showMsg('Receipt sent', 'success')
    } catch {
      setReceiptEmailError('Unable to send receipt email.')
    } finally {
      setSendingReceiptEmail(false)
    }
  }

  const confirmCheckout = async () => {
    if (!cart || !hasCartItems || checkingOut) return
    setCheckoutError(null)
    if (cartPackageItems.length > 0 && !selectedMember?.id) {
      setCheckoutError('Please assign member before purchasing service package.')
      return
    }
    if (hasCartBookServices && !hasCartPackages) {
      if (checkoutIdentityMode === 'member' && !selectedMember?.id) {
        setCheckoutError('Please assign a member, or switch to guest details.')
        return
      }
      if (checkoutIdentityMode === 'guest' && !guestContactIsComplete && !checkoutGuestIsUnknown) {
        setCheckoutError('Please complete guest name, phone, and email.')
        return
      }
    }

    if (hasCartBookServices || hasCartPackages) {
      if (checkoutRequiresMemberOnly || checkoutIdentityMode === 'member') {
        if (selectedMember?.id) {
          const synced = await syncPosCartCustomerContext({ mode: 'member', memberId: selectedMember.id })
          if (!synced) return
        }
      } else if (checkoutIdentityMode === 'guest' && (guestContactIsComplete || checkoutGuestIsUnknown)) {
        setSelectedMember(null)
        const synced = await syncPosCartCustomerContext({ mode: 'guest' })
        if (!synced) return
      }
    }

    if (!splitPaymentValid) {
      setCheckoutError(splitMixedOverpaid ? 'Payment total cannot exceed grand total for split/non-cash payment.' : 'Total paid must equal grand total.')
      return
    }

    await finalizeCheckout({ paid_amount: splitTotalPaid, change_amount: splitChange })
  }

  const checkout = async () => {
    if (!cart || !hasCartItems || checkingOut) return
    if (cartPackageItems.length > 0 && !selectedMember?.id) {
      setCheckoutError('Please assign member before purchasing service package.')
      return
    }
    await openCheckoutConfirmation()
  }

  const syncPosCartCustomerContext = useCallback(
    async (opts: { mode: 'member'; memberId: number } | { mode: 'guest' }): Promise<boolean> => {
      try {
        const body =
          opts.mode === 'member'
            ? { mode: 'member', member_id: opts.memberId }
            : {
                mode: 'guest',
                guest_name: checkoutGuestIsUnknown ? 'UNKNOWN' : guestContactCache.name.trim(),
                guest_phone: checkoutGuestIsUnknown ? null : normalizeInternationalPhone(guestContactCache.phone),
                guest_email: checkoutGuestIsUnknown ? null : guestContactCache.email.trim(),
              }
        const res = await fetch('/api/proxy/pos/cart/sync-customer-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          showMsg(String(json?.message ?? 'Unable to update cart lines.'), 'error')
          return false
        }
        if (json?.data?.cart) {
          setCart(json.data.cart as Cart)
        }
        return true
      } catch {
        showMsg('Unable to update cart lines.', 'error')
        return false
      }
    },
    [checkoutGuestIsUnknown, guestContactCache.email, guestContactCache.name, guestContactCache.phone, showMsg],
  )

  const closeMemberPanel = () => {
    setMemberOpen(false)
    setMemberQuery('')
    setMembers([])
    setMemberDetail(null)
    setLookupMember(null)
    setMemberRecentOrders([])
    setMemberRecentOrdersMeta({ current_page: 1, last_page: 1, per_page: 5, total: 0 })
    setMemberActivePackages([])
    setMemberActivePackagesTotal(0)
    setMemberUpcomingAppointments([])
    setMemberUpcomingAppointmentsMeta({ current_page: 1, last_page: 1, per_page: 2, total: 0 })
    setMemberOrderViewId(null)
  }

  const openMemberQuickLookupPanel = async () => {
    setMemberOpen(true)
    setMemberQuery('')
    setMembers([])
    setMemberPage(1)
    setMemberLastPage(1)
    setLookupMember(null)
    setMemberDetail(null)
    setMemberRecentOrders([])
    setMemberRecentOrdersMeta({ current_page: 1, last_page: 1, per_page: 5, total: 0 })
    setMemberActivePackages([])
    setMemberActivePackagesTotal(0)
    setMemberUpcomingAppointments([])
    setMemberUpcomingAppointmentsMeta({ current_page: 1, last_page: 1, per_page: 2, total: 0 })
  }

  const openAssignMemberModal = (context: 'checkout' | 'service' | 'package') => {
    setAssignMemberContext(context)
    setPackageMemberPickerOpen(true)
    setPackageMemberQuery('')
    setPackageMembers([])
  }

  const onAssignMember = async (member: Member) => {
    const shouldRemoveCurrentVoucher = Boolean(appliedVoucher && !appliedVoucher.customer_voucher_id)
    if (shouldRemoveCurrentVoucher) {
      await removeVoucher(true)
    }
    setSelectedMember(member)
    if (checkoutConfirmationOpen) {
      setCheckoutIdentityMode('member')
    }
    setVoucherModalOpen(false)
    setSelectedVoucherKey('')
    showMsg('Member assigned.', 'success')
    await syncPosCartCustomerContext({ mode: 'member', memberId: member.id })
    await fetchMemberDetail(member.id, { page: 1 })
  }

  const hydrateMemberProfile = useCallback(async (member: Member): Promise<Member> => {
    try {
      const params = new URLSearchParams({ recent_orders_page: '1', recent_orders_per_page: '1', appointments_page: '1', appointments_per_page: '1' })
      const res = await fetch(`/api/proxy/pos/members/${member.id}?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) return member
      const payload = (json && typeof json === 'object' && 'data' in json)
        ? (json as { data?: { member?: MemberDetail } }).data
        : null
      const full = payload?.member
      if (!full) return member
      return {
        id: full.id,
        name: full.name,
        phone: full.phone ?? null,
        email: full.email ?? null,
        member_code: full.member_code ?? null,
        phone_masked: member.phone_masked ?? null,
      }
    } catch {
      return member
    }
  }, [])

  useEffect(() => {
    if (!selectedMember?.id) return
    if (selectedMember.phone && selectedMember.phone.trim()) return

    let cancelled = false
    const run = async () => {
      const hydrated = await hydrateMemberProfile(selectedMember)
      if (cancelled) return
      setSelectedMember((previous) => {
        if (!previous || previous.id !== hydrated.id) return previous
        return {
          ...previous,
          name: hydrated.name || previous.name,
          phone: hydrated.phone ?? previous.phone ?? null,
          email: hydrated.email ?? previous.email ?? null,
          member_code: hydrated.member_code ?? previous.member_code ?? null,
        }
      })
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [hydrateMemberProfile, selectedMember])

  /** Product-only: clear optional member + guest fields (same layout as booking services + Clear) */
  const clearOptionalProductSaleContext = useCallback(async () => {
    const shouldRemoveCurrentVoucher = Boolean(appliedVoucher && !appliedVoucher.customer_voucher_id)
    if (shouldRemoveCurrentVoucher) {
      await removeVoucher(true)
    }
    setSelectedMember(null)
    setGuestContactCache({ name: '', phone: '', email: '' })
    setCheckoutIdentityMode('member')
    setCheckoutError(null)
    showMsg('Customer details cleared.', 'info')
  }, [appliedVoucher, removeVoucher, showMsg])

  useEffect(() => {
    if (!voucherModalOpen) return
    void fetchVouchers(selectedMember?.id ?? null)
  }, [fetchVouchers, selectedMember?.id, voucherModalOpen])

  useEffect(() => {
    if (!voucherModalOpen) return
    if (!appliedVoucher) {
      setSelectedVoucherKey('')
      return
    }

    if (appliedVoucher.customer_voucher_id) {
      setSelectedVoucherKey(String(appliedVoucher.customer_voucher_id))
      return
    }

    if (appliedVoucher.id) {
      setSelectedVoucherKey(String(appliedVoucher.id))
    }
  }, [appliedVoucher, voucherModalOpen])

  const onSelectQrProof: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (qrProofPreviewUrl) {
      URL.revokeObjectURL(qrProofPreviewUrl)
    }

    const url = URL.createObjectURL(file)
    setQrProofFile(file)
    setQrProofFileName(file.name)
    setQrProofPreviewUrl(url)
    event.currentTarget.value = ''
  }

  const clearQrProof = () => {
    if (qrProofPreviewUrl) {
      URL.revokeObjectURL(qrProofPreviewUrl)
    }
    setQrProofFile(null)
    setQrProofPreviewUrl(null)
    setQrProofFileName(null)
  }

  const getStaffInputLabel = (staff: StaffOption) => {
    const name = String(staff.name ?? '').trim()
    const phone = String(staff.phone ?? '').trim()
    return phone ? `${name} (${phone})` : name
  }

  const getStaffDropdownPrimary = (staff: StaffOption) => getStaffInputLabel(staff)

  const getSplitSummary = (assignment: CheckoutItemAssignment | undefined) => {
    if (!assignment || assignment.splits.length === 0) return 'No staff assigned'
    const total = assignment.splits.reduce((sum, row) => sum + row.share_percent, 0)
    if (assignment.is_default && assignment.splits.length === 1 && total === 100) {
      return 'Default (100%)'
    }
    return `${assignment.splits.length} staff (${total}%)`
  }

  const getSettlementWorkerSummary = useCallback((settlement: AppointmentSettlementCartItem) => {
    const splitSummary = formatSettlementStaffLabel(settlement)
    return splitSummary === '—' ? 'Staff: —' : `Staff: ${splitSummary}`
  }, [formatSettlementStaffLabel])

  const createDraftRow = (seed?: Partial<CheckoutItemSplitDraft>): CheckoutItemSplitDraft => ({
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    staff_id: seed?.staff_id ?? null,
    share_percent: seed?.share_percent ?? 0,
    search: seed?.search ?? '',
    options: seed?.options ?? activeStaffs,
    loading: false,
    open: false,
  })

  const validateSplitDraft = (rows: CheckoutItemSplitDraft[]) => {
    if (rows.length === 0) return { valid: false, error: 'Please add at least one staff row.' }

    const ids = new Set<number>()
    let total = 0
    for (const row of rows) {
      if (!row.staff_id || row.staff_id <= 0) return { valid: false, error: 'Please select staff for every row.' }
      if (ids.has(row.staff_id)) return { valid: false, error: 'Duplicate staff is not allowed.' }
      ids.add(row.staff_id)
      if (!Number.isInteger(row.share_percent) || row.share_percent < 0 || row.share_percent > 100) {
        return { valid: false, error: 'Share % must be an integer between 0 and 100.' }
      }
      total += row.share_percent
    }
    if (total !== 100) return { valid: false, error: 'Total share must be exactly 100%.' }

    return { valid: true, error: null as string | null }
  }

  const syncCheckoutAssignments = useCallback(async () => {
    if (!cartItems.length) {
      setCheckoutItemAssignments([])
      return
    }

    let baseStaffs = activeStaffs
    if (!baseStaffs.length) {
      const fetched = await fetchStaffOptions('')
      baseStaffs = fetched
      setActiveStaffs(fetched)
    }

    setCheckoutItemAssignments((prev) => cartItems.map((item) => {
      const existing = prev.find((x) => x.cart_item_id === item.id)
      if (existing) return existing
      const defaultStaffId = currentUser.staff_id ?? null
      return {
        cart_item_id: item.id,
        splits: defaultStaffId ? [{ staff_id: defaultStaffId, share_percent: 100 }] : [],
        is_default: Boolean(defaultStaffId),
      }
    }))
  }, [activeStaffs, cartItems, currentUser.staff_id, fetchStaffOptions])

  const openItemSplitEditor = async (cartItemId: number) => {
    let nextStaffs = activeStaffs
    if (!nextStaffs.length) {
      nextStaffs = await fetchStaffOptions('')
      setActiveStaffs(nextStaffs)
    }

    const assignment = checkoutItemAssignments.find((x) => x.cart_item_id === cartItemId)
    const rows = (assignment?.splits ?? []).map((split) => {
      const selected = nextStaffs.find((staff) => staff.id === split.staff_id)
      return createDraftRow({
        staff_id: split.staff_id,
        share_percent: split.share_percent,
         search: selected ? getStaffInputLabel(selected) : '',
        options: nextStaffs,
      })
    })

    setItemSplitDraftRows(rows.length ? rows : [createDraftRow({ options: nextStaffs, share_percent: 100 })])
    setItemSplitEditorTarget({ type: 'product', id: cartItemId })
    setItemSplitAutoBalance(true)
    setItemSplitError(null)
    setItemSplitEditorOpen(true)
  }



  const formatCheckoutSplitRows = (splits: CheckoutItemStaffSplit[]): string => {
    const rows = (splits ?? []).filter((split) => Number(split.staff_id) > 0 && Number(split.share_percent) > 0)
    if (!rows.length) return '—'

    return rows.map((split) => {
      const staff = activeStaffs.find((item) => item.id === Number(split.staff_id))
      return `${staff?.name ?? `Staff #${split.staff_id}`} (${Number(split.share_percent)}%)`
    }).join(' · ')
  }

  const formatLineSplitSummary = (lineKey: string, inheritedSplits: CheckoutItemStaffSplit[], inheritedLabel = 'main service') => {
    const explicitSplits = checkoutLineSplits[lineKey] ?? []
    if (explicitSplits.length > 0) return `Staff split: ${formatCheckoutSplitRows(explicitSplits)}`
    return `Staff split: inherited from ${inheritedLabel} — ${formatCheckoutSplitRows(inheritedSplits)}`
  }

  const openBulkSplitEditor = async (title: string, lineKeys: string[], inheritedSplits: CheckoutItemStaffSplit[] = [], productCartItemIds: number[] = [], packageItemIds: number[] = []) => {
    let nextStaffs = activeStaffs
    if (!nextStaffs.length) {
      nextStaffs = await fetchStaffOptions('')
      setActiveStaffs(nextStaffs)
    }

    const rows = inheritedSplits.map((split) => {
      const selected = nextStaffs.find((staff) => staff.id === split.staff_id)
      return createDraftRow({
        staff_id: split.staff_id,
        share_percent: split.share_percent,
        search: selected ? getStaffInputLabel(selected) : '',
        options: nextStaffs,
      })
    })

    setBulkSplitOverwrite(false)
    setItemSplitDraftRows(rows.length ? rows : [createDraftRow({ options: nextStaffs, share_percent: 100 })])
    setItemSplitEditorTarget({ type: 'bulk', id: 0, lineKeys: Array.from(new Set(lineKeys)), productCartItemIds, packageItemIds, title })
    setItemSplitAutoBalance(true)
    setItemSplitError(null)
    setItemSplitEditorOpen(true)
  }


  const openLineSplitEditor = async (lineKey: string, title: string, inheritedSplits: CheckoutItemStaffSplit[] = []) => {
    let nextStaffs = activeStaffs
    if (!nextStaffs.length) {
      nextStaffs = await fetchStaffOptions('')
      setActiveStaffs(nextStaffs)
    }

    const existingSplits = checkoutLineSplits[lineKey] ?? inheritedSplits
    const rows = existingSplits.map((split) => {
      const selected = nextStaffs.find((staff) => staff.id === split.staff_id)
      return createDraftRow({
        staff_id: split.staff_id,
        share_percent: split.share_percent,
        search: selected ? getStaffInputLabel(selected) : '',
        options: nextStaffs,
      })
    })

    setItemSplitDraftRows(rows.length ? rows : [createDraftRow({ options: nextStaffs, share_percent: 100 })])
    setItemSplitEditorTarget({ type: 'line', id: 0, lineKey, title })
    setItemSplitAutoBalance(true)
    setItemSplitError(null)
    setItemSplitEditorOpen(true)
  }

  const openPackageSplitEditor = async (packageItemId: number) => {
    let nextStaffs = activeStaffs
    if (!nextStaffs.length) {
      nextStaffs = await fetchStaffOptions('')
      setActiveStaffs(nextStaffs)
    }

    const existingSplits = packageCheckoutSplits[packageItemId] ?? []
    const rows = existingSplits.map((split) => {
      const selected = nextStaffs.find((staff) => staff.id === split.staff_id)
      return createDraftRow({
        staff_id: split.staff_id,
        share_percent: split.share_percent,
        search: selected ? getStaffInputLabel(selected) : '',
        options: nextStaffs,
      })
    })

    setItemSplitDraftRows(rows.length ? rows : [createDraftRow({ options: nextStaffs, share_percent: 100 })])
    setItemSplitEditorTarget({ type: 'package', id: packageItemId })
    setItemSplitAutoBalance(true)
    setItemSplitError(null)
    setItemSplitEditorOpen(true)
  }

  const openSettlementSplitEditor = async (settlement: AppointmentSettlementCartItem) => {
    let nextStaffs = activeStaffs
    if (!nextStaffs.length) {
      nextStaffs = await fetchStaffOptions('')
      setActiveStaffs(nextStaffs)
    }

    const rows = (settlement.staff_splits ?? [])
      .map((split) => {
        const staffId = Number(split.staff_id)
        const sharePercent = Number(split.share_percent)
        if (staffId <= 0 || sharePercent <= 0) return null
        const selected = nextStaffs.find((staff) => staff.id === staffId)
        return createDraftRow({
          staff_id: staffId,
          share_percent: sharePercent,
          search: selected ? getStaffInputLabel(selected) : (split.staff_name ?? ''),
          options: nextStaffs,
        })
      })
      .filter((row): row is CheckoutItemSplitDraft => row != null)

    setItemSplitDraftRows(rows.length ? rows : [createDraftRow({ options: nextStaffs, share_percent: 100 })])
    setItemSplitEditorTarget({ type: 'settlement', id: settlement.id })
    setItemSplitAutoBalance(true)
    setItemSplitError(null)
    setItemSplitEditorOpen(true)
  }

  const setDraftRowSearch = (rowId: string, value: string) => {
    setItemSplitDraftRows((prev) => prev.map((row) => row.id === rowId ? { ...row, search: value, loading: true, open: true } : row))
    if (staffSearchTimerRef.current[rowId]) clearTimeout(staffSearchTimerRef.current[rowId])
    staffSearchTimerRef.current[rowId] = setTimeout(async () => {
      const options = await fetchStaffOptions(value)
      setItemSplitDraftRows((prev) => prev.map((row) => row.id === rowId ? { ...row, loading: false, options, open: true } : row))
    }, 300)
  }

  const selectDraftRowStaff = (rowId: string, staff: StaffOption) => {
    setItemSplitDraftRows((prev) => prev.map((row) => row.id === rowId ? { ...row, staff_id: staff.id, search: getStaffInputLabel(staff), open: false } : row))
  }

  const saveItemSplitEditor = () => {
    const validation = validateSplitDraft(itemSplitDraftRows)
    if (!validation.valid) {
      setItemSplitError(validation.error)
      return
    }

    if (!itemSplitEditorTarget) return

    const mappedSplits = itemSplitDraftRows.map((row) => ({ staff_id: row.staff_id!, share_percent: row.share_percent }))

    if (itemSplitEditorTarget.type === 'product') {
      setCheckoutItemAssignments((prev) => prev.map((assignment) => {
        if (assignment.cart_item_id !== itemSplitEditorTarget.id) return assignment
        return {
          ...assignment,
          is_default: false,
          splits: mappedSplits,
        }
      }))
    } else if (itemSplitEditorTarget.type === 'package') {
      setPackageCheckoutSplits((prev) => ({
        ...prev,
        [itemSplitEditorTarget.id]: mappedSplits,
      }))
    } else if (itemSplitEditorTarget.type === 'line' && itemSplitEditorTarget.lineKey) {
      setCheckoutLineSplits((prev) => ({ ...prev, [itemSplitEditorTarget.lineKey!]: mappedSplits }))
    } else if (itemSplitEditorTarget.type === 'bulk') {
      const lineKeys = itemSplitEditorTarget.lineKeys ?? []
      setCheckoutLineSplits((prev) => {
        const next = { ...prev }
        lineKeys.forEach((key) => {
          if (bulkSplitOverwrite || !next[key]?.length) next[key] = mappedSplits
        })
        return next
      })
      if (itemSplitEditorTarget.productCartItemIds?.length) {
        const productIds = new Set(itemSplitEditorTarget.productCartItemIds)
        setCheckoutItemAssignments((prev) => prev.map((assignment) => (
          productIds.has(assignment.cart_item_id) && (bulkSplitOverwrite || !assignment.splits?.length)
            ? { ...assignment, is_default: false, splits: mappedSplits }
            : assignment
        )))
      }
      if (itemSplitEditorTarget.packageItemIds?.length) {
        const packageIds = new Set(itemSplitEditorTarget.packageItemIds)
        setPackageCheckoutSplits((prev) => {
          const next = { ...prev }
          packageIds.forEach((id) => {
            if (bulkSplitOverwrite || !next[id]?.length) next[id] = mappedSplits
          })
          return next
        })
      }
    } else {
      setCart((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          appointment_settlement_items: (prev.appointment_settlement_items ?? []).map((settlement) => {
            if (settlement.id !== itemSplitEditorTarget.id) return settlement
            return {
              ...settlement,
              staff_splits: mappedSplits.map((split) => ({
                staff_id: split.staff_id,
                share_percent: split.share_percent,
                staff_name: activeStaffs.find((staff) => staff.id === split.staff_id)?.name ?? null,
              })),
            }
          }),
        }
      })
    }

    setItemSplitEditorOpen(false)
    setItemSplitEditorTarget(null)
  }

  const onAddDraftSplitRow = () => {
    setItemSplitDraftRows((prev) => {
      const next = [...prev, createDraftRow({ options: activeStaffs, share_percent: 0 })]
      if (!itemSplitAutoBalance) return next
      if (next.length <= 1) return next
      const othersTotal = next.slice(1).reduce((sum, row) => sum + Math.max(0, row.share_percent), 0)
      return next.map((row, idx) => (idx === 0 ? { ...row, share_percent: Math.max(0, 100 - othersTotal) } : row))
    })
    setItemSplitError(null)
  }

  const onRemoveDraftSplitRow = (rowId: string) => {
    setItemSplitDraftRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId)
      if (!itemSplitAutoBalance || next.length <= 1) return next
      const othersTotal = next.slice(1).reduce((sum, row) => sum + Math.max(0, row.share_percent), 0)
      return next.map((row, idx) => (idx === 0 ? { ...row, share_percent: Math.max(0, 100 - othersTotal) } : row))
    })
    setItemSplitError(null)
  }

  const onChangeDraftShare = (rowId: string, rawValue: number) => {
    const nextValue = Math.max(0, Math.min(100, Math.round(rawValue || 0)))
    setItemSplitError(null)

    setItemSplitDraftRows((prev) => {
      if (!itemSplitAutoBalance) {
        return prev.map((row) => row.id === rowId ? { ...row, share_percent: nextValue } : row)
      }

      const primary = prev[0]
      if (!primary) return prev
      if (primary.id === rowId) return prev

      const next = prev.map((row) => row.id === rowId ? { ...row, share_percent: nextValue } : row)
      const othersTotal = next.slice(1).reduce((sum, row) => sum + row.share_percent, 0)
      const primaryShare = 100 - othersTotal
      if (primaryShare < 0) {
        setItemSplitError('Total share cannot exceed 100% when Auto Balance is on.')
        return prev
      }

      next[0] = { ...next[0], share_percent: primaryShare }
      return next
    })
  }

  const openCheckoutConfirmation = async () => {
    setCheckoutError(null)
    await syncCheckoutAssignments()

    const guestLine = cartServiceItems.find(
      (row) => !row.customer_id && (row.guest_email?.trim() || row.guest_name?.trim()),
    )
    if (guestLine) {
      setGuestContactCache({
        name: String(guestLine.guest_name ?? '').trim(),
        phone: String(guestLine.guest_phone ?? '').trim(),
        email: String(guestLine.guest_email ?? '').trim(),
      })
      // Ensure stale member selection doesn't override guest checkout UI.
      setSelectedMember(null)
    }

    if (checkoutRequiresMemberOnly) {
      setCheckoutIdentityMode('member')
    } else if (checkoutAllowsGuestToggle || !checkoutRequiresCustomerValidation) {
      // If cart already has guest booking lines, default checkout to guest (avoid stale member selection).
      if (guestLine) {
        setCheckoutIdentityMode('guest')
      } else if (selectedMember?.id) {
        setCheckoutIdentityMode('member')
      } else if (guestContactCache.email.trim() && guestContactCache.name.trim()) {
        setCheckoutIdentityMode('guest')
      } else {
        setCheckoutIdentityMode('member')
      }
    }

    setPackageCheckoutSplits((prev) => {
      const next: Record<number, CheckoutItemStaffSplit[]> = {}
      const defaultStaffId = currentUser.staff_id ?? activeStaffs[0]?.id ?? null
      for (const pkg of cartPackageItems) {
        const existing = prev[pkg.id]
        if (existing && existing.length > 0) {
          next[pkg.id] = existing
          continue
        }
        next[pkg.id] = defaultStaffId ? [{ staff_id: defaultStaffId, share_percent: 100 }] : []
      }
      return next
    })

    setSplitPaymentAmounts({ cash: cartTotal > 0 ? cartTotal.toFixed(2) : '', qrpay: '', credit_card: '' })
    setCheckoutConfirmationOpen(true)
  }

  const canConfirmCheckoutInModal = useMemo(() => {
    if (checkingOut) return false
    if (!splitPaymentValid) return false

    if (checkoutRequiresCustomerValidation) {
      if (checkoutRequiresMemberOnly) {
        if (!selectedMember?.id) return false
      } else if (checkoutAllowsGuestToggle) {
        if (checkoutIdentityMode === 'member') {
          if (!selectedMember?.id) return false
        } else if (!guestContactIsComplete && !checkoutGuestIsUnknown) {
          return false
        }
      }
    }

    return true
  }, [
    splitPaymentValid,
    checkingOut,
    checkoutAllowsGuestToggle,
    checkoutIdentityMode,
    checkoutRequiresMemberOnly,
    checkoutRequiresCustomerValidation,
    guestContactIsComplete,
    checkoutGuestIsUnknown,
    selectedMember?.id,
  ])

  const checkoutResultHasCashChange = Boolean(
    checkoutResult &&
      checkoutResult.payment_method === 'cash' &&
      checkoutResult.change_amount > 0 &&
      checkoutResult.paid_amount > checkoutResult.total,
  )

  const selectedModalVariant = useMemo(() => {
    if (!selectedProduct || selectedProduct.variants.length === 0) return null
    return selectedProduct.variants.find((variant) => variant.id === selectedVariantId) ?? null
  }, [selectedProduct, selectedVariantId])

  const selectedProductDisplayImage = useMemo(() => {
    if (!selectedProduct) return null

    const galleryImages = Array.isArray(fullProductData?.images) ? fullProductData.images : []
    const firstGalleryImage = galleryImages
      .map((image: { url?: string | null; image_path?: string | null } | null) =>
        getModalImageUrl(image?.url) || getModalImageUrl(image?.image_path),
      )
      .find((url: string | null): url is string => Boolean(url))

    return (
      getModalImageUrl(selectedModalVariant?.image_url) ||
      getModalImageUrl(selectedModalVariant?.image_path) ||
      getModalImageUrl(fullProductData?.main_image_url) ||
      getModalImageUrl(fullProductData?.cover_image_url) ||
      getModalImageUrl(fullProductData?.image_url) ||
      getModalImageUrl(selectedProduct.main_image_url) ||
      getModalImageUrl(selectedProduct.cover_image_url) ||
      getModalImageUrl(selectedProduct.image_url) ||
      firstGalleryImage ||
      getModalImageUrl(selectedProduct.thumbnail_url) ||
      null
    )
  }, [fullProductData, selectedModalVariant, selectedProduct])

  return (
    <div className="min-h-screen space-y-4 bg-gray-50 p-3 sm:space-y-5 sm:p-4 lg:space-y-6 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">POS Checkout</h2>
          <p className="mt-2 flex flex-col gap-1.5 text-sm text-gray-600 sm:flex-row sm:items-start sm:gap-2">
            <span className="inline-flex shrink-0 items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span className="font-medium">Barcode Listener Active</span>
            </span>
            <span className="min-w-0 text-pretty text-gray-600">
              System listens for barcode scans; scan items to add them to the cart automatically.
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {/* <Link
            href="/pos/appointments"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
          >
            Appointments
          </Link> */}
          <button
            type="button"
            onClick={() => void openMemberQuickLookupPanel()}
            className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            Member Quick Lookup
          </button>
        </div>
      </div>

      <div className="pos-split-layout grid min-w-0 grid-cols-1 gap-5">
        <div className="pos-split-catalog min-w-0 space-y-5">
          {/* Hidden barcode scanner input for listening */}
          <input
            ref={scannerInputRef}
            type="text"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void onScannerEnter()
              }
            }}
            className="sr-only"
            autoFocus
          />

          {/* Products / Services Section */}
          <div className="@container pos-split-panel flex min-h-[420px] w-full min-w-0 max-w-full flex-col rounded-xl border-2 border-gray-200 bg-white p-4 shadow-md sm:p-6">
            <h3 className="mb-5 text-xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              POS Catalog
              {catalogTab === 'products' && productLoading && (
                <svg className="h-4 w-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              )}
            </h3>

            <div className="mb-4 flex max-w-full flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setCatalogTab('products')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${catalogTab === 'products' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                PRODUCTS
              </button>
              <button
                type="button"
                onClick={() => setCatalogTab('booking-products')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${catalogTab === 'booking-products' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                BOOKING PRODUCTS
              </button>
              <button
                type="button"
                onClick={() => setCatalogTab('book-service')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${catalogTab === 'book-service' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                BOOK SERVICE
              </button>
              <button
                type="button"
                onClick={() => setCatalogTab('service-packages')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${catalogTab === 'service-packages' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                SERVICE PACKAGES
              </button>
              <button
                type="button"
                onClick={() => {
                  setCatalogTab('settlement')
                  void fetchUnpaidCompletedAppointments(settlementQuery)
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${catalogTab === 'settlement' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                SETTLEMENT
              </button>
            </div>

            {catalogTab === 'products' ? (
              <>
            
            {/* Search + Category Filters */}
            <div className="mb-5 min-w-0 space-y-3">
              <div className="grid min-w-0 gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => setProductSearchMode('name')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${productSearchMode === 'name' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Search Name
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductSearchMode('barcode')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${productSearchMode === 'barcode' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Search Barcode
                  </button>
                </div>

                <div className="relative">
                  <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 pl-10 pr-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder={
                      productSearchMode === 'name'
                        ? 'Search by product name or Chinese name'
                        : 'Search by product barcode'
                    }
                  />
                </div>
              </div>

              <div className="min-w-0 border-b border-gray-200 pb-2">
                <div className="-mx-1 flex min-w-0 flex-nowrap items-start gap-2 overflow-x-auto overflow-y-hidden px-1 pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(null)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-left transition-all ${showProductCategoryCnLine ? 'flex min-h-[2.5rem] flex-col items-start justify-start' : ''} ${selectedCategoryId === null ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    <ServiceNameStack
                      name="All"
                      cnName={showProductCategoryCnLine ? '全部' : null}
                      reserveSecondaryLine={showProductCategoryCnLine}
                      primaryClassName={`text-left text-xs font-semibold leading-tight ${selectedCategoryId === null ? 'text-white' : 'text-gray-700'}`}
                      secondaryClassName={`mt-0.5 text-left text-[10px] leading-tight ${selectedCategoryId === null ? 'text-white/80' : 'text-gray-500'}`}
                    />
                  </button>
                  {categories.map((category) => {
                    const isActive = selectedCategoryId === category.id

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`flex shrink-0 flex-col items-start justify-start rounded-full px-3 py-1.5 text-left transition-all ${showProductCategoryCnLine ? 'min-h-[2.5rem]' : ''} ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        <ServiceNameStack
                          name={category.name}
                          cnName={category.cn_name}
                          reserveSecondaryLine={showProductCategoryCnLine}
                          primaryClassName={`text-left text-xs font-semibold leading-tight ${isActive ? 'text-white' : 'text-gray-700'}`}
                          secondaryClassName={`mt-0.5 text-left text-[10px] leading-tight ${isActive ? 'text-white/80' : 'text-gray-500'}`}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Products Grid */}
            <div ref={productsGridRef} className="pos-split-product-grid grid min-h-[260px] min-w-0 flex-1 auto-rows-max content-start grid-cols-1 gap-3 overflow-auto p-1 @min-[640px]:grid-cols-2">
              {visibleProductHits.map((hit, idx) => {
                const item = hit.product
                const displaySku = hit.matchedVariantSku || item.sku || firstActiveVariantSku(item) || '-'
                const variantsCount = item.variants_count ?? item.variants.length
                const titleWithVariant = hit.matchedVariantName ? `${item.name} (${hit.matchedVariantName})` : item.name
                const catalogCardOutOfStock = isPosSimpleProductOutOfStock(item)

                return (
                <div
                  key={item.product_id}
                  role="button"
                  tabIndex={0}
                  className={`group cursor-pointer overflow-hidden rounded-xl border-2 bg-white transition-all shadow-sm flex flex-row h-[124px] ${idx === productHighlighted ? 'border-blue-500 shadow-lg ring-2 ring-blue-500/20' : catalogCardOutOfStock ? 'border-red-100 opacity-90' : 'border-gray-200 hover:border-blue-400 hover:shadow-lg'}`}
                  onMouseEnter={() => setProductHighlighted(idx)}
                  onClick={() => {
                    void onSelectProduct(item, hit.matchedVariantId ?? null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      void onSelectProduct(item, hit.matchedVariantId ?? null)
                    }
                  }}
                >
                  {/* Product Image - Left Side */}
                  <div className="w-[120px] h-full bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden flex-shrink-0">
                    {item.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnail_url} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                        <svg className="h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Product Info - Right Side */}
                  <div className="flex flex-col flex-1 p-4 bg-white min-h-0 justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-tight text-gray-900 line-clamp-2 mb-1" title={titleWithVariant}>{titleWithVariant}</p>
                      {item.cn_name ? <p className="text-xs text-gray-500 line-clamp-1">{item.cn_name}</p> : null}
                      <p className="text-xs text-gray-500 font-mono truncate">{displaySku}</p>
                      {catalogCardOutOfStock && (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-red-600">
                          Out of stock
                        </p>
                      )}
                      {variantsCount > 0 && (
                        <p className="text-[11px] text-blue-600 font-medium mt-0.5">({variantsCount} variants)</p>
                      )}
                      {item.is_staff_free && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                            Consumable
                          </span>
                          {currentUser.staff_id ? (
                            <span className="text-[10px] text-emerald-700">Free for staff</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-sm font-bold text-gray-900">RM {Number(item.price ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )})}

              {!productLoading && visibleProductHits.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-2 text-4xl">📦</div>
                  <p className="text-sm font-medium text-gray-600">No products found</p>
                  <p className="mt-1 text-xs text-gray-500">Try adjusting your search</p>
                </div>
              )}

              {productLoading && visibleProductHits.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-gray-500">Loading products...</div>
              )}
            </div>

            {/* Pagination */}
            {visibleProductHits.length > 0 && productPage < productLastPage && (
              <div className="mt-4 flex items-center justify-end border-t pt-4">
                <button
                  className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:bg-white disabled:hover:text-gray-700"
                  disabled={productLoading}
                  onClick={() => void fetchProductPage(productPage + 1, effectiveServerProductQuery, true, { categoryId: selectedCategoryId })}
                >
                  {productLoading ? (
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </div>
                  ) : (
                    `View More (${productPage + 1}/${productLastPage})`
                  )}
                </button>
              </div>
            )}
              </>
            ) : catalogTab === 'booking-products' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Active booking products from Booking module.</p>
                  {bookingProductsLoading && <span className="text-xs text-blue-600">Loading...</span>}
                </div>
                <div className="mb-5 space-y-3">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      value={bookingProductQuery}
                      onChange={(e) => setBookingProductQuery(e.target.value)}
                      className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 pl-10 pr-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="Search by booking product name"
                    />
                  </div>
                  <div className="border-b border-gray-200 pb-2">
                    <div className="flex flex-nowrap items-start gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                      <button
                        type="button"
                        onClick={() => setSelectedBookingProductCategoryId(null)}
                        className={`flex shrink-0 flex-col items-start justify-start rounded-full px-3 py-1.5 text-left transition-all ${showBookingProductCategoryCnLine ? 'min-h-[2.5rem]' : ''} ${selectedBookingProductCategoryId === null ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        <ServiceNameStack
                          name="All"
                          cnName={showBookingProductCategoryCnLine ? '全部' : null}
                          reserveSecondaryLine={showBookingProductCategoryCnLine}
                          primaryClassName={`text-left text-xs font-semibold leading-tight ${selectedBookingProductCategoryId === null ? 'text-white' : 'text-gray-700'}`}
                          secondaryClassName={`mt-0.5 text-left text-[10px] leading-tight ${selectedBookingProductCategoryId === null ? 'text-white/80' : 'text-gray-500'}`}
                        />
                      </button>
                      {bookingProductCategories.map((category) => {
                        const isSelected = selectedBookingProductCategoryId === category.id
                        return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => setSelectedBookingProductCategoryId(category.id)}
                          className={`flex shrink-0 flex-col items-start justify-start rounded-full px-3 py-1.5 text-left transition-all ${showBookingProductCategoryCnLine ? 'min-h-[2.5rem]' : ''} ${isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          <ServiceNameStack
                            name={category.name}
                            cnName={category.cn_name}
                            reserveSecondaryLine={showBookingProductCategoryCnLine}
                            primaryClassName={`text-left text-xs font-semibold leading-tight ${isSelected ? 'text-white' : 'text-gray-700'}`}
                            secondaryClassName={`mt-0.5 text-left text-[10px] leading-tight ${isSelected ? 'text-white/80' : 'text-gray-500'}`}
                          />
                        </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 @min-[520px]:grid-cols-2 @min-[820px]:grid-cols-3">
                  {filteredBookingProducts.map((item) => (
                    <button key={item.id} type="button" onClick={() => { const activeQuestions = (item.questions ?? []).filter((q) => q.is_active !== false && Array.isArray(q.options) && q.options.some((o) => o.is_active !== false)); if (activeQuestions.length === 0 && item.price_mode !== 'range') { void addBookingProductToCart(item); } else { setBookingProductDraft({ ...item, questions: activeQuestions }); setBookingProductOptionModalOpen(true); } }} className="rounded-lg border border-gray-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50/30">
                      <div className="flex items-start gap-3">
                        {item.image_url ? <img src={item.image_url} alt={item.name} className="h-12 w-12 rounded object-cover border" /> : <div className="h-12 w-12 rounded border bg-gray-100" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                          {item.cn_name ? <p className="truncate text-xs text-gray-500">{item.cn_name}</p> : null}
                          <p className="text-xs text-gray-500">{item.barcode ? `SKU: ${item.barcode}` : (item.category?.name ?? '-')}</p>
                          <p className="mt-1 text-sm font-bold text-blue-700">{formatBookingProductCatalogPrice(item)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {!bookingProductsLoading && filteredBookingProducts.length === 0 && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    No booking products found.
                  </div>
                )}
              </div>
            ) : catalogTab === 'book-service' ? (
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <BookingServicePicker
                  categories={bookingServiceCategories}
                  services={filteredServices}
                  selectedCategoryId={selectedBookingServiceCategoryId}
                  onCategoryChange={setSelectedBookingServiceCategoryId}
                  searchQuery={serviceQuery}
                  onSearchQueryChange={setServiceQuery}
                  onSelectService={(service) => void openBookingModal(service as BookingServiceOption)}
                  loading={servicesLoading}
                  emptyMessage="No services found."
                  searchPlaceholder="Search service name..."
                />
              </div>
            ) : catalogTab === 'service-packages' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-4">
                  <input
                    value={packageQuery}
                    onChange={(e) => setPackageQuery(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Search service packages"
                  />
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {servicePackagesLoading ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">Loading packages...</div>
                  ) : filteredServicePackages.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">No service packages available</div>
                  ) : (
                    filteredServicePackages.map((servicePackage) => (
                      <div key={servicePackage.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{servicePackage.name}</p>
                          {servicePackage.description ? (
                            <p className="mt-1 text-xs text-gray-600 line-clamp-2">{servicePackage.description}</p>
                          ) : null}
                          <p className="text-xs text-gray-500">Validity: {Number(servicePackage.valid_days ?? 0) > 0 ? `${servicePackage.valid_days} day(s)` : 'No expiry'}</p>
                          {servicePackage.items_summary && servicePackage.items_summary.length > 0 ? (
                            <div className="mt-1 space-y-0.5">
                              {servicePackage.items_summary.map((summary, idx) => (
                                <p key={`${servicePackage.id}-${idx}`} className="text-xs text-gray-500">{summary}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-sm font-bold text-gray-900">RM {Number(servicePackage.selling_price ?? 0).toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => void openPackageModal(servicePackage)}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Add Package
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : catalogTab === 'settlement' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-4 flex items-center gap-2">
                  <input
                    value={settlementQuery}
                    onChange={(e) => setSettlementQuery(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Search booking no / customer / service"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void fetchUnpaidCompletedAppointments(settlementQuery)
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void fetchUnpaidCompletedAppointments(settlementQuery)}
                    className="shrink-0 rounded-lg border-2 border-gray-300 bg-white px-3 py-3 text-xs font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700"
                    title="Refresh unpaid completed appointments"
                  >
                    Refresh
                  </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {settlementLoading ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">Loading unpaid completed appointments...</div>
                  ) : settlementAppointments.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">No completed unpaid appointments found.</div>
                  ) : (
                    settlementAppointments.map((appt) => {
                      const due = Number(appt.amount_due_now ?? appt.balance_due ?? 0)
                      const isRangeAppt =
                        'requires_settled_amount' in (appt as Record<string, unknown>) &&
                        (appt as { requires_settled_amount?: boolean | null }).requires_settled_amount === true
                      const serviceLabel = Array.isArray(appt.service_names) && appt.service_names.length
                        ? appt.service_names.join(', ')
                        : ''
                      const serviceCnLabel = Array.isArray(appt.service_cn_names) && appt.service_cn_names.length
                        ? appt.service_cn_names.join(', ')
                        : ''
                      const addonList = Array.isArray(appt.add_ons) ? appt.add_ons : []
                      const apptCustomerId = Number(appt.customer_id ?? 0)
                      const lockedId = settlementLockedCustomerId ?? null
                      const isLockedMismatchById = Boolean(lockedId && apptCustomerId && lockedId !== apptCustomerId)
                      const lockedName = (cartAppointmentSettlementItems[0]?.customer_name ?? '').trim()
                      const apptName = String(appt.customer_name ?? '').trim()
                      const isLockedMismatchByName = Boolean(lockedId && lockedName && apptName && lockedName !== apptName)
                      const isLockedMismatch = isLockedMismatchById || isLockedMismatchByName
                      const cartHasGuestContext = cartServiceItems.some((row) => !row.customer_id && Boolean(row.guest_email?.trim() || row.guest_name?.trim()))
                      const disableSettlementAdd = isLockedMismatch || cartHasGuestContext
                      const disableReason = isLockedMismatch
                        ? 'Different member. Remove current settlement to change.'
                        : cartHasGuestContext
                          ? 'Guest checkout in cart. Settlement requires member; remove guest items or clear guest details first.'
                          : ''
                      const guestContactLines = getGuestContactLines(appt)

                      return (
                        <div key={appt.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {String(appt.booking_code ?? `BOOKING-${appt.id}`)}
                              {/* {serviceLabel ? <span className="text-gray-400"> · </span> : null}
                              {serviceLabel ? <span className="text-gray-700">{serviceLabel}</span> : null} */}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-gray-500">
                              {String(appt.customer_name ?? '-')}
                              {appt.staff_name ? <span className="text-gray-300"> · </span> : null}
                              {appt.staff_name ? <span>{String(appt.staff_name)}</span> : null}
                            </p>
                            {guestContactLines.length > 0 ? (
                              <p className="mt-0.5 truncate text-xs text-gray-500">{guestContactLines.join(' · ')}</p>
                            ) : null}
                            {appt.appointment_start_at ? (
                              <p className="mt-1 text-[11px] text-gray-500">
                                Time: {formatDateTimeRange(appt.appointment_start_at, appt.appointment_end_at)}
                              </p>
                            ) : null}
                            {serviceLabel ? (
                              <div className="mt-1 text-[11px] text-gray-600">
                                <p>Service: {serviceLabel}</p>
                                {serviceCnLabel ? <p className="text-gray-500">{serviceCnLabel}</p> : null}
                              </div>
                            ) : null}
                            {addonList.length > 0 ? (
                              <p className="mt-1 text-[11px] text-gray-600">
                                Add-ons: {addonList.map((a) => a?.name).filter(Boolean).join(', ')}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-sm font-bold text-gray-900">
                              {isRangeAppt
                                ? `RM ${Number(
                                    ('service_price_range_min' in (appt as Record<string, unknown>)
                                      ? (appt as { service_price_range_min?: number | string | null }).service_price_range_min
                                      : 0) ?? 0,
                                  ).toFixed(2)} - ${Number(
                                    ('service_price_range_max' in (appt as Record<string, unknown>)
                                      ? (appt as { service_price_range_max?: number | string | null }).service_price_range_max
                                      : 0) ?? 0,
                                  ).toFixed(2)}`
                                : `RM ${Number.isFinite(due) ? due.toFixed(2) : '0.00'}`}
                            </span>
                            <button
                              type="button"
                              disabled={disableSettlementAdd}
                              onClick={() => void addAppointmentSettlementToCart(appt.id)}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${disableSettlementAdd ? 'cursor-not-allowed bg-gray-300' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                              Add to Cart
                            </button>
                            {disableSettlementAdd && disableReason ? (
                              <p className="max-w-[220px] text-right text-[11px] text-amber-700">{disableReason}</p>
                            ) : null}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>


        <div className="pos-split-cart min-w-0 space-y-5">

            <div className="pos-split-panel flex min-h-[420px] w-full min-w-0 max-w-full flex-col rounded-xl border-2 border-gray-200 bg-white p-4 shadow-md sm:p-5">
              <>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 flex-shrink-0">
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Shopping Cart
            </h3>
            {hasCartItems ? (
              <div className="pos-split-cart-scroll mt-3 min-h-[220px] flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
                {cartItems.map((item) => {
                  // Get current variant stock info
                  const currentVariant = item.variant_id 
                    ? (cartVariantOptions[item.id] ?? []).find(v => v.id === item.variant_id)
                    : null
                  
                  const trackStock = currentVariant?.track_stock ?? null
                  const stockValue = typeof currentVariant?.stock === 'number' && Number.isFinite(currentVariant.stock)
                    ? currentVariant.stock
                    : null
                  
                  const hasStockLimit = (trackStock ?? true) && stockValue !== null && stockValue >= 0
                  const canIncreaseQty = !hasStockLimit || (stockValue !== null && item.qty < stockValue)
                  const isBookingProduct = item.item_type === 'BOOKING_PRODUCT'
                  const selectedBookingProductOptions = getBookingProductSelectedOptions(item)
                  const bookingProductBaseLineTotal = getBookingProductBaseLineTotal(item, selectedBookingProductOptions)
                  const bookingProductBaseDiscountTotal = Math.max(0, Number(item.discount_amount ?? 0))
                  const bookingProductBaseNetLineTotal = Math.max(0, bookingProductBaseLineTotal - bookingProductBaseDiscountTotal)
                  const bookingProductTotalGrossLineTotal = Number(item.line_total_snapshot ?? item.line_total)
                  const bookingProductTotalNetLineTotal = Number(item.line_total)
                  
                  return (
                    <div key={item.id} className="rounded-xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-3 shadow-sm hover:shadow-md transition-shadow sm:p-4">
                      <div className="flex min-w-0 flex-col gap-3">
                        <div className="min-w-0">
                          {isBookingProduct ? (
                            <>
                              <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">TYPE: BOOKING PRODUCT</p>
                              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-800">Item</p>
                                <div className="mt-2 space-y-3 text-xs">
                                  <div className="flex items-start justify-between gap-3">
                                    <ServiceNameStack
                                      name={`1. ${item.product_name ?? 'Booking Product'}`}
                                      cnName={item.product_cn_name ?? null}
                                      primaryClassName="font-semibold text-gray-900"
                                      secondaryClassName="mt-0.5 text-[11px] text-gray-500"
                                    />
                                    <PosCartDiscountAmount gross={bookingProductBaseLineTotal} net={bookingProductBaseNetLineTotal} />
                                  </div>
                                  {selectedBookingProductOptions.map((opt, optIdx) => {
                                    const optionGross = getBookingProductOptionGrossLineTotal(item, opt)
                                    const optionNet = getBookingProductOptionNetLineTotal(item, opt)

                                    return (
                                      <div key={`cart-bp-opt-${item.id}-${opt.id ?? optIdx}`} className="flex items-start justify-between gap-3 pl-4">
                                        <ServiceNameStack
                                          name={`+ ${opt.label ?? 'Option'}`}
                                          cnName={opt.cn_label ?? null}
                                          primaryClassName="font-medium text-gray-800"
                                          secondaryClassName="mt-0.5 text-[11px] text-gray-500"
                                        />
                                        <PosCartDiscountAmount gross={optionGross} net={optionNet} />
                                      </div>
                                    )
                                  })}
                                </div>
                                <div className="mt-3 flex items-start justify-between gap-3 border-t border-blue-100 pt-2 text-xs font-bold text-blue-900">
                                  <span>Total booking product</span>
                                  <PosCartDiscountAmount
                                    gross={bookingProductTotalGrossLineTotal}
                                    net={bookingProductTotalNetLineTotal}
                                    className="shrink-0 text-right tabular-nums text-blue-900"
                                  />
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-bold break-words text-gray-900" title={item.product_name || undefined}>{item.product_name}</p>
                              {item.product_cn_name ? <p className="mt-0.5 text-xs text-gray-500">{item.product_cn_name}</p> : null}
                            </>
                          )}
                          {/* {item.promotion_applied ? (
                            <div className="mt-1.5">
                              <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                                Promo Applied: {item.promotion_name ?? 'Promotion'}
                              </span>
                              {item.promotion_summary || item.promotion_snapshot?.summary ? <p className="text-[10px] text-blue-700 mt-1">{item.promotion_summary ?? item.promotion_snapshot?.summary}</p> : null}
                            </div>
                          ) : null} */}
                          {item.is_staff_free_applied ? (
                            <div className="mt-1.5">
                              <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                Staff Free Applied
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex min-w-0 w-full flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray-100 pt-3 sm:border-t-0 sm:pt-0">
                          <div className="flex shrink-0 items-center gap-2 rounded-lg bg-gray-100 p-1">
                          <button
                            type="button"
                            title={item.qty <= 1 ? 'Remove item' : 'Decrease quantity'}
                            onClick={() => {
                              if (item.qty <= 1) {
                                void removeItem(item.id)
                                return
                              }
                              void updateQty(item.id, item.qty - 1)
                            }}
                            className="h-7 w-7 rounded-md border-2 border-gray-300 bg-white font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all active:scale-95"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-gray-900">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => void updateQty(item.id, item.qty + 1)} 
                            disabled={!canIncreaseQty}
                            className="h-7 w-7 rounded-md border-2 border-gray-300 bg-white font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-gray-100 disabled:hover:border-gray-200"
                          >+</button>
                        </div>
                          {!isBookingProduct ? (
                            <div className="min-w-0 flex-1 text-right tabular-nums sm:max-w-[11rem] sm:flex-none sm:text-right">
                              {item.promotion_applied && item.line_total_snapshot ? (
                                <div className="space-y-0.5">
                                  <p className="text-[11px] text-gray-500 line-through">RM {Number(item.line_total_snapshot).toFixed(2)}</p>
                                  <p className="text-sm font-bold text-orange-700">RM {Number(item.line_total).toFixed(2)}</p>
                                </div>
                              ) : item.is_staff_free_applied ? (
                                <div className="space-y-0.5">
                                  <p className="text-[11px] text-gray-500 line-through">
                                     RM {Number(item.line_total_snapshot ?? 0).toFixed(2)}
                                  </p>
                                  <p className="text-sm font-bold text-orange-700">RM {Number(item.line_total).toFixed(2)}</p>
                                </div>
                              ) : (item.discount_amount ?? 0) > 0 ? (
                                <div className="space-y-0.5">
                                  <p className="text-[11px] text-gray-500 line-through">RM {Number(item.line_total_snapshot ?? item.line_total).toFixed(2)}</p>
                                  <p className="text-sm font-bold text-orange-700">RM {Number(item.line_total).toFixed(2)}</p>
                                </div>
                              ) : (
                                <p className="text-sm font-bold text-orange-700">RM {Number(item.line_total).toFixed(2)}</p>
                              )}
                            </div>
                          ) : null}
                          <button 
                            type="button"
                            onClick={() => void removeItem(item.id)} 
                            className="ml-auto flex shrink-0 items-center justify-center rounded-md p-2 text-red-600 transition-colors hover:bg-red-50 sm:ml-0"
                            title="Remove item"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        {!!item.product_id && (item.variant_id || (cartVariantOptions[item.id]?.length ?? 0) > 0) ? (
                          <div className="mt-2 w-full min-w-0 border-t border-gray-100 pt-3 sm:border-t-0 sm:pt-0">
                            <PosCartVariantSelect
                              itemId={item.id}
                              variants={cartVariantOptions[item.id] ?? []}
                              loading={Boolean(cartVariantLoading[item.id])}
                              disabled={(cartVariantOptions[item.id] ?? []).length === 0 && !cartVariantLoading[item.id]}
                              selectedVariantId={item.variant_id}
                              fallbackName={item.variant_name}
                              fallbackCnName={item.variant_cn_name}
                              fallbackSku={item.variant_sku}
                              productName={item.product_name}
                              isOpen={openCartVariantItemId === item.id}
                              onToggle={() => {
                                setOpenCartVariantItemId((current) => (current === item.id ? null : item.id))
                              }}
                              onClose={() => setOpenCartVariantItemId(null)}
                              onOpen={() => {
                                if (item.variant_id) void fetchCartItemVariants(item)
                              }}
                              onSelect={(variantId) => {
                                setOpenCartVariantItemId(null)
                                void updateItemVariant(item, variantId)
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}

                {cartServiceItems.map((serviceItem) => {
                  const depMain = Number(serviceItem.deposit_contribution ?? 0)
                  const depAddonTotal = Number(serviceItem.deposit_addon_total ?? 0)
                  const depPayable = Number(
                    serviceItem.deposit_payable_total ?? depMain + depAddonTotal,
                  )
                  const identityLine = formatPosServiceCartIdentity(serviceItem, selectedMember)
                  const isPkgClaimed =
                    !!serviceItem.claimed_by_package ||
                    serviceItem.package_claim_status === 'reserved' ||
                    serviceItem.package_claim_status === 'consumed'
                  const depositBlocks = getPosServiceDepositBlocks(serviceItem)
                  const hasAddons = depositBlocks.some((block) => (block.add_ons ?? []).length > 0)
                  const staffSplitSummary = formatPosServiceStaffSplitSummary(serviceItem)
                  const mainCoveredByPkg = isPkgClaimed && depMain < 0.0001
                  const servicePackageDisabledReason = !selectedMember?.id
                    ? 'Package can only be applied for members.'
                    : (serviceAvailabilityMap[serviceItem.id] ?? 0) <= 0
                      ? 'No eligible package available.'
                      : null

                  return (
                  <div key={`service-${serviceItem.id}`} className="rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-3 shadow-sm sm:p-4">
                    <div className="border-b border-emerald-200/50 pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Type: Services</p>
                          {servicePackageDisabledReason && !isPkgClaimed ? (
                            <p className="mt-1 text-[10px] font-medium leading-tight text-amber-700">{servicePackageDisabledReason}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5 sm:shrink-0">
                          {isPkgClaimed || (serviceAvailabilityMap[serviceItem.id] ?? 0) > 0 ? (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${isPkgClaimed ? 'bg-emerald-100 text-emerald-800' : 'text-gray-500'}`}>
                              {(serviceAvailabilityMap[serviceItem.id] ?? 0) > 0 ? `Pkg bal. ${serviceAvailabilityMap[serviceItem.id] ?? 0}` : 'Package claimed'}
                            </span>
                          ) : null}
                          {serviceItem.package_claim_status === 'reserved' ? (
                            <button
                              type="button"
                              disabled={serviceUnclaimingIds[serviceItem.id] || serviceRedeemingIds[serviceItem.id]}
                              onClick={() => void unclaimServicePackage(serviceItem)}
                              className="rounded-lg border border-amber-400/90 bg-amber-50/90 px-3 py-1.5 text-[11px] font-semibold text-amber-950 shadow-sm transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {serviceUnclaimingIds[serviceItem.id] ? 'Releasing…' : 'Unclaim Package'}
                            </button>
                          ) : (
                            <span className="inline-flex items-center">
                              <button
                                type="button"
                                disabled={
                                  !!servicePackageDisabledReason ||
                                  serviceRedeemingIds[serviceItem.id] ||
                                  serviceUnclaimingIds[serviceItem.id] ||
                                  serviceItem.claimed_by_package ||
                                  serviceItem.package_claim_status === 'consumed'
                                }
                                title={servicePackageDisabledReason ?? undefined}
                                onClick={() => void redeemServiceItem(serviceItem)}
                                className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                  isPkgClaimed
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
                                    : 'border-emerald-400/80 bg-white text-emerald-800'
                                }`}
                              >
                                {serviceRedeemingIds[serviceItem.id]
                                  ? 'Reserving…'
                                  : isPkgClaimed
                                    ? 'Package applied'
                                    : 'Claim package'}
                              </button>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => void removeServiceItem(serviceItem.id)}
                            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 shadow-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-gray-600">
                      {serviceItem.start_at ? (
                        <p>Appointment: {formatDateTimeRange(serviceItem.start_at, serviceItem.end_at)}</p>
                      ) : null}
                      {serviceItem.assigned_staff_name ? (
                        <p>Staff: {serviceItem.assigned_staff_name}</p>
                      ) : null}
                      {identityLine ? (
                        <p>{identityLine}</p>
                      ) : null}
                    </div>
                    </div>

                    <div className="mt-3 rounded-lg bg-white/90 px-3 py-2.5 ring-1 ring-emerald-200/80">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Deposit Service</p>
                      <div className="mt-2 space-y-2 text-[11px]">
                        {depositBlocks.map((service, idx) => (
                          <div key={`dep-service-${serviceItem.id}-${service.linked_booking_service_id ?? service.id ?? idx}`} className={`space-y-1 rounded-md border-b border-gray-100 pb-2 last:border-b-0 last:pb-0 ${service.covered_by_package ? 'bg-emerald-50/80 px-2 py-1.5 ring-1 ring-emerald-100' : ''}`}>
                            <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-2 tabular-nums text-gray-800">
                              <span className="text-gray-500">{idx + 1}.</span>
                              <ServiceNameStack name={service.name} cnName={service.cn_name} primaryClassName="text-xs font-semibold text-gray-900" secondaryClassName="mt-0.5 text-[10px] text-gray-500" />
                              <div className="text-right"><PosDepositAmount amount={Number(service.deposit ?? 0)} referenceAmount={Number(service.reference_deposit ?? service.deposit ?? 0)} />{!service.covered_by_package && Number(service.deposit ?? 0) > 0.0001 ? <button type="button" onClick={() => openPriceEditModal({ kind: 'serviceDeposit', id: serviceItem.id, lineKey: service.line_key ?? 'main', name: service.name ?? 'Service deposit', currentUnitPrice: Number(service.deposit ?? 0), originalUnitPrice: Number(service.price_override?.original_unit_price ?? service.reference_deposit ?? service.deposit ?? 0) })} className="mt-1 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button> : null}</div>
                            </div>
                            {service.package_note ? (
                              <p className="pl-7 text-[10px] font-medium text-emerald-700">{service.package_note}</p>
                            ) : null}
                            {(service.add_ons ?? []).map((addon, addonIdx) => (
                              <div key={`dep-service-addon-${serviceItem.id}-${idx}-${addon.id ?? addonIdx}`} className={`space-y-0.5 rounded pl-5 ${addon.covered_by_package ? 'bg-emerald-50/80 py-1 pr-1 ring-1 ring-emerald-100' : ''}`}>
                                <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-2 tabular-nums text-gray-700">
                                  <span className="text-gray-500">+</span>
                                  <ServiceNameStack name={addon.name} cnName={addon.cn_name} primaryClassName="text-[11px] text-gray-700" secondaryClassName="mt-0.5 text-[10px] text-gray-500" />
                                  <div className="text-right"><PosDepositAmount amount={Number(addon.deposit ?? 0)} referenceAmount={Number(addon.reference_deposit ?? addon.deposit ?? 0)} />{!addon.covered_by_package && Number(addon.deposit ?? 0) > 0.0001 ? <button type="button" onClick={() => openPriceEditModal({ kind: 'serviceDeposit', id: serviceItem.id, lineKey: addon.line_key ?? `addon:${Number(addon.id ?? 0)}`, name: addon.name ?? 'Service add-on deposit', currentUnitPrice: Number(addon.deposit ?? 0), originalUnitPrice: Number(addon.price_override?.original_unit_price ?? addon.reference_deposit ?? addon.deposit ?? 0) })} className="mt-1 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button> : null}</div>
                                </div>
                                {addon.package_note ? (
                                  <p className="pl-7 text-[10px] font-medium text-emerald-700">{addon.package_note}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ))}

                        {mainCoveredByPkg && hasAddons && depAddonTotal > 0.0001 ? (
                          <p className="text-[10px] leading-snug text-gray-600">
                            Your package covers the <strong className="font-medium text-gray-900">main service</strong>{' '}
                            only. Add-on deposits above are still due at checkout.
                          </p>
                        ) : null}

                        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-gray-200 pt-2">
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Total deposit</span>
                          <span className="text-sm font-bold tabular-nums text-orange-700">RM {depPayable.toFixed(2)}</span>
                        </div>
                        <p className="text-[10px] font-medium text-gray-600">Staff split: {staffSplitSummary}</p>
                      </div>
                    </div>
                  </div>
                  )
                })}

                {cartAppointmentSettlementItems.map((settlement) => (
                  <div
                    key={`settlement-${settlement.id}`}
                    className="rounded-xl border border-cyan-200 bg-gradient-to-b from-cyan-50/70 to-white p-3 shadow-sm sm:p-4"
                  >
                    <div className="border-b border-cyan-200/60 pb-2">
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Type: Settlement Services</p>
                          {!settlement.can_apply_package ? (
                            <p className="mt-1 text-[10px] font-medium leading-tight text-amber-700">
                              {settlement.package_disabled_reason ?? 'No eligible package available.'}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5 sm:shrink-0">
                          {settlement.package_status?.status === 'reserved' || Number(settlement.eligible_package_count ?? settlementAvailabilityMap[settlement.id] ?? 0) > 0 ? (
                            <span className="text-[10px] text-gray-500 tabular-nums">
                              Pkg bal. {Number(settlement.eligible_package_count ?? settlementAvailabilityMap[settlement.id] ?? 0)}
                            </span>
                          ) : null}
                            {settlement.package_status?.status === 'reserved' ? (
                              <button
                                type="button"
                                disabled={settlementUnclaimingIds[settlement.id] || settlementRedeemingIds[settlement.id]}
                                onClick={() => void unclaimSettlementPackage(settlement.booking_id, settlement.id)}
                                className="rounded-lg border border-amber-400/90 bg-amber-50/90 px-3 py-1.5 text-[11px] font-semibold text-amber-950 shadow-sm transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {settlementUnclaimingIds[settlement.id] ? 'Releasing…' : 'Unclaim Package'}
                              </button>
                            ) : (
                              <span className="inline-flex items-center">
                                <button
                                  type="button"
                                  disabled={
                                    !settlement.can_apply_package ||
                                    settlementRedeemingIds[settlement.id] ||
                                    settlementUnclaimingIds[settlement.id] ||
                                    settlement.package_status?.status === 'consumed'
                                  }
                                  title={!settlement.can_apply_package ? (settlement.package_disabled_reason ?? 'No eligible package available.') : undefined}
                                  onClick={() => void claimSettlementPackage(settlement.booking_id, settlement.id)}
                                  className="rounded-lg border border-cyan-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-cyan-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {settlementRedeemingIds[settlement.id] ? 'Reserving…' : 'Claim package'}
                                </button>
                              </span>
                            )}
                          <button
                            type="button"
                            onClick={() => void openCartEditSettlement(settlement)}
                            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-800 shadow-sm hover:bg-indigo-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeAppointmentSettlementItem(settlement.id)}
                            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 shadow-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="text-sm font-bold text-gray-900" title={settlement.booking_code}>
                          {settlement.booking_code}
                          {/* {settlement.service_name ? <span className="text-gray-400"> · </span> : null}
                          {settlement.service_name ? <span className="font-semibold text-gray-900">{settlement.service_name}</span> : null} */}
                        </h4>
                      </div>

                      <div className="mt-2 space-y-1 text-xs text-gray-600">
                        <p>Name: {settlement.customer_name || '—'}</p>
                        {getGuestContactLines(settlement).map((line) => (
                          <p key={`cart-settlement-guest-contact-${settlement.id}-${line}`}>{line}</p>
                        ))}
                        <p>Staff: {formatSettlementStaffLabel(settlement)}</p>
                        {settlement.appointment_start_at ? (
                          <>
                            <p>Appointment: {formatDateTimeRange(settlement.appointment_start_at, getSettlementDisplayEndAt(settlement))}</p>
                            <p>Duration: {getSettlementDurationMin(settlement) > 0 ? `${getSettlementDurationMin(settlement)} min` : '—'}</p>
                          </>
                        ) : null}
                      </div>
                      {/* {(settlement.main_services ?? []).length > 0 ? (
                        <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] text-gray-700">
                          {(settlement.main_services ?? []).map((service, idx) => (
                            <div key={`cart-main-display-${settlement.id}-${service.id ?? service.name}-${idx}`} className="mb-1 last:mb-0">
                              <div className="flex justify-between gap-2">
                                <span>
                                  {service.name}{service.is_original ? ' (Original)' : ''}
                                </span>
                                <span className="tabular-nums">RM {Number(service.extra_price ?? 0).toFixed(2)}</span>
                              </div>
                              {(service.add_ons ?? []).map((addon, addonIdx) => (
                                <div key={`cart-main-addon-display-${settlement.id}-${service.id ?? service.name}-${addon.id ?? addon.name}-${addonIdx}`} className="flex justify-between gap-2 pl-2 text-[10px] text-gray-600">
                                  <span>+ {addon.name}</span>
                                  <span className="tabular-nums">RM {Number(addon.extra_price ?? 0).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : null} */}
                      {settlement.requires_settled_amount ? (
                        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5">
                          <p className="text-[11px] font-semibold text-amber-900">
                            Range pricing — click Edit to set the service amount before checkout.
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      <BookingServicePhotosModal
                        bookingId={settlement.booking_id}
                        bookingCode={settlement.booking_code}
                      />
                    </div>

                    {(() => {
                      const pkgOffset = Number(settlement.package_offset ?? 0)
                      const settlementPackageClaimed = ['reserved', 'consumed'].includes(String(settlement.package_status?.status ?? '').toLowerCase())
                      const mainCoveredByPkg = (settlementPackageClaimed || pkgOffset > 0.0001) && pkgOffset > 0.0001
                      const serviceBlocks = settlement.main_service_settlement_items ?? []
                      const hasServiceBlocks = serviceBlocks.length > 0
                      const originalServiceBlock = serviceBlocks.find((service, idx) => service.is_original ?? idx === 0)
                      const originalServiceReference = Number(
                        originalServiceBlock?.gross_amount ??
                        originalServiceBlock?.extra_price ??
                        originalServiceBlock?.balance_due ??
                        settlement.service_total ??
                        0,
                      )
                      const addonRows = settlement.addon_settlement_items ?? []
                      const addonDueSum = addonRows.reduce((sum, a) => sum + Number(a.balance_due ?? a.extra_price ?? 0), 0)
                      const depositCredit = Number(settlement.deposit_contribution ?? 0)
                      const totalDue = Number(settlement.balance_due ?? settlement.amount_due_now ?? 0)
                      const isRangeUnsettled = settlement.is_range_priced && settlement.settled_service_amount == null
                      const totalDueLabel = isRangeUnsettled
                        ? `RM ${(Number(settlement.service_price_range_min) + addonDueSum - depositCredit - pkgOffset).toFixed(2)} - ${(Number(settlement.service_price_range_max) + addonDueSum - depositCredit - pkgOffset).toFixed(2)}`
                        : `RM ${totalDue.toFixed(2)}`

                      return (
                        <div className="mt-3 rounded-lg bg-white/90 px-3 py-2.5 ring-1 ring-cyan-200/80">
                          {/* <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Deposits</p> */}
                          <div className="mt-2 space-y-2 text-[11px]">
                            {hasServiceBlocks ? (
                              <div className="space-y-2 border-b border-gray-200 pb-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Service</p>
                                {serviceBlocks.map((service, idx) => {
                                  const gross = Number(service.gross_amount ?? service.balance_due ?? service.extra_price ?? 0)
                                  const discount = Number(service.discount_amount ?? 0)
                                  const net = Number(service.line_total_after_discount ?? Math.max(0, gross - discount))
                                  const coveredByPackage = mainCoveredByPkg && (service.is_original ?? idx === 0)
                                  const displayGross = coveredByPackage
                                    ? resolveSettlementLineOriginalPrice(
                                        service,
                                        originalServiceReference,
                                        settlement.service_total,
                                        pkgOffset,
                                      )
                                    : gross
                                  const displayNet = coveredByPackage ? 0 : net
                                  return (
                                    <div key={`settlement-service-block-${settlement.id}-${service.id ?? service.name}-${idx}`} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
                                      <div className="flex justify-between gap-2 text-gray-800">
                                        <div className="min-w-0">
                                          <ServiceNameStack name={`${service.name}${service.is_original ? ' (Original)' : ''}`} cnName={service.cn_name} primaryClassName="text-xs font-medium text-gray-800" secondaryClassName="mt-0.5 text-[10px] text-gray-500" />
                                          {coveredByPackage ? (
                                            <p className="mt-0.5 text-[10px] font-medium leading-snug text-emerald-700">
                                              Included in your package (main service)
                                            </p>
                                          ) : null}
                                        </div>
                                        <span className="text-right font-semibold tabular-nums">
                                          {coveredByPackage || discount > 0 ? <span className="block text-[10px] text-gray-400 line-through">RM {displayGross.toFixed(2)}</span> : null}
                                          {!coveredByPackage && discount > 0 ? <span className="block text-[10px] font-semibold text-amber-700">- RM {discount.toFixed(2)}</span> : null}
                                          <span className="block">RM {displayNet.toFixed(2)}</span>
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                                {addonRows.map((addon, idx) => {
                                  const gross = Number(addon.gross_amount ?? addon.balance_due ?? addon.extra_price ?? 0)
                                  const addonReference = Number(addon.extra_price ?? gross)
                                  const discount = Number(addon.discount_amount ?? 0)
                                  const net = Number(addon.line_total_after_discount ?? Math.max(0, gross - discount))
                                  const coveredByPackage = pkgOffset > originalServiceReference + 0.0001 && net <= 0.0001 && addonReference > 0.0001
                                  const displayGross = coveredByPackage ? addonReference : gross
                                  const displayNet = coveredByPackage ? 0 : net
                                  return (
                                    <div key={`settlement-addon-block-${settlement.id}-${addon.id ?? addon.name}-${idx}`} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
                                      <div className="flex justify-between gap-2 text-gray-700">
                                        <span>+ {addon.name}{addon.cn_name ? <span className="block pl-2 text-[10px] text-gray-500">{addon.cn_name}</span> : null}{coveredByPackage ? <span className="mt-0.5 block pl-2 text-[10px] font-medium leading-snug text-emerald-700">Included in your package (add-on)</span> : null}</span>
                                        <span className="text-right font-semibold tabular-nums">
                                          {coveredByPackage || discount > 0 ? <span className="block text-[10px] text-gray-400 line-through">RM {displayGross.toFixed(2)}</span> : null}
                                          {!coveredByPackage && discount > 0 ? <span className="block text-[10px] font-semibold text-amber-700">- RM {discount.toFixed(2)}</span> : null}
                                          <span className="block">RM {displayNet.toFixed(2)}</span>
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : null}

                            {mainCoveredByPkg && addonDueSum > 0.0001 ? (
                              <p className="text-[10px] leading-snug text-gray-600">
                                Your package covers the <strong className="font-medium text-gray-900">main service</strong>{' '}
                                only. Add-ons above are still due at checkout.
                              </p>
                            ) : null}

                            {depositCredit > 0.0001 ? (
                              <div className="flex justify-between gap-2 border-b border-gray-200 pb-2">
                                <span className="text-gray-700">Deposit</span>
                                <span className="font-semibold tabular-nums text-gray-900">
                                  − RM {depositCredit.toFixed(2)}
                                </span>
                              </div>
                            ) : null}

                            <div className="mt-2 flex items-baseline justify-between gap-3 pt-2">
                              <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                                Total to pay
                              </span>
                              <div className="text-right">
                                <span className="text-sm font-bold tabular-nums text-orange-700">{totalDueLabel}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                ))}

                {cartPackageItems.map((packageItem) => (
                  <div
                    key={`package-${packageItem.id}`}
                    className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4"
                  >
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">Type: Service Package</p>
                        <h4 className="mt-0.5 break-words text-sm font-bold text-gray-900" title={packageItem.package_name}>
                          {packageItem.package_name}
                        </h4>
                        <p className="mt-1.5 break-words text-xs text-gray-600">{formatPosPackageMemberLabel(packageItem, selectedMember)}</p>
                      </div>
                      <div className="flex min-w-0 w-full flex-wrap items-center gap-x-3 gap-y-2 border-t border-purple-100 pt-3 sm:border-t-0 sm:pt-0">
                      <div className="flex shrink-0 items-center gap-2 rounded-lg bg-purple-100/90 p-1 ring-1 ring-purple-200/80">
                        <button
                          type="button"
                          title={packageItem.qty <= 1 ? 'Remove package' : 'Decrease quantity'}
                          onClick={() => {
                            if (packageItem.qty <= 1) {
                              void removePackageCartItem(packageItem.id)
                              return
                            }
                            void updatePackageCartQty(packageItem.id, packageItem.qty - 1)
                          }}
                          className="h-7 w-7 rounded-md border-2 border-purple-300 bg-white text-sm font-bold text-purple-900 transition-all hover:border-purple-400 hover:bg-purple-50 active:scale-95"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-purple-950">{packageItem.qty}</span>
                        <button
                          type="button"
                          title="Increase quantity"
                          onClick={() => void updatePackageCartQty(packageItem.id, packageItem.qty + 1)}
                          disabled={packageItem.qty >= 10}
                          className="h-7 w-7 rounded-md border-2 border-purple-300 bg-white text-sm font-bold text-purple-900 transition-all hover:border-purple-400 hover:bg-purple-50 active:scale-95 disabled:cursor-not-allowed disabled:border-purple-200 disabled:bg-purple-50/50 disabled:text-purple-300 disabled:hover:bg-purple-50/50"
                        >
                          +
                        </button>
                      </div>
                        <div className="min-w-0 flex-1 text-right tabular-nums sm:max-w-[11rem] sm:flex-none sm:text-right">
                          {(packageItem.discount_amount ?? 0) > 0 ? (
                            <div className="space-y-0.5">
                              <p className="text-[11px] text-gray-500 line-through">RM {Number(packageItem.line_total_snapshot ?? packageItem.line_total).toFixed(2)}</p>
                              <p className="text-sm font-bold text-orange-700">RM {Number(packageItem.line_total ?? 0).toFixed(2)}</p>
                            </div>
                          ) : (
                            <p className="text-sm font-bold text-orange-700">RM {Number(packageItem.line_total ?? 0).toFixed(2)}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void removePackageCartItem(packageItem.id)}
                          className="ml-auto flex shrink-0 items-center justify-center rounded-md p-2 text-red-600 transition-colors hover:bg-red-50 sm:ml-0"
                          title="Remove package"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              ) : (
              <div className="mt-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-200">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="mt-2 text-sm font-bold text-gray-700">Cart is empty</p>
                <p className="text-xs text-gray-500 mt-1">Scan or add products to start</p>
              </div>
            )}

            <div className="mt-5 rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm">
              {/* Order Summary inside payment card for clearer iPad POS flow */}
              <div className="mb-4 space-y-1 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                {/* <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">RM {cartSubtotal.toFixed(2)}</span>
                </div> */}
                {promotionDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Promotion Discount</span>
                    <span className="font-semibold text-gray-700">- RM {promotionDiscount.toFixed(2)}</span>
                  </div>
                )}
                {voucherDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Voucher Discount</span>
                    <span className="font-semibold text-gray-700">- RM {voucherDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-lg text-orange-700">RM {cartTotal.toFixed(2)}</span>
                </div>
                {/* {cartPackageItems.length > 0 && (
                  <div className="border-t border-gray-200 pt-2 text-xs text-gray-700">
                    Package assignment: {selectedMember ? selectedMember.name : 'No member selected'}
                  </div>
                )} */}
              </div>

            </div>

            <button 
              onClick={() => void checkout()} 
              disabled={!canCheckout} 
              className="mt-5 h-14 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-base font-bold text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none active:scale-[0.98]"
            >
              {checkingOut ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Checkout'
              )}
            </button>
            {!hasOpenShift && !cashShiftLoading ? (
              <p className="mt-2 text-center text-xs font-semibold text-amber-700">Open a cash shift before checkout.</p>
            ) : cashShiftLoading ? (
              <p className="mt-2 text-center text-xs font-semibold text-blue-700">Checking current cash shift…</p>
            ) : null}
              </>
            </div>
        </div>
      </div>

      {productSelectModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border-2 border-gray-100 my-8 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4 rounded-t-2xl">
              <h4 className="text-xl font-bold text-gray-900">Product Details</h4>
              <button
                onClick={() => {
                  setProductSelectModalOpen(false)
                  setSelectedProduct(null)
                  setSelectedVariantId(null)
                  setProductVariantLoading(false)
                  setFullProductData(null)
                }}
                className="rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 p-6 max-h-[80vh] overflow-y-auto">
              {/* Left: Product Images */}
              <div className="space-y-4">
                {productVariantLoading ? (
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center border-2 border-gray-200">
                    <div className="text-center">
                      <svg className="h-12 w-12 mx-auto mb-2 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-sm font-medium text-gray-500">Loading...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {selectedProductDisplayImage ? (
                      <div className="aspect-square w-full bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedProductDisplayImage}
                          alt={selectedProduct.name || ''}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square w-full bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center border-2 border-gray-200">
                        <div className="text-center">
                          <svg className="h-16 w-16 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm font-medium text-gray-400">No image</p>
                        </div>
                      </div>
                    )}
                    {fullProductData?.images && fullProductData.images.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {fullProductData.images.slice(0, 4).map((img: { url?: string | null; image_path?: string | null } | null, idx: number) => (
                          <div key={idx} className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={getModalImageUrl(img?.url) || getModalImageUrl(img?.image_path) || ''} alt={`${selectedProduct.name} ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right: Product Info */}
              <div className="space-y-5">
                {(() => {
                  // Derive currently selected / primary variant for stock display
                  const selectedVariant =
                    (selectedProduct.variants.length > 0 &&
                      (selectedProduct.variants.find((v) => v.id === selectedVariantId) ?? selectedProduct.variants[0])) ||
                    null

                  const trackStock = selectedVariant?.track_stock ?? null
                  const stockValue =
                    typeof selectedVariant?.stock === 'number' && Number.isFinite(selectedVariant.stock)
                      ? selectedVariant.stock
                      : null

                  const hasStockLimit = (trackStock ?? true) && stockValue !== null && stockValue >= 0

                  return null
                })()}

                <div>
                  <ServiceNameStack
                    name={selectedProduct.name}
                    cnName={selectedProduct.cn_name}
                    primaryClassName="text-2xl font-bold text-gray-900"
                    secondaryClassName="mt-1 text-sm text-gray-500"
                  />
                  <p className="text-sm text-gray-500 mt-1.5 font-mono">{selectedProduct.sku || selectedProduct.barcode}</p>
                </div>

                {/* Price */}
                <div className="rounded-xl border-2 border-gray-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-gray-900">
                      RM {selectedVariantId && selectedProduct.variants.length > 0
                        ? Number(selectedProduct.variants.find(v => v.id === selectedVariantId)?.price ?? selectedProduct.price ?? 0).toFixed(2)
                        : Number(selectedProduct.price ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Variants */}
                {productVariantLoading ? (
                  <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-500">Loading variants...</p>
                  </div>
                ) : selectedProduct.variants.length > 0 ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-gray-900">Select Variant</label>
                    <div className="grid gap-2.5 max-h-64 overflow-y-auto">
                      {selectedProduct.variants.map((variant) => {
                        const selected = variant.id === selectedVariantId
                        const isActive = variant.is_active !== false
                        const outOfStock = isVariantOutOfStockForDisplay(variant)
                        return (
                          <button
                            type="button"
                            key={variant.id}
                            onClick={() => isActive && !outOfStock && setSelectedVariantId(variant.id)}
                            disabled={!isActive || outOfStock}
                            className={`rounded-xl border-2 p-4 text-left transition-all ${
                              selected
                                ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-500/20'
                                : !isActive || outOfStock
                                  ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                  : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <ServiceNameStack
                                  name={variant.name}
                                  cnName={variant.cn_name}
                                  primaryClassName="font-bold text-gray-900"
                                  secondaryClassName="mt-0.5 text-xs text-gray-500"
                                />
                                <p className="text-xs text-gray-600 mt-0.5 font-mono">{variant.sku}</p>
                                <p className="text-sm font-bold text-gray-900 mt-1.5">RM {variant.price.toFixed(2)}</p>
                                {typeof variant.stock === 'number' && (variant.track_stock ?? true) && (
                                  <p className="mt-1 text-xs text-gray-500">
                                    Stock: <span className="font-semibold text-gray-800">{variant.stock}</span>
                                  </p>
                                )}
                              </div>
                              {outOfStock && (
                                <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded">Out of Stock</span>
                              )}
                              {selected && !outOfStock && (
                                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : isPosSimpleProductOutOfStock(selectedProduct) ? (
                  <div className="rounded-xl border-2 border-red-100 bg-red-50 px-4 py-3">
                    <p className="text-sm font-bold text-red-600">Out of stock</p>
                  </div>
                ) : null}

                {/* Description */}
                {fullProductData?.description && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold">Description</label>
                    <div className="prose max-w-none text-sm text-gray-700 whitespace-pre-line">
                      {fullProductData.description}
                    </div>
                  </div>
                )}

                {/* Quantity with stock awareness */}
                <div className="space-y-3">
                  {(() => {
                    const selectedVariant =
                      (selectedProduct.variants.length > 0 &&
                        (selectedProduct.variants.find((v) => v.id === selectedVariantId) ?? selectedProduct.variants[0])) ||
                      null

                    const usesSimpleProductStock = selectedProduct.variants.length === 0

                    const trackStock = usesSimpleProductStock
                      ? selectedProduct.track_stock ?? null
                      : selectedVariant?.track_stock ?? null
                    const stockValue = usesSimpleProductStock
                      ? typeof selectedProduct.stock === 'number' && Number.isFinite(selectedProduct.stock)
                        ? selectedProduct.stock
                        : null
                      : typeof selectedVariant?.stock === 'number' && Number.isFinite(selectedVariant.stock)
                        ? selectedVariant.stock
                        : null

                    const hasStockLimit = (trackStock ?? true) && stockValue !== null && stockValue >= 0

                    const maxQty = hasStockLimit ? stockValue ?? null : null

                    const clampQty = (next: number) => {
                      if (next < 1) return 1
                      if (typeof maxQty === 'number') return Math.min(maxQty, next)
                      return next
                    }

                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-bold text-gray-900">Quantity</label>
                          {hasStockLimit && typeof stockValue === 'number' && (
                            <span className="text-xs font-medium text-gray-500">
                              Available:{' '}
                              <span className="font-semibold text-gray-800">{stockValue}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            className="rounded-lg border-2 border-gray-300 w-12 h-12 flex items-center justify-center bg-white hover:bg-gray-50 hover:border-gray-400 transition-all active:scale-95 font-bold text-gray-700"
                            onClick={() => setSelectedProductQty((prev) => clampQty(prev - 1))}
                          >
                            <span className="text-xl">−</span>
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={selectedProductQty}
                            onChange={(e) => {
                              const raw = Number(e.target.value || 1)
                              setSelectedProductQty(clampQty(Number.isFinite(raw) ? raw : 1))
                            }}
                            className="w-28 rounded-lg border-2 border-gray-300 bg-white px-3 py-3 text-center font-bold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                          <button
                            className="rounded-lg border-2 border-gray-300 w-12 h-12 flex items-center justify-center bg-white hover:bg-gray-50 hover:border-gray-400 transition-all active:scale-95 font-bold text-gray-700"
                            onClick={() => setSelectedProductQty((prev) => clampQty(prev + 1))}
                          >
                            <span className="text-xl">+</span>
                          </button>
                        </div>

                        {hasStockLimit && typeof maxQty === 'number' && selectedProductQty > maxQty && (
                          <p className="text-xs font-medium text-red-600">
                            Quantity cannot exceed available stock ({maxQty}).
                          </p>
                        )}
                      </>
                    )
                  })()}
                </div>

                {/* Add to Cart Button */}
                <div className="pt-4 border-t-2 border-gray-200">
                  <button
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white font-bold text-base shadow-lg hover:from-blue-700 hover:to-blue-800 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400 active:scale-[0.98]"
                    onClick={() => void confirmAddSelectedProduct()}
                    disabled={
                      (selectedProduct.variants.length > 0 && !selectedVariantId) ||
                      isPosSimpleProductOutOfStock(selectedProduct)
                    }
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {cartEditSettlementOpen && cartEditSettlementItem && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
              <div>
                <h4 className="text-lg font-bold text-gray-900">Edit Settlement</h4>
                <p className="text-xs text-gray-500">{cartEditSettlementItem.booking_code} · {cartEditOriginalService?.name ?? cartEditSettlementItem.service_name ?? '—'}</p>
              </div>
              <button
                type="button"
                onClick={() => setCartEditSettlementOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-5">
              {settlementNeedsSettledAmount(cartEditOriginalSettlementSource) ? (
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">Service Amount</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Range: RM {getSettlementRangeBounds(cartEditOriginalSettlementSource).min.toFixed(2)} – RM{' '}
                    {getSettlementRangeBounds(cartEditOriginalSettlementSource).max.toFixed(2)}
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">RM</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={cartEditSettledAmount}
                      onChange={(e) => {
                        setCartEditSettlementError(null)
                        setCartEditSettledAmount(e.target.value)
                      }}
                      className="w-full rounded-lg border-2 border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder={`${getSettlementRangeBounds(cartEditOriginalSettlementSource).min.toFixed(2)} - ${getSettlementRangeBounds(cartEditOriginalSettlementSource).max.toFixed(2)}`}
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Service Block · Original</p>
                      <ServiceNameStack
                        name={cartEditOriginalService?.name ?? cartEditSettlementItem.service_name ?? 'Service'}
                        cnName={cartEditOriginalService?.cn_name ?? cartEditSettlementItem.service_cn_name}
                      />
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-gray-600">
                          {settlementNeedsSettledAmount(cartEditOriginalSettlementSource) && parseSettlementAmountInput(cartEditSettledAmount) == null
                            ? `RM ${getSettlementRangeBounds(cartEditOriginalSettlementSource).min.toFixed(2)} - ${getSettlementRangeBounds(cartEditOriginalSettlementSource).max.toFixed(2)}`
                            : `RM ${Number(
                                settlementNeedsSettledAmount(cartEditOriginalSettlementSource) && parseSettlementAmountInput(cartEditSettledAmount) != null
                                  ? parseSettlementAmountInput(cartEditSettledAmount)
                                  : cartEditOriginalServicePrice ?? cartEditOriginalService?.service_price ?? cartEditOriginalService?.price ?? cartEditSettlementItem.service_total ?? 0,
                              ).toFixed(2)}`}
                          {Number(cartEditOriginalService?.duration_min ?? 0) > 0 ? ` · ${cartEditOriginalService?.duration_min}min` : ''}
                        </p>
                        <button type="button" onClick={editCartSettlementOriginalServicePrice} className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCartEditOriginalServicePicker()}
                      className="shrink-0 rounded-md border border-indigo-300 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      change
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-gray-900 mb-2">Add-ons</p>
                {cartEditAddonOptionsLoading ? (
                  <p className="text-xs text-gray-500">Loading add-on options...</p>
                ) : cartEditAddonQuestions.length === 0 ? (
                  <p className="text-xs text-gray-500">No add-on options available for this service.</p>
                ) : (
                  <div className="space-y-3">
                    {cartEditAddonQuestions.map((question) => (
                      <div key={question.id}>
                        <div className="mb-1.5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{question.title}</p>{question.cn_title ? <p className="mt-0.5 text-[11px] text-gray-500">{question.cn_title}</p> : null}</div>
                        <div className="space-y-1.5">
                          {question.options.map((opt) => {
                            const checked = cartEditSelectedAddonIds.has(opt.id)
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
                                    onChange={() => toggleCartEditAddon(opt.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <ServiceNameStack name={opt.label} cnName={opt.cn_label ?? opt.cn_name ?? opt.linked_cn_name} primaryClassName="text-sm font-medium text-gray-900" secondaryClassName="mt-0.5 text-[11px] text-gray-500" />
                                </div>
                                <span className="flex flex-col items-end gap-1 text-xs font-semibold tabular-nums text-gray-600">
                                  <span>+RM {Number(cartEditAddonPriceOverrides[opt.id] ?? opt.extra_price).toFixed(2)}{opt.extra_duration_min > 0 ? ` · ${opt.extra_duration_min}min` : ''}</span>
                                  {checked ? <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); editCartSettlementAddonPrice(opt.id, opt.label, Number(opt.extra_price ?? 0)) }} className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button> : null}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">Staff Split</p>
                  <button
                    type="button"
                    onClick={() => setCartEditStaffSplits((prev) => {
                      const next = [...prev, { staff_id: null, share_percent: '' }]
                      if (!cartEditStaffSplitAutoBalance) return next
                      return rebalanceSettlementPrimaryShare(next)
                    })}
                    className="rounded-md border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    + Add Staff
                  </button>
                </div>
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={cartEditStaffSplitAutoBalance}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setCartEditStaffSplitAutoBalance(checked)
                      if (checked) {
                        setCartEditStaffSplits((prev) => rebalanceSettlementPrimaryShare(prev))
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Auto Balance (lock first row, auto adjust to 100%)
                </label>
                <div className="space-y-2">
                  {cartEditStaffSplits.map((split, idx) => (
                    <div key={`cart-split-${idx}`} className="grid grid-cols-[1fr_120px_auto] gap-2">
                      <select
                        value={split.staff_id ?? ''}
                        onChange={(e) => {
                          const value = e.target.value ? Number(e.target.value) : null
                          setCartEditSettlementError(null)
                          setCartEditStaffSplits((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, staff_id: value } : row)))
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select staff</option>
                        {activeStaffs
                          .filter((staff) => {
                            const selected = new Set(
                              cartEditStaffSplits
                                .map((row, rowIdx) => (rowIdx === idx ? null : row.staff_id))
                                .filter((id): id is number => id != null),
                            )
                            return !selected.has(staff.id)
                          })
                          .map((staff) => (
                            <option key={staff.id} value={staff.id}>{staff.name}</option>
                          ))}
                      </select>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={split.share_percent}
                          disabled={cartEditStaffSplitAutoBalance && idx === 0}
                          onChange={(e) => updateCartEditSplitShare(idx, e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-7 text-sm"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                      </div>
                      <button
                        type="button"
                        disabled={cartEditStaffSplits.length <= 1}
                        onClick={() => removeCartEditSplitRow(idx)}
                        className="rounded-lg border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-600 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <button
                      type="button"
                      onClick={() => openCartEditMainServicePicker()}
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

              {cartEditAddedMainBlocks.map((block) => {
                const addonOptions = block.addon_questions.flatMap((q) => q.options)
                const selectedAddons = addonOptions.filter((opt) => block.selected_addon_ids.has(opt.id))
                const addonTotal = selectedAddons.reduce((sum, opt) => sum + Number(opt.extra_price ?? 0), 0)
                const blockSubtotal = Number(block.price ?? 0) + addonTotal
                return (
                  <div key={`cart-added-main-block-${block.tmp_id}`} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Service Block · Added</p>
                        <ServiceNameStack name={block.service_name} cnName={block.service_cn_name} />
                        <div className="mt-1 flex flex-wrap items-center gap-2"><p className="text-xs text-gray-600">RM {Number(block.price).toFixed(2)}{block.duration_min > 0 ? ` · ${block.duration_min}min` : ''}</p><button type="button" onClick={() => editCartAddedMainServicePrice(block.tmp_id, Number(block.price ?? 0))} className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button></div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCartEditAddedMainBlocks((prev) => prev.filter((item) => item.tmp_id !== block.tmp_id))}
                        className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                    {block.addon_questions.map((question) => (
                      <div key={`cart-added-q-${block.service_id}-${question.id}`} className="mb-2">
                        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">{question.title}</p>{question.cn_title ? <p className="mt-0.5 text-[11px] text-gray-500">{question.cn_title}</p> : null}</div>
                        {question.options.map((opt) => {
                          const checked = block.selected_addon_ids.has(opt.id)
                          return (
                            <label key={`cart-added-opt-${block.service_id}-${opt.id}`} className="mt-1 flex items-center justify-between rounded-md border border-gray-200 px-2 py-1.5 text-sm">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setCartEditAddedMainBlocks((prev) => prev.map((item) => {
                                    if (item.service_id !== block.service_id) return item
                                    const next = new Set(item.selected_addon_ids)
                                    if (next.has(opt.id)) next.delete(opt.id)
                                    else next.add(opt.id)
                                    return { ...item, selected_addon_ids: next }
                                  }))}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                                />
                                <ServiceNameStack name={opt.label} cnName={opt.cn_label ?? opt.cn_name ?? opt.linked_cn_name} primaryClassName="text-sm text-gray-700" secondaryClassName="mt-0.5 text-[11px] text-gray-500" />
                              </div>
                              <span className="text-xs font-semibold text-gray-500">+RM {Number(opt.extra_price).toFixed(2)}</span>
                            </label>
                          )
                        })}
                      </div>
                    ))}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={block.auto_balance}
                          onChange={(e) => toggleCartEditAddedMainAutoBalance(block.tmp_id, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Auto Balance (lock first row, auto adjust to 100%)
                      </label>
                      {block.staff_splits.map((split, idx) => (
                        <div key={`cart-added-split-${block.tmp_id}-${idx}`} className="grid grid-cols-[1fr_120px_auto] gap-2">
                          <select
                            value={split.staff_id ?? ''}
                            onChange={(e) => {
                              const value = e.target.value ? Number(e.target.value) : null
                              updateCartEditAddedMainSplitStaff(block.tmp_id, idx, value)
                            }}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="">Select staff</option>
                            {activeStaffs
                              .filter((staff) => {
                                const selected = new Set(
                                  block.staff_splits
                                    .map((row, rowIdx) => (rowIdx === idx ? null : row.staff_id))
                                    .filter((id): id is number => id != null),
                                )
                                return !selected.has(staff.id)
                              })
                              .map((staff) => (
                                <option key={`cart-added-staff-${block.tmp_id}-${staff.id}`} value={staff.id}>{staff.name}</option>
                              ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={split.share_percent}
                            disabled={block.auto_balance && idx === 0}
                            onChange={(e) => {
                              const value = e.target.value
                              updateCartEditAddedMainSplitShare(block.tmp_id, idx, value)
                            }}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setCartEditAddedMainBlocks((prev) => prev.map((item) => item.service_id === block.service_id
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
                        onClick={() => setCartEditAddedMainBlocks((prev) => prev.map((item) => item.service_id === block.service_id ? { ...item, staff_splits: [...item.staff_splits, { staff_id: null, share_percent: '' }] } : item))}
                        className="rounded-md border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-700"
                      >
                        + Add Staff
                      </button>
                    </div>
                    <div className="mt-3 border-t border-gray-200 pt-2 text-sm font-semibold text-gray-800">Block Subtotal: RM {blockSubtotal.toFixed(2)}</div>
                  </div>
                )
              })}
                </div>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-5">

              {(() => {
                const allOptions = cartEditAddonQuestions.flatMap((q) => q.options)
                const selectedAddons = allOptions.filter((o) => cartEditSelectedAddonIds.has(o.id))
                const addonTotal = selectedAddons.reduce((sum, o) => sum + Number(cartEditAddonPriceOverrides[o.id] ?? o.extra_price), 0)
                const selectedMainServices = cartEditAddedMainBlocks
                const addedMainTotal = selectedMainServices.reduce((sum, service) => {
                  const addonOptions = service.addon_questions.flatMap((q) => q.options)
                  const addonTotal = addonOptions.filter((opt) => service.selected_addon_ids.has(opt.id)).reduce((acc, opt) => acc + Number(opt.extra_price ?? 0), 0)
                  return sum + Number(service.price ?? 0) + addonTotal
                }, 0)
                const isRange = settlementNeedsSettledAmount(cartEditOriginalSettlementSource)
                const settledAmt = parseSettlementAmountInput(cartEditSettledAmount)
                const originalServiceAmt = isRange && settledAmt != null
                  ? settledAmt
                  : Number(
                    cartEditOriginalServicePrice
                      ?? cartEditOriginalService?.service_price
                      ?? cartEditOriginalService?.price
                      ?? (cartEditSettlementItem.main_services ?? [])
                        .find((service) => service.is_original)?.extra_price
                      ?? cartEditSettlementItem.service_total
                      ?? 0,
                  )
                const serviceAmt = originalServiceAmt + addedMainTotal
                const depositOffset = Number(cartEditSettlementItem.deposit_contribution ?? 0)
                const packageOffset = Number(cartEditSettlementItem.package_offset ?? 0)
                const finalTotal = Math.max(0, serviceAmt + addonTotal - depositOffset - packageOffset)
                return (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">Summary</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Original Service</span>
                        <span className="font-semibold tabular-nums text-gray-900">
                          {isRange && settledAmt == null
                            ? `RM ${getSettlementRangeBounds(cartEditOriginalSettlementSource).min.toFixed(2)} - ${getSettlementRangeBounds(cartEditOriginalSettlementSource).max.toFixed(2)}`
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
              {cartEditSettlementError ? (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{cartEditSettlementError}</p>
              ) : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCartEditSettlementOpen(false)}
                  className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={cartEditSettlementLoading}
                  onClick={() => void saveCartEditSettlement()}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {cartEditSettlementLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cartEditMainServicePickerOpen && cartEditSettlementItem && cartEditMainServicePickerTargetId ? (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
              <div>
                <h4 className="text-base font-bold text-gray-900">
                  {cartEditMainServicePickerTargetId === '__original__' ? 'Change Original Service' : 'Choose Main Service'}
                </h4>
                <p className="text-xs text-gray-500">
                  {cartEditMainServicePickerTargetId === '__original__'
                    ? 'Search and select the correct original service.'
                    : 'Search and select a booking service.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCartEditMainServicePickerOpen(false)
                  setCartEditMainServicePickerTargetId(null)
                  setCartEditMainServicePickerQuery('')
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <BookingServicePicker
                categories={bookingServiceCategories}
                services={cartEditMainServiceCatalog}
                selectedCategoryId={cartEditMainServiceCategoryId}
                onCategoryChange={setCartEditMainServiceCategoryId}
                searchQuery={cartEditMainServicePickerQuery}
                onSearchQueryChange={setCartEditMainServicePickerQuery}
                selectedServiceId={cartEditMainServicePickerTargetId === '__original__' ? cartEditOriginalService?.id : null}
                excludeServiceIds={[
                  ...(cartEditOriginalService?.id ? [cartEditOriginalService.id] : []),
                  ...cartEditAddedMainBlocks.map((block) => block.service_id),
                ]}
                onSelectService={async (service) => {
                  const selected = service as BookingServiceOption
                  if (cartEditMainServicePickerTargetId === '__original__') {
                    await selectCartEditOriginalService(selected)
                  } else {
                    await addCartEditMainServiceBlock(selected)
                    setCartEditMainServicePickerOpen(false)
                    setCartEditMainServicePickerTargetId(null)
                    setCartEditMainServicePickerQuery('')
                    setCartEditMainServiceCategoryId(null)
                  }
                }}
                emptyMessage="No services found."
                searchPlaceholder="Search service name..."
              />
            </div>
          </div>
        </div>
      ) : null}

      {checkoutConfirmationOpen && hasCartItems ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50 px-8 py-6 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-gray-900">Checkout Confirmation</h4>
                  <p className="mt-1 text-sm text-gray-600">Review your order before completing payment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutConfirmationOpen(false)}
                className="rounded-xl p-2.5 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700 active:scale-95"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8">

              <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={openGlobalBulkSplitEditor}
                    disabled={globalBulkSelectedOnly && globalBulkSelectedKeys.size === 0}
                    className="inline-flex items-center rounded-lg border border-indigo-500 bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300"
                  >
                    Apply Staff Split
                  </button>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-900">
                    <input
                      type="radio"
                      checked={!globalBulkSelectedOnly}
                      onChange={() => setGlobalBulkSelectedOnly(false)}
                      className="h-4 w-4"
                    />
                    All chargeable lines
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-900">
                    <input
                      type="radio"
                      checked={globalBulkSelectedOnly}
                      onChange={() => setGlobalBulkSelectedOnly(true)}
                      className="h-4 w-4"
                    />
                    Selected lines only
                  </label>
                  {globalBulkSelectedOnly ? (
                    <span className="text-[11px] font-medium text-indigo-700">{globalBulkSelectedKeys.size} selected</span>
                  ) : null}
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-gray-200/90 bg-gradient-to-b from-slate-50/80 to-white shadow-inner ring-1 ring-gray-100">
                <table className="min-w-[720px] w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-100 via-gray-50 to-slate-100 shadow-sm">
                    <tr>
                      <th className="px-4 py-3.5 text-left font-bold text-gray-800 uppercase tracking-wider text-[11px] sm:px-5">Item</th>
                      <th className="px-4 py-3.5 text-left font-bold text-gray-800 uppercase tracking-wider text-[11px] sm:min-w-[220px]">Details</th>
                      <th className="px-4 py-3.5 text-left font-bold text-gray-800 uppercase tracking-wider text-[11px] sm:min-w-[160px]">Unit / Deposit</th>
                      <th className="px-4 py-3.5 text-right font-bold text-gray-800 uppercase tracking-wider text-[11px] sm:px-5">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-300/90">
                    {cartItems.map((item) => {
                      const assignment = checkoutItemAssignments.find((x) => x.cart_item_id === item.id)
                      const hasVariant = Boolean(item.variant_id || item.variant_name || item.variant_sku)
                      const variantDisplay = item.variant_name || item.variant_sku || null
                      const selectedBookingProductOptions = getBookingProductSelectedOptions(item)
                      const isBookingProduct = item.item_type === 'BOOKING_PRODUCT'
                      const bookingProductBaseUnitPrice = getBookingProductBaseUnitPrice(item, selectedBookingProductOptions)
                      const bookingProductBaseLineTotal = getBookingProductBaseLineTotal(item, selectedBookingProductOptions)
                      const bookingProductBaseNetLineTotal = Math.max(0, bookingProductBaseLineTotal - Number(item.discount_amount ?? 0))
                      return (
                        <Fragment key={item.id}>
                        <tr className="bg-white hover:bg-slate-50/90 transition-colors align-top">
                          <td className="px-4 py-3.5 sm:px-5">
                            {isBookingProduct ? <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">TYPE: BOOKING PRODUCT</p> : null}
                            <p className="font-semibold text-gray-900">{item.product_name}</p>
                            {item.product_cn_name ? <p className="mt-0.5 text-xs text-gray-500">{item.product_cn_name}</p> : null}
                            {hasVariant && variantDisplay && (
                              <div className="mt-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Variant</p>
                                <ServiceNameStack
                                  name={variantDisplay}
                                  cnName={item.variant_cn_name ?? null}
                                  primaryClassName="text-xs font-medium text-blue-700"
                                  secondaryClassName="mt-0.5 text-xs text-gray-500"
                                />
                              </div>
                            )}
                            {!hasVariant && item.product_id && (
                              <p className="text-xs text-gray-400 italic mt-0.5">No variant selected</p>
                            )}
                            <p className="text-xs text-gray-500 mt-0.5">Qty: {item.qty}</p>
                            {item.promotion_applied ? (
                            <div className="mt-1.5">
                              <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                                Promo Applied: {item.promotion_name ?? 'Promotion'}
                              </span>
                              {item.promotion_summary ? <p className="text-[10px] text-green-700 mt-1">{item.promotion_summary}</p> : null}
                            </div>
                          ) : null}
                          {item.is_staff_free_applied ? (
                              <p className="mt-1 inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                Staff Free Applied
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3.5 min-w-[260px] align-top">
                            <div className="space-y-2">
                              {renderGlobalBulkLineCheckbox(`product:${item.id}`)}
                              <p className="text-xs text-gray-600 font-medium leading-relaxed">{getSplitSummary(assignment)}</p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void openItemSplitEditor(item.id)}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-95 ${
                                    assignment?.splits?.length
                                      ? 'border-indigo-500 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700'
                                      : 'border-emerald-500 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
                                  }`}
                                >
                                  {assignment?.splits?.length ? (
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                                      />
                                    </svg>
                                  ) : (
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  )}
                                  {assignment?.splits?.length ? 'Edit Staff' : 'Assign Staff'}
                                </button>
                                {assignment?.splits?.length ? (
                                  <button
                                    type="button"
                                    onClick={() => setCheckoutItemAssignments((prev) => prev.map((row) => row.cart_item_id === item.id ? { ...row, splits: [], is_default: false } : row))}
                                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition-all hover:bg-red-50 hover:border-red-400 hover:shadow-md active:scale-95"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Clear
                                  </button>
                                ) : null}
                                {selectedBookingProductOptions.length > 0 ? (
                                  <button type="button" onClick={() => void openBulkSplitEditor('Booking product lines', selectedBookingProductOptions.map((opt, idx) => `cart:${item.id}:booking_product_option:${Number(opt.id ?? idx)}`), assignment?.splits ?? [], [item.id])} className="inline-flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">Apply Staff Split to All Lines</button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => openDiscountModal({
                                    kind: 'product',
                                    id: item.id,
                                    name: item.product_name ?? 'Product',
                                    lineTotal: isBookingProduct ? bookingProductBaseLineTotal : Number(item.line_total_snapshot ?? item.line_total ?? 0),
                                    discountType: item.discount_type ?? null,
                                    discountValue: Number(item.discount_value ?? 0),
                                    discountRemark: item.discount_remark ?? null,
                                    promotionApplied: item.promotion_applied,
                                    manualDiscountAllowed: item.manual_discount_allowed,
                                  })}
                                  disabled={item.promotion_applied || item.manual_discount_allowed === false}
                                  className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50"
                                >
                                  {(item.discount_amount ?? 0) > 0 ? 'Edit Discount' : 'Discount'}
                                </button>
                                <button type="button" onClick={() => openPriceEditModal({ kind: 'product', id: item.id, name: item.product_name ?? 'Product', currentUnitPrice: Number(selectedBookingProductOptions.length > 0 ? bookingProductBaseUnitPrice : item.unit_price), originalUnitPrice: Number(selectedBookingProductOptions.length > 0 ? bookingProductBaseUnitPrice : (item.unit_price_snapshot ?? item.unit_price ?? 0)), quantity: Number(item.qty ?? 1), currentLineTotal: Number(isBookingProduct ? bookingProductBaseLineTotal : item.line_total_snapshot ?? item.line_total ?? 0) })} className="inline-flex items-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Edit Price</button>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-left align-top tabular-nums">
                            <div className="space-y-1">
                            {item.promotion_applied && item.unit_price_snapshot ? (
                              <div className="space-y-0.5">
                                <p className="text-xs text-gray-400 line-through">RM {Number(item.unit_price_snapshot).toFixed(2)}</p>
                                <p className="text-gray-700 font-semibold text-gray-800">RM {Number(selectedBookingProductOptions.length > 0 ? bookingProductBaseUnitPrice : item.unit_price).toFixed(2)}</p>
                              </div>
                            ) : item.is_staff_free_applied ? (
                              <div className="space-y-0.5">
                                <p className="text-xs text-gray-400 line-through">RM {Number(item.unit_price_snapshot ?? 0).toFixed(2)}</p>
                                <p className="font-semibold text-emerald-800">RM {Number(selectedBookingProductOptions.length > 0 ? bookingProductBaseUnitPrice : item.unit_price).toFixed(2)}</p>
                              </div>
                            ) : (
                              <p className="text-gray-700">RM {Number(selectedBookingProductOptions.length > 0 ? bookingProductBaseUnitPrice : item.unit_price).toFixed(2)}</p>
                            )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right align-top tabular-nums sm:px-5">
                            {item.promotion_applied && item.line_total_snapshot ? (
                              <div className="space-y-0.5">
                                <p className="text-xs text-gray-400 line-through">RM {Number(isBookingProduct ? bookingProductBaseLineTotal : item.line_total_snapshot).toFixed(2)}</p>
                                <p className="font-bold text-orange-700">RM {Number(isBookingProduct ? bookingProductBaseNetLineTotal : item.line_total).toFixed(2)}</p>
                              </div>
                            ) : item.is_staff_free_applied ? (
                              <div className="space-y-0.5 text-right">
                                <p className="text-[11px] font-semibold tabular-nums text-emerald-700">
                                  - RM {Number(item.line_total_snapshot ?? 0).toFixed(2)}
                                </p>
                                <p className="font-bold text-orange-700">RM {Number(isBookingProduct ? bookingProductBaseNetLineTotal : item.line_total).toFixed(2)}</p>
                              </div>
                            ) : (item.discount_amount ?? 0) > 0 ? (
                              <div className="space-y-0.5">
                                <p className="text-xs text-gray-400 line-through">RM {Number(isBookingProduct ? bookingProductBaseLineTotal : (item.line_total_snapshot ?? item.line_total)).toFixed(2)}</p>
                                <p className="text-xs text-amber-700">- RM {Number(item.discount_amount ?? 0).toFixed(2)}</p>
                                <p className="font-bold text-orange-700">RM {Number(isBookingProduct ? bookingProductBaseNetLineTotal : item.line_total).toFixed(2)}</p>
                              </div>
                            ) : (
                              <p className="font-bold text-orange-700">RM {Number(isBookingProduct ? bookingProductBaseNetLineTotal : item.line_total).toFixed(2)}</p>
                            )}
                          </td>
                        </tr>
                        {selectedBookingProductOptions.map((opt, optIdx) => {
                          const optionGross = getBookingProductOptionGrossLineTotal(item, opt)
                          const optionNet = getBookingProductOptionNetLineTotal(item, opt)
                          const optionDiscount = Number(opt.discount_amount ?? Math.max(0, optionGross - optionNet))
                          const optionSplitKey = `cart:${item.id}:booking_product_option:${Number(opt.id ?? optIdx)}`
                          const optionSplits = checkoutLineSplits[optionSplitKey] ?? (assignment?.splits ?? [])
                          const inheritedProductSplits = assignment?.splits ?? []
                          const optionSplitSummary = formatLineSplitSummary(optionSplitKey, inheritedProductSplits, 'main product')
                          return (
                          <tr key={`checkout-bp-addon-${item.id}-${opt.id ?? optIdx}`} className="bg-blue-50/50 align-top">
                            <td className="px-4 py-2.5 pl-6 sm:px-5 sm:pl-7">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">ADD-ON</p>
                              <p className="mt-1 text-sm text-gray-800">+ {opt.label}</p>
                              {opt.cn_label ? <p className="text-xs text-gray-500">{opt.cn_label}</p> : null}
                              <p className="mt-1 text-xs font-semibold text-gray-600">Qty: {item.qty}</p>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">
                              <div className="mb-2 space-y-1">
                                {renderGlobalBulkLineCheckbox(optionSplitKey)}
                                <p className="text-[11px] font-medium text-gray-600">{optionSplitSummary}</p>
                                <button
                                  type="button"
                                  onClick={() => void openLineSplitEditor(optionSplitKey, `+ ${opt.label ?? 'Booking Product Option'}`, inheritedProductSplits)}
                                  className="inline-flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                                >
                                  {checkoutLineSplits[optionSplitKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => opt.id && openDiscountModal({
                                  kind: 'bookingProductOption',
                                  id: item.id,
                                  optionId: Number(opt.id),
                                  name: `+ ${opt.label ?? 'Booking Product Option'}`,
                                  lineTotal: optionGross,
                                  discountType: opt.discount_type ?? null,
                                  discountValue: Number(opt.discount_value ?? 0),
                                  discountRemark: opt.discount_remark ?? null,
                                })}
                                disabled={!opt.id}
                                className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50"
                              >
                                {optionDiscount > 0 ? 'Edit Discount' : 'Discount'}
                              </button>
                              <button type="button" onClick={() => opt.id && openPriceEditModal({ kind: 'bookingProductOption', id: item.id, optionId: Number(opt.id), name: `+ ${opt.label ?? 'Booking Product Option'}`, currentUnitPrice: Number(opt.extra_price ?? 0), originalUnitPrice: Number(opt.original_unit_price_snapshot ?? opt.extra_price ?? 0), quantity: Number(item.qty ?? 1), currentLineTotal: optionGross })} disabled={!opt.id} className="inline-flex items-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50">Edit Price</button>
                            </td>
                            <td className="px-4 py-2.5 text-left tabular-nums text-sm text-gray-700">
                              <div className="space-y-1">
                                <p>RM {Number(opt.extra_price ?? 0).toFixed(2)}</p>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-sm font-semibold text-gray-900 sm:px-5">
                              {optionDiscount > 0 ? (
                                <div className="space-y-0.5">
                                  <p className="text-xs text-gray-400 line-through">RM {optionGross.toFixed(2)}</p>
                                  <p className="text-xs text-amber-700">- RM {optionDiscount.toFixed(2)}</p>
                                  <p>RM {optionNet.toFixed(2)}</p>
                                </div>
                              ) : (
                                <>RM {optionGross.toFixed(2)}</>
                              )}
                            </td>
                          </tr>
                          )
                        })}
                        {isBookingProduct && selectedBookingProductOptions.length > 0 ? (
                          <tr className="bg-blue-100/60 align-top">
                            <td className="px-4 py-2.5 pl-6 text-xs font-bold uppercase tracking-wide text-blue-900 sm:px-5 sm:pl-7" colSpan={3}>Subtotal / Line Total</td>
                            <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-blue-900 sm:px-5">RM {Number(item.line_total).toFixed(2)}</td>
                          </tr>
                        ) : null}
                        </Fragment>
                      )
                    })}
                    {cartServiceItems.map((serviceItem) => {
                      const splitSummary = formatPosServiceStaffSplitSummary(serviceItem)
                      const chkIdentity = formatPosServiceCartIdentity(serviceItem, selectedMember)
                      const depPayableChk = Number(serviceItem.deposit_payable_total ?? Number(serviceItem.deposit_contribution ?? 0) + Number(serviceItem.deposit_addon_total ?? 0))
                      const chkPkgClaimed =
                        !!serviceItem.claimed_by_package ||
                        serviceItem.package_claim_status === 'reserved' ||
                        serviceItem.package_claim_status === 'consumed'
                      const checkoutDepositBlocks = getPosServiceDepositBlocks(serviceItem)
                      const checkoutHasAddons = checkoutDepositBlocks.some((block) => (block.add_ons ?? []).length > 0)
                      const mainCoveredByPkg = chkPkgClaimed && Number(serviceItem.deposit_contribution ?? 0) < 0.0001

                      const checkoutServiceItemHeader = (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Type: Services</p>
                          <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                            {serviceItem.start_at ? (
                              <p>Appointment: {formatDateTimeRange(serviceItem.start_at, serviceItem.end_at)}</p>
                            ) : null}
                            {chkIdentity ? <p className="font-medium text-gray-700">{chkIdentity}</p> : null}
                          </div>
                        </>
                      )

                      const svcRowClass =
                        'bg-emerald-50/50 hover:bg-emerald-50/80 transition-colors border-t border-emerald-200/50'

                      return (
                        <Fragment key={`checkout-service-${serviceItem.id}`}>
                          <tr className={`${svcRowClass} align-top`}>
                            <td className="px-4 py-3.5 sm:px-5">{checkoutServiceItemHeader}</td>
                            <td className="min-w-[260px] px-4 py-3.5 align-top">
                              <button type="button" onClick={() => void openBulkSplitEditor('Service lines', checkoutDepositBlocks.flatMap((service, idx) => [`service:${serviceItem.id}:main:${service.line_key ?? service.linked_booking_service_id ?? service.id ?? idx}`, ...(service.add_ons ?? []).map((addon, addonIdx) => `service:${serviceItem.id}:addon:${addon.line_key ?? addon.id ?? addonIdx}`)]), serviceItem.staff_splits ?? [])} className="inline-flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">Apply Staff Split to All Lines</button>
                            </td>
                            <td className="px-4 py-3.5 align-top tabular-nums text-xs text-gray-400">—</td>
                            <td className="px-4 py-3.5 text-right align-top tabular-nums text-xs text-gray-400 sm:px-5">
                              —
                            </td>
                          </tr>
                          <tr className={`${svcRowClass} align-top`}>
                            <td className="px-4 py-2.5 pl-7 sm:px-5 sm:pl-8" colSpan={4}>
                              <div className="rounded-lg bg-white/80 p-3 ring-1 ring-emerald-100">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Deposit Service</p>
                                <div className="mt-2 space-y-2 text-[11px]">
                                  {checkoutDepositBlocks.map((service, idx) => {
                                    const serviceLineKey = `service:${serviceItem.id}:main:${service.line_key ?? service.linked_booking_service_id ?? service.id ?? idx}`
                                    const serviceLineSplits = checkoutLineSplits[serviceLineKey] ?? (service.staff_splits ?? serviceItem.staff_splits ?? [])
                                    const serviceLineSummary = formatLineSplitSummary(serviceLineKey, serviceItem.staff_splits ?? [], 'main service')
                                    return (
                                    <div key={`checkout-dep-service-${serviceItem.id}-${service.linked_booking_service_id ?? service.id ?? idx}`} className={`space-y-1 rounded-md border-b border-gray-100 pb-2 last:border-b-0 last:pb-0 ${service.covered_by_package ? 'bg-emerald-50/80 px-2 py-1.5 ring-1 ring-emerald-100' : ''}`}>
                                      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-2 tabular-nums text-gray-800">
                                        <span className="text-gray-500">{idx + 1}.</span>
                                        <div>{renderGlobalBulkLineCheckbox(serviceLineKey)}<ServiceNameStack name={service.name} cnName={service.cn_name} primaryClassName="text-xs font-semibold text-gray-900" secondaryClassName="mt-0.5 text-[10px] text-gray-500" /><p className="mt-1 text-[10px] font-medium text-gray-600">Staff split: {serviceLineSummary}</p><div className="mt-1 flex flex-wrap gap-1">{!service.covered_by_package && Number(service.deposit ?? 0) > 0.0001 ? <button type="button" onClick={() => openPriceEditModal({ kind: 'serviceDeposit', id: serviceItem.id, lineKey: service.line_key ?? 'main', name: service.name ?? 'Service deposit', currentUnitPrice: Number(service.deposit ?? 0), originalUnitPrice: Number(service.price_override?.original_unit_price ?? service.reference_deposit ?? service.deposit ?? 0) })} className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button> : null}<button type="button" onClick={() => void openLineSplitEditor(serviceLineKey, service.name ?? 'Service deposit', serviceItem.staff_splits ?? [])} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{checkoutLineSplits[serviceLineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button></div></div>
                                        <div className="text-right"><PosDepositAmount amount={Number(service.deposit ?? 0)} referenceAmount={Number(service.reference_deposit ?? service.deposit ?? 0)} /></div>
                                      </div>
                                      {service.package_note ? (
                                        <p className="pl-7 text-[10px] font-medium text-emerald-700">{service.package_note}</p>
                                      ) : null}
                                      {(service.add_ons ?? []).map((addon, addonIdx) => {
                                        const addonLineKey = `service:${serviceItem.id}:addon:${addon.line_key ?? addon.id ?? addonIdx}`
                                        const addonLineSplits = checkoutLineSplits[addonLineKey] ?? (addon.staff_splits ?? service.staff_splits ?? serviceItem.staff_splits ?? [])
                                        const addonLineSummary = formatLineSplitSummary(addonLineKey, service.staff_splits ?? serviceItem.staff_splits ?? [], 'main service')
                                        return (
                                        <div key={`checkout-dep-service-addon-${serviceItem.id}-${idx}-${addon.id ?? addonIdx}`} className={`space-y-0.5 rounded pl-5 ${addon.covered_by_package ? 'bg-emerald-50/80 py-1 pr-1 ring-1 ring-emerald-100' : ''}`}>
                                          <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-2 tabular-nums text-gray-700">
                                            <span className="text-gray-500">+</span>
                                            <div>{renderGlobalBulkLineCheckbox(addonLineKey)}<ServiceNameStack name={addon.name} cnName={addon.cn_name} primaryClassName="text-[11px] text-gray-700" secondaryClassName="mt-0.5 text-[10px] text-gray-500" /><p className="mt-1 text-[10px] font-medium text-gray-600">Staff split: {addonLineSummary}</p><div className="mt-1 flex flex-wrap gap-1">{!addon.covered_by_package && Number(addon.deposit ?? 0) > 0.0001 ? <button type="button" onClick={() => openPriceEditModal({ kind: 'serviceDeposit', id: serviceItem.id, lineKey: addon.line_key ?? `addon:${Number(addon.id ?? 0)}`, name: addon.name ?? 'Service add-on deposit', currentUnitPrice: Number(addon.deposit ?? 0), originalUnitPrice: Number(addon.price_override?.original_unit_price ?? addon.reference_deposit ?? addon.deposit ?? 0) })} className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edit Price</button> : null}<button type="button" onClick={() => void openLineSplitEditor(addonLineKey, addon.name ?? 'Service add-on deposit', serviceItem.staff_splits ?? [])} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{checkoutLineSplits[addonLineKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button></div></div>
                                            <div className="text-right"><PosDepositAmount amount={Number(addon.deposit ?? 0)} referenceAmount={Number(addon.reference_deposit ?? addon.deposit ?? 0)} /></div>
                                          </div>
                                          {addon.package_note ? (
                                            <p className="pl-7 text-[10px] font-medium text-emerald-700">{addon.package_note}</p>
                                          ) : null}
                                        </div>
                                      )})}
                                    </div>
                                  )})}

                                  {mainCoveredByPkg && checkoutHasAddons && Number(serviceItem.deposit_addon_total ?? 0) > 0.0001 ? (
                                    <p className="text-[10px] leading-snug text-gray-600">
                                      Your package covers the <span className="font-semibold text-gray-900">main service</span>{' '}
                                      only. Add-on deposits above are still due at checkout.
                                    </p>
                                  ) : null}

                                  <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-gray-200 pt-2">
                                    <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Total deposit</span>
                                    <span className="text-sm font-bold tabular-nums text-orange-700">RM {depPayableChk.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      )
                    })}

                    {cartAppointmentSettlementItems.map((settlement) => {
                      const stRowClass =
                        'bg-cyan-50/50 hover:bg-cyan-50/80 transition-colors border-t border-cyan-200/50'

                      const addons = settlement.addon_settlement_items ?? []
                      const addonCount = addons.length
                      const checkoutServiceBlocks = settlement.main_service_settlement_items ?? []
                      const hasServiceBlocks = checkoutServiceBlocks.length > 0
                      const addonDueSum = addons.reduce((sum, a) => sum + Number(a.balance_due ?? a.extra_price ?? 0), 0)
                      const serviceTotalRef = Number(settlement.service_total ?? 0)
                      const depositCredit = Number(settlement.deposit_contribution ?? 0)
                      const pkgOffset = Number(settlement.package_offset ?? 0)
                      const settlementPackageClaimed = ['reserved', 'consumed'].includes(String(settlement.package_status?.status ?? '').toLowerCase())
                      const mainCoveredByPkg = (settlementPackageClaimed || pkgOffset > 0.0001) && pkgOffset > 0.0001
                      const checkoutOriginalServiceBlock = checkoutServiceBlocks.find((service, idx) => service.is_original ?? idx === 0)
                      const checkoutOriginalServiceReference = Number(
                        checkoutOriginalServiceBlock?.gross_amount ??
                        checkoutOriginalServiceBlock?.extra_price ??
                        checkoutOriginalServiceBlock?.balance_due ??
                        settlement.service_total ??
                        0,
                      )
                      const stIsRangeUnsettled = settlement.is_range_priced && settlement.settled_service_amount == null
                      const stServiceLabel = stIsRangeUnsettled
                        ? `RM ${Number(settlement.service_price_range_min).toFixed(2)} - ${Number(settlement.service_price_range_max).toFixed(2)}`
                        : `RM ${serviceTotalRef.toFixed(2)}`
                      const fallbackMainOriginal = resolveSettlementLineOriginalPrice(
                        checkoutOriginalServiceBlock ?? {},
                        checkoutOriginalServiceReference,
                        settlement.service_total,
                        pkgOffset,
                      )

                      return (
                        <Fragment key={`checkout-settlement-${settlement.id}`}>
                          <tr className={`${stRowClass} align-top`}>
                            <td className="px-4 py-3.5 sm:px-5">
                              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Type: Settlement Services</p>
                              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="text-base font-bold leading-snug text-gray-900">{settlement.booking_code}</span>
                                {/* {settlement.service_name ? (
                                  <span className="text-sm font-semibold text-gray-800">· {settlement.service_name}</span>
                                ) : null} */}
                              </div>
                              <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                                <p>Name: {settlement.customer_name || '—'}</p>
                                {getGuestContactLines(settlement).map((line) => (
                                  <p key={`checkout-settlement-guest-contact-${settlement.id}-${line}`}>{line}</p>
                                ))}
                                {settlement.appointment_start_at ? (
                                  <p>
                                    Appointment: {formatDateTimeRange(settlement.appointment_start_at, getSettlementDisplayEndAt(settlement))}
                                  </p>
                                ) : null}
                                <p>Duration: {getSettlementDurationMin(settlement) > 0 ? `${getSettlementDurationMin(settlement)} min` : '—'}</p>
                              </div>
                            </td>
                            <td className="min-w-[260px] px-4 py-3.5 align-top">
                              <div className="space-y-2">
                                <button type="button" onClick={() => void openBulkSplitEditor('Settlement lines', [...checkoutServiceBlocks.map((service, idx) => `settlement:${settlement.id}:${service.line_key ?? `service:${service.id ?? idx}`}`), ...addons.map((addon, idx) => `settlement:${settlement.id}:${addon.line_key ?? `addon:${addon.id ?? idx}`}`)], settlement.staff_splits?.map((split) => ({ staff_id: split.staff_id, share_percent: split.share_percent })) ?? [])} className="inline-flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">Apply Staff Split to All Lines</button>
                                <button
                                  type="button"
                                  onClick={() => void openCartEditSettlement(settlement)}
                                  className="ml-2 inline-flex items-center gap-1.5 rounded-lg border-2 border-indigo-500 bg-gradient-to-r from-indigo-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-indigo-600 hover:to-indigo-700"
                                >
                                  Edit Settlement
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 align-top tabular-nums text-xs text-gray-400">—</td>
                            <td className="px-4 py-3.5 text-right align-top tabular-nums sm:px-5">
                              <p className="text-xs text-gray-400">—</p>
                            </td>
                          </tr>

                          {hasServiceBlocks ? (
                            <>
                              {checkoutServiceBlocks.map((service, idx) => {
                                const servicePrice = Number(service.gross_amount ?? service.balance_due ?? service.extra_price ?? 0)
                                const serviceDiscount = Number(service.discount_amount ?? 0)
                                const serviceNet = Number(service.line_total_after_discount ?? Math.max(0, servicePrice - serviceDiscount))
                                const coveredByPackage = mainCoveredByPkg && (service.is_original ?? idx === 0)
                                const displayServiceNet = coveredByPackage ? 0 : serviceNet
                                const serviceSettlementSplitKey = `settlement:${settlement.id}:${service.line_key ?? `service:${service.id ?? idx}`}`
                                const serviceSettlementSplits = checkoutLineSplits[serviceSettlementSplitKey] ?? (service.staff_splits ?? settlement.staff_splits ?? [])
                                const serviceSettlementSplitSummary = formatLineSplitSummary(serviceSettlementSplitKey, settlement.staff_splits?.map((split) => ({ staff_id: split.staff_id, share_percent: split.share_percent })) ?? [], 'main service')
                                const packageOriginalPrice = resolveSettlementLineOriginalPrice(
                                  service,
                                  checkoutOriginalServiceReference,
                                  settlement.service_total,
                                  pkgOffset,
                                )
                                return (
                                  <Fragment key={`chk-main-block-row-${settlement.id}-${service.id ?? service.name}-${idx}`}>
                                    <tr className={`${stRowClass} align-top`}>
                                      <td className="px-4 py-2.5 pl-7 sm:px-5 sm:pl-8">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Services Block</p>
                                        <ServiceNameStack name={`${service.name}${service.is_original ? ' (Original)' : ''}`} cnName={service.cn_name} primaryClassName="mt-1 text-xs text-gray-700" secondaryClassName="mt-0.5 text-[10px] text-gray-500" />
                                        {coveredByPackage ? (
                                          <p className="mt-1 text-[10px] font-medium leading-snug text-emerald-700">
                                            Included in your package (main service)
                                          </p>
                                        ) : null}
                                      </td>
                                      <td className="min-w-[260px] px-4 py-2.5 align-top">
                                        {renderGlobalBulkLineCheckbox(serviceSettlementSplitKey)}
                                        <p className="mb-1 text-[11px] font-medium text-gray-600">{serviceSettlementSplitSummary}</p>
                                        <button type="button" onClick={() => service.line_key && openDiscountModal({ kind: 'settlementLine', id: settlement.id, lineKey: service.line_key, name: service.name, lineTotal: servicePrice, discountType: service.discount_type ?? null, discountValue: Number(service.discount_value ?? 0), discountRemark: service.discount_remark ?? null })} disabled={!service.line_key} className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50">
                                          {serviceDiscount > 0 ? 'Edit Discount' : 'Discount'}
                                        </button>
                                        {!coveredByPackage && service.line_key ? <button type="button" onClick={() => openPriceEditModal({ kind: 'settlementLine', id: settlement.id, lineKey: service.line_key!, name: service.name, currentUnitPrice: servicePrice, originalUnitPrice: Number(service.price_override?.original_unit_price ?? service.extra_price ?? servicePrice) })} className="ml-2 inline-flex items-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Edit Price</button> : null}
                                        <button type="button" onClick={() => void openLineSplitEditor(serviceSettlementSplitKey, service.name ?? 'Settlement service', settlement.staff_splits?.map((split) => ({ staff_id: split.staff_id, share_percent: split.share_percent })) ?? [])} className="ml-2 inline-flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">{checkoutLineSplits[serviceSettlementSplitKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button>
                                      </td>
                                      <td className="px-4 py-2.5 align-top tabular-nums text-xs font-semibold text-gray-700">
                                        {coveredByPackage ? (
                                          <PosPackageIncludedAmount originalAmount={packageOriginalPrice} inline />
                                        ) : (
                                          <>RM {serviceNet.toFixed(2)}</>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5 text-right align-top tabular-nums sm:px-5">
                                        {coveredByPackage ? (
                                          <PosPackageIncludedAmount originalAmount={packageOriginalPrice} />
                                        ) : serviceDiscount > 0 ? (
                                          <div className="space-y-0.5">
                                            <p className="text-xs text-gray-400 line-through">RM {servicePrice.toFixed(2)}</p>
                                            <p className="text-xs font-semibold text-amber-700">- RM {serviceDiscount.toFixed(2)}</p>
                                            <p className="text-lg font-bold leading-tight text-orange-700">RM {displayServiceNet.toFixed(2)}</p>
                                          </div>
                                        ) : (
                                          <p className="text-lg font-bold leading-tight text-orange-700">RM {serviceNet.toFixed(2)}</p>
                                        )}
                                      </td>
                                    </tr>
                                    {/* <tr className={`${stRowClass} align-top`}>
                                      <td className="px-4 py-2 pl-8 text-xs font-semibold text-gray-700 sm:px-5 sm:pl-10">Block Subtotal</td>
                                      <td className="min-w-[260px] px-4 py-2" aria-hidden />
                                      <td className="px-4 py-2 align-top tabular-nums text-xs text-gray-400">—</td>
                                      <td className="px-4 py-2 text-right align-top tabular-nums sm:px-5">
                                        <p className="text-lg font-bold leading-tight text-orange-700">RM {serviceSubtotal.toFixed(2)}</p>
                                      </td>
                                    </tr> */}
                                  </Fragment>
                                )
                              })}
                              {addonCount > 0 ? addons.map((addon, idx) => {
                                const gross = Number(addon.gross_amount ?? addon.balance_due ?? addon.extra_price ?? 0)
                                const addonReference = Number(addon.extra_price ?? gross)
                                const discount = Number(addon.discount_amount ?? 0)
                                const due = Number(addon.line_total_after_discount ?? Math.max(0, gross - discount))
                                const coveredByPackage = pkgOffset > checkoutOriginalServiceReference + 0.0001 && due <= 0.0001 && addonReference > 0.0001
                                const addonOriginalPrice = resolveSettlementLineOriginalPrice(addon, addonReference, gross)
                                const displayDue = coveredByPackage ? 0 : due
                                const addonSettlementSplitKey = `settlement:${settlement.id}:${addon.line_key ?? `addon:${addon.id ?? idx}`}`
                                const addonSettlementSplits = checkoutLineSplits[addonSettlementSplitKey] ?? (addon.staff_splits ?? settlement.staff_splits ?? [])
                                const addonSettlementSplitSummary = formatLineSplitSummary(addonSettlementSplitKey, settlement.staff_splits?.map((split) => ({ staff_id: split.staff_id, share_percent: split.share_percent })) ?? [], 'main service')
                                return (
                                  <tr key={`chk-st-addon-block-${settlement.id}-${addon.id ?? addon.name}-${idx}`} className={`${stRowClass} align-top`}>
                                    <td className="px-4 py-2 pl-8 text-xs text-gray-700 sm:px-5 sm:pl-10"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Add-on</p><span className="text-gray-500">+</span> {addon.name}{addon.cn_name ? <span className="block pl-2 text-[10px] text-gray-500">{addon.cn_name}</span> : null}{coveredByPackage ? <span className="mt-1 block pl-2 text-[10px] font-medium leading-snug text-emerald-700">Included in your package (add-on)</span> : null}</td>
                                    <td className="min-w-[260px] px-4 py-2 align-top">{renderGlobalBulkLineCheckbox(addonSettlementSplitKey)}<p className="mb-1 text-[11px] font-medium text-gray-600">{addonSettlementSplitSummary}</p><button type="button" onClick={() => addon.line_key && openDiscountModal({ kind: 'settlementLine', id: settlement.id, lineKey: addon.line_key, name: addon.name, lineTotal: gross, discountType: addon.discount_type ?? null, discountValue: Number(addon.discount_value ?? 0), discountRemark: addon.discount_remark ?? null })} disabled={!addon.line_key} className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50">{discount > 0 ? 'Edit Discount' : 'Discount'}</button>{!coveredByPackage && addon.line_key ? <button type="button" onClick={() => openPriceEditModal({ kind: 'settlementLine', id: settlement.id, lineKey: addon.line_key!, name: addon.name, currentUnitPrice: gross, originalUnitPrice: Number(addon.price_override?.original_unit_price ?? addon.extra_price ?? gross) })} className="ml-2 inline-flex items-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Edit Price</button> : null}<button type="button" onClick={() => void openLineSplitEditor(addonSettlementSplitKey, addon.name ?? 'Settlement add-on', settlement.staff_splits?.map((split) => ({ staff_id: split.staff_id, share_percent: split.share_percent })) ?? [])} className="ml-2 inline-flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">{checkoutLineSplits[addonSettlementSplitKey]?.length ? 'Edit Staff Split' : 'Assign Staff Split'}</button></td>
                                    <td className="px-4 py-2 align-top tabular-nums text-xs font-semibold text-gray-700">{coveredByPackage ? <PosPackageIncludedAmount originalAmount={addonOriginalPrice} inline /> : <>RM {due.toFixed(2)}</>}</td>
                                    <td className="px-4 py-2 text-right align-top tabular-nums sm:px-5">{coveredByPackage ? <PosPackageIncludedAmount originalAmount={addonOriginalPrice} /> : discount > 0 ? (<div className="space-y-0.5"><p className="text-xs text-gray-400 line-through">RM {gross.toFixed(2)}</p><p className="text-xs font-semibold text-amber-700">- RM {discount.toFixed(2)}</p><p className="text-lg font-bold leading-tight text-orange-700">RM {displayDue.toFixed(2)}</p></div>) : (<p className="text-lg font-bold leading-tight text-orange-700">RM {due.toFixed(2)}</p>)}</td>
                                  </tr>
                                )
                              }) : null}
                            </>
                          ) : (
                            <>
                              <tr className={`${stRowClass} align-top`}>
                                <td className="px-4 py-2.5 pl-7 sm:px-5 sm:pl-8">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Settlement</p>
                                  <p className="mt-1 text-xs text-gray-700">Service</p>
                                  {mainCoveredByPkg ? (
                                    <p className="mt-1 text-[10px] leading-snug text-cyan-800">
                                      Included in your package (main service)
                                    </p>
                                  ) : null}
                                </td>
                                <td className="min-w-[260px] px-4 py-2.5"><button type="button" onClick={() => void openLineSplitEditor(`settlement:${settlement.id}:service:original`, settlement.service_name ?? 'Settlement service', settlement.staff_splits?.map((split) => ({ staff_id: split.staff_id, share_percent: split.share_percent })) ?? [])} className="inline-flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">Assign Staff Split</button></td>
                                <td className="px-4 py-2.5 align-top tabular-nums text-xs text-gray-700">
                                  {mainCoveredByPkg ? (
                                    <PosPackageIncludedAmount originalAmount={fallbackMainOriginal} inline />
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right align-top tabular-nums sm:px-5">
                                  {mainCoveredByPkg ? (
                                    <PosPackageIncludedAmount originalAmount={fallbackMainOriginal} />
                                  ) : (
                                    <p className="text-lg font-bold leading-tight text-orange-700">{stServiceLabel}</p>
                                  )}
                                </td>
                              </tr>

                              {addonCount > 0 ? (
                            <>
                              <tr className={`${stRowClass} align-top`}>
                                <td className="px-4 py-1.5 pl-7 sm:px-5 sm:pl-8">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Add-ons</p>
                                </td>
                                <td className="min-w-[260px] px-4 py-1.5" aria-hidden />
                                <td className="px-4 py-1.5" colSpan={2} aria-hidden />
                              </tr>
                              {addons.map((addon, idx) => {
                                const gross = Number(addon.gross_amount ?? addon.balance_due ?? addon.extra_price ?? 0)
                                const discount = Number(addon.discount_amount ?? 0)
                                const due = Number(addon.line_total_after_discount ?? Math.max(0, gross - discount))
                                return (
                                  <tr
                                    key={`chk-st-addon-${settlement.id}-${addon.id ?? addon.name}-${idx}`}
                                    className={`${stRowClass} align-top`}
                                  >
                                    <td className="px-4 py-2 pl-8 text-xs text-gray-700 sm:px-5 sm:pl-10">
                                      <span className="text-gray-500">+</span> {addon.name}
                                      {addon.cn_name ? <span className="block pl-2 text-[10px] text-gray-500">{addon.cn_name}</span> : null}
                                    </td>
                                    <td className="min-w-[260px] px-4 py-2 align-top"><button type="button" onClick={() => addon.line_key && openDiscountModal({ kind: 'settlementLine', id: settlement.id, lineKey: addon.line_key, name: addon.name, lineTotal: gross, discountType: addon.discount_type ?? null, discountValue: Number(addon.discount_value ?? 0), discountRemark: addon.discount_remark ?? null })} disabled={!addon.line_key} className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50">{discount > 0 ? 'Edit Discount' : 'Discount'}</button>{addon.line_key ? <button type="button" onClick={() => openPriceEditModal({ kind: 'settlementLine', id: settlement.id, lineKey: addon.line_key!, name: addon.name, currentUnitPrice: gross, originalUnitPrice: Number(addon.price_override?.original_unit_price ?? addon.extra_price ?? gross) })} className="ml-2 inline-flex items-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Edit Price</button> : null}</td>
                                    <td className="px-4 py-2 align-top tabular-nums text-xs font-semibold text-gray-700">RM {due.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right align-top tabular-nums sm:px-5">{discount > 0 ? (<div className="space-y-0.5"><p className="text-xs text-gray-400 line-through">RM {gross.toFixed(2)}</p><p className="text-xs font-semibold text-amber-700">- RM {discount.toFixed(2)}</p><p className="text-lg font-bold leading-tight text-orange-700">RM {due.toFixed(2)}</p></div>) : (<p className="text-lg font-bold leading-tight text-orange-700">RM {due.toFixed(2)}</p>)}</td>
                                  </tr>
                                )
                              })}
                              {mainCoveredByPkg && addonDueSum > 0.0001 ? (
                                <tr className={`${stRowClass} align-top`}>
                                  <td
                                    className="px-4 py-2 pl-7 text-[10px] leading-snug text-gray-600 sm:px-5 sm:pl-8"
                                    colSpan={4}
                                  >
                                    Your package covers the <span className="font-semibold text-gray-900">main service</span>{' '}
                                    only. Add-ons above are still due at checkout.
                                  </td>
                                </tr>
                              ) : null}
                            </>
                          ) : null}
                            </>
                          )}

                          {depositCredit > 0.0001 ? (
                            <tr className={`${stRowClass} align-top`}>
                              <td className="px-4 py-2 pl-7 text-xs text-gray-700 sm:px-5 sm:pl-8">
                                Deposit
                              </td>
                              <td className="min-w-[260px] px-4 py-2" aria-hidden />
                              <td className="px-4 py-2 align-top tabular-nums text-xs text-gray-400">—</td>
                              <td className="px-4 py-2 text-right align-top tabular-nums sm:px-5">
                                <p className="text-lg font-bold leading-tight text-orange-700">− RM {depositCredit.toFixed(2)}</p>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })}

                    {cartPackageItems.map((packageItem) => {
                      const splitRows = packageCheckoutSplits[packageItem.id] ?? []

                      return (
                        <tr key={`checkout-package-${packageItem.id}`} className="bg-purple-50/50 hover:bg-purple-50/80 transition-colors align-middle">
                          <td className="px-4 py-3.5 sm:px-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">Type: Service Package</p>
                            <p className="mt-1 text-base font-bold leading-snug text-gray-900">{packageItem.package_name}</p>
                            <p className="text-xs font-medium text-gray-600 mt-1.5">{formatPosPackageMemberLabel(packageItem, selectedMember)}</p>
                            <p className="text-xs text-gray-500 mt-0.5 tabular-nums">Qty: {packageItem.qty}</p>
                          </td>
                          <td className="px-4 py-3.5 min-w-[260px] align-top">
                            <div className="space-y-2">
                              {renderGlobalBulkLineCheckbox(`package:${packageItem.id}`)}
                              <p className="text-xs leading-relaxed text-gray-700">
                                {splitRows.length > 0
                                  ? `${splitRows.length} staff (${splitRows.reduce((sum, row) => sum + Number(row.share_percent || 0), 0)}%)`
                                  : 'No staff assigned'}
                              </p>
                              <button
                                type="button"
                                onClick={() => void openPackageSplitEditor(packageItem.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-purple-500 bg-gradient-to-r from-purple-500 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-purple-600 hover:to-purple-700"
                              >
                                Assign Staff Split
                              </button>
                              <button
                                type="button"
                                onClick={() => openDiscountModal({
                                  kind: 'package',
                                  id: packageItem.id,
                                  name: packageItem.package_name,
                                  lineTotal: Number(packageItem.line_total_snapshot ?? packageItem.line_total ?? 0),
                                  discountType: packageItem.discount_type ?? null,
                                  discountValue: Number(packageItem.discount_value ?? 0),
                                  discountRemark: packageItem.discount_remark ?? null,
                                })}
                                className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"
                              >
                                {(packageItem.discount_amount ?? 0) > 0 ? 'Edit Discount' : 'Discount'}
                              </button>
                              <button type="button" onClick={() => openPriceEditModal({ kind: 'package', id: packageItem.id, name: packageItem.package_name, currentUnitPrice: Number(packageItem.unit_price ?? 0), originalUnitPrice: Number(packageItem.line_total_snapshot ?? packageItem.line_total ?? 0) / Math.max(1, Number(packageItem.qty ?? 1)), quantity: Number(packageItem.qty ?? 1), currentLineTotal: Number(packageItem.line_total_snapshot ?? packageItem.line_total ?? 0) })} className="inline-flex items-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Edit Price</button>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 align-top tabular-nums">
                            <div className="space-y-1">
                              <p className="text-gray-700">RM {Number(packageItem.unit_price ?? 0).toFixed(2)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right align-top sm:px-5">
                            {(packageItem.discount_amount ?? 0) > 0 ? (
                              <div className="space-y-0.5">
                                <p className="text-xs text-gray-400 line-through">RM {Number(packageItem.line_total_snapshot ?? packageItem.line_total).toFixed(2)}</p>
                                <p className="text-xs text-amber-700">- RM {Number(packageItem.discount_amount ?? 0).toFixed(2)}</p>
                                <p className="text-lg font-bold tabular-nums text-orange-700">RM {Number(packageItem.line_total ?? 0).toFixed(2)}</p>
                              </div>
                            ) : (
                              <p className="text-lg font-bold tabular-nums text-orange-700">RM {Number(packageItem.line_total ?? 0).toFixed(2)}</p>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>


              {/* {(cart?.service_items?.length ?? 0) > 0 && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <h5 className="text-sm font-bold text-emerald-900">Booking Deposit Summary</h5>
                  <div className="mt-2 space-y-1 text-xs text-emerald-900">
                    <p>Premium services: {bookingDepositBreakdown?.premium_count ?? 0}</p>
                    <p>Standard services: {bookingDepositBreakdown?.standard_count ?? 0}</p>
                    <p>Premium deposit total: RM {Number(bookingDepositBreakdown?.premium_deposit_total ?? 0).toFixed(2)}</p>
                    <p>Standard-only base deposit: RM {Number(bookingDepositBreakdown?.standard_base_amount ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="mt-2 border-t border-emerald-200 pt-2 text-sm font-bold text-emerald-800">
                    Booking deposit total: RM {bookingDepositTotal.toFixed(2)}
                  </div>
                </div>
              )} */}

              <div className="mt-6 rounded-xl border-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4 shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-600">Subtotal</p>
                    <p className="text-sm font-semibold text-gray-700">RM {cartSubtotal.toFixed(2)}</p>
                  </div>
                  {promotionDiscount > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-600">Promotion Discount</p>
                      <p className="text-sm font-semibold text-gray-700">- RM {promotionDiscount.toFixed(2)}</p>
                    </div>
                  )}
                  {voucherDiscount > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-600">Voucher Discount</p>
                      <p className="text-sm font-semibold text-gray-700">- RM {voucherDiscount.toFixed(2)}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-gray-300 pt-2 mt-2">
                    <p className="text-base font-semibold text-gray-700">Net Amount</p>
                    <p className="text-2xl font-bold text-orange-700">RM {cartTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border-2 border-gray-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-bold text-gray-800">Customer</p>
                    {!checkoutRequiresCustomerValidation ? (
                      <button
                        type="button"
                        onClick={() => void clearOptionalProductSaleContext()}
                        className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  {!checkoutRequiresCustomerValidation ? (
                    <p className="mt-1 text-xs font-bold text-amber-800">
                     IMPORTANT : Product sale — optional member or guest details (voucher / receipt). Checkout does not require a customer.
                    </p>
                  ) : checkoutRequiresMemberOnly ? (
                    <p className="mt-1 text-xs font-bold text-amber-800">
                      IMPORTANT :
                      A service package is in the cart — checkout must use a <span className="font-semibold">member</span>. Guest checkout is not available.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-bold text-amber-800">
                     IMPORTANT : This cart includes booking services — choose a member or guest details. You can switch here before paying; all booking lines will update to match.
                    </p>
                  )}

                  {showMemberGuestToggleInCheckout ? (
                    <div className="mt-3 inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5">
                      <button
                        type="button"
                        disabled={Boolean(settlementLockedIdentityMode && settlementLockedIdentityMode !== 'member')}
                        onClick={() => {
                          setCheckoutIdentityMode('member')
                          setCheckoutError(null)
                        }}
                        className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${settlementLockedIdentityMode && settlementLockedIdentityMode !== 'member' ? 'cursor-not-allowed opacity-60' : ''} ${checkoutIdentityMode === 'member' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        Member
                      </button>
                      <button
                        type="button"
                        disabled={checkoutRequiresMemberOnly || Boolean(settlementLockedIdentityMode && settlementLockedIdentityMode !== 'guest')}
                        onClick={() => {
                          setCheckoutIdentityMode('guest')
                          setSelectedMember(null)
                          setCheckoutError(null)
                        }}
                        className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${(checkoutRequiresMemberOnly || (settlementLockedIdentityMode && settlementLockedIdentityMode !== 'guest')) ? 'cursor-not-allowed opacity-60' : ''} ${checkoutIdentityMode === 'guest' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        Guest details
                      </button>
                    </div>
                  ) : null}

                  {hasCartAppointmentSettlements ? (
                    <p className="mt-2 text-[11px] text-amber-700">
                      Settlement is in the cart — customer is locked to <span className="font-semibold">{settlementLockedIdentityMode === 'guest' ? 'guest' : 'member'}</span>. Remove the settlement item to change customer.
                    </p>
                  ) : null}

                  {(checkoutRequiresMemberOnly || checkoutIdentityMode === 'member') && (
                    <div className="mt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-gray-600">Member</label>
                        <button
                          type="button"
                          disabled={hasCartAppointmentSettlements}
                          onClick={() => openAssignMemberModal('checkout')}
                          className={`shrink-0 rounded-xl border-2 border-blue-400 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-all ${hasCartAppointmentSettlements ? 'cursor-not-allowed opacity-60' : 'hover:bg-blue-50'}`}
                        >
                          {selectedMember ? 'change member' : 'assign member'}
                        </button>
                      </div>
                      <div className="mt-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800">
                        {selectedMember
                          ? `${selectedMember.name}${selectedMember.phone ? ` (${selectedMember.phone})` : ''}`
                          : 'No member selected yet'}
                      </div>
                    </div>
                  )}

                  {showMemberGuestToggleInCheckout && checkoutIdentityMode === 'guest' ? (
                    <div className="mt-4 space-y-2 rounded-lg border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold text-gray-700">Guest details</p>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600">Name *</label>
                        <input
                          value={guestContactCache.name}
                          onChange={(e) => {
                            setGuestContactCache((prev) => ({ ...prev, name: e.target.value }))
                            setCheckoutError(null)
                          }}
                          className="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          placeholder="Name *"
                          autoComplete="name"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600">Phone{checkoutGuestIsUnknown ? '' : ' *'}</label>
                        <InternationalPhoneInput
                          value={guestContactCache.phone}
                          onChange={(phone) => {
                            setGuestContactCache((prev) => ({ ...prev, phone }))
                            setCheckoutError(null)
                          }}
                          placeholder={checkoutGuestIsUnknown ? 'Phone (optional)' : 'Phone *'}
                          required={!checkoutGuestIsUnknown}
                        />
                      </div>
                      {checkoutGuestIsUnknown ? (
                        <p className="text-[11px] text-amber-700">Walk-in / Unknown customer — no contact details required.</p>
                      ) : null}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600">Email{checkoutGuestIsUnknown ? '' : ' *'}</label>
                        <input
                          type="email"
                          value={guestContactCache.email}
                          onChange={(e) => {
                            setGuestContactCache((prev) => ({ ...prev, email: e.target.value }))
                            setCheckoutError(null)
                          }}
                          className="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          placeholder={checkoutGuestIsUnknown ? 'Email (optional)' : 'Email *'}
                          autoComplete="email"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

              <div className="mt-6 rounded-xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-gray-800">Split Payment</p>
                  <p className="text-xs font-semibold text-gray-500">Enter paid amount per method</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {SPLIT_PAYMENT_METHODS.map(({ method, label }) => (
                    <div key={method} className="rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setSplitPaymentAmounts({ cash: '', qrpay: '', credit_card: '', [method]: cartTotal.toFixed(2) })
                          setPaymentMethod(method === 'credit_card' ? 'billplz_credit_card' : method)
                          setCheckoutError(null)
                        }}
                        className="mb-3 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                      >
                        {label}
                      </button>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label} Amount</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={splitPaymentAmounts[method]}
                        onChange={(e) => {
                          setSplitPaymentAmounts((prev) => ({ ...prev, [method]: e.target.value }))
                          setPaymentMethod(method === 'credit_card' ? 'billplz_credit_card' : method)
                          setCheckoutError(null)
                        }}
                        className="mt-1 h-12 w-full rounded-xl border-2 border-gray-300 bg-white px-4 text-base font-bold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-3">
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Grand Total</span>
                    <p className="font-bold text-gray-900">RM {cartTotal.toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Total Paid</span>
                    <p className="font-bold text-blue-700">RM {splitTotalPaid.toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">{splitCashOnlyOverpaid ? 'Change' : splitMixedOverpaid ? 'Overpaid' : 'Remaining'}</span>
                    <p className={`font-bold ${splitMixedOverpaid ? 'text-red-700' : splitRemaining > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                      {splitCashOnlyOverpaid
                        ? `RM ${splitChange.toFixed(2)}`
                        : splitMixedOverpaid
                          ? `RM ${splitOverpaid.toFixed(2)}`
                          : `RM ${splitRemaining.toFixed(2)}`}
                    </p>
                  </div>
                </div>
                {splitMixedOverpaid ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Payment total cannot exceed grand total for split/non-cash payment.</p>
                ) : null}
              </div>

              <div className="mt-6 space-y-3 rounded-xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 shadow-sm">
                  <label className="block text-sm font-bold text-gray-900">Upload Payment Proof (optional)</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button type="button" className="h-11 rounded-xl border-2 border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 active:scale-95 shadow-sm" onClick={() => qrUploadInputRef.current?.click()}>
                      Upload
                    </button>
                    <button type="button" className="h-11 rounded-xl border-2 border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 active:scale-95 shadow-sm" onClick={() => qrCameraBackInputRef.current?.click()}>
                      Back Camera
                    </button>
                    <button type="button" className="h-11 rounded-xl border-2 border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 active:scale-95 shadow-sm" onClick={() => qrCameraFrontInputRef.current?.click()}>
                      Front Camera
                    </button>
                  </div>
                  <input ref={qrUploadInputRef} type="file" accept="image/*" onChange={onSelectQrProof} className="sr-only" />
                  <input ref={qrCameraBackInputRef} type="file" accept="image/*" capture="environment" onChange={onSelectQrProof} className="sr-only" />
                  <input ref={qrCameraFrontInputRef} type="file" accept="image/*" capture="user" onChange={onSelectQrProof} className="sr-only" />
                  {qrProofFileName ? (
                    <div className="flex items-center justify-between rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 shadow-sm">
                      <p className="truncate pr-2 text-sm font-medium text-green-800">{qrProofFileName}</p>
                      <button type="button" className="text-sm font-semibold text-red-600 hover:text-red-700 underline transition-colors" onClick={clearQrProof}>Clear</button>
                    </div>
                  ) : null}
                </div>

              <div className="mt-5 rounded-xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 shadow-sm overflow-hidden">
                <label className="flex cursor-pointer items-center gap-3 px-5 py-4 select-none">
                  <input
                    type="checkbox"
                    checked={autoPrint}
                    onChange={(e) => setAutoPrint(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-700">Auto Print Receipt</span>
                  </div>
                </label>

                {autoPrint && (
                  <div className="border-t border-gray-200 px-5 py-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Print via</span>
                      <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setPrintMode('bluetooth')}
                          className={`px-3 py-1.5 transition-all ${printMode === 'bluetooth' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          Bluetooth
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintMode('wifi')}
                          className={`px-3 py-1.5 border-l border-gray-300 transition-all ${printMode === 'wifi' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          WiFi
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintMode('usb')}
                          className={`px-3 py-1.5 border-l border-gray-300 transition-all ${printMode === 'usb' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          USB
                        </button>
                      </div>
                    </div>

                    {printMode === 'bluetooth' && (
                      <div>
                        {btPrinterName ? (
                          <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                            <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                              </span>
                              {btPrinterName}
                            </div>
                            <button
                              type="button"
                              onClick={handleDisconnectBtPrinter}
                              className="text-xs font-semibold text-red-600 hover:text-red-700 underline transition-colors"
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleConnectBtPrinter()}
                            disabled={btConnecting}
                            className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {btConnecting ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Connecting...
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Connect Bluetooth Printer
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {printMode === 'wifi' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={wifiPrinterIp}
                            onChange={(e) => { setWifiPrinterIp(e.target.value); setWifiTestOk(null) }}
                            placeholder="Printer IP (e.g. 192.168.1.100)"
                            className="h-9 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500"
                          />
                          <input
                            type="text"
                            value={wifiPrinterPort}
                            onChange={(e) => { setWifiPrinterPort(e.target.value); setWifiTestOk(null) }}
                            placeholder="Port"
                            className="h-9 w-20 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleTestWifiPrinter()}
                          disabled={wifiTesting || !wifiPrinterIp.trim()}
                          className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {wifiTesting ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Testing...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Test Print
                            </span>
                          )}
                        </button>
                        {wifiTestOk === true && (
                          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-800">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                            </span>
                            Printer reachable — test receipt sent
                          </div>
                        )}
                        {wifiTestOk === false && (
                          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                            </svg>
                            Could not reach printer — check IP &amp; port
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {checkoutError ? (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{checkoutError}</div>
              ) : null}

              <div className="mt-8 flex gap-4 pt-2 flex-shrink-0">
                <button
                  type="button"
                  className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-6 py-3.5 text-base font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 active:scale-95 shadow-sm"
                  onClick={() => {
                    setCheckoutError(null)
                    setCheckoutConfirmationOpen(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmCheckout()}
                  disabled={!canConfirmCheckoutInModal}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:from-blue-700 hover:via-blue-700 hover:to-blue-800 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-300 disabled:via-gray-300 disabled:to-gray-400 disabled:shadow-none active:scale-95"
                >
                  Confirm Checkout
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {itemSplitEditorOpen && itemSplitEditorTarget ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl my-8 rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h5 className="text-lg font-bold text-gray-900">{itemSplitEditorTarget.type === 'settlement' ? 'Edit Worker' : itemSplitEditorTarget.type === 'bulk' ? `Apply Staff Split${itemSplitEditorTarget.title ? `: ${itemSplitEditorTarget.title}` : ''}` : itemSplitEditorTarget.type === 'line' ? `Line Staff Split${itemSplitEditorTarget.title ? `: ${itemSplitEditorTarget.title}` : ''}` : 'Item Staff Split'}</h5>
              <button type="button" onClick={() => { setItemSplitEditorOpen(false); setItemSplitEditorTarget(null) }} className="text-2xl leading-none text-gray-500">×</button>
            </div>

            <div className="space-y-3 p-5">
              {itemSplitEditorTarget.type === 'bulk' ? (
                <label className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  <input type="checkbox" checked={bulkSplitOverwrite} onChange={(event) => setBulkSplitOverwrite(event.target.checked)} className="h-4 w-4" />
                  Overwrite existing child staff splits
                </label>
              ) : null}
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={itemSplitAutoBalance}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setItemSplitAutoBalance(checked)
                    if (checked) {
                      setItemSplitDraftRows((prev) => {
                        if (prev.length <= 1) return prev
                        const othersTotal = prev.slice(1).reduce((sum, row) => sum + Math.max(0, row.share_percent), 0)
                        return prev.map((row, idx) => (idx === 0 ? { ...row, share_percent: Math.max(0, 100 - othersTotal) } : row))
                      })
                    }
                  }}
                  className="h-4 w-4"
                />
                Auto Balance
              </label>

              <div className="space-y-3 pr-1">
                {itemSplitDraftRows.map((row, index) => (
                  <div key={row.id} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[1.6fr_0.8fr_auto] sm:items-end">
                    <div className="relative">
                      <label className="mb-1 block text-xs font-semibold text-gray-600">Staff</label>
                      <input
                        value={row.search}
                        onFocus={() => setItemSplitDraftRows((prev) => prev.map((item) => item.id === row.id ? { ...item, open: true } : item))}
                        onChange={(event) => setDraftRowSearch(row.id, event.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
                        placeholder="Search staff by name / phone / email"
                      />
                      {row.open && (() => {
                        // Filter out already selected staff (except the current row's selected staff)
                        const selectedStaffIds = new Set(
                          itemSplitDraftRows
                            .filter(r => r.id !== row.id && r.staff_id !== null)
                            .map(r => r.staff_id!)
                        )
                        const availableOptions = row.options.filter(staff => !selectedStaffIds.has(staff.id))
                        
                        return (
                          <div className="absolute z-[80] mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
                            {row.loading ? (
                              <p className="px-3 py-2 text-xs text-gray-500">Searching...</p>
                            ) : availableOptions.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-gray-500">No available staff</p>
                            ) : (
                              availableOptions.map((staff) => (
                                <button
                                  key={staff.id}
                                  type="button"
                                  onClick={() => selectDraftRowStaff(row.id, staff)}
                                  className="block w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-gray-50"
                                >
                                  <p className="text-xs font-semibold text-gray-900">{getStaffDropdownPrimary(staff)}</p>
                                  {!!staff.email && <p className="mt-0.5 text-[11px] text-gray-600">{staff.email}</p>}
                                </button>
                              ))
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-600">Share %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row.share_percent}
                        readOnly={itemSplitAutoBalance && index === 0}
                        onChange={(event) => onChangeDraftShare(row.id, Number(event.target.value || 0))}
                        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm read-only:bg-gray-100"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveDraftSplitRow(row.id)}
                      className="h-10 rounded-lg border border-red-300 px-3 text-red-700 hover:bg-red-50 flex items-center justify-center transition-colors"
                      title="Remove"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={onAddDraftSplitRow}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-500 bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-emerald-600 hover:to-emerald-700 hover:shadow-md active:scale-95"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Staff
              </button>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-700">Total %</span>
                <span className="text-sm font-bold text-gray-900">{itemSplitDraftRows.reduce((sum, row) => sum + row.share_percent, 0)}%</span>
              </div>

              {itemSplitError && <p className="text-xs font-medium text-red-600">{itemSplitError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setItemSplitEditorOpen(false); setItemSplitEditorTarget(null) }} className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">Cancel</button>
                <button
                  type="button"
                  onClick={saveItemSplitEditor}
                  disabled={!validateSplitDraft(itemSplitDraftRows).valid}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}


      {priceEditTarget ? (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h4 className="text-lg font-bold text-gray-900">Edit Price</h4>
            <p className="mt-1 text-sm text-gray-600">{priceEditTarget.name}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-sm">
              <div><p className="text-xs text-gray-500">Original price</p><p className="font-semibold tabular-nums">RM {Number(priceEditTarget.originalUnitPrice ?? 0).toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-500">Current price</p><p className="font-semibold tabular-nums">RM {Number(priceEditTarget.currentUnitPrice ?? 0).toFixed(2)}</p></div>
            </div>
            <div className="mt-4 rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-semibold text-gray-700">Edit by</p>
              <div className="mt-2 flex gap-3 text-sm">
                <label className="inline-flex items-center gap-2"><input type="radio" checked={priceEditMode === 'unit'} onChange={() => setPriceEditMode('unit')} /> Unit Price</label>
                <label className="inline-flex items-center gap-2"><input type="radio" checked={priceEditMode === 'line'} onChange={() => setPriceEditMode('line')} /> Line Total</label>
              </div>
              {priceEditMode === 'unit' ? (
                <label className="mt-3 block text-sm font-semibold text-gray-700">New Unit Price
                  <input type="number" min={0} step="0.01" value={priceEditValueDraft} onChange={(event) => setPriceEditValueDraft(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" />
                  <span className="mt-1 block text-xs font-medium text-gray-500">Calculated Line Total: RM {(Math.max(0, Number(priceEditValueDraft || 0)) * Math.max(1, Number(priceEditTarget.quantity ?? 1))).toFixed(2)}</span>
                </label>
              ) : (
                <label className="mt-3 block text-sm font-semibold text-gray-700">New Line Total
                  <input type="number" min={0} step="0.01" value={priceEditLineTotalDraft} onChange={(event) => setPriceEditLineTotalDraft(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" />
                  <span className="mt-1 block text-xs font-medium text-gray-500">Calculated Unit Price: RM {(Math.max(0, Number(priceEditLineTotalDraft || 0)) / Math.max(1, Number(priceEditTarget.quantity ?? 1))).toFixed(6)}</span>
                </label>
              )}
            </div>
            <label className="mt-3 block text-sm font-semibold text-gray-700">Reason / remark
              <textarea value={priceEditReasonDraft} onChange={(event) => setPriceEditReasonDraft(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Optional reason" />
            </label>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setPriceEditTarget(null)} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700">Cancel</button>
              <button type="button" onClick={() => void submitPriceEditModal()} disabled={priceEditSaving} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{priceEditSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {discountModalOpen && discountTarget ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h4 className="text-lg font-bold text-gray-900">Line Item Discount</h4>
            <p className="mt-1 text-sm text-gray-600">{discountTarget.name}</p>
            <p className="mt-1 text-xs text-gray-500">Line total: RM {Number(discountTarget.lineTotal ?? 0).toFixed(2)}</p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Discount Type
                <select value={discountTypeDraft} onChange={(event) => setDiscountTypeDraft(event.target.value as 'percentage' | 'fixed')} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm">
                  <option value="fixed">Fixed amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Discount Value {discountTypeDraft === 'percentage' ? '(%)' : '(RM)'}
                <input type="number" min={0} max={discountTypeDraft === 'percentage' ? 100 : Number(discountTarget.lineTotal ?? 0)} step="0.01" value={discountValueDraft} onChange={(event) => setDiscountValueDraft(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" />
              </label>
              <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-gray-700">
                <div className="flex justify-between gap-3"><span>Calculated discount</span><span className="font-semibold tabular-nums text-amber-700">-RM {Math.min(Number(discountTarget.lineTotal ?? 0), Math.max(0, discountTypeDraft === 'percentage' ? Number(discountTarget.lineTotal ?? 0) * (Number(discountValueDraft || 0) / 100) : Number(discountValueDraft || 0))).toFixed(2)}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span>Net amount</span><span className="font-semibold tabular-nums text-gray-900">RM {Math.max(0, Number(discountTarget.lineTotal ?? 0) - Math.min(Number(discountTarget.lineTotal ?? 0), Math.max(0, discountTypeDraft === 'percentage' ? Number(discountTarget.lineTotal ?? 0) * (Number(discountValueDraft || 0) / 100) : Number(discountValueDraft || 0)))).toFixed(2)}</span></div>
              </div>
              <label className="block text-sm font-semibold text-gray-700">
                Remarks (optional)
                <textarea value={discountRemarkDraft} onChange={(event) => setDiscountRemarkDraft(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="VIP discount / damaged box / promo adjustment" />
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setDiscountModalOpen(false)} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700">Cancel</button>
              {/* <button type="button" onClick={() => { setDiscountValueDraft(''); setDiscountRemarkDraft('') }} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Clear</button> */}
              <button type="button" onClick={() => void submitDiscountModal()} disabled={discountSaving} className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{discountSaving ? 'Saving…' : 'Apply'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {packageModalOpen && packageDraft && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900">Add Package to Cart</h3>
            <p className="mt-1 text-base text-gray-600">{packageDraft.name}</p>
            {hasCartAppointmentSettlements ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Settlement is in the cart — this package will use <span className="font-semibold">{selectedMember?.name ?? 'selected member'}</span>. Member switching is disabled.
              </p>
            ) : selectedMember ? (
              <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                Using member from your cart: <span className="font-semibold">{selectedMember.name}</span> — pre-filled below. Change here if needed.
              </p>
            ) : (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Service packages must be linked to a <span className="font-semibold">member</span>. Search and select one (guest checkout cannot be used for packages).
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-base font-bold text-gray-900">Package Summary</p>
                {(packageDraft.items_summary ?? []).length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {(packageDraft.items_summary ?? []).map((summary, idx) => (
                      <p key={`package-summary-${idx}`} className="text-sm font-medium text-gray-800">{summary}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-600">No items summary.</p>
                )}
                <div className="mt-3 space-y-1 text-sm text-gray-700">
                  <p>Selling Price: <span className="font-semibold text-gray-900">RM {Number(packageDraft.selling_price ?? 0).toFixed(2)}</span></p>
                  <p>Validity: <span className="font-semibold text-gray-900">{Number(packageDraft.valid_days ?? 0) > 0 ? `${packageDraft.valid_days} day(s)` : 'No expiry'}</span></p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-semibold text-gray-700">Member</label>
                  <button
                    type="button"
                    disabled={hasCartAppointmentSettlements}
                    onClick={() => openAssignMemberModal('package')}
                    className={`rounded-md border border-blue-300 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 ${hasCartAppointmentSettlements ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    {packageSelectedMember ? 'change member' : 'assign member'}
                  </button>
                </div>

                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {packageSelectedMember
                    ? `${packageSelectedMember.name}${packageSelectedMember.phone ? ` (${packageSelectedMember.phone})` : ''}`
                    : 'No member selected'}
                </div>

                <PosModalRemarkField
                  ref={packageRemarkRef}
                  resetKey={packageDraft?.id ?? 'package'}
                  className="mt-3"
                  label="Remark / Note (optional)"
                  placeholder="Internal note for staff (optional)"
                />

                {hasCartAppointmentSettlements ? (
                  <p className="mt-2 text-[11px] text-amber-700">
                    Settlement is in the cart — member is locked.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Staff split and commission preview will be configured in Checkout Confirmation.
            </div>

            {packageModalError ? <p className="mt-3 text-sm font-medium text-red-600">{packageModalError}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPackageModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitPackageToCart()}
                disabled={packageSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {packageSubmitting ? 'Adding...' : 'Add Package to Cart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {packageMemberPickerOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4 rounded-t-2xl">
              <h4 className="text-xl font-bold text-gray-900">assign member</h4>
              <button
                type="button"
                onClick={() => setPackageMemberPickerOpen(false)}
                className="rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="border-b-2 border-gray-200 bg-white p-5">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={packageMemberQuery}
                  onChange={(e) => setPackageMemberQuery(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Search by name or phone"
                  autoFocus
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Search member by name or phone. Type at least 3 characters to search.</p>
            </div>

            <div className="max-h-[65vh] overflow-auto">
              {packageMemberQuery.trim().length < 3 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  Type at least 3 characters to search.
                </div>
              ) : packageMembersLoading ? (
                <div className="p-6 text-sm text-gray-500">Loading members...</div>
              ) : (
                packageMembers.map((member) => (
                  <button
                    key={`package-member-modal-${member.id}`}
                    className="block w-full border-b border-gray-100 p-4 text-left transition-all hover:bg-gradient-to-r hover:from-blue-50 hover:to-white last:border-b-0 active:bg-blue-100"
                    onClick={async () => {
                      if (assignMemberContext === 'package') {
                        const fullMember = await hydrateMemberProfile(member)
                        setPackageSelectedMember(fullMember)
                      } else {
                        await onAssignMember(member)
                      }
                      setPackageMemberQuery('')
                      setPackageMemberPickerOpen(false)
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden border-2 border-blue-300">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={member.avatar_url || '/images/default_user_image.jpg'} alt={member.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-base leading-tight">{member.name}</p>
                        <p className="mt-1 text-xs text-gray-600">{member.phone_masked ?? '***'}</p>
                      </div>
                      <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))
              )}

              {!packageMembersLoading && packageMemberQuery.trim().length >= 3 && packageMembers.length === 0 && (
                <div className="p-12 text-center">
                  <p className="text-sm font-medium text-gray-600">No members found</p>
                  <p className="mt-1 text-xs text-gray-500">Try adjusting your search terms</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {bookingModalOpen && bookingServiceDraft && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[min(90vh,90dvh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add Service to Cart</h3>
                </div>

              </div>
              <div className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Selected Service</p>
                <div className="mt-1"><ServiceNameStack name={bookingServiceDraft.name} cnName={bookingServiceDraft.cn_name} /><p className="text-xs text-gray-500">{bookingServiceDraft.service_type}</p></div>
                <p className="mt-0.5 text-xs font-semibold text-gray-600 tabular-nums">
                  Base time: {Number(bookingServiceDraft.duration_min ?? 0)} min
                </p>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 overscroll-contain">
            {bookingModalError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {bookingModalError}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Main Services</p>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingExtraServiceBlocks((prev) => [
                        ...prev,
                        { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, service: null, questions: [], selectedOptionIds: [] },
                      ])
                    }}
                    className="rounded-md border border-blue-300 bg-white px-2 py-1 text-xs font-semibold text-blue-700"
                  >
                    + Add Main Service
                  </button>
                </div>
                {bookingQuestions.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-gray-800">Add-ons / Questions</p>
                    {bookingQuestions.map((question) => (
                      <div key={question.id} className="rounded border border-gray-200 bg-white p-2">
                        <p className="text-xs font-semibold text-gray-800">
                          {question.title}
                          {question.is_required ? <span className="ml-1 text-red-600">*</span> : null}
                        </p>
                        {question.cn_title ? <p className="mt-0.5 text-[11px] text-gray-500">{question.cn_title}</p> : null}
                        {question.description ? <p className="text-[11px] text-gray-500">{question.description}</p> : null}
                        {question.cn_description ? <p className="text-[11px] text-gray-500">{question.cn_description}</p> : null}
                        <div className="mt-2 space-y-1">
                          {question.options.map((option) => {
                            const checked = bookingSelectedOptionIds.includes(option.id)
                            return (
                              <label key={option.id} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-gray-800">
                                <div className="flex min-w-0 items-start gap-2">
                                  <input
                                    type="checkbox"
                                    name={`booking-question-${question.id}`}
                                    checked={checked}
                                    onChange={() => {
                                      setBookingSelectedOptionIds((prev) => {
                                        if (question.question_type === 'single_choice') {
                                          const withoutQuestion = prev.filter((id) => !question.options.some((opt) => opt.id === id))
                                          return checked ? withoutQuestion : [...withoutQuestion, option.id]
                                        }
                                        return checked ? prev.filter((id) => id !== option.id) : [...prev, option.id]
                                      })
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <ServiceNameStack
                                      name={option.label}
                                      cnName={option.cn_label ?? option.cn_name ?? option.linked_cn_name}
                                      primaryClassName="block truncate font-medium text-gray-900"
                                      secondaryClassName="mt-0.5 block truncate text-[11px] font-normal text-gray-500"
                                    />
                                    <span className="mt-0.5 block text-[11px] font-semibold text-gray-600 tabular-nums">
                                      TIME: {Number(option.extra_duration_min ?? 0)} min
                                    </span>
                                  </div>
                                </div>
                                <span className="shrink-0 tabular-nums font-semibold text-gray-900">
                                  +RM{Number(option.extra_price ?? 0).toFixed(2)}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <div className="rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-800">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">Total</p>
                      <div className="mt-2 space-y-1">
                        <p className="font-medium">
                          Duration: {Number(bookingServiceDraft.duration_min ?? 0) + bookingAddonDurationTotal + bookingExtraTotals.baseDuration + bookingExtraTotals.addonDuration} min
                        </p>
                        <p className="font-medium">
                          Total price: {bookingServiceDraft.price_mode === 'range' && bookingServiceDraft.price_range_min != null && bookingServiceDraft.price_range_max != null
                            ? `RM${(Number(bookingServiceDraft.price_range_min) + bookingAddonPriceTotal + bookingExtraTotals.basePrice + bookingExtraTotals.addonPrice).toFixed(2)} - RM${(Number(bookingServiceDraft.price_range_max) + bookingAddonPriceTotal + bookingExtraTotals.basePrice + bookingExtraTotals.addonPrice).toFixed(2)}`
                            : `RM${(Number(bookingServiceDraft.price ?? bookingServiceDraft.service_price ?? 0) + bookingAddonPriceTotal + bookingExtraTotals.basePrice + bookingExtraTotals.addonPrice).toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                    No add-ons for this service.
                  </div>
                )}
                {bookingExtraServiceBlocks.map((block, blockIndex) => (
                  <div key={block.id} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Service Block {blockIndex + 2}</p>
                        {block.service ? (
                          <ServiceNameStack
                            name={block.service.name}
                            cnName={block.service.cn_name}
                            primaryClassName="mt-0.5 text-sm font-semibold text-gray-900"
                            secondaryClassName="mt-0.5 text-xs text-gray-500"
                          />
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBookingExtraServiceBlocks((prev) => prev.filter((row) => row.id !== block.id))
                          setBookingExtraServiceCategoryIds((prev) => {
                            const next = { ...prev }
                            delete next[block.id]
                            return next
                          })
                          setBookingExtraServiceQueries((prev) => {
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
                    {(() => {
                      const takenByOthers = [
                        ...(bookingServiceDraft?.id ? [bookingServiceDraft.id] : []),
                        ...bookingExtraServiceBlocks
                          .filter((row) => row.id !== block.id)
                          .map((row) => Number(row.service?.id ?? 0))
                          .filter((id) => id > 0),
                      ]

                      return (
                        <BookingServicePicker
                          categories={bookingServiceCategories}
                          services={services}
                          selectedCategoryId={bookingExtraServiceCategoryIds[block.id] ?? null}
                          onCategoryChange={(next) => {
                            setBookingExtraServiceCategoryIds((prev) => ({ ...prev, [block.id]: next }))
                            if (next && block.service && !bookingServiceMatchesPickerCategory(block.service, next)) {
                              setBookingExtraServiceBlocks((prev) => prev.map((row) => row.id === block.id ? { ...row, service: null, questions: [], selectedOptionIds: [] } : row))
                            }
                          }}
                          searchQuery={bookingExtraServiceQueries[block.id] ?? ''}
                          onSearchQueryChange={(query) => setBookingExtraServiceQueries((prev) => ({ ...prev, [block.id]: query }))}
                          selectedServiceId={block.service?.id ?? null}
                          excludeServiceIds={takenByOthers}
                          onSelectService={async (service) => {
                            const selected = service as BookingServiceOption
                            const questions = await fetchBookingQuestions(selected.id)
                            setBookingExtraServiceBlocks((prev) =>
                              prev.map((row) =>
                                row.id === block.id
                                  ? { ...row, service: selected, questions, selectedOptionIds: [] }
                                  : row,
                              ),
                            )
                          }}
                          loading={servicesLoading || bookingSubmitting}
                          emptyMessage="No services found."
                          searchPlaceholder="Search service name..."
                        />
                      )
                    })()}
                    {block.questions.map((question) => (
                      <div key={`${block.id}-${question.id}`} className="rounded border border-gray-200 bg-white p-2">
                        <p className="text-xs font-semibold text-gray-800">
                          {question.title}
                          {question.is_required ? <span className="ml-1 text-red-600">*</span> : null}
                        </p>
                        {question.cn_title ? <p className="mt-0.5 text-[11px] text-gray-500">{question.cn_title}</p> : null}
                        <div className="mt-1 space-y-1">
                          {question.options.map((option) => {
                            const checked = block.selectedOptionIds.includes(option.id)
                            return (
                              <label key={`${block.id}-option-${option.id}`} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setBookingExtraServiceBlocks((prev) => prev.map((row) => {
                                        if (row.id !== block.id) return row
                                        if (question.question_type === 'single_choice') {
                                          const withoutQuestion = row.selectedOptionIds.filter((id) => !question.options.some((opt) => opt.id === id))
                                          return { ...row, selectedOptionIds: checked ? withoutQuestion : [...withoutQuestion, option.id] }
                                        }
                                        return { ...row, selectedOptionIds: checked ? row.selectedOptionIds.filter((id) => id !== option.id) : [...row.selectedOptionIds, option.id] }
                                      }))
                                    }}
                                  />
                                  <ServiceNameStack
                                    name={option.label}
                                    cnName={option.cn_label ?? option.cn_name ?? option.linked_cn_name}
                                    primaryClassName="text-xs text-gray-700"
                                    secondaryClassName="mt-0.5 text-[11px] text-gray-500"
                                  />
                                </div>
                                <span className="font-semibold text-gray-900">+RM{Number(option.extra_price ?? 0).toFixed(2)}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-600">Customer</p>
                  <div
                    className="mt-1 flex w-full rounded-lg border border-gray-200 bg-gray-100 p-1"
                    role="tablist"
                    aria-label="Customer type"
                  >
                    <button
                      type="button"
                      disabled={Boolean(settlementLockedIdentityMode && settlementLockedIdentityMode !== 'member')}
                      onClick={() => {
                        setBookingIdentityMode('member')
                        setBookingModalError(null)
                      }}
                      role="tab"
                      aria-selected={bookingIdentityMode === 'member'}
                      className={`flex-1 rounded-md px-3 py-2 text-[11px] font-semibold transition ${
                        settlementLockedIdentityMode && settlementLockedIdentityMode !== 'member'
                          ? 'cursor-not-allowed opacity-60'
                          : ''
                      } ${
                        bookingIdentityMode === 'member'
                          ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Member
                    </button>
                    <button
                      type="button"
                      disabled={checkoutRequiresMemberOnly || Boolean(settlementLockedIdentityMode && settlementLockedIdentityMode !== 'guest')}
                      onClick={() => {
                        setBookingIdentityMode('guest')
                        setBookingModalError(null)
                      }}
                      role="tab"
                      aria-selected={bookingIdentityMode === 'guest'}
                      className={`flex-1 rounded-md px-3 py-2 text-[11px] font-semibold transition ${
                        checkoutRequiresMemberOnly || (settlementLockedIdentityMode && settlementLockedIdentityMode !== 'guest')
                          ? 'cursor-not-allowed opacity-60'
                          : ''
                      } ${
                        bookingIdentityMode === 'guest'
                          ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Guest details
                    </button>
                  </div>
                  {hasCartAppointmentSettlements ? (
                    <p className="mt-2 text-[11px] text-amber-700">
                      Settlement is in the cart — customer is locked to <span className="font-semibold">{settlementLockedIdentityMode === 'guest' ? 'guest' : 'member'}</span>. Remove settlement to change customer mode.
                    </p>
                  ) : null}
                </div>

                {bookingIdentityMode === 'member' ? (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-gray-600">Member</label>
                      <button
                        type="button"
                        disabled={Boolean(settlementLockedIdentityMode)}
                        onClick={() => openAssignMemberModal('service')}
                        className={`rounded-md border border-blue-300 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 ${settlementLockedIdentityMode ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {selectedMember ? 'change member' : 'assign member'}
                      </button>
                    </div>
                    <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {selectedMember
                        ? `${selectedMember.name}${selectedMember.phone ? ` (${selectedMember.phone})` : ''}`
                        : 'No member selected'}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-700">Guest details</p>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600">Name *</label>
                      <input
                        ref={bookingGuestNameRef}
                        defaultValue={guestContactCache.name}
                        className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        placeholder="Name *"
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600">Phone *</label>
                      <InternationalPhoneInput
                        value={bookingGuestPhoneValue}
                        onChange={setBookingGuestPhoneValue}
                        placeholder="Phone *"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600">Email *</label>
                      <input
                        type="email"
                        ref={bookingGuestEmailRef}
                        defaultValue={guestContactCache.email}
                        className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        placeholder="Email *"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                )}

                {(bookingAllowedStaffs.length === 0) ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    This service is temporarily unavailable because no eligible staff is assigned.
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Appointment Date</label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => {
                        setBookingDate(e.target.value)
                        setBookingSlotValue('')
                        setBookingAssignedStaffId(null)
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Appointment Slot / Time</label>
                    <select
                      value={bookingSlotValue}
                      onChange={(e) => setBookingSlotValue(e.target.value)}
                      disabled={!bookingDate || bookingSlotsLoading}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                    >
                      <option value="">{bookingSlotsLoading ? 'Loading slots...' : 'Select slot'}</option>
                      {bookingSlots.map((slot) => (
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
                      options={bookingStaffPickerOptions.map((s) => ({ id: s.id, name: s.name }))}
                      value={bookingAssignedStaffId != null ? String(bookingAssignedStaffId) : ''}
                      onChange={(next) => setBookingAssignedStaffId(Number(next) || null)}
                      disabled={
                        bookingSubmitting ||
                        !bookingStaffPickerReady ||
                        bookingStaffPickerOptions.length === 0
                      }
                      placeholder={bookingStaffPickerReady ? 'Select staff' : 'Select date and slot first'}
                      searchPlaceholder="Search staff…"
                      unknownEntityLabel="Staff"
                      ariaLabel="Select staff"
                      emptySearchMessage="No staff match your search."
                      emptyListMessage={
                        bookingStaffPickerReady
                          ? 'No staff available for this slot.'
                          : 'Select appointment date and slot first.'
                      }
                    />
                  </div>
                </div>

                <PosModalRemarkField
                  ref={bookingRemarkRef}
                  resetKey={bookingServiceDraft?.id ?? 'booking'}
                  label="Remarks (optional)"
                />
              </div>
            </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setBookingModalOpen(false)
                  setBookingModalError(null)
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bookingSubmitting || bookingAllowedStaffs.length === 0}
                onClick={() => void submitBooking()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {bookingSubmitting ? 'Creating...' : 'Add Service to Cart'}
              </button>
            </div>
          </div>
        </div>
      )}


      {bookingProductOptionModalOpen && bookingProductDraft ? (
        <BookingProductOptionsModal
          draft={bookingProductDraft}
          onClose={() => setBookingProductOptionModalOpen(false)}
          onAdd={addBookingProductToCart}
        />
      ) : null}


      {memberOpen && (
        <div className={`fixed inset-0 ${bookingModalOpen || checkoutConfirmationOpen ? 'z-[140]' : 'z-50'} bg-black/40`}>
          <button type="button" className="absolute inset-0 h-full w-full cursor-default" onClick={closeMemberPanel} aria-label="Close member panel" />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl border-l border-gray-200 bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <div>
                  <h4 className="text-lg font-bold text-gray-900">Member Quick Lookup</h4>
                  <p className="text-xs text-gray-500">Search member by name or phone</p>
                </div>
                <button type="button" onClick={closeMemberPanel} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>

              {hasCartAppointmentSettlements ? (
                <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
                  Settlement is in the cart — member is locked. Remove settlement to change member.
                </div>
              ) : null}

              <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="border-b border-gray-200 p-5 md:border-b-0 md:border-r">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Type name or phone"
                      autoFocus
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Type at least 3 characters to search.</p>

                  <div className="mt-4 max-h-[52vh] overflow-auto rounded-lg border border-gray-100">
                    {memberQuery.trim().length < 3 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        <p>Search member by name or phone.</p>
                        <p className="mt-1 text-xs">Type at least 3 characters to search.</p>
                      </div>
                    ) : (
                      <>
                        {members.map((member) => (
                          <button
                            key={member.id}
                            className="block w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-blue-50 last:border-b-0"
                            onClick={() => {
                              setLookupMember(member)
                              void fetchMemberDetail(member.id, { page: 1, appointmentsPage: 1, updateSelectedMember: false })
                            }}
                          >
                            <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{member.phone_masked ?? '***'}</p>
                          </button>
                        ))}

                        {!memberLoading && members.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-gray-500">No members found.</div>
                        ) : null}
                      </>
                    )}
                  </div>

                  {memberQuery.trim().length >= 3 && members.length > 0 ? (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Page {memberPage} of {memberLastPage}</span>
                      <button
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
                        disabled={memberLoading || memberPage >= memberLastPage}
                        onClick={() => void fetchMemberPage(memberPage + 1, memberQuery, true)}
                      >
                        {memberLoading ? 'Loading...' : 'Load More'}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="min-h-0 overflow-y-auto p-5">
                  {lookupMember && memberDetailLoading ? (
                    <p className="text-sm text-gray-500">Loading member details...</p>
                  ) : null}

                  {!lookupMember ? (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                      Select a member from the search results to view profile details and recent orders.
                    </div>
                  ) : memberDetail ? (
                    <div className="space-y-5">
                      <section>
                        <h5 className="text-sm font-bold text-gray-900">Overview</h5>
                        <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-700">
                          <p><span className="font-semibold text-gray-900">Full Name:</span> {memberDetail.name || '—'}</p>
                          <p><span className="font-semibold text-gray-900">Phone:</span> {memberDetail.phone || '—'}</p>
                          <p><span className="font-semibold text-gray-900">Email:</span> {memberDetail.email || '—'}</p>
                          <p><span className="font-semibold text-gray-900">Join Date:</span> {memberDetail.join_date ? new Date(memberDetail.join_date).toLocaleString() : '—'}</p>
                          <p><span className="font-semibold text-gray-900">Customer Type:</span> {memberDetail.customer_type || '—'}</p>
                          <p><span className="font-semibold text-gray-900">Total Orders:</span> {memberDetail.total_orders ?? 0}</p>
                          <p><span className="font-semibold text-gray-900">Total Spent:</span> RM {Number(memberDetail.total_spent ?? 0).toFixed(2)}</p>
                          <p><span className="font-semibold text-gray-900">Last Order Date:</span> {memberDetail.last_order_date ? new Date(memberDetail.last_order_date).toLocaleString() : '—'}</p>
                          <p><span className="font-semibold text-gray-900">Member Points Balance:</span> {memberDetail.points_balance ?? 0}</p>
                        </div>
                      </section>

                      <section>
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-bold text-gray-900">Active Packages (Summary)</h5>
                          <p className="text-xs text-gray-500">Total: {memberActivePackagesTotal}</p>
                        </div>
                        <div className="mt-2 space-y-2">
                          {memberActivePackages.length === 0 ? (
                            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">No active packages.</p>
                          ) : memberActivePackages.map((pkg) => (
                            <div key={pkg.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                              <p className="text-sm font-semibold text-gray-900">{pkg.package_name || `Package #${pkg.id}`}</p>
                              <p>Expires: {pkg.expires_at ? new Date(pkg.expires_at).toLocaleString() : 'No expiry'}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-bold text-gray-900">Upcoming Appointments</h5>
                          <p className="text-xs text-gray-500">
                            Showing {memberUpcomingAppointments.length} of {memberUpcomingAppointmentsMeta.total}
                          </p>
                        </div>
                        <div className="mt-2 space-y-2">
                          {memberUpcomingAppointments.length === 0 ? (
                            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">No upcoming appointments.</p>
                          ) : memberUpcomingAppointments.map((appointment) => (
                            <div key={appointment.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                              <p className="text-sm font-semibold text-gray-900">{appointment.booking_code || `Booking #${appointment.id}`}</p>
                              <p>Status: {appointment.status || '—'}</p>
                              <div>Service: <ServiceNameStack name={appointment.service_name} cnName={appointment.service_cn_name} primaryClassName="inline text-sm font-medium text-gray-900" secondaryClassName="mt-0.5 text-xs text-gray-500" /></div>
                              <p>Staff: {appointment.staff_name || '—'}</p>
                              <p>Time: {appointment.start_at ? new Date(appointment.start_at).toLocaleString() : '—'}</p>
                            </div>
                          ))}
                        </div>
                        {memberUpcomingAppointmentsMeta.current_page < memberUpcomingAppointmentsMeta.last_page ? (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (!lookupMember?.id) return
                                void fetchMemberDetail(lookupMember.id, {
                                  appointmentsPage: memberUpcomingAppointmentsMeta.current_page + 1,
                                  appendAppointments: true,
                                  silent: true,
                                  updateSelectedMember: false,
                                })
                              }}
                              disabled={memberAppointmentsLoadingMore}
                              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {memberAppointmentsLoadingMore ? 'Loading...' : 'Load More Appointments'}
                            </button>
                          </div>
                        ) : null}
                      </section>

                      <section>
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-bold text-gray-900">Recent Orders</h5>
                          <p className="text-xs text-gray-500">
                            Showing {memberRecentOrders.length} of {memberRecentOrdersMeta.total}
                          </p>
                        </div>
                        <div className="mt-2 space-y-2">
                          {memberRecentOrders.length === 0 ? (
                            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">No recent orders.</p>
                          ) : memberRecentOrders.map((order) => (
                            <div key={order.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-0.5 text-xs text-gray-600">
                                  <p className="text-sm font-semibold text-gray-900">{order.order_number || `#${order.id}`}</p>
                                  <p>Date: {order.order_date ? new Date(order.order_date).toLocaleString() : '—'}</p>
                                  <p>Status: {order.status || '—'}</p>
                                  <p>Total: RM {Number(order.total_amount ?? 0).toFixed(2)}</p>
                                  <p>Channel: {order.channel || '—'}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMemberOrderViewId(order.id)
                                  }}
                                  className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                  View Order
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {memberRecentOrdersMeta.current_page < memberRecentOrdersMeta.last_page ? (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (!lookupMember?.id) return
                                void fetchMemberDetail(lookupMember.id, {
                                  page: memberRecentOrdersMeta.current_page + 1,
                                  append: true,
                                  silent: true,
                                  updateSelectedMember: false,
                                })
                              }}
                              disabled={memberOrdersLoadingMore}
                              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {memberOrdersLoadingMore ? 'Loading...' : 'Load More Orders'}
                            </button>
                          </div>
                        ) : null}
                      </section>
                    </div>
                  ) : lookupMember ? (
                    <p className="text-sm text-gray-500">Unable to load member details.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {memberOrderViewId ? (
        <OrderViewPanel
          orderId={memberOrderViewId}
          onClose={() => setMemberOrderViewId(null)}
          zIndexClassName="z-[170]"
        />
      ) : null}

      {voucherModalOpen && (
        <div className={`fixed inset-0 ${bookingModalOpen ? 'z-[130]' : 'z-50'} flex items-center justify-center bg-black/50 backdrop-blur-sm p-4`}>
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4 rounded-t-2xl">
              <h4 className="text-xl font-bold text-gray-900">Apply Voucher</h4>
              <button
                type="button"
                onClick={() => setVoucherModalOpen(false)}
                className="rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="p-5">
              <p className="mb-3 text-xs text-gray-600">
                {selectedMember ? 'Showing member vouchers.' : 'Showing public vouchers (non-reward).'}
              </p>

              {voucherLoading ? (
                <p className="text-sm text-gray-600">Loading vouchers...</p>
              ) : availableVouchers.length === 0 ? (
                <p className="text-sm text-gray-600">No vouchers available.</p>
              ) : (
                <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                  {availableVouchers.map((item) => {
                    const key = String(item.customer_voucher_id ?? item.id)
                    const voucher = item.voucher
                    const minSpend = Number(voucher?.min_order_amount ?? 0)
                    const rule = getVoucherRuleStatus(item)
                    return (
                      <button
                        type="button"
                        key={`${key}_${voucher?.id ?? 'voucher'}`}
                        onClick={() => setSelectedVoucherKey(key)}
                        disabled={!rule.eligible}
                        className={`w-full rounded-lg border p-3 text-left transition ${selectedVoucherKey === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'} ${!rule.eligible ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <p className="text-sm font-semibold text-gray-900">{formatVoucherLabel(item)}</p>
                        {minSpend > 0 && <p className="mt-0.5 text-xs text-gray-600">Min spend: RM {minSpend.toFixed(2)}</p>}
                        {!!item.expires_at && <p className="mt-0.5 text-xs text-gray-500">Expires: {new Date(item.expires_at).toLocaleString()}</p>}
                        {rule.reason && <p className="mt-1 text-xs font-medium text-amber-700">{rule.reason}</p>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-4">
              <button
                type="button"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                onClick={() => setVoucherModalOpen(false)}
              >
                Cancel
              </button>
              {selectedVoucherRule?.reason && selectedVoucherKey && (
                <p className="mr-auto text-xs font-medium text-amber-700">{selectedVoucherRule.reason}</p>
              )}
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void applyVoucher()}
                disabled={!selectedVoucherKey || voucherApplying || selectedVoucherRule?.eligible === false}
              >
                {voucherApplying ? 'Applying...' : 'Apply Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Success Modal with QR Code */}
      {checkoutResult && (
        <div className={`fixed inset-0 ${bookingModalOpen ? 'z-[130]' : 'z-50'} flex items-center justify-center bg-black/50 backdrop-blur-sm p-4`}>
          <div className={`w-full ${checkoutResultHasCashChange ? 'max-w-4xl' : 'max-w-lg'} rounded-2xl bg-white shadow-2xl border-2 border-gray-100 overflow-hidden`}>
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-5 flex items-center justify-between">
              <h4 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Order Completed
              </h4>
              <button
                onClick={() => {
                  setCheckoutResult(null)
                  setQrCodeFullscreen(false)
                  setReceiptEmail('')
                  setReceiptEmailError(null)
                  setSendingReceiptEmail(false)
                  setReceiptCooldownUntil(0)
                  focusScanner()
                }}
                className="rounded-lg p-1.5 text-white/90 transition-all hover:bg-white/20 hover:text-white"
                title="Close"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={checkoutResultHasCashChange ? 'grid gap-6 p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : 'p-6'}>
              {checkoutResultHasCashChange ? (
                <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 shadow-inner">
                  <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Cash Summary</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/80 px-4 py-3">
                      <span className="font-semibold text-gray-600">Grand Total</span>
                      <span className="font-bold text-gray-900">RM {checkoutResult.total.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/80 px-4 py-3">
                      <span className="font-semibold text-gray-600">Cash Received</span>
                      <span className="font-bold text-gray-900">RM {checkoutResult.paid_amount.toFixed(2)}</span>
                    </div>
                    <div className="rounded-2xl border-2 border-emerald-500 bg-white px-4 py-4 text-center shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Change to Return</p>
                      <p className="mt-1 text-4xl font-black text-emerald-700">RM {checkoutResult.change_amount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="space-y-5">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-gray-600">Order Number</p>
                <p className="text-2xl font-bold text-gray-900">{checkoutResult.order_number}</p>
                {/* <p className="text-lg font-semibold text-gray-700">RM {checkoutResult.total.toFixed(2)}</p> */}
              </div>

              {checkoutResult.receipt_public_url && (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Scan QR Code to View Receipt</p>
                    <div 
                      className="relative flex justify-center p-4 bg-white rounded-xl border-2 border-gray-200 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all"
                      onClick={() => setQrCodeFullscreen(true)}
                      title="Click to enlarge QR code"
                    >
                      {!receiptQrLoaded && <div className="h-48 w-48 animate-pulse rounded-lg bg-gray-100" />}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={receiptQrImageUrl ?? ''}
                        onLoad={() => setReceiptQrLoaded(true)}
                        onError={() => setReceiptQrLoaded(true)}
                        alt="Receipt QR Code"
                        className={`h-48 w-48 ${receiptQrLoaded ? 'block' : 'hidden'}`}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Tap QR code to enlarge for customer scanning</p>
                  </div>

                  <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">Send receipt to email</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        value={receiptEmail}
                        onChange={(event) => {
                          setReceiptEmail(event.target.value)
                          if (receiptEmailError) setReceiptEmailError(null)
                        }}
                        placeholder="customer@email.com"
                        className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => void sendReceiptToEmail()}
                        disabled={sendingReceiptEmail || receiptCooldownActive}
                        className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sendingReceiptEmail ? 'Sending...' : receiptCooldownActive ? 'Send (wait...)' : 'Send'}
                      </button>
                    </div>
                    {receiptEmailError && <p className="text-xs font-medium text-red-600">{receiptEmailError}</p>}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => window.open(checkoutResult.receipt_public_url!, '_blank')}
                      className="flex-1 rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100 active:scale-95"
                    >
                      Open Receipt
                    </button>
                    {/* <button
                      onClick={() => {
                        if (checkoutResult.receipt_public_url) {
                          navigator.clipboard.writeText(checkoutResult.receipt_public_url)
                        }
                      }}
                      className="rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 active:scale-95"
                      title="Copy receipt link"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button> */}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* QR Code Fullscreen Modal */}
      {qrCodeFullscreen && checkoutResult?.receipt_public_url && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setQrCodeFullscreen(false)}
        >
          <div className="relative">
            {/* <button
              onClick={() => setQrCodeFullscreen(false)}
              className="absolute -top-12 right-0 rounded-full bg-white/20 p-3 text-white transition-all hover:bg-white/30"
              title="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button> */}
            <div className="bg-white p-8 rounded-2xl shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={receiptQrFullscreenImageUrl ?? ''}
                alt="Receipt QR Code - Fullscreen"
                className="w-80 h-80"
              />
            </div>
            <p className="text-center text-white mt-4 text-sm">Tap anywhere to close</p>
          </div>
        </div>
      )}

      {/* Checkout Error Modal */}
      {checkoutError && (
        <div className={`fixed inset-0 ${bookingModalOpen ? 'z-[130]' : 'z-50'} flex items-center justify-center bg-black/50 backdrop-blur-sm p-4`}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5">
              <h4 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Checkout Failed
              </h4>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">{checkoutError}</p>
              <button
                onClick={() => {
                  setCheckoutError(null)
                  focusScanner()
                }}
                className="w-full rounded-xl bg-gradient-to-r from-gray-600 to-gray-700 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-gray-700 hover:to-gray-800 hover:shadow-xl active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom-right Toasts (commercial POS style) */}
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
              <div
                key={toast.id}
                className={`rounded-xl border-2 px-4 py-3 shadow-lg backdrop-blur-sm ${styles}`}
              >
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
