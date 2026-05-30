export type BookingProductCategory = {
  id: number
  name: string
  cn_name?: string | null
  sort_order: number
  is_active: boolean
}

export type BookingProductRowData = {
  id: number
  name: string
  cn_name?: string | null
  price: number
  barcode?: string | null
  description?: string | null
  category_ids?: number[]
  categories?: BookingProductCategory[]
  is_active: boolean
  image_path?: string | null
  image_url?: string | null
  questions?: BookingProductQuestion[]
}



export type BookingProductQuestionOption = {
  id?: number
  label: string
  cn_label?: string | null
  extra_price: number
  sort_order: number
  is_active: boolean
}

export type BookingProductQuestion = {
  id?: number
  title: string
  cn_title?: string | null
  description?: string | null
  cn_description?: string | null
  question_type: "single_choice" | "multi_choice"
  sort_order: number
  is_required: boolean
  is_active: boolean
  options: BookingProductQuestionOption[]
}
