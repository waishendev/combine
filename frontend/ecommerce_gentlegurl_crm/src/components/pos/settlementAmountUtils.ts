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
