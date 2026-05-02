export type BookingProductCategory = {
  id: number
  name: string
  sort_order: number
  is_active: boolean
}

export type BookingProductRowData = {
  id: number
  name: string
  price: number
  barcode?: string | null
  description?: string | null
  category_ids?: number[]
  categories?: BookingProductCategory[]
  is_active: boolean
  image_path?: string | null
  image_url?: string | null
}

