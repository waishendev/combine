import type { StoreRowData, StoreImage } from './StoreRow'

export type StoreApiItem = {
  id: number | string
  name?: string | null
  code?: string | null
  opening_hours?: unknown
  images?: {
    id?: number | string | null
    image_path?: string | null
    image_url?: string | null
    sort_order?: number | string | null
  }[]
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postcode?: string | null
  country?: string | null
  phone?: string | null
  is_active?: boolean | number | string | null
}

const formatOpeningHours = (openingHours: unknown): string[] => {
  if (Array.isArray(openingHours)) {
    return openingHours
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
  }

  if (openingHours && typeof openingHours === 'object') {
    return Object.entries(openingHours as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value ?? '').trim()}`.trim())
      .filter((value) => value && !value.endsWith(':'))
  }

  return []
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

  const images: StoreImage[] = (item.images ?? [])
    .map((image) => {
      const idValue =
        typeof image?.id === 'number'
          ? image.id
          : Number(image?.id) || Number.parseInt(String(image?.id ?? ''), 10)
      const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0
      const imageUrl = image?.image_url ?? null
      return normalizedId && imageUrl ? { id: normalizedId, imageUrl } : null
    })
    .filter((value): value is StoreImage => Boolean(value))

  const primaryImageUrl = images[0]?.imageUrl ?? null

  return {
    id: normalizedId,
    name: item.name ?? '-',
    code: item.code ?? '-',
    imageUrl: primaryImageUrl,
    images,
    openingHours: formatOpeningHours(item.opening_hours),
    address_line1: item.address_line1 ?? '-',
    address_line2: item.address_line2 ?? '',
    city: item.city ?? '-',
    state: item.state ?? '-',
    postcode: item.postcode ?? '-',
    country: item.country ?? '-',
    phone: item.phone ?? '-',
    isActive,
  }
}
