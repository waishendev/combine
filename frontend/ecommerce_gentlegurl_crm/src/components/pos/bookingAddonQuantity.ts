export type BookingAddonOptionLike = {
  id: number
  allow_quantity?: boolean
  extra_duration_min?: number
  extra_price?: number
}

export type AddonSelectionMap = Record<number, number>

export const ADDON_QTY_MIN = 1
export const ADDON_QTY_MAX = 99

export function addonAllowsQuantity(option: Pick<BookingAddonOptionLike, 'allow_quantity'>): boolean {
  return option.allow_quantity !== false
}

export function getSelectedAddonIds(selection: AddonSelectionMap): number[] {
  return Object.entries(selection)
    .map(([id, qty]) => ({ id: Number(id), qty: Number(qty) }))
    .filter((row) => row.id > 0 && Number.isFinite(row.qty) && row.qty >= ADDON_QTY_MIN)
    .map((row) => row.id)
}

export function getAddonQuantity(selection: AddonSelectionMap, optionId: number): number {
  const qty = Number(selection[optionId] ?? 0)
  return Number.isFinite(qty) && qty >= ADDON_QTY_MIN ? Math.min(ADDON_QTY_MAX, Math.floor(qty)) : 0
}

export function isAddonSelected(selection: AddonSelectionMap, optionId: number): boolean {
  return getAddonQuantity(selection, optionId) > 0
}

export function clampAddonQuantity(raw: number, allowQuantity: boolean): number {
  if (!allowQuantity) return ADDON_QTY_MIN
  const qty = Number.isFinite(raw) ? Math.floor(raw) : ADDON_QTY_MIN
  return Math.min(ADDON_QTY_MAX, Math.max(ADDON_QTY_MIN, qty))
}

export function selectionFromAddonRows(
  rows: Array<{ id?: number | null; quantity?: number | null }>,
): AddonSelectionMap {
  const next: AddonSelectionMap = {}
  for (const row of rows) {
    const id = Number(row.id ?? 0)
    if (!Number.isFinite(id) || id <= 0) continue
    next[id] = clampAddonQuantity(Number(row.quantity ?? ADDON_QTY_MIN), true)
  }
  return next
}

export function selectionFromOptionIds(optionIds: number[]): AddonSelectionMap {
  const next: AddonSelectionMap = {}
  for (const rawId of optionIds) {
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0 || next[id]) continue
    next[id] = ADDON_QTY_MIN
  }
  return next
}

export function buildAddonQuantitiesPayload(selection: AddonSelectionMap): Record<string, number> {
  return Object.fromEntries(
    getSelectedAddonIds(selection).map((id) => [String(id), getAddonQuantity(selection, id)]),
  )
}

export function toggleAddonSelection(
  selection: AddonSelectionMap,
  option: BookingAddonOptionLike,
  questionType: 'single_choice' | 'multi_choice' | string,
  questionOptionIds: number[],
): AddonSelectionMap {
  const optionId = option.id
  const checked = isAddonSelected(selection, optionId)
  const next = { ...selection }

  if (questionType === 'single_choice') {
    for (const id of questionOptionIds) {
      delete next[id]
    }
    if (!checked) {
      next[optionId] = ADDON_QTY_MIN
    }
    return next
  }

  if (checked) {
    delete next[optionId]
    return next
  }

  next[optionId] = ADDON_QTY_MIN
  return next
}

export function setAddonQuantity(
  selection: AddonSelectionMap,
  option: BookingAddonOptionLike,
  rawQty: number,
): AddonSelectionMap {
  const optionId = option.id
  const allowQuantity = addonAllowsQuantity(option)
  const qty = clampAddonQuantity(rawQty, allowQuantity)
  return { ...selection, [optionId]: qty }
}

export function addonUnitDuration(option: BookingAddonOptionLike): number {
  return Number(option.extra_duration_min ?? 0)
}

export function addonUnitPrice(option: BookingAddonOptionLike): number {
  return Number(option.extra_price ?? 0)
}

export function addonLineDuration(option: BookingAddonOptionLike, qty: number): number {
  return addonUnitDuration(option) * clampAddonQuantity(qty, addonAllowsQuantity(option))
}

export function addonLinePrice(option: BookingAddonOptionLike, qty: number): number {
  return addonUnitPrice(option) * clampAddonQuantity(qty, addonAllowsQuantity(option))
}

export function sumSelectedAddonDuration(
  options: BookingAddonOptionLike[],
  selection: AddonSelectionMap,
): number {
  return options.reduce((sum, option) => {
    const qty = getAddonQuantity(selection, option.id)
    if (qty <= 0) return sum
    return sum + addonLineDuration(option, qty)
  }, 0)
}

export function sumSelectedAddonPrice(
  options: BookingAddonOptionLike[],
  selection: AddonSelectionMap,
): number {
  return options.reduce((sum, option) => {
    const qty = getAddonQuantity(selection, option.id)
    if (qty <= 0) return sum
    return sum + addonLinePrice(option, qty)
  }, 0)
}

export function formatAddonQuantityLabel(qty: number): string {
  return qty > 1 ? ` × ${qty}` : ''
}

export type StoredAddonRowLike = {
  extra_duration_min?: number
  extra_price?: number
  quantity?: number | null
  line_gross_amount?: number | null
  gross_amount?: number | null
  line_total_override?: number | null
}

export function storedAddonQuantity(row: Pick<StoredAddonRowLike, 'quantity'>): number {
  const qty = Number(row.quantity ?? ADDON_QTY_MIN)
  return Number.isFinite(qty) && qty >= ADDON_QTY_MIN ? Math.min(ADDON_QTY_MAX, Math.floor(qty)) : ADDON_QTY_MIN
}

export function storedAddonUnitPrice(row: Pick<StoredAddonRowLike, 'extra_price'>): number {
  return Number(row.extra_price ?? 0)
}

export function storedAddonLinePrice(row: StoredAddonRowLike): number {
  const lineOverride = Number(row.line_total_override ?? NaN)
  if (Number.isFinite(lineOverride) && lineOverride >= 0) {
    return lineOverride
  }
  const lineGross = Number(row.line_gross_amount ?? row.gross_amount ?? NaN)
  if (Number.isFinite(lineGross) && lineGross >= 0) {
    return lineGross
  }
  const qty = storedAddonQuantity(row)
  const unit = storedAddonUnitPrice(row)
  return unit * qty
}

export function storedAddonLineDuration(row: StoredAddonRowLike): number {
  return Number(row.extra_duration_min ?? 0) * storedAddonQuantity(row)
}

export function formatSelectedAddonDurationText(
  option: BookingAddonOptionLike,
  selection: AddonSelectionMap,
  prefix = '',
): string | null {
  const unit = addonUnitDuration(option)
  if (unit <= 0) return null
  const qty = getAddonQuantity(selection, option.id)
  const minutes = qty > 0 ? addonLineDuration(option, qty) : unit
  return `${prefix}${minutes} min`
}
