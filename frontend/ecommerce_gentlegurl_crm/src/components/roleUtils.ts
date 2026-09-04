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
  permissions_count?: number | string | null
  created_at?: string | null
  updated_at?: string | null
  store_location_id?: number | string | null
  store_location?: { id?: number; name?: string | null; code?: string | null } | null
}

export const roleApiErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== 'object') return fallback

  const response = payload as { message?: unknown; errors?: unknown; error?: unknown }
  if (typeof response.message === 'string' && response.message.trim() && response.message !== 'HTTP Error') {
    return response.message
  }
  if (response.errors && typeof response.errors === 'object') {
    for (const value of Object.values(response.errors as Record<string, unknown>)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
      if (typeof value === 'string') return value
    }
  }
  if (typeof response.error === 'string' && response.error.trim()) return response.error
  return fallback
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

  const permissionCountFromApi = Number(item.permissions_count)
  const permissionCount = Number.isFinite(permissionCountFromApi)
    ? permissionCountFromApi
    : permissions.length

  const permissionNames =
    permissions.length > 0
      ? permissions.map((permission) => permission.name).join(', ')
      : permissionCount > 0
        ? `${permissionCount} permission${permissionCount === 1 ? '' : 's'}`
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
    permissionCount,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
    branchName: item.store_location?.name ?? 'Global / Unassigned',
  }
}
