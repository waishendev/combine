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
  /** From `resolveAppointmentFinancialSummary` — used with `package_status` for completed paid vs unpaid colours. */
  settlement_paid?: number
  package_status?: { status?: string; used_qty?: number } | null
  service_total?: number
  settled_service_amount?: number | null
  is_range_priced?: boolean
  requires_settled_amount?: boolean
  service_price_mode?: string | null
  service_price_range_min?: number | null
  service_price_range_max?: number | null
}

export type PosAppointmentDetail = {
  id: number
  booking_code: string
  status: string
  appointment_start_at?: string | null
  appointment_end_at?: string | null
  /** Present when booked under a member; guest walk-ins use `guest_*` instead. */
  customer?: { id: number; name: string; phone?: string | null; email?: string | null } | null
  guest_name?: string | null
  guest_phone?: string | null
  guest_email?: string | null
  service?: { id: number; name: string; service_type?: string | null; price_mode?: string | null; price_range_min?: number | null; price_range_max?: number | null }
  staff?: { id: number; name: string }
  staff_splits?: Array<{ staff_id: number; staff_name: string; split_percent: number }>
  service_total: number
  settled_service_amount?: number | null
  is_range_priced?: boolean
  requires_settled_amount?: boolean
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
  /** Latest POS order that registered this booking via an order_service_items row (checkout closure). */
  visit_register_order_id?: number
  settlement_paid: number
  service_balance_due?: number
  balance_due: number
  amount_due_now?: number
  package_status?: { status?: string; used_qty?: number } | null
  payment_history?: Array<{ order_number?: string; line_type?: string; amount?: number; payment_method?: string; paid_at?: string | null }>
  receipts?: Array<{ order_id?: number; order_number?: string; line_type?: string; stage_label?: string; amount?: number; payment_method?: string; paid_at?: string | null; receipt_public_url?: string | null }>
}

export type ServiceAddonOption = {
  id: number
  label: string
  extra_duration_min: number
  extra_price: number
}

export type ServiceAddonQuestion = {
  id: number
  title: string
  question_type: string
  is_required: boolean
  options: ServiceAddonOption[]
}
