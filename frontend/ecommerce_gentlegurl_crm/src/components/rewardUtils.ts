import type { RewardRowData } from './RewardRow'

export type RewardApiItem = {
  id: number | string
  title?: string | null
  description?: string | null
  type?: string | null
  points_required?: number | string | null
  product_id?: number | string | null
  voucher_id?: number | string | null
  quota_total?: number | string | null
  quota_used?: number | string | null
  is_active?: boolean | number | string | null
  sort_order?: number | string | null
  product?: {
    id?: number | string | null
    name?: string | null
    sku?: string | null
  } | null
  voucher?: {
    id?: number | string | null
    code?: string | null
  } | null
}

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const toBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1'

export const mapRewardApiItemToRow = (item: RewardApiItem): RewardRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  return {
    id: normalizedId,
    title: item.title ?? '-',
    description: item.description ?? '',
    type: item.type ?? 'custom',
    pointsRequired: toNumber(item.points_required) ?? 0,
    productId: toNumber(item.product_id),
    voucherId: toNumber(item.voucher_id),
    quotaTotal: toNumber(item.quota_total),
    quotaUsed: toNumber(item.quota_used),
    isActive: toBoolean(item.is_active),
    sortOrder: toNumber(item.sort_order),
    productName: item.product?.name ?? null,
    productSku: item.product?.sku ?? null,
    voucherCode: item.voucher?.code ?? null,
  }
}
