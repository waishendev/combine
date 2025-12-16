import type { PermissionGroupRowData } from './PermissionGroupRow'

export type PermissionGroupApiItem = {
  id: number | string
  name?: string | null
  sort_order?: number | string | null
  created_at?: string | null
  updated_at?: string | null
  permissions?: Array<{
    id: number | string
    group_id: number | string
    name: string | null
    slug: string | null
    description: string | null
    created_at?: string | null
    updated_at?: string | null
  }> | null
}

export const mapPermissionGroupApiItemToRow = (
  item: PermissionGroupApiItem,
): PermissionGroupRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

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
    sortOrder: normalizedSortOrder,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}

