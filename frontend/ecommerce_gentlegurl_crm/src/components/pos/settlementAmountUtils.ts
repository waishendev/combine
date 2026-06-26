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

export type PosPriceDisplaySource = {
  price?: number | string | null
  service_price?: number | string | null
  extra_price?: number | string | null
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
): PosPriceBounds {
  const hasRange = posPriceDisplayHasRange(source)
  const finalized = posAddonPriceIsFinalized(source, overrideAmount, hasOverrideKey)

  if (hasRange && !finalized) {
    const minRaw = finiteNumber(source?.price_range_min ?? source?.service_price_range_min ?? source?.linked_price_range_min) ?? 0
    const maxRaw = finiteNumber(source?.price_range_max ?? source?.service_price_range_max ?? source?.linked_price_range_max) ?? 0
    return { min: Math.min(minRaw, maxRaw), max: Math.max(minRaw, maxRaw), hasRange: true }
  }

  const amount = finiteNumber(
    hasOverrideKey && finalized
      ? overrideAmount
      : (source?.price ?? source?.service_price ?? source?.extra_price),
  ) ?? 0
  return { min: amount, max: amount, hasRange: false }
}

export function accumulatePosPriceBounds(
  items: Array<{ source?: PosPriceDisplaySource | null; overrideAmount?: number; hasOverrideKey?: boolean }>,
): PosPriceBounds {
  let min = 0
  let max = 0
  let hasRange = false
  for (const item of items) {
    const bounds = posPriceResolvedBounds(item.source, item.overrideAmount, item.hasOverrideKey)
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

export function settlementCartItemHasUnsettledRangePricing(settlement?: {
  requires_settled_amount?: boolean | null
  addon_settlement_items?: Array<PosPriceDisplaySource & { price_finalized?: boolean | null; is_original?: boolean }>
  main_service_settlement_items?: Array<PosPriceDisplaySource & { price_finalized?: boolean | null; is_original?: boolean }>
  main_services?: Array<PosPriceDisplaySource & {
    price_finalized?: boolean | null
    add_ons?: Array<PosPriceDisplaySource & { price_finalized?: boolean | null }>
  }>
} | null): boolean {
  if (!settlement) return false
  if (settlement.requires_settled_amount) return true
  if (collectionHasUnsettledRangePricing(settlement.addon_settlement_items)) return true
  if (collectionHasUnsettledRangePricing(
    (settlement.main_service_settlement_items ?? []).filter((line) => !line.is_original),
  )) return true
  for (const service of settlement.main_services ?? []) {
    if (posLineHasUnsettledRangePricing(service)) return true
    if (collectionHasUnsettledRangePricing(service.add_ons)) return true
  }
  return false
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
