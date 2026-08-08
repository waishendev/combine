export type StoreLocation = {
  id: number
  name: string
  code: string
  is_active: boolean
  is_pickup_available: boolean
  is_booking_available: boolean
  is_pos_available: boolean
  sort_order: number
  inventory_cutover_status?: 'pending' | 'reconciled' | 'active'
  inventory_is_authoritative?: boolean
  inventory_authority_label?: string
}
