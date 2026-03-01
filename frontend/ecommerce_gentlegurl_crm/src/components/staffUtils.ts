export type StaffApiItem = {
  id: number | string
  code?: string | null
  name?: string | null
  phone?: string | null
  email?: string | null
  commission_rate?: number | string | null
  is_active?: boolean | number | string | null
  created_at?: string | null
  admin?: {
    username?: string | null
  } | null
}

export type StaffRowData = {
  id: number
  code: string
  name: string
  phone: string
  email: string
  loginUsername: string
  commissionRate: number
  isActive: boolean
  createdAt: string
}

export const mapStaffApiItemToRow = (item: StaffApiItem): StaffRowData => {
  const id = Number(item.id) || 0
  const commissionRateRaw = Number(item.commission_rate ?? 0)

  return {
    id,
    code: item.code ?? '-',
    name: item.name ?? '-',
    phone: item.phone ?? '-',
    email: item.email ?? '-',
    loginUsername: item.admin?.username ?? '-',
    commissionRate: Number.isFinite(commissionRateRaw) ? commissionRateRaw : 0,
    isActive: item.is_active === true || item.is_active === 1 || item.is_active === '1' || item.is_active === 'true',
    createdAt: item.created_at ?? '',
  }
}
