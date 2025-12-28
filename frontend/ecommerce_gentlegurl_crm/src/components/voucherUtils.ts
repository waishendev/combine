import type { VoucherRowData } from './VoucherRow'

export type VoucherApiItem = {
  id: number | string
  code?: string | null
  type?: string | null
  amount?: string | number | null
  max_uses?: number | string | null
  max_uses_per_customer?: number | string | null
  min_order_amount?: string | number | null
  start_at?: string | null
  end_at?: string | null
  is_active?: boolean | number | string | null
}

export const mapVoucherApiItemToRow = (item: VoucherApiItem): VoucherRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  const isActiveValue = item.is_active
  const isActive =
    isActiveValue === true ||
    isActiveValue === 'true' ||
    isActiveValue === '1' ||
    isActiveValue === 1

  const formatAmount = (value: string | number | null | undefined): string => {
    if (value == null) return '-'
    const num = typeof value === 'string' ? parseFloat(value) : value
    return Number.isFinite(num) ? num.toFixed(2) : '-'
  }

  return {
    id: normalizedId,
    code: item.code ?? '-',
    type: item.type ?? 'fixed',
    amount: formatAmount(item.amount),
    maxUses: item.max_uses != null ? String(item.max_uses) : '-',
    maxUsesPerCustomer: item.max_uses_per_customer != null ? String(item.max_uses_per_customer) : '-',
    minOrderAmount: formatAmount(item.min_order_amount),
    startAt: item.start_at ?? '', // Direct from API
    endAt: item.end_at ?? '', // Direct from API
    isActive,
  }
}
