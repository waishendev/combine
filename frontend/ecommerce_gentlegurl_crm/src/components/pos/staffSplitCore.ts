export type StaffSplitMode = 'percent' | 'amount'

export type StaffSplitPayload = {
  staff_id: number
  share_percent: number
  share_amount?: number | null
  split_mode?: StaffSplitMode
}

export type StaffSplitDraftRow = {
  id: string
  staff_id: number | null
  share_percent: number
  share_amount: string
  search: string
  options: Array<{ id: number; name: string; email?: string | null; phone?: string | null; code?: string | null }>
  loading: boolean
  open: boolean
}

export const STAFF_SPLIT_AMOUNT_TOLERANCE = 0.01

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function parseMoneyInput(value: string): number {
  const parsed = Number.parseFloat(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? roundMoney(Math.max(0, parsed)) : 0
}

export function amountsToIntegerPercents(amounts: number[], lineTotal: number): number[] {
  if (lineTotal <= 0) return amounts.map(() => 0)

  const floors: number[] = []
  const remainders: Array<{ index: number; remainder: number }> = []

  amounts.forEach((amount, index) => {
    const raw = (amount / lineTotal) * 100
    floors[index] = Math.floor(raw)
    remainders.push({ index, remainder: raw - floors[index] })
  })

  const result = [...floors]
  let remaining = 100 - result.reduce((sum, value) => sum + value, 0)
  remainders.sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < remaining && i < remainders.length; i++) {
    result[remainders[i].index] += 1
  }

  return result
}

export function percentsToAmounts(percents: number[], lineTotal: number): number[] {
  if (lineTotal <= 0) return percents.map(() => 0)
  const amounts = percents.map((percent) => roundMoney(lineTotal * (percent / 100)))
  const delta = roundMoney(lineTotal - amounts.reduce((sum, value) => sum + value, 0))
  if (Math.abs(delta) > STAFF_SPLIT_AMOUNT_TOLERANCE) {
    amounts[0] = roundMoney(amounts[0] + delta)
  }
  return amounts
}

export function rebalancePrimaryPercentShare<T extends { share_percent: number | string }>(rows: T[]): T[] {
  if (rows.length <= 1) return rows
  const othersTotal = rows
    .slice(1)
    .reduce((sum, row) => sum + Math.max(0, Number.parseInt(String(row.share_percent || '0'), 10) || 0), 0)
  const primary = Math.max(0, 100 - othersTotal)
  return rows.map((row, index) => (index === 0 ? { ...row, share_percent: String(primary) } : row))
}

export function rebalancePrimaryAmountShare<T extends { share_amount: string }>(rows: T[], lineTotal: number): T[] {
  if (rows.length <= 1) return rows
  const othersTotal = rows
    .slice(1)
    .reduce((sum, row) => sum + parseMoneyInput(row.share_amount), 0)
  const primary = roundMoney(Math.max(0, lineTotal - othersTotal))
  return rows.map((row, index) => (index === 0 ? { ...row, share_amount: primary.toFixed(2) } : row))
}

export function validateStaffSplitDraft(
  rows: Array<{ staff_id: number | null; share_percent: number; share_amount: string }>,
  mode: StaffSplitMode,
  lineTotal: number | null,
): { valid: boolean; error: string | null } {
  if (rows.length === 0) return { valid: false, error: 'Please add at least one staff row.' }

  const ids = new Set<number>()
  for (const row of rows) {
    if (!row.staff_id || row.staff_id <= 0) return { valid: false, error: 'Please select staff for every row.' }
    if (ids.has(row.staff_id)) return { valid: false, error: 'Duplicate staff is not allowed.' }
    ids.add(row.staff_id)
  }

  if (mode === 'amount') {
    if (lineTotal == null || lineTotal <= 0) {
      return { valid: false, error: 'Line total is required for amount-based split.' }
    }
    const amounts = rows.map((row) => parseMoneyInput(row.share_amount))
    if (amounts.some((amount) => amount <= 0)) {
      return { valid: false, error: 'Each staff amount must be greater than zero.' }
    }
    const total = roundMoney(amounts.reduce((sum, amount) => sum + amount, 0))
    if (Math.abs(total - roundMoney(lineTotal)) > STAFF_SPLIT_AMOUNT_TOLERANCE) {
      return {
        valid: false,
        error: `Staff amounts must equal line total ${roundMoney(lineTotal).toFixed(2)} (current: ${total.toFixed(2)}).`,
      }
    }
    return { valid: true, error: null }
  }

  let total = 0
  for (const row of rows) {
    if (!Number.isInteger(row.share_percent) || row.share_percent < 0 || row.share_percent > 100) {
      return { valid: false, error: 'Share % must be an integer between 0 and 100.' }
    }
    total += row.share_percent
  }
  if (total !== 100) return { valid: false, error: 'Total share must be exactly 100%.' }

  return { valid: true, error: null }
}

export function mapBulkStaffSplitDraftToPayload(
  rows: Array<{ staff_id: number | null; share_percent: number; share_amount: string }>,
  mode: StaffSplitMode,
  referenceTotal: number | null,
  lineTotal: number | null,
): StaffSplitPayload[] {
  const resolvedLineTotal = lineTotal != null && lineTotal > 0 ? roundMoney(lineTotal) : null
  const resolvedReferenceTotal = referenceTotal != null && referenceTotal > 0 ? roundMoney(referenceTotal) : null

  if (mode === 'amount' && resolvedReferenceTotal != null && resolvedLineTotal != null) {
    const template = mapStaffSplitDraftToPayload(rows, 'amount', resolvedReferenceTotal)
    const percents = template.map((row) => row.share_percent)
    const amounts = percentsToAmounts(percents, resolvedLineTotal)
    const linePercents = amountsToIntegerPercents(amounts, resolvedLineTotal)

    return template.map((row, index) => ({
      staff_id: row.staff_id,
      share_percent: linePercents[index] ?? row.share_percent,
      share_amount: amounts[index] ?? 0,
      split_mode: 'amount' as const,
    }))
  }

  return mapStaffSplitDraftToPayload(rows, mode, resolvedLineTotal ?? resolvedReferenceTotal)
}

export function mapStaffSplitDraftToPayload(
  rows: Array<{ staff_id: number | null; share_percent: number; share_amount: string }>,
  mode: StaffSplitMode,
  lineTotal: number | null,
): StaffSplitPayload[] {
  if (mode === 'amount' && lineTotal != null && lineTotal > 0) {
    const amounts = rows.map((row) => parseMoneyInput(row.share_amount))
    const percents = amountsToIntegerPercents(amounts, lineTotal)
    return rows.map((row, index) => ({
      staff_id: row.staff_id!,
      share_percent: percents[index] ?? 0,
      share_amount: amounts[index] ?? 0,
      split_mode: 'amount' as const,
    }))
  }

  const roundedTotal = lineTotal != null && lineTotal > 0 ? roundMoney(lineTotal) : null
  return rows.map((row) => ({
    staff_id: row.staff_id!,
    share_percent: row.share_percent,
    share_amount:
      mode === 'percent' || roundedTotal == null
        ? null
        : roundMoney(roundedTotal * (row.share_percent / 100)),
    split_mode: 'percent' as const,
  }))
}

export function formatStaffSplitSummary(
  splits: StaffSplitPayload[],
  formatMoney: (value: number) => string,
): string {
  const rows = (splits ?? []).filter((split) => Number(split.staff_id) > 0)
  if (!rows.length) return '—'

  return rows
    .map((split) => {
      if (split.split_mode === 'amount' && split.share_amount != null) {
        return `${formatMoney(split.share_amount)} (${split.share_percent}%)`
      }
      return `${split.share_percent}%`
    })
    .join(' · ')
}

export function serializeStaffSplitForApi(
  split: Pick<StaffSplitPayload, 'staff_id' | 'share_percent' | 'share_amount' | 'split_mode'>,
): StaffSplitPayload {
  const payload: StaffSplitPayload = {
    staff_id: split.staff_id,
    share_percent: split.share_percent,
  }
  if (split.split_mode === 'amount' && split.share_amount != null && Number(split.share_amount) > 0) {
    payload.share_amount = Number(split.share_amount)
  }
  if (split.split_mode) {
    payload.split_mode = split.split_mode
  }
  return payload
}

export type ReportStaffSplit = {
  staff_id?: number | null
  staff_name?: string | null
  name?: string | null
  share_percent?: number
  share_amount?: number | null
  split_mode?: StaffSplitMode
}

export function resolveReportStaffSplitName(split: ReportStaffSplit): string {
  return split.staff_name ?? split.name ?? (split.staff_id ? `Staff #${split.staff_id}` : 'Staff')
}

export function formatReportStaffSplitLabel(split: ReportStaffSplit): string {
  const name = resolveReportStaffSplitName(split)
  const mode = split.split_mode ?? 'percent'
  if (mode === 'amount') {
    const amount = split.share_amount != null && Number(split.share_amount) > 0 ? Number(split.share_amount) : null
    if (amount != null) {
      return `${name} RM ${amount.toFixed(2)}`
    }
  }
  return `${name} ${Number(split.share_percent ?? 0)}%`
}

export function formatReportStaffSplitList(splits?: ReportStaffSplit[] | null): string {
  const rows = (splits ?? []).filter(
    (split) => Number(split.share_percent ?? 0) > 0 || Number(split.share_amount ?? 0) > 0,
  )
  if (!rows.length) return '—'
  return rows.map(formatReportStaffSplitLabel).join(', ')
}

export function createStaffSplitDraftRow(
  seed?: Partial<StaffSplitDraftRow> & { options?: StaffSplitDraftRow['options'] },
): StaffSplitDraftRow {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    staff_id: seed?.staff_id ?? null,
    share_percent: seed?.share_percent ?? 0,
    share_amount: seed?.share_amount ?? '0.00',
    search: seed?.search ?? '',
    options: seed?.options ?? [],
    loading: false,
    open: false,
  }
}

export type SettlementInlineStaffSplitRow = {
  staff_id: number | null
  share_percent: string
  share_amount: string
}

export function rebalanceSettlementInlineStaffRows(
  rows: SettlementInlineStaffSplitRow[],
  mode: StaffSplitMode,
  lineTotal: number | null,
  autoBalance: boolean,
): SettlementInlineStaffSplitRow[] {
  if (!autoBalance || rows.length <= 1) return rows
  if (mode === 'amount' && lineTotal != null && lineTotal > 0) {
    return rebalancePrimaryAmountShare(rows, lineTotal)
  }
  return rebalancePrimaryPercentShare(rows)
}

export function mapSettlementInlineStaffRowsForApi(
  rows: SettlementInlineStaffSplitRow[],
  mode: StaffSplitMode,
  lineTotal: number | null,
) {
  const draftRows = rows.map((row) => ({
    staff_id: row.staff_id,
    share_percent: Number.parseInt(row.share_percent || '0', 10),
    share_amount: row.share_amount,
  }))
  const validation = validateStaffSplitDraft(draftRows, mode, lineTotal)
  if (!validation.valid) {
    return { valid: false as const, error: validation.error ?? 'Invalid staff split.', splits: [] as StaffSplitPayload[] }
  }
  return {
    valid: true as const,
    error: null,
    splits: mapStaffSplitDraftToPayload(draftRows, mode, lineTotal).map(serializeStaffSplitForApi),
  }
}

export function resolveSavedSettlementStaffSplitMode(
  splits: Array<{
    staff_id?: number
    share_percent?: number | string | null
    split_mode?: StaffSplitMode | string | null
    share_amount?: number | string | null
  }> | null | undefined,
  options?: { allowAmount?: boolean },
): StaffSplitMode {
  const allowAmount = options?.allowAmount !== false
  const savedMode = splits?.[0]?.split_mode
  if (savedMode === 'amount' && allowAmount) return 'amount'
  if (savedMode === 'percent') return 'percent'
  if (
    allowAmount
    && (splits ?? []).some((split) => split.share_amount != null && Number(split.share_amount) > 0)
  ) {
    return 'amount'
  }
  return 'percent'
}

export function seedSettlementInlineStaffRows(
  splits: Array<{ staff_id?: number | null; share_percent?: number | string | null; share_amount?: number | string | null }>,
  mode: StaffSplitMode,
  lineTotal: number | null,
): SettlementInlineStaffSplitRow[] {
  const rows = splits
    .map((split) => ({
      staff_id: Number(split.staff_id) > 0 ? Number(split.staff_id) : null,
      share_percent: String(split.share_percent ?? ''),
      share_amount: split.share_amount != null ? Number(split.share_amount).toFixed(2) : '0.00',
    }))
    .filter((split) => split.staff_id != null)
  if (rows.length === 0) return rows
  if (mode === 'amount' && lineTotal != null && lineTotal > 0) {
    return rebalanceSettlementInlineStaffRows(rows, 'amount', lineTotal, true)
  }
  return rebalancePrimaryPercentShare(rows)
}

export function settlementInlineRowsToInheritedSplits(rows: SettlementInlineStaffSplitRow[]): StaffSplitPayload[] {
  return rows
    .map((row) => ({
      staff_id: Number(row.staff_id ?? 0),
      share_percent: Number.parseInt(row.share_percent || '0', 10),
      share_amount: parseMoneyInput(row.share_amount),
    }))
    .filter((row) => row.staff_id > 0 && (row.share_percent > 0 || Number(row.share_amount) > 0))
    .map((row) => ({
      staff_id: row.staff_id,
      share_percent: row.share_percent,
      share_amount: row.share_amount > 0 ? row.share_amount : null,
    }))
}
