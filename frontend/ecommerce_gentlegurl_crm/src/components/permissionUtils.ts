import type { PermissionRowData } from './PermissionRow'

export type PermissionApiGroup = {
  id?: number | string | null
  name?: string | null
  sort_order?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export type PermissionApiItem = {
  id: number | string
  group_id?: number | string | null
  name?: string | null
  slug?: string | null
  description?: string | null
  created_at?: string | null
  updated_at?: string | null
  group?: PermissionApiGroup | null
}

export const mapPermissionApiItemToRow = (item: PermissionApiItem): PermissionRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  const groupIdValue = item.group_id
  let normalizedGroupId: number | null = null
  if (typeof groupIdValue === 'number') {
    normalizedGroupId = groupIdValue
  } else if (groupIdValue != null) {
    const parsed = Number(groupIdValue)
    normalizedGroupId = Number.isFinite(parsed) ? parsed : null
  }

  const groupName = item.group?.name ?? '-'

  return {
    id: normalizedId,
    groupId: normalizedGroupId,
    groupName,
    name: item.name ?? '-',
    slug: item.slug ?? '-',
    description: item.description ?? null,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}

