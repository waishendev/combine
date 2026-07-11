export interface BookingProductCategoryRowData {
  id: number
  name: string
  cnName: string
  sortOrder: number | null
  isActive: boolean
  showInPosFilter: boolean
}

export type BookingProductCategoryApiItem = {
  id?: number
  name?: string | null
  cn_name?: string | null
  sort_order?: number | null
  is_active?: boolean | number | string | null
  show_in_pos_filter?: boolean | number | string | null
}

export function mapBookingProductCategoryApiItemToRow(
  item: BookingProductCategoryApiItem,
): BookingProductCategoryRowData {
  return {
    id: Number(item.id ?? 0),
    name: String(item.name ?? ''),
    cnName: typeof item.cn_name === 'string' ? item.cn_name : '',
    sortOrder:
      item.sort_order !== null && item.sort_order !== undefined ? Number(item.sort_order) : null,
    isActive:
      item.is_active === true ||
      item.is_active === 1 ||
      item.is_active === '1' ||
      item.is_active === 'true',
    showInPosFilter:
      item.show_in_pos_filter === undefined ||
      item.show_in_pos_filter === null ||
      item.show_in_pos_filter === true ||
      item.show_in_pos_filter === 1 ||
      item.show_in_pos_filter === '1' ||
      item.show_in_pos_filter === 'true',
  }
}
