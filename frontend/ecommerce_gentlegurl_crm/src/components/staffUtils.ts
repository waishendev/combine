export type StaffApiItem = {
  id: number | string
  code?: string | null
  name?: string | null
  phone?: string | null
  email?: string | null
  position?: string | null
  description?: string | null
  avatar_path?: string | null
  avatar_url?: string | null
  commission_rate?: number | string | null
  service_commission_rate?: number | string | null
  is_active?: boolean | number | string | null
  created_at?: string | null
  admin?: {
    id?: number | string | null
    username?: string | null
  } | null
}

export type StaffRowData = {
  id: number
  code: string
  name: string
  phone: string
  email: string
  position: string
  description: string
  avatarPath: string
  avatarUrl: string
  loginUsername: string
  adminUserId: number | null
  commissionRate: number
  serviceCommissionRate: number
  isActive: boolean
  createdAt: string
}

export const mapStaffApiItemToRow = (item: StaffApiItem): StaffRowData => {
  const id = Number(item.id) || 0
  const commissionRateRaw = Number(item.commission_rate ?? 0)
  const serviceCommissionRateRaw = Number(item.service_commission_rate ?? 0)

  return {
    id,
    code: item.code ?? '-',
    name: item.name ?? '-',
    phone: item.phone ?? '-',
    email: item.email ?? '-',
    position: item.position ?? '',
    description: item.description ?? '',
    avatarPath: item.avatar_path ?? '',
    avatarUrl: item.avatar_url ?? item.avatar_path ?? '',
    loginUsername: item.admin?.username ?? '-',
    adminUserId: item.admin?.id != null ? Number(item.admin.id) : null,
    commissionRate: Number.isFinite(commissionRateRaw) ? commissionRateRaw : 0,
    serviceCommissionRate: Number.isFinite(serviceCommissionRateRaw) ? serviceCommissionRateRaw : 0,
    isActive: item.is_active === true || item.is_active === 1 || item.is_active === '1' || item.is_active === 'true',
    createdAt: item.created_at ?? '',
  }
}
