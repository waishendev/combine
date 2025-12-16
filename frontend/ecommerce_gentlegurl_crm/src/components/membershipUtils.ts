import type { MembershipRowData } from './MembershipRow'

export type MembershipApiItem = {
  id: number | string
  tier?: string | null
  display_name?: string | null
  description?: string | null
  badge_image_path?: string | null
  min_spent_last_x_months?: string | number | null
  months_window?: number | string | null
  multiplier?: string | number | null
  product_discount_percent?: string | number | null
  is_active?: boolean | number | string | null
  sort_order?: number | string | null
  created_at?: string | null
  updated_at?: string | null
}

export const mapMembershipApiItemToRow = (item: MembershipApiItem): MembershipRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  const tierValue = item.tier
  const tier = typeof tierValue === 'string' ? tierValue : String(tierValue ?? '')

  const displayName = item.display_name ?? '-'
  const description = item.description ?? '-'

  const minSpentValue = item.min_spent_last_x_months
  const minSpent =
    minSpentValue != null
      ? typeof minSpentValue === 'number'
        ? minSpentValue.toFixed(2)
        : String(minSpentValue)
      : '0.00'

  const monthsWindowValue = item.months_window
  const monthsWindow =
    monthsWindowValue != null
      ? typeof monthsWindowValue === 'number'
        ? monthsWindowValue
        : Number(monthsWindowValue) || 0
      : 0

  const multiplierValue = item.multiplier
  const multiplier =
    multiplierValue != null
      ? typeof multiplierValue === 'number'
        ? multiplierValue.toFixed(2)
        : String(multiplierValue)
      : '1.00'

  const discountPercentValue = item.product_discount_percent
  const discountPercent =
    discountPercentValue != null
      ? typeof discountPercentValue === 'number'
        ? discountPercentValue.toFixed(2)
        : String(discountPercentValue)
      : '0.00'

  const sortOrderValue = item.sort_order
  const sortOrder =
    sortOrderValue != null
      ? typeof sortOrderValue === 'number'
        ? sortOrderValue
        : Number(sortOrderValue) || 0
      : 0

  const isActiveValue = item.is_active
  const isActive =
    isActiveValue === true ||
    isActiveValue === 'true' ||
    isActiveValue === '1' ||
    isActiveValue === 1

  return {
    id: normalizedId,
    tier,
    displayName,
    description,
    minSpent,
    monthsWindow,
    multiplier,
    discountPercent,
    isActive,
    sortOrder,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}

