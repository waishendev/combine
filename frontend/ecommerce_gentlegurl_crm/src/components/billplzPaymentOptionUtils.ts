import type { BillplzPaymentOptionRowData } from './BillplzPaymentOptionRow'

export type WorkspaceType = 'ecommerce' | 'booking'
export type GatewayGroup = 'online_banking' | 'credit_card'

export type BillplzPaymentOptionApiItem = {
  id: number | string
  type?: WorkspaceType | string | null
  gateway_group?: GatewayGroup | string | null
  code?: string | null
  name?: string | null
  logo_url?: string | null
  description?: string | null
  is_active?: boolean | number | string | null
  is_default?: boolean | number | string | null
  sort_order?: number | string | null
  created_at?: string | null
  updated_at?: string | null
}

const toBool = (value: unknown) =>
  value === true || value === 'true' || value === '1' || value === 1

export const mapBillplzPaymentOptionApiItemToRow = (
  item: BillplzPaymentOptionApiItem,
): BillplzPaymentOptionRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  const sortOrderValue = item.sort_order
  let sortOrder: number | null = null
  if (typeof sortOrderValue === 'number') {
    sortOrder = sortOrderValue
  } else if (sortOrderValue != null) {
    const parsed = Number(sortOrderValue)
    sortOrder = Number.isFinite(parsed) ? parsed : null
  }

  const type = item.type === 'booking' ? 'booking' : 'ecommerce'
  const gatewayGroup = item.gateway_group === 'credit_card' ? 'credit_card' : 'online_banking'

  return {
    id: normalizedId,
    type,
    gateway_group: gatewayGroup,
    code: item.code ?? '',
    name: item.name ?? '',
    logo_url: item.logo_url ?? null,
    description: item.description ?? null,
    isActive: toBool(item.is_active),
    isDefault: toBool(item.is_default),
    sort_order: sortOrder,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}

export function getBillplzOptionApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback

  const payload = data as { message?: unknown; errors?: unknown }
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message
  }

  if (payload.errors && typeof payload.errors === 'object') {
    const errors = payload.errors as Record<string, unknown>
    const firstKey = Object.keys(errors)[0]
    if (firstKey) {
      const firstValue = errors[firstKey]
      if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
        return firstValue[0]
      }
      if (typeof firstValue === 'string') {
        return firstValue
      }
    }
  }

  return fallback
}

export const BILLPLZ_LOGO_ACCEPT =
  '.svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp'
