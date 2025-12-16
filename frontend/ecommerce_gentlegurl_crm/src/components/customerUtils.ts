import type { CustomerRowData } from './CustomerRow'

export type CustomerApiItem = {
  id: number | string
  name?: string | null
  email?: string | null
  phone?: string | null
  tier?: string | null
  tier_marked_pending_at?: string | null
  tier_effective_at?: string | null
  is_active?: boolean | number | string | null
  last_login_at?: string | null
  last_login_ip?: string | null
  created_at?: string | null
  updated_at?: string | null
  available_points?: number | null
  spent_in_window?: number | null
  next_tier?: string | null
  amount_to_next_tier?: number | null
}

export const mapCustomerApiItemToRow = (item: CustomerApiItem): CustomerRowData => {
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

  return {
    id: normalizedId,
    name: item.name ?? '-',
    email: item.email ?? '-',
    phone: item.phone ?? '-',
    tier: item.tier ?? '-',
    isActive,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}

