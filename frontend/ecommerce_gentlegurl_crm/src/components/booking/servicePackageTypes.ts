export type ServicePackageItem = {
  id: number
  booking_service_id: number
  quantity: number
  booking_service?: {
    id: number
    name: string
  }
}

export type ServicePackage = {
  id: number
  name: string
  description?: string | null
  selling_price: number | string
  total_sessions: number
  valid_days?: number | null
  is_active: boolean
  items?: ServicePackageItem[]
}

export type BookingServiceOption = {
  id: number
  name: string
}
