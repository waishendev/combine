import type { PaymentGatewayRowData } from './PaymentGatewayRow'

export type PaymentGatewayApiItem = {
  id: number | string
  key?: string | null
  name?: string | null
  is_active?: boolean | number | string | null
  is_default?: boolean | number | string | null
  sort_order?: number | string | null
  config?: unknown | null
  created_at?: string | null
  updated_at?: string | null
}

export const mapPaymentGatewayApiItemToRow = (item: PaymentGatewayApiItem): PaymentGatewayRowData => {
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

  const isDefaultValue = item.is_default
  const isDefault =
    isDefaultValue === true ||
    isDefaultValue === 'true' ||
    isDefaultValue === '1' ||
    isDefaultValue === 1

  const sortOrderValue = item.sort_order
  let normalizedSortOrder: number | null = null
  if (typeof sortOrderValue === 'number') {
    normalizedSortOrder = sortOrderValue
  } else if (sortOrderValue != null) {
    const parsed = Number(sortOrderValue)
    normalizedSortOrder = Number.isFinite(parsed) ? parsed : null
  }

  return {
    id: normalizedId,
    key: item.key ?? '',
    name: item.name ?? '',
    isActive,
    isDefault,
    sort_order: normalizedSortOrder,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}

