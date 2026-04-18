export interface CustomerTypeRowData {
  id: number
  name: string
  createdAt: string
  updatedAt: string
}

export type CustomerTypeApiItem = {
  id: number | string
  name?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export function mapCustomerTypeApiItemToRow(item: CustomerTypeApiItem): CustomerTypeRowData {
  const rawId = typeof item.id === 'number' ? item.id : Number(item.id)
  const id = Number.isFinite(rawId) ? Number(rawId) : 0

  return {
    id,
    name: item.name ?? '-',
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}
