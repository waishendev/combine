export type SettlementRangeSource = {
  is_range_priced?: boolean
  requires_settled_amount?: boolean
  service_price_mode?: string | null
  service_price_range_min?: number | null
  service_price_range_max?: number | null
  service?: {
    price_mode?: string | null
    price_range_min?: number | null
    price_range_max?: number | null
  } | null
}

import { getAddonQuantity, isAddonSelected, storedAddonLinePrice, storedAddonQuantity, type AddonSelectionMap, type StoredAddonRowLike } from '@/components/pos/bookingAddonQuantity'

export type PosPriceDisplaySource = {
  price?: number | string | null
  service_price?: number | string | null
  extra_price?: number | string | null
  quantity?: number | null
  line_gross_amount?: number | null
  gross_amount?: number | null
  price_mode?: string | null
  service_price_mode?: string | null
  linked_price_mode?: string | null
  price_range_min?: number | string | null
  price_range_max?: number | string | null
  service_price_range_min?: number | string | null
  service_price_range_max?: number | string | null
  linked_price_range_min?: number | string | null
  linked_price_range_max?: number | string | null
  settled_service_amount?: number | string | null
  price_finalized?: boolean | null
  final_price_set?: boolean | null
  price_override?: unknown | null
}

type BookingServiceSettlementOption = {
  price_mode?: string | null
  price_range_min?: number | null
  price_range_max?: number | null
}

export function bookingServiceSettlementSource(
  service?: BookingServiceSettlementOption | null,
  extra?: Partial<SettlementRangeSource>,
): SettlementRangeSource {
  return {
    service_price_mode: service?.price_mode ?? extra?.service_price_mode,
    service_price_range_min: service?.price_range_min ?? extra?.service_price_range_min,
    service_price_range_max: service?.price_range_max ?? extra?.service_price_range_max,
    service: service
      ? {
          price_mode: service.price_mode,
          price_range_min: service.price_range_min,
          price_range_max: service.price_range_max,
        }
      : (extra?.service ?? null),
    ...extra,
  }
}

export function settlementNeedsSettledAmount(source?: SettlementRangeSource | null): boolean {
  if (!source) return false
  if (source.is_range_priced || source.requires_settled_amount) return true
  const mode = String(source.service_price_mode ?? source.service?.price_mode ?? '').toLowerCase()
  return mode === 'range'
}

export function getSettlementRangeBounds(source?: SettlementRangeSource | null): { min: number; max: number } {
  const minRaw = Number(source?.service_price_range_min ?? source?.service?.price_range_min ?? NaN)
  const maxRaw = Number(source?.service_price_range_max ?? source?.service?.price_range_max ?? NaN)
  let min = Number.isFinite(minRaw) ? minRaw : 0
  let max = Number.isFinite(maxRaw) ? maxRaw : 0
  if (max < min) {
    const swap = min
    min = max
    max = swap
  }
  return { min, max }
}

function finiteNumber(value: number | string | null | undefined): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatPosPriceDisplay(source?: PosPriceDisplaySource | null, options?: { prefix?: string }): string {
  const prefix = options?.prefix ?? 'RM '
  const mode = String(source?.price_mode ?? source?.service_price_mode ?? source?.linked_price_mode ?? '').toLowerCase()
  const min = finiteNumber(source?.price_range_min ?? source?.service_price_range_min ?? source?.linked_price_range_min)
  const max = finiteNumber(source?.price_range_max ?? source?.service_price_range_max ?? source?.linked_price_range_max)

  if (mode === 'range' && min != null && max != null) {
    const low = Math.min(min, max)
    const high = Math.max(min, max)
    return `${prefix}${low.toFixed(2)} - ${prefix}${high.toFixed(2)}`
  }

  const amount = finiteNumber(source?.price ?? source?.service_price ?? source?.extra_price) ?? 0
  return `${prefix}${amount.toFixed(2)}`
}

export function posPriceDisplayHasRange(source?: PosPriceDisplaySource | null): boolean {
  const mode = String(source?.price_mode ?? source?.service_price_mode ?? source?.linked_price_mode ?? '').toLowerCase()
  return mode === 'range' &&
    finiteNumber(source?.price_range_min ?? source?.service_price_range_min ?? source?.linked_price_range_min) != null &&
    finiteNumber(source?.price_range_max ?? source?.service_price_range_max ?? source?.linked_price_range_max) != null
}

export function posPriceDisplayHasFinalPrice(source?: PosPriceDisplaySource | null): boolean {
  if (!posPriceDisplayHasRange(source)) return true
  if (source?.price_finalized === true || source?.final_price_set === true) return true
  if (source?.price_override != null) return true
  return finiteNumber(source?.settled_service_amount) != null
}

/** Zero line totals are placeholders for unsettled range addons and must not block range display. */
export function posAddonHasStoredLineTotal(source?: PosPriceDisplaySource | null): boolean {
  const lineGross = finiteNumber(source?.line_gross_amount ?? source?.gross_amount)
  if (lineGross == null) return false
  if (lineGross > 0.0001) return true
  if (posPriceDisplayHasRange(source) && !posPriceDisplayHasFinalPrice(source)) return false
  return true
}

export function formatPosCurrentOrRangeDisplay(source?: PosPriceDisplaySource | null, options?: { prefix?: string }): string {
  if (posPriceDisplayHasRange(source) && !posPriceDisplayHasFinalPrice(source)) {
    return formatPosPriceDisplay(source, options)
  }
  return formatPosPriceDisplay({
    ...source,
    price_mode: null,
    service_price_mode: null,
    linked_price_mode: null,
  }, options)
}

export type PosPriceBounds = { min: number; max: number; hasRange: boolean }

/** Whether an addon/settlement line should use a keyed override amount (Edit Price). */
export function posAddonPriceIsFinalized(
  source?: PosPriceDisplaySource | null,
  overrideAmount?: number,
  hasOverrideKey?: boolean,
): boolean {
  if (hasOverrideKey) {
    if (!posPriceDisplayHasRange(source)) return true
    return finiteNumber(overrideAmount) != null
  }
  return posPriceDisplayHasFinalPrice(source)
}

export function posPriceDisplayWithOverride(
  source?: PosPriceDisplaySource | null,
  overrideAmount?: number,
  hasOverrideKey?: boolean,
): PosPriceDisplaySource | null {
  if (!source) return null
  const finalized = posAddonPriceIsFinalized(source, overrideAmount, hasOverrideKey)
  return {
    ...source,
    extra_price: hasOverrideKey && finalized ? overrideAmount : source.extra_price,
    price_finalized: finalized,
  }
}

export function posPriceResolvedBounds(
  source?: PosPriceDisplaySource | null,
  overrideAmount?: number,
  hasOverrideKey?: boolean,
  lineTotalOverride?: number,
  hasLineTotalOverrideKey?: boolean,
): PosPriceBounds {
  const hasRange = posPriceDisplayHasRange(source)
  const finalized = posAddonPriceIsFinalized(source, overrideAmount, hasOverrideKey)

  const qty = storedAddonQuantity(source ?? {})

  if (hasLineTotalOverrideKey && finiteNumber(lineTotalOverride) != null) {
    const line = finiteNumber(lineTotalOverride)!
    return { min: line, max: line, hasRange: false }
  }

  if (posAddonHasStoredLineTotal(source)) {
    const line = storedAddonLinePrice(source ?? {})
    return { min: line, max: line, hasRange: false }
  }

  if (hasRange && !finalized) {
    const minRaw = finiteNumber(source?.price_range_min ?? source?.service_price_range_min ?? source?.linked_price_range_min) ?? 0
    const maxRaw = finiteNumber(source?.price_range_max ?? source?.service_price_range_max ?? source?.linked_price_range_max) ?? 0
    return {
      min: Math.min(minRaw, maxRaw) * qty,
      max: Math.max(minRaw, maxRaw) * qty,
      hasRange: true,
    }
  }

  const amount = finiteNumber(
    hasOverrideKey && finalized
      ? overrideAmount
      : (source?.price ?? source?.service_price ?? source?.extra_price),
  ) ?? 0
  return { min: amount * qty, max: amount * qty, hasRange: false }
}

export function posPriceDisplayForAddonLine(
  source?: (PosPriceDisplaySource & StoredAddonRowLike) | null,
): PosPriceDisplaySource | null {
  if (!source) return null
  const qty = storedAddonQuantity(source)
  const hasExplicitLineTotal =
    (Number.isFinite(Number(source.line_total_override)) && Number(source.line_total_override) >= 0)
    || posAddonHasStoredLineTotal(source)

  if (qty <= 1 && !hasExplicitLineTotal) {
    return source
  }
  if (posPriceDisplayHasRange(source) && !posPriceDisplayHasFinalPrice(source)) {
    const scale = (value: number | string | null | undefined) => {
      const parsed = finiteNumber(value)
      return parsed != null ? parsed * qty : value
    }
    return {
      ...source,
      price_range_min: scale(source.price_range_min ?? source.service_price_range_min ?? source.linked_price_range_min),
      price_range_max: scale(source.price_range_max ?? source.service_price_range_max ?? source.linked_price_range_max),
      service_price_range_min: scale(source.service_price_range_min),
      service_price_range_max: scale(source.service_price_range_max),
      linked_price_range_min: scale(source.linked_price_range_min),
      linked_price_range_max: scale(source.linked_price_range_max),
    }
  }
  const lineAmount = storedAddonLinePrice(source)
  return {
    ...source,
    extra_price: lineAmount,
    price: lineAmount,
    service_price: lineAmount,
    price_mode: null,
    service_price_mode: null,
    linked_price_mode: null,
  }
}

export function posAddonDisplayWithSelection(
  source?: (PosPriceDisplaySource & { id?: number }) | null,
  selection?: AddonSelectionMap,
  overrideAmount?: number,
  hasOverrideKey?: boolean,
  lineTotalOverride?: number,
  hasLineTotalOverrideKey?: boolean,
): PosPriceDisplaySource | null {
  if (!source) return null
  const withOverride = posPriceDisplayWithOverride(source, overrideAmount, hasOverrideKey) ?? source
  const qty = getAddonQuantity(selection ?? {}, Number(source.id ?? 0))
  if (qty <= 0) return withOverride

  const rangeUnsettled = posPriceDisplayHasRange(withOverride) && !posPriceDisplayHasFinalPrice(withOverride)
  if (qty <= 1 && rangeUnsettled && !hasLineTotalOverrideKey) {
    return withOverride
  }

  return posPriceDisplayForAddonLine({
    ...withOverride,
    quantity: qty,
    line_gross_amount: null,
    gross_amount: null,
    line_total_override: hasLineTotalOverrideKey && finiteNumber(lineTotalOverride) != null
      ? lineTotalOverride
      : null,
  })
}

export function accumulatePosPriceBounds(
  items: Array<{
    source?: PosPriceDisplaySource | null
    overrideAmount?: number
    hasOverrideKey?: boolean
    lineTotalOverride?: number
    hasLineTotalOverrideKey?: boolean
  }>,
): PosPriceBounds {
  let min = 0
  let max = 0
  let hasRange = false
  for (const item of items) {
    const bounds = posPriceResolvedBounds(
      item.source,
      item.overrideAmount,
      item.hasOverrideKey,
      item.lineTotalOverride,
      item.hasLineTotalOverrideKey,
    )
    min += bounds.min
    max += bounds.max
    if (bounds.hasRange) hasRange = true
  }
  if (!hasRange && Math.abs(min - max) > 0.0001) hasRange = true
  return { min, max, hasRange }
}

export function formatPosAccumulatedPriceDisplay(
  accumulated: PosPriceBounds,
  options?: { prefix?: string },
): string {
  const prefix = options?.prefix ?? 'RM '
  if (accumulated.hasRange && Math.abs(accumulated.min - accumulated.max) > 0.0001) {
    return `${prefix}${accumulated.min.toFixed(2)} - ${prefix}${accumulated.max.toFixed(2)}`
  }
  const amount = accumulated.hasRange ? accumulated.max : accumulated.min
  return `${prefix}${amount.toFixed(2)}`
}

/** Seed addon override map only for lines that already have a settled/final price. */
export function seedFinalizedAddonPriceOverrides(
  addons: Array<{ id?: number | null; extra_price?: number | string | null } & PosPriceDisplaySource>,
): Record<number, number> {
  return Object.fromEntries(
    addons
      .filter((addon) => Number(addon.id ?? 0) > 0)
      .filter((addon) => posPriceDisplayHasFinalPrice(addon))
      .map((addon) => [Number(addon.id), Number(addon.extra_price ?? 0)]),
  )
}

/** Seed exact line totals from stored rows (line_gross_amount or unit×qty mismatch). */
export function seedAddonLineTotalOverrides(
  addons: Array<{ id?: number | null; extra_price?: number | string | null; quantity?: number | null; line_gross_amount?: number | null; gross_amount?: number | null }>,
): Record<number, number> {
  const entries: Array<[number, number]> = []
  for (const addon of addons) {
    const optionId = Number(addon.id ?? 0)
    if (optionId <= 0) continue
    const explicitLine = finiteNumber(addon.line_gross_amount ?? addon.gross_amount)
    if (explicitLine != null) {
      const unit = Number(addon.extra_price ?? 0)
      const qty = storedAddonQuantity(addon)
      const computed = unit * qty
      if (Math.abs(explicitLine - computed) > 0.004) {
        entries.push([optionId, explicitLine])
      }
    }
  }
  return Object.fromEntries(entries)
}

export function resolveSettlementAddonLineGross(
  addon?: (StoredAddonRowLike & { balance_due?: number | null; line_total_after_discount?: number | null }) | null,
): number {
  if (!addon) return 0
  const lineGross = storedAddonLinePrice(addon)
  if (lineGross > 0.0001) return lineGross
  return Number(addon.line_total_after_discount ?? addon.balance_due ?? 0)
}

export function resolveSettlementAddonLineDue(
  addon?: (StoredAddonRowLike & {
    balance_due?: number | null
    line_total_after_discount?: number | null
    discount_amount?: number | null
    gross_amount?: number | null
  }) | null,
): number {
  if (!addon) return 0
  const gross = resolveSettlementAddonLineGross(addon)
  const discount = Number(addon.discount_amount ?? 0)
  return Number(addon.line_total_after_discount ?? Math.max(0, gross - discount))
}

export function resolveEditSettlementAddonLineAmount(
  optionId: number,
  catalogUnitPrice: number,
  selection: AddonSelectionMap,
  unitOverrides: Record<number, number>,
  lineTotalOverrides: Record<number, number>,
): number | null {
  if (!isAddonSelected(selection, optionId)) return null
  if (Object.prototype.hasOwnProperty.call(lineTotalOverrides, optionId)) {
    return finiteNumber(lineTotalOverrides[optionId]) ?? 0
  }
  const qty = getAddonQuantity(selection, optionId)
  const unit = Object.prototype.hasOwnProperty.call(unitOverrides, optionId)
    ? Number(unitOverrides[optionId] ?? 0)
    : catalogUnitPrice
  return unit * qty
}

export function resolveEditSettlementAddonUnitDisplay(
  optionId: number,
  qty: number,
  catalogUnitPrice: number,
  unitOverrides: Record<number, number>,
  lineTotalOverrides: Record<number, number>,
): number {
  if (Object.prototype.hasOwnProperty.call(lineTotalOverrides, optionId)) {
    const line = finiteNumber(lineTotalOverrides[optionId]) ?? 0
    return qty > 0 ? line / qty : line
  }
  if (Object.prototype.hasOwnProperty.call(unitOverrides, optionId)) {
    return Number(unitOverrides[optionId] ?? 0)
  }
  return catalogUnitPrice
}

export function buildAddonSettlementSaveOverrides(
  optionIds: number[],
  selection: AddonSelectionMap,
  unitOverrides: Record<number, number>,
  lineTotalOverrides: Record<number, number>,
): { addon_price_overrides: Record<number, number>; addon_line_total_overrides: Record<number, number> } {
  const addonPriceOverrides = { ...unitOverrides }
  const addonLineTotalOverrides = { ...lineTotalOverrides }
  for (const optionId of optionIds) {
    if (!Object.prototype.hasOwnProperty.call(addonLineTotalOverrides, optionId)) continue
    const line = finiteNumber(addonLineTotalOverrides[optionId])
    if (line == null) continue
    const qty = getAddonQuantity(selection, optionId)
    addonPriceOverrides[optionId] = qty > 0 ? Number((line / qty).toFixed(2)) : line
  }
  return { addon_price_overrides: addonPriceOverrides, addon_line_total_overrides: addonLineTotalOverrides }
}

export const UNSETTLED_RANGE_CHECKOUT_MESSAGE =
  'Range pricing — set final prices via Edit Settlement before checkout.'

export function posLineHasUnsettledRangePricing(source?: PosPriceDisplaySource | null): boolean {
  return posPriceDisplayHasRange(source) && !posPriceDisplayHasFinalPrice(source)
}

export function collectionHasUnsettledRangePricing(
  items?: Array<PosPriceDisplaySource | null | undefined> | null,
): boolean {
  return (items ?? []).some((item) => posLineHasUnsettledRangePricing(item))
}

export function computePosServiceCartItemPayableAmount(item: {
  deposit_payable_total?: number | string | null
  deposit_contribution?: number | string | null
  deposit_addon_total?: number | string | null
}): number {
  return Number(
    item.deposit_payable_total
    ?? Number(item.deposit_contribution ?? 0) + Number(item.deposit_addon_total ?? 0),
  )
}

export function computePosCartGrossAmountBounds(input: {
  cartItems: Array<{ line_total?: number | string | null }>
  cartServiceItems: Array<{
    deposit_payable_total?: number | string | null
    deposit_contribution?: number | string | null
    deposit_addon_total?: number | string | null
  }>
  cartPackageItems: Array<{ line_total?: number | string | null }>
  cartAppointmentSettlementItems: Parameters<typeof computeSettlementCartItemDueBounds>[0][]
}): PosPriceBounds {
  let min = 0
  let max = 0
  let hasRange = false

  const addBounds = (bounds: PosPriceBounds) => {
    min += bounds.min
    max += bounds.max
    if (bounds.hasRange) hasRange = true
  }

  for (const item of input.cartItems) {
    const amount = Number(item.line_total ?? 0)
    addBounds({ min: amount, max: amount, hasRange: false })
  }
  for (const item of input.cartServiceItems) {
    const amount = computePosServiceCartItemPayableAmount(item)
    addBounds({ min: amount, max: amount, hasRange: false })
  }
  for (const item of input.cartPackageItems) {
    const amount = Number(item.line_total ?? 0)
    addBounds({ min: amount, max: amount, hasRange: false })
  }
  for (const settlement of input.cartAppointmentSettlementItems) {
    addBounds(computeSettlementCartItemDueBounds(settlement))
  }

  if (!hasRange && Math.abs(min - max) > 0.0001) hasRange = true
  return { min, max, hasRange }
}

export function applyPosCartDiscountsToBounds(
  bounds: PosPriceBounds,
  discountTotal: number,
): PosPriceBounds {
  const deduct = Math.max(0, Number(discountTotal ?? 0))
  const min = Math.max(0, bounds.min - deduct)
  const max = Math.max(0, bounds.max - deduct)
  const hasRange = bounds.hasRange || Math.abs(min - max) > 0.0001
  return { min, max, hasRange }
}

export function resolveSettlementLineFullPrice(line?: {
  gross_amount?: number | string | null
  extra_price?: number | string | null
  balance_due?: number | string | null
} | null): number {
  if (!line) return 0
  return Number(line.gross_amount ?? line.extra_price ?? line.balance_due ?? 0)
}

export function resolveSettlementLineAmountDue(line?: {
  line_total_after_discount?: number | string | null
  balance_due?: number | string | null
  gross_amount?: number | string | null
  extra_price?: number | string | null
  discount_amount?: number | string | null
} | null): number {
  if (!line) return 0
  if (line.line_total_after_discount != null && line.line_total_after_discount !== '') {
    return Number(line.line_total_after_discount)
  }
  if (line.balance_due != null && line.balance_due !== '') {
    return Number(line.balance_due)
  }
  const fullPrice = resolveSettlementLineFullPrice(line)
  const discount = Number(line.discount_amount ?? 0)
  return Math.max(0, fullPrice - discount)
}

export function settlementShowsSeparateDepositCredit(settlement?: {
  deposit_contribution?: number | string | null
  main_service_settlement_items?: Array<{
    is_original?: boolean
    gross_amount?: number | string | null
    extra_price?: number | string | null
    balance_due?: number | string | null
    line_total_after_discount?: number | string | null
  }> | null
} | null): boolean {
  const deposit = Number(settlement?.deposit_contribution ?? 0)
  if (deposit <= 0.0001) return false
  const original = (settlement?.main_service_settlement_items ?? []).find((line, idx) => line.is_original ?? idx === 0)
  if (!original) return true
  const fullPrice = resolveSettlementLineFullPrice(original)
  const amountDue = resolveSettlementLineAmountDue(original)
  return fullPrice > amountDue + 0.0001
}

export type SettlementCartItemLike = {
  is_range_priced?: boolean | null
  requires_settled_amount?: boolean | null
  settled_service_amount?: number | string | null
  service_price_mode?: string | null
  service_price_range_min?: number | string | null
  service_price_range_max?: number | string | null
  service_total?: number | string | null
  balance_due?: number | string | null
  amount_due_now?: number | string | null
  deposit_contribution?: number | string | null
  deposit_previously_collected?: boolean | null
  deposit_previously_collected_amount?: number | string | null
  package_offset?: number | string | null
  refund_needed?: number | string | null
  overpaid_amount?: number | string | null
  refund_handled_amount?: number | string | null
  refund_handled?: boolean | null
  refund_transactions?: Array<{
    amount?: number | string | null
    method?: string | null
    method_label?: string | null
  }> | null
  package_status?: { status?: string | null } | null
  package_claims?: Array<{ booking_service_id: number }> | null
  main_services?: Array<{
    is_original?: boolean
    price_mode?: string | null
    price_range_min?: number | null
    price_range_max?: number | null
  }> | null
  main_service_settlement_items?: Array<PosPriceDisplaySource & {
    is_original?: boolean
    linked_booking_service_id?: number | null
    id?: number | null
    price_mode?: string | null
    price_range_min?: number | null
    price_range_max?: number | null
    price_finalized?: boolean | null
  }> | null
  addon_settlement_items?: Array<(PosPriceDisplaySource & StoredAddonRowLike & {
    balance_due?: number | string | null
    extra_price?: number | string | null
    linked_booking_service_id?: number | null
    id?: number | null
    discount_amount?: number | null
    line_total_after_discount?: number | null
    gross_amount?: number | null
    price_finalized?: boolean | null
  })> | null
}

export function buildSettlementCartMainServicePriceSource(
  settlement: SettlementCartItemLike,
  service: NonNullable<SettlementCartItemLike['main_service_settlement_items']>[number],
  idx: number,
): PosPriceDisplaySource {
  const isOriginalService = Boolean(service.is_original ?? idx === 0)
  const originalMainMeta = (settlement.main_services ?? []).find((row) => row.is_original)
    ?? settlement.main_services?.[0]

  return {
    ...service,
    ...(isOriginalService && settlement.settled_service_amount != null
      ? {
          extra_price: Number(settlement.settled_service_amount),
          settled_service_amount: settlement.settled_service_amount,
          price_finalized: true,
        }
      : {}),
    ...(isOriginalService && settlement.settled_service_amount == null
      ? {
          price_mode: service.price_mode ?? settlement.service_price_mode ?? originalMainMeta?.price_mode ?? null,
          service_price_mode: settlement.service_price_mode ?? null,
          price_range_min: service.price_range_min ?? settlement.service_price_range_min ?? originalMainMeta?.price_range_min ?? null,
          price_range_max: service.price_range_max ?? settlement.service_price_range_max ?? originalMainMeta?.price_range_max ?? null,
          service_price_range_min: settlement.service_price_range_min ?? null,
          service_price_range_max: settlement.service_price_range_max ?? null,
        }
      : {}),
    ...(service.price_finalized ? { price_finalized: true } : {}),
  }
}

export function computeSettlementCartItemServiceValueBounds(
  settlement?: SettlementCartItemLike | null,
): PosPriceBounds {
  if (!settlement) return { min: 0, max: 0, hasRange: false }

  const blocks = settlement.main_service_settlement_items ?? []
  if (blocks.length === 0) {
    if (settlement.is_range_priced && settlement.settled_service_amount == null) {
      return {
        min: Number(settlement.service_price_range_min ?? 0),
        max: Number(settlement.service_price_range_max ?? 0),
        hasRange: true,
      }
    }
    const amount = Number(settlement.service_total ?? 0)
    return { min: amount, max: amount, hasRange: false }
  }

  return accumulatePosPriceBounds(
    blocks.map((service, idx) => ({
      source: buildSettlementCartMainServicePriceSource(settlement, service, idx),
    })),
  )
}

export function settlementPackageApplied(settlement?: SettlementCartItemLike | null): boolean {
  if (!settlement) return false
  return ['reserved', 'consumed'].includes(String(settlement.package_status?.status ?? '').toLowerCase())
    || (settlement.package_claims?.length ?? 0) > 0
}

export function settlementMainLineCoveredByPackage(
  settlement: SettlementCartItemLike,
  service: { linked_booking_service_id?: number | null; id?: number | null; is_original?: boolean },
  idx: number,
): boolean {
  const claims = settlement.package_claims ?? []
  const lineBookingServiceId = Number(service.linked_booking_service_id ?? service.id ?? 0)
  if (claims.length > 0) {
    return claims.some((claim) => claim.booking_service_id === lineBookingServiceId)
  }

  const pkgOffset = Number(settlement.package_offset ?? 0)
  if (!settlementPackageApplied(settlement) || pkgOffset <= 0.0001) return false
  return Boolean(service.is_original ?? idx === 0)
}

export function settlementAddonLineCoveredByPackage(
  settlement: SettlementCartItemLike,
  addon: {
    linked_booking_service_id?: number | null
    id?: number | null
    extra_price?: number | string | null
    balance_due?: number | string | null
    discount_amount?: number | null
    line_total_after_discount?: number | null
    gross_amount?: number | null
    quantity?: number | null
    line_gross_amount?: number | null
  },
  originalServiceReference: number,
): boolean {
  const claims = settlement.package_claims ?? []
  const lineBookingServiceId = Number(addon.linked_booking_service_id ?? addon.id ?? 0)
  if (claims.length > 0) {
    return claims.some((claim) => claim.booking_service_id === lineBookingServiceId)
  }

  const pkgOffset = Number(settlement.package_offset ?? 0)
  const net = resolveSettlementAddonLineDue(addon)
  const gross = resolveSettlementAddonLineGross(addon)
  const addonReference = gross > 0.0001 ? gross : Number(addon.extra_price ?? 0) * storedAddonQuantity(addon)
  return pkgOffset > originalServiceReference + 0.0001 && net <= 0.0001 && addonReference > 0.0001
}

export function computeSettlementCartItemDueBounds(
  settlement?: SettlementCartItemLike | null,
): PosPriceBounds {
  if (!settlement) return { min: 0, max: 0, hasRange: false }

  const depositCredit = Number(settlement.deposit_contribution ?? 0)
  const hasUnsettledRange = settlementCartItemHasUnsettledRangePricing(settlement)

  if (hasUnsettledRange) {
    const serviceBlocks = settlement.main_service_settlement_items ?? []
    const addonBlocks = settlement.addon_settlement_items ?? []
    const originalServiceBlock = serviceBlocks.find((service, idx) => service.is_original ?? idx === 0)
    const originalServiceReference = Number(
      originalServiceBlock?.gross_amount ??
      originalServiceBlock?.extra_price ??
      originalServiceBlock?.balance_due ??
      settlement.service_total ??
      0,
    )

    const serviceBounds = accumulatePosPriceBounds(
      serviceBlocks.map((service, idx) => ({
        source: settlementMainLineCoveredByPackage(settlement, service, idx)
          ? settlementZeroPriceSource()
          : buildSettlementCartMainServicePriceSource(settlement, service, idx),
      })),
    )
    const addonBounds = accumulatePosPriceBounds(
      addonBlocks.map((addon) => ({
        source: settlementAddonLineCoveredByPackage(settlement, addon, originalServiceReference)
          ? settlementZeroPriceSource()
          : posPriceDisplayForAddonLine(addon),
      })),
    )
    const minRaw = serviceBounds.min + addonBounds.min - depositCredit
    const maxRaw = serviceBounds.max + addonBounds.max - depositCredit
    const min = Math.max(0, Math.min(minRaw, maxRaw))
    const max = Math.max(0, Math.max(minRaw, maxRaw))
    const hasRange = serviceBounds.hasRange
      || addonBounds.hasRange
      || Math.abs(min - max) > 0.0001
    return { min, max, hasRange }
  }

  const due = Number(settlement.balance_due ?? settlement.amount_due_now ?? 0)
  return { min: due, max: due, hasRange: false }
}

export function appointmentDetailHasUnsettledRangePricing(detail?: {
  requires_settled_amount?: boolean | null
  add_ons?: Array<PosPriceDisplaySource & { price_finalized?: boolean | null }>
  main_services?: Array<PosPriceDisplaySource & {
    price_finalized?: boolean | null
    add_ons?: Array<PosPriceDisplaySource & { price_finalized?: boolean | null }>
  }>
} | null): boolean {
  if (!detail) return false
  if (detail.requires_settled_amount) return true
  if (collectionHasUnsettledRangePricing(detail.add_ons)) return true
  for (const service of detail.main_services ?? []) {
    if (posLineHasUnsettledRangePricing(service)) return true
    if (collectionHasUnsettledRangePricing(service.add_ons)) return true
  }
  return false
}

export function appointmentVisitCheckoutFinalized(detail?: {
  visit_checkout_finalized?: boolean | null
  settlement_paid?: number | null
} | null): boolean {
  if (!detail) return false
  if (detail.visit_checkout_finalized === true) return true
  if (detail.visit_checkout_finalized === false) return false
  return Number(detail.settlement_paid ?? 0) > 0.0001
}

/** Balance is RM 0 but POS checkout / receipt is still required (deposit or package covers the visit). */
export function appointmentNeedsZeroBalanceCheckout(detail?: {
  visit_checkout_finalized?: boolean | null
  settlement_paid?: number | null
  amount_due_now?: number | null
  balance_due?: number | null
  requires_settled_amount?: boolean | null
  add_ons?: Array<PosPriceDisplaySource & { price_finalized?: boolean | null }>
  main_services?: Array<PosPriceDisplaySource & {
    price_finalized?: boolean | null
    add_ons?: Array<PosPriceDisplaySource & { price_finalized?: boolean | null }>
  }>
} | null): boolean {
  if (!detail) return false
  if (appointmentDetailHasUnsettledRangePricing(detail)) return false
  if (appointmentVisitCheckoutFinalized(detail)) return false
  const due = Number(detail.amount_due_now ?? detail.balance_due ?? 0)
  return due <= 0.0001
}

export function settlementCartItemHasUnsettledRangePricing(settlement?: {
  requires_settled_amount?: boolean | null
  is_range_priced?: boolean | null
  settled_service_amount?: number | string | null
  addon_settlement_items?: Array<PosPriceDisplaySource & { price_finalized?: boolean | null; is_original?: boolean }>
  main_service_settlement_items?: Array<PosPriceDisplaySource & { price_finalized?: boolean | null; is_original?: boolean }>
  main_services?: Array<PosPriceDisplaySource & {
    price_finalized?: boolean | null
    add_ons?: Array<PosPriceDisplaySource & { price_finalized?: boolean | null }>
  }>
} | null): boolean {
  if (!settlement) return false
  if (settlement.requires_settled_amount) return true
  if (settlement.is_range_priced && settlement.settled_service_amount == null) return true
  if (collectionHasUnsettledRangePricing(settlement.addon_settlement_items)) return true
  if (collectionHasUnsettledRangePricing(settlement.main_service_settlement_items)) return true
  for (const service of settlement.main_services ?? []) {
    if (posLineHasUnsettledRangePricing(service)) return true
    if (collectionHasUnsettledRangePricing(service.add_ons)) return true
  }
  return false
}

function settlementZeroPriceSource(): PosPriceDisplaySource {
  return {
    price: 0,
    extra_price: 0,
    price_mode: null,
    service_price_mode: null,
    linked_price_mode: null,
    price_finalized: true,
  }
}

/** Only include settlement amount in save payload when the user entered a value. */
export function optionalSettlementAmountPayload(raw: string): number | undefined {
  if (!String(raw ?? '').trim()) return undefined
  const parsed = parseSettlementAmountInput(raw)
  return parsed == null ? undefined : parsed
}

/** Parse POS settlement amount input (trim, allow commas as decimal separator). */
export function parseSettlementAmountInput(raw: string): number | null {
  const normalized = String(raw ?? '')
    .trim()
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '')
  if (!normalized || normalized === '.') return null
  const amt = Number.parseFloat(normalized)
  if (!Number.isFinite(amt) || amt < 0) return null
  return amt
}

export function validateSettlementAmountInput(
  raw: string,
  _source?: SettlementRangeSource | null,
): { ok: true; amount: number } | { ok: false; message: string } {
  const amt = parseSettlementAmountInput(raw)
  if (amt == null) {
    return { ok: false, message: 'Please enter a valid service amount.' }
  }

  return { ok: true, amount: amt }
}

export function resolveSettlementCartDepositForBreakdown(settlement?: SettlementCartItemLike | null): number {
  if (!settlement) return 0
  const contribution = Number(settlement.deposit_contribution ?? 0)
  if (contribution > 0.0001) return contribution
  if (settlement.deposit_previously_collected) {
    return Number(settlement.deposit_previously_collected_amount ?? 0)
  }
  return 0
}

export function computeSettlementCartPackageCoveredBounds(settlement: SettlementCartItemLike): PosPriceBounds {
  const claims = settlement.package_claims ?? []
  const claimedIds = new Set(claims.map((c) => c.booking_service_id))
  const hasPerLineClaims = claims.length > 0
  const packageApplied = settlementPackageApplied(settlement)

  if (!hasPerLineClaims && !packageApplied) {
    return { min: 0, max: 0, hasRange: false }
  }

  const coveredItems: Array<{ source?: PosPriceDisplaySource | null }> = []

  ;(settlement.main_service_settlement_items ?? []).forEach((service, idx) => {
    const serviceBookingServiceId = Number(service.linked_booking_service_id ?? service.id ?? 0)
    const packageCovers = hasPerLineClaims
      ? claimedIds.has(serviceBookingServiceId)
      : packageApplied && Boolean(service.is_original ?? idx === 0)
    if (!packageCovers) return
    coveredItems.push({
      source: buildSettlementCartMainServicePriceSource(settlement, service, idx),
    })
  })

  for (const addon of settlement.addon_settlement_items ?? []) {
    const addonServiceId = Number(addon.linked_booking_service_id ?? addon.id ?? 0)
    if (!hasPerLineClaims || !claimedIds.has(addonServiceId)) continue
    coveredItems.push({ source: posPriceDisplayForAddonLine(addon) ?? addon })
  }

  if (coveredItems.length === 0) {
    const offset = Number(settlement.package_offset ?? 0)
    return { min: offset, max: offset, hasRange: false }
  }

  return accumulatePosPriceBounds(coveredItems)
}

export function computeSettlementCartAddonValueBounds(settlement: SettlementCartItemLike): PosPriceBounds {
  return accumulatePosPriceBounds(
    (settlement.addon_settlement_items ?? []).map((addon) => ({
      source: posPriceDisplayForAddonLine(addon) ?? addon,
    })),
  )
}

export type SettlementRefundIssuedLine = {
  amount: number
  methodLabel: string
}

export function formatSettlementRefundMethodLabel(method?: string | null): string {
  const key = String(method ?? '').toLowerCase()
  if (key === 'customer_credit') return 'Customer Credit'
  if (key === 'cash') return 'Cash Refund'
  if (!key) return 'Refund'
  return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function resolveSettlementRefundIssuedLines(
  settlement: Pick<
    SettlementCartItemLike,
    'refund_transactions' | 'refund_handled_amount'
  >,
): SettlementRefundIssuedLine[] {
  const transactions = settlement.refund_transactions ?? []
  if (transactions.length > 0) {
    return transactions
      .map((row) => ({
        amount: Number(row.amount ?? 0),
        methodLabel: String(row.method_label ?? '').trim() || formatSettlementRefundMethodLabel(row.method),
      }))
      .filter((row) => row.amount > 0.0001)
  }

  const handledAmount = Number(settlement.refund_handled_amount ?? 0)
  if (handledAmount > 0.0001) {
    return [{ amount: handledAmount, methodLabel: 'Refund' }]
  }

  return []
}

export function resolveSettlementRefundIssuedTotal(
  settlement: Pick<
    SettlementCartItemLike,
    'refund_transactions' | 'refund_handled_amount'
  >,
): number {
  const lines = resolveSettlementRefundIssuedLines(settlement)
  if (lines.length > 0) {
    return lines.reduce((sum, row) => sum + row.amount, 0)
  }
  return Math.max(0, Number(settlement.refund_handled_amount ?? 0))
}

export function resolveSettlementRefundNeededAmount(
  settlement: Pick<SettlementCartItemLike, 'refund_needed' | 'overpaid_amount' | 'refund_handled'>,
): number {
  if (settlement.refund_needed != null) {
    return Math.max(0, Number(settlement.refund_needed))
  }
  if (settlement.refund_handled) return 0
  return Math.max(0, Number(settlement.overpaid_amount ?? 0))
}

export function resolveSettlementRefundRequiredAmount(
  settlement: Pick<
    SettlementCartItemLike,
    'overpaid_amount' | 'refund_needed' | 'refund_handled_amount' | 'refund_transactions'
  >,
): number {
  const overpaid = Math.max(0, Number(settlement.overpaid_amount ?? 0))
  if (overpaid > 0.0001) return overpaid

  const refundedTotal = resolveSettlementRefundIssuedTotal(settlement)
  const remainingRefund = resolveSettlementRefundNeededAmount(settlement)
  return Math.max(0, refundedTotal + remainingRefund)
}

export type SettlementRefundDisplayMode = 'active' | 'history'

export type SettlementRefundSummary = {
  refundRequired: number
  refundedTotal: number
  remainingRefund: number
  refundIssuedLines: SettlementRefundIssuedLine[]
  showRefundSection: boolean
  refundSettled: boolean
  displayMode: SettlementRefundDisplayMode
}

export function computeSettlementRefundSummary(
  settlement: Pick<
    SettlementCartItemLike,
    'overpaid_amount' | 'refund_needed' | 'refund_handled' | 'refund_handled_amount' | 'refund_transactions'
  >,
  options?: { mode?: SettlementRefundDisplayMode },
): SettlementRefundSummary {
  const displayMode = options?.mode ?? 'active'
  const refundIssuedLines = resolveSettlementRefundIssuedLines(settlement)
  const refundedTotal = resolveSettlementRefundIssuedTotal(settlement)
  const remainingRefund = resolveSettlementRefundNeededAmount(settlement)
  const refundRequired = resolveSettlementRefundRequiredAmount(settlement)
  const showRefundSection = displayMode === 'history'
    ? refundedTotal > 0.0001
    : refundRequired > 0.0001 || refundedTotal > 0.0001

  return {
    refundRequired,
    refundedTotal,
    remainingRefund,
    refundIssuedLines,
    showRefundSection,
    refundSettled: refundRequired > 0.0001 && remainingRefund <= 0.0001 && refundedTotal > 0.0001,
    displayMode,
  }
}

export type SettlementCartPaymentBreakdownView = {
  serviceValueDisplay: string
  addonDisplay: string
  hasAddons: boolean
  depositTotal: number
  packageCoveredDisplay: string | null
  showPackageCovered: boolean
  amountToPayDisplay: string
  refundSummary: SettlementRefundSummary
  refundNeeded: number
  refundIssuedLines: SettlementRefundIssuedLine[]
  refundIssuedTotal: number
  refundSettled: boolean
  mainCoveredAddonDueNote: boolean
}

export function computeSettlementCartPaymentBreakdown(
  settlement: SettlementCartItemLike,
): SettlementCartPaymentBreakdownView {
  const depositTotal = resolveSettlementCartDepositForBreakdown(settlement)
  const serviceValueBounds = computeSettlementCartItemServiceValueBounds(settlement)
  const addonBounds = computeSettlementCartAddonValueBounds(settlement)
  const packageCoveredBounds = computeSettlementCartPackageCoveredBounds(settlement)
  const amountDueBounds = computeSettlementCartItemDueBounds(settlement)

  const pkgOffset = Number(settlement.package_offset ?? 0)
  const packageClaimed = settlementPackageApplied(settlement)
  const mainCoveredByPkg = packageClaimed && (pkgOffset > 0.0001 || (settlement.package_claims?.length ?? 0) > 0)
  const addonDueSum = (settlement.addon_settlement_items ?? []).reduce(
    (sum, addon) => sum + resolveSettlementAddonLineDue(addon),
    0,
  )

  let packageCoveredDisplay: string | null = null
  let showPackageCovered = false
  if (packageClaimed) {
    showPackageCovered = true
    if (packageCoveredBounds.hasRange && Math.abs(packageCoveredBounds.min - packageCoveredBounds.max) > 0.0001) {
      packageCoveredDisplay = `− RM ${packageCoveredBounds.min.toFixed(2)} - RM ${packageCoveredBounds.max.toFixed(2)}`
    } else {
      const amount = packageCoveredBounds.min > 0.0001 ? packageCoveredBounds.min : pkgOffset
      packageCoveredDisplay = amount > 0.0001 ? `− RM ${amount.toFixed(2)}` : '− RM 0.00'
    }
  }

  const refundSummary = computeSettlementRefundSummary(settlement)

  return {
    serviceValueDisplay: formatPosAccumulatedPriceDisplay(serviceValueBounds),
    addonDisplay: addonBounds.min > 0.0001 || addonBounds.hasRange
      ? formatPosAccumulatedPriceDisplay(addonBounds)
      : 'RM 0.00',
    hasAddons: (settlement.addon_settlement_items?.length ?? 0) > 0,
    depositTotal,
    packageCoveredDisplay,
    showPackageCovered,
    amountToPayDisplay: formatPosAccumulatedPriceDisplay(amountDueBounds),
    refundSummary,
    refundNeeded: refundSummary.remainingRefund,
    refundIssuedLines: refundSummary.refundIssuedLines,
    refundIssuedTotal: refundSummary.refundedTotal,
    refundSettled: refundSummary.refundSettled,
    mainCoveredAddonDueNote: mainCoveredByPkg && addonDueSum > 0.0001,
  }
}
