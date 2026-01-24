import type { ServicesMenuRowData } from './ServicesMenuRow'

export type ServicesMenuApiItem = {
  id: number | string
  name?: string | null
  slug?: string | null
  sort_order?: number | string | null
  is_active?: boolean | number | string | null
  created_at?: string | null
  updated_at?: string | null
  page?: unknown | null
}

export const mapServicesMenuApiItemToRow = (
  item: ServicesMenuApiItem,
): ServicesMenuRowData => {
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
    name: item.name ?? '-',
    slug: item.slug ?? '-',
    sortOrder: normalizedSortOrder,
    isActive,
  }
}
