export interface BookingServiceCategoryRowData {
  id: number
  name: string
  cnName?: string
  slug: string
  sortOrder: number | null
  isActive: boolean
  imagePath?: string
  imageUrl?: string
}

export type BookingServiceCategoryApiItem = {
  id?: number
  name?: string | null
  cn_name?: string | null
  slug?: string | null
  sort_order?: number | null
  is_active?: boolean | number | string | null
  image_path?: string | null
  image_url?: string | null
}

export function mapBookingServiceCategoryApiItemToRow(
  item: BookingServiceCategoryApiItem,
): BookingServiceCategoryRowData {
  return {
    id: Number(item.id ?? 0),
    name: String(item.name ?? ''),
    cnName: typeof item.cn_name === 'string' ? item.cn_name : '',
    slug: String(item.slug ?? ''),
    sortOrder:
      item.sort_order !== null && item.sort_order !== undefined ? Number(item.sort_order) : null,
    isActive:
      item.is_active === true ||
      item.is_active === 1 ||
      item.is_active === '1' ||
      item.is_active === 'true',
    imagePath: typeof item.image_path === 'string' && item.image_path ? item.image_path : undefined,
    imageUrl: typeof item.image_url === 'string' && item.image_url ? item.image_url : undefined,
  }
}

/**
 * Laravel-style JSON: `{ message, errors: { field: ["msg"] } }`.
 * Prefer flattened `errors` so UI shows e.g. image message instead of only "Validation failed".
 */
export function formatBookingCategorySubmitError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const o = body as Record<string, unknown>
  const errors = o.errors
  if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
    const parts: string[] = []
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const msg of value) {
          if (typeof msg === 'string' && msg.trim()) parts.push(msg.trim())
        }
      } else if (typeof value === 'string' && value.trim()) {
        parts.push(value.trim())
      }
    }
    if (parts.length > 0) return parts.join(' ')
  }
  if (typeof o.message === 'string' && o.message.trim()) return o.message.trim()
  return fallback
}
