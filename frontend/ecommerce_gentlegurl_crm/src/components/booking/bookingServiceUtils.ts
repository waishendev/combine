import type { BookingServiceRowData } from './BookingServiceRow'

export type BookingServiceApiItem = {
  id: number | string
  name?: string | null
  description?: string | null
  service_type?: 'premium' | 'standard' | null
  duration_min?: number | string | null
  service_price?: string | number | null
  deposit_amount?: string | number | null
  buffer_min?: number | string | null
  is_active?: boolean | number | string | null
  image_path?: string | null
  image_url?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export const mapBookingServiceApiItemToRow = (item: BookingServiceApiItem): BookingServiceRowData => {
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

  const durationMin = typeof item.duration_min === 'number' 
    ? item.duration_min 
    : (item.duration_min ? Number(item.duration_min) : 0)

  const bufferMin = typeof item.buffer_min === 'number'
    ? item.buffer_min
    : (item.buffer_min ? Number(item.buffer_min) : 0)

  const servicePrice = item.service_price ?? 0
  const depositAmount = item.deposit_amount ?? 0

  return {
    id: normalizedId,
    name: item.name ?? '-',
    description: item.description ?? '',
    duration_min: durationMin,
    service_price: servicePrice,
    deposit_amount: depositAmount,
    buffer_min: bufferMin,
    isActive,
    imagePath: item.image_path ?? '',
    imageUrl: item.image_url ?? item.image_path ?? '',
    createdAt: item.created_at ?? undefined,
  }
}
