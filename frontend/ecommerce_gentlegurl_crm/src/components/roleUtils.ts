import type { RoleRowData } from './RoleRow'

export type RoleApiPermission = {
  id?: number | string | null
  name?: string | null
  slug?: string | null
  group_id?: number | string | null
  description?: string | null
  created_at?: string | null
  updated_at?: string | null
  pivot?: {
    role_id?: number | string | null
    permission_id?: number | string | null
  } | null
}

export type RoleApiItem = {
  id?: number | string | null
  name?: string | null
  description?: string | null
  is_active?: boolean | number | string | null
  permissions?: RoleApiPermission[] | null
  created_at?: string | null
  updated_at?: string | null
}

export const mapRoleApiItemToRow = (item: RoleApiItem): RoleRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  const permissions = Array.isArray(item.permissions)
    ? item.permissions.map((permission) => ({
        id: permission?.id ?? '',
        name: permission?.name ?? '-',
        slug: permission?.slug ?? '-',
      }))
    : []

  const permissionNames =
    permissions.length > 0
      ? permissions.map((permission) => permission.name).join(', ')
      : ''

  const isActiveValue = item.is_active
  const isActive =
    isActiveValue === true ||
    isActiveValue === 'true' ||
    isActiveValue === '1' ||
    isActiveValue === 1

  return {
    id: normalizedId,
    name: item.name ?? '-',
    description: item.description ?? null,
    isActive,
    permissions,
    permissionNames,
    permissionCount: permissions.length,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}

