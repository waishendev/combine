import type { AdminRowData } from './AdminRow'

export type AdminApiRole = {
  id?: number | string | null
  name?: string | null
  guard_name?: string | null
}

export type AdminApiItem = {
  id: number | string
  username?: string | null
  email?: string | null
  is_active?: boolean | number | string | null
  role?: AdminApiRole | null
  roles?: AdminApiRole[] | null
  created_at?: string | null
  updated_at?: string | null
  last_login_at?: string | null
  last_login_ip?: string | null
}

export const mapAdminApiItemToRow = (item: AdminApiItem): AdminRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  // Handle both role (single) and roles (array) formats
  const role = item.role || (Array.isArray(item.roles) && item.roles.length > 0 ? item.roles[0] : null)
  
  const roleIdValue = role?.id
  let normalizedRoleId: number | null = null
  if (typeof roleIdValue === 'number') {
    normalizedRoleId = roleIdValue
  } else if (roleIdValue != null) {
    const parsed = Number(roleIdValue)
    normalizedRoleId = Number.isFinite(parsed) ? parsed : null
  }

  // If roles array has multiple roles, join them
  let roleName = role?.name ?? '-'
  if (Array.isArray(item.roles) && item.roles.length > 1) {
    roleName = item.roles.map(r => r?.name).filter(Boolean).join(', ')
  }

  const isActiveValue = item.is_active
  const isActive =
    isActiveValue === true ||
    isActiveValue === 'true' ||
    isActiveValue === '1' ||
    isActiveValue === 1

  return {
    id: normalizedId,
    username: item.username ?? '-',
    email: item.email ?? '-',
    isActive,
    roleName,
    roleId: normalizedRoleId,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}
