export interface BookingServiceCategoryRowData {
  id: number
  name: string
  slug: string
  sortOrder: number | null
  isActive: boolean
}

export type BookingServiceCategoryApiItem = {
  id?: number
  name?: string | null
  slug?: string | null
  sort_order?: number | null
  is_active?: boolean | number | string | null
}

export function mapBookingServiceCategoryApiItemToRow(
  item: BookingServiceCategoryApiItem,
): BookingServiceCategoryRowData {
  return {
    id: Number(item.id ?? 0),
    name: String(item.name ?? ''),
    slug: String(item.slug ?? ''),
    sortOrder:
      item.sort_order !== null && item.sort_order !== undefined ? Number(item.sort_order) : null,
    isActive:
      item.is_active === true ||
      item.is_active === 1 ||
      item.is_active === '1' ||
      item.is_active === 'true',
  }
}
