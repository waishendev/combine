import type { CustomerRowData } from './CustomerRow'

export type CustomerApiItem = {
  id: number | string
  name?: string | null
  email?: string | null
  phone?: string | null
  tier?: string | null
  customer_type_id?: number | string | null
  type?: string | null
  tier_marked_pending_at?: string | null
  tier_effective_at?: string | null
  is_active?: boolean | number | string | null
  last_login_at?: string | null
  last_login_ip?: string | null
  allow_booking_without_deposit?: boolean | number | string | null
  gender?: string | null
  date_of_birth?: string | null
  created_at?: string | null
  updated_at?: string | null
  available_points?: number | null
  spent_in_window?: number | null
  next_tier?: string | null
  amount_to_next_tier?: number | null
}

export function normalizeDateForInput(value: unknown): string {
  if (value == null) return ''

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''

    const datePart = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
    if (datePart) return datePart[1]

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }

    return ''
  }

  return ''
}

export type CustomerFormState = {
  name: string
  email: string
  phone: string
  password: string
  isActive: 'true' | 'false'
  customerTypeId: string
  gender: string
  date_of_birth: string
}

export const mapCustomerApiItemToFormState = (customer: CustomerApiItem): CustomerFormState => ({
  name: typeof customer.name === 'string' ? customer.name : '',
  email: typeof customer.email === 'string' ? customer.email : '',
  phone: typeof customer.phone === 'string' ? customer.phone : '',
  password: '',
  isActive:
    customer.is_active === true || customer.is_active === 'true' || customer.is_active === 1
      ? 'true'
      : 'false',
  customerTypeId:
    customer.customer_type_id === null || customer.customer_type_id === undefined
      ? ''
      : String(customer.customer_type_id),
  gender: typeof customer.gender === 'string' ? customer.gender : '',
  date_of_birth: normalizeDateForInput(customer.date_of_birth),
})

export const mapCustomerApiItemToRow = (item: CustomerApiItem): CustomerRowData => {
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

  return {
    id: normalizedId,
    name: item.name ?? '-',
    email: item.email ?? '-',
    phone: item.phone ?? '-',
    tier: item.tier ?? '-',
    type: item.type ?? '-',
    isActive,
    allowBookingWithoutDeposit:
      item.allow_booking_without_deposit === true ||
      item.allow_booking_without_deposit === 'true' ||
      item.allow_booking_without_deposit === '1' ||
      item.allow_booking_without_deposit === 1,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}
