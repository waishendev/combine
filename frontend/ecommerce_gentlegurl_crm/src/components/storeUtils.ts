import type { StoreRowData } from './StoreRow'

export type StoreApiItem = {
  id: number | string
  name?: string | null
  code?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postcode?: string | null
  country?: string | null
  phone?: string | null
  is_active?: boolean | number | string | null
  created_at?: string | null
  updated_at?: string | null
}

export const mapStoreApiItemToRow = (item: StoreApiItem): StoreRowData => {
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
    code: item.code ?? '-',
    address_line1: item.address_line1 ?? '-',
    address_line2: item.address_line2 ?? '',
    city: item.city ?? '-',
    state: item.state ?? '-',
    postcode: item.postcode ?? '-',
    country: item.country ?? '-',
    phone: item.phone ?? '-',
    isActive,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}


