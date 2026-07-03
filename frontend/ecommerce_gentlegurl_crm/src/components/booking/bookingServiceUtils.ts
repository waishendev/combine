import type { BookingServiceRowData } from './BookingServiceRow'

/** Shown under cover image fields in CRM (booking services + categories); matches booking shop card crop. */
export const BOOKING_SERVICE_COVER_IMAGE_SUGGESTED_SIZE_LINE =
  'Suggested size: 1080 × 680 px (landscape).'

export type BookingServiceApiItem = {
  id: number | string
  name?: string | null
  cn_name?: string | null
  description?: string | null
  service_type?: 'premium' | 'standard' | string | null
  category_ids?: number[] | null
  category_id?: number | string | null
  category?: { id?: number | string; name?: string | null; cn_name?: string | null } | null
  categories?: Array<{ id?: number | string; name?: string | null; cn_name?: string | null }> | null
  duration_min?: number | string | null
  service_price?: string | number | null
  price_mode?: string | null
  price_range_min?: string | number | null
  price_range_max?: string | number | null
  deposit_amount?: string | number | null
  buffer_min?: number | string | null
  is_active?: boolean | number | string | null
  allow_photo_upload?: boolean | number | string | null
  image_path?: string | null
  image_url?: string | null
  linked_booking_product_id?: number | null
  linked_booking_product?: {
    id: number
    name?: string | null
    cn_name?: string | null
    price?: number | string | null
    price_mode?: string | null
    is_active?: boolean | null
  } | null
  created_at?: string | null
  updated_at?: string | null
  allowed_staff_count?: number | string | null
  allowed_staff_names?: string[] | null
  primary_slots?: Array<{ start_time?: string | null }> | null
}

export const extractBookingServiceApiErrorMessage = (
  data: unknown,
  fallback: string,
): string => {
  if (!data || typeof data !== 'object') {
    return fallback
  }

  const payload = data as { message?: unknown; errors?: unknown }
  if (typeof payload.message === 'string' && payload.message.trim() !== '') {
    return payload.message
  }

  if (payload.errors && typeof payload.errors === 'object') {
    const errors = payload.errors as Record<string, unknown>
    const firstKey = Object.keys(errors)[0]
    if (firstKey) {
      const firstValue = errors[firstKey]
      if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
        return firstValue[0]
      }
      if (typeof firstValue === 'string') {
        return firstValue
      }
    }
  }

  return fallback
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

  const allowPhotoUpload = item.allow_photo_upload === true || item.allow_photo_upload === 'true' || item.allow_photo_upload === '1' || item.allow_photo_upload === 1

  const durationMin = typeof item.duration_min === 'number' 
    ? item.duration_min 
    : (item.duration_min ? Number(item.duration_min) : 0)

  const bufferMin = typeof item.buffer_min === 'number'
    ? item.buffer_min
    : (item.buffer_min ? Number(item.buffer_min) : 0)

  const servicePrice = item.service_price ?? 0
  const priceMode = item.price_mode === 'range' ? 'range' : 'fixed'
  const priceRangeMin = item.price_range_min != null ? Number(item.price_range_min) : null
  const priceRangeMax = item.price_range_max != null ? Number(item.price_range_max) : null
  const depositAmount = item.deposit_amount ?? 0

  const categoryIds = Array.isArray(item.category_ids)
    ? item.category_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : item.category_id != null
      ? [Number(item.category_id)].filter((id) => Number.isFinite(id) && id > 0)
      : item.category?.id != null
        ? [Number(item.category.id)].filter((id) => Number.isFinite(id) && id > 0)
        : Array.isArray(item.categories)
          ? item.categories
              .map((category) => Number(category?.id))
              .filter((id) => Number.isFinite(id) && id > 0)
          : []

  const categoryNames = Array.isArray(item.categories)
    ? item.categories.map((category) => String(category?.name ?? '').trim()).filter(Boolean)
    : item.category?.name
      ? [String(item.category.name)]
      : []

  return {
    id: normalizedId,
    name: item.name ?? '-',
    cnName: typeof item.cn_name === 'string' ? item.cn_name : '',
    serviceType:
      item.service_type === 'premium' || item.service_type === 'standard'
        ? item.service_type
        : (item.service_type ? String(item.service_type) : ''),
    categoryId: categoryIds[0] ?? null,
    categoryIds,
    categoryName: categoryNames[0] ?? '',
    categoryNames,
    description: item.description ?? '',
    duration_min: durationMin,
    service_price: servicePrice,
    price_mode: priceMode,
    price_range_min: priceRangeMin,
    price_range_max: priceRangeMax,
    deposit_amount: depositAmount,
    buffer_min: bufferMin,
    isActive,
    allowPhotoUpload,
    imagePath: item.image_path ?? '',
    imageUrl: item.image_url ?? item.image_path ?? '',
    createdAt: item.created_at ?? undefined,
    allowedStaffCount: item.allowed_staff_count != null ? Number(item.allowed_staff_count) : undefined,
    allowedStaffNames: Array.isArray(item.allowed_staff_names) ? item.allowed_staff_names.filter((name): name is string => typeof name === 'string') : undefined,
    primarySlots: Array.isArray(item.primary_slots) ? item.primary_slots.map((slot) => String(slot?.start_time ?? "")).filter(Boolean) : undefined,
  }
}
