/** Shared types for POS appointments workspace (not used by checkout cart). */

/** Active staff row for day schedule columns (all staff, not only with bookings). */
export type PosScheduleStaff = { id: number; name: string }

export type PosAppointmentCurrentUser = {
  id: number
  name: string
  staff_id?: number | null
  staff_name?: string | null
}

export type PosAppointmentListItem = {
  id: number
  booking_code: string
  customer_name: string
  service_names: string[]
  appointment_start_at?: string | null
  appointment_end_at?: string | null
  staff_id?: number | null
  staff_name?: string | null
  status: string
  deposit_contribution?: number
  deposit_paid: number
  linked_booking_deposit?: number
  linked_booking_deposit_total?: number
  deposit_previously_collected?: boolean
  deposit_previously_collected_amount?: number
  package_offset?: number
  balance_due: number
  amount_due_now?: number
  service_total?: number
}

export type PosAppointmentDetail = {
  id: number
  booking_code: string
  status: string
  appointment_start_at?: string | null
  appointment_end_at?: string | null
  customer?: { id: number; name: string; phone?: string | null; email?: string | null }
  service?: {
    id: number
    name: string
    service_type?: string | null
    price_mode?: 'fixed' | 'range' | null
    service_price?: number
    range_min?: number
    range_max?: number
  }
  staff?: { id: number; name: string }
  staff_splits?: Array<{ staff_id: number; staff_name: string; split_percent: number }>
  service_total: number
  add_ons?: Array<{ id?: number | null; name: string; extra_duration_min: number; extra_price: number }>
  addon_total_duration_min?: number
  addon_total_price?: number
  addon_paid_online?: number
  addon_paid_settlement?: number
  addon_balance_due?: number
  deposit_contribution?: number
  deposit_paid: number
  linked_booking_deposit?: number
  linked_booking_deposit_total?: number
  deposit_previously_collected?: boolean
  deposit_previously_collected_amount?: number
  package_offset?: number
  settlement_paid: number
  /** Service subtotal after deposit credit, package offset, and service settlement (matches balance math). */
  service_balance_due?: number
  balance_due: number
  amount_due_now?: number
  package_status?: { status?: string; used_qty?: number } | null
  payment_history?: Array<{ order_number?: string; line_type?: string; amount?: number; payment_method?: string; paid_at?: string | null }>
  receipts?: Array<{ order_id?: number; order_number?: string; line_type?: string; stage_label?: string; amount?: number; payment_method?: string; paid_at?: string | null; receipt_public_url?: string | null }>
}
