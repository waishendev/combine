import type { AdminRowData } from './AdminRow'
import type { AdminRoleOption } from './AdminFilters'
import { formatDateTime12Hour } from '@/lib/formatDateTime'

export const isOperationalStaffRole = (
  role: { name?: string | null } | null | undefined,
): boolean => (role?.name ?? '').trim().toLowerCase() === 'staff'

export const assignableAdminRoles = (
  roles: AdminRoleOption[],
  currentRole?: AdminRoleOption | null,
): AdminRoleOption[] => {
  const currentId = currentRole?.id != null ? String(currentRole.id) : null
  const filtered = roles.filter(
    (role) => !isOperationalStaffRole(role) || (currentId != null && String(role.id ?? '') === currentId),
  )

  if (currentRole && currentId && !filtered.some((role) => String(role.id ?? '') === currentId)) {
    return [currentRole, ...filtered]
  }

  return filtered
}

export type AdminApiRole = {
  id?: number | string | null
  name?: string | null
  guard_name?: string | null
  is_system?: boolean | number | string | null
  is_default?: boolean | number | string | null
}

export type AdminApiStoreLocation = {
  id?: number | string | null
  name?: string | null
  code?: string | null
  is_active?: boolean | number | string | null
  is_pickup_available?: boolean | number | string | null
  is_booking_available?: boolean | number | string | null
  is_pos_available?: boolean | number | string | null
  sort_order?: number | string | null
}

export type AdminApiStaff = {
  id?: number | string | null
  name?: string | null
  code?: string | null
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
  staff_id?: number | string | null
  staff?: AdminApiStaff | null
  store_locations?: AdminApiStoreLocation[] | null
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
    createdAt: formatDateTime12Hour(item.created_at),
    updatedAt: item.updated_at ?? '',
    storeLocations: Array.isArray(item.store_locations)
      ? item.store_locations.map((location) => ({
          id: Number(location.id) || 0,
          name: location.name ?? '-',
          code: location.code ?? '',
          isActive: location.is_active === true || location.is_active === 1 || location.is_active === '1' || location.is_active === 'true',
        }))
      : [],
  }
}
