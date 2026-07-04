/** Shared types for POS appointments workspace (not used by checkout cart). */

export type PosDepositTransaction = {
  id: number
  order_id?: number
  order_number?: string
  line_type?: string
  kind?: 'service_deposit' | 'addon_deposit' | string
  label?: string
  amount: number
  payment_method?: string
  payments?: Array<{ method?: string; amount?: number }>
  paid_at?: string | null
  created_at?: string | null
  receipt_public_url?: string | null
  created_by?: { id?: number; name?: string } | null
  remark?: string | null
}

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
  customer_id?: number | null
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  guest_name?: string | null
  guest_phone?: string | null
  guest_email?: string | null
  service_names: string[]
  appointment_start_at?: string | null
  appointment_end_at?: string | null
  schedule_override?: {
    used?: boolean
    type?: string | null
    scheduled_staff_start_at?: string | null
    scheduled_staff_end_at?: string | null
    actual_booking_start_at?: string | null
    actual_booking_end_at?: string | null
    by?: number | null
    at?: string | null
  } | null
  staff_id?: number | null
  staff_name?: string | null
  status: string
  payment_status?: string | null
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
  visit_checkout_finalized?: boolean
  package_status?: { status?: string; used_qty?: number } | null
  can_apply_package?: boolean
  package_disabled_reason?: string | null
  eligible_package_count?: number
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
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  status: string
  payment_status?: string | null
  appointment_start_at?: string | null
  appointment_end_at?: string | null
  schedule_override?: {
    used?: boolean
    type?: string | null
    scheduled_staff_start_at?: string | null
    scheduled_staff_end_at?: string | null
    actual_booking_start_at?: string | null
    actual_booking_end_at?: string | null
    by?: number | null
    at?: string | null
  } | null
  /** Present when booked under a member; guest walk-ins use `guest_*` instead. */
  customer?: { id: number; name: string; phone?: string | null; email?: string | null } | null
  guest_name?: string | null
  guest_phone?: string | null
  guest_email?: string | null
  /** Booking remarks entered at create / reschedule. */
  notes?: string | null
  /** Void order remark from POS void flow. */
  void_remarks?: string | null
  /** Internal settlement notes appended from Edit Settlement. */
  settlement_notes?: string | null
  /** Latest reschedule reason (overwritten on each reschedule). */
  reschedule_reason?: string | null
  rescheduled_at?: string | null
  reschedule_count?: number
  service?: { id: number; name: string; cn_name?: string | null; service_type?: string | null; price_mode?: string | null; price_range_min?: number | null; price_range_max?: number | null; duration_min?: number | null }
  staff?: { id: number; name: string }
  staff_splits?: Array<{ staff_id: number; staff_name: string; share_percent: number }>
  service_total: number
  main_services?: Array<{ id?: number | null; name: string; cn_name?: string | null; extra_duration_min?: number; extra_price: number; linked_booking_service_id?: number | null; price_mode?: string | null; price_range_min?: number | null; price_range_max?: number | null; is_original?: boolean; add_ons?: Array<{ id?: number | null; name: string; cn_name?: string | null; extra_duration_min?: number; extra_price: number; linked_booking_service_id?: number | null; price_mode?: string | null; price_range_min?: number | null; price_range_max?: number | null; staff_splits?: Array<{ staff_id: number; share_percent: number }> }>; staff_splits?: Array<{ staff_id: number; share_percent: number }> }>
  main_service_settlement_items?: Array<{ id?: number | null; line_key?: string | null; name: string; cn_name?: string | null; extra_duration_min?: number; extra_price: number; balance_due?: number; paid_amount?: number; linked_booking_service_id?: number | null; is_original?: boolean; staff_splits?: Array<{ staff_id: number; share_percent: number }> }>
  settled_service_amount?: number | null
  is_range_priced?: boolean
  requires_settled_amount?: boolean
  add_ons?: Array<{ id?: number | null; line_key?: string | null; name: string; cn_name?: string | null; extra_duration_min: number; extra_price: number; price_mode?: string | null; price_range_min?: number | null; price_range_max?: number | null; price_finalized?: boolean | null; linked_booking_service_id?: number | null; service_ref?: string | null; staff_splits?: Array<{ staff_id: number; share_percent: number }> }>
  addon_total_duration_min?: number
  estimated_duration_min?: number
  addon_total_price?: number
  addon_paid_online?: number
  addon_paid_settlement?: number
  addon_balance_due?: number
  addon_settlement_items?: Array<{ id?: number | null; line_key?: string | null; name: string; cn_name?: string | null; extra_duration_min?: number; extra_price: number; balance_due?: number; paid_amount?: number; service_ref?: string | null; staff_splits?: Array<{ staff_id: number; share_percent: number }> }>
  deposit_contribution?: number
  deposit_paid: number
  linked_booking_deposit?: number
  linked_booking_deposit_total?: number
  deposit_previously_collected?: boolean
  deposit_previously_collected_amount?: number
  package_offset?: number
  /** Latest POS order that registered this booking via an order_service_items row (checkout closure). */
  visit_register_order_id?: number | null
  visit_checkout_finalized?: boolean
  settlement_paid: number
  service_balance_due?: number
  balance_due: number
  amount_due_now?: number
  package_status?: { status?: string; used_qty?: number } | null
  can_apply_package?: boolean
  package_disabled_reason?: string | null
  eligible_package_count?: number
  payment_history?: Array<{ order_id?: number; order_number?: string; line_type?: string; amount?: number; payment_method?: string; paid_at?: string | null }>
  receipts?: Array<{ order_id?: number; order_number?: string; line_type?: string; stage_label?: string; amount?: number; payment_method?: string; paid_at?: string | null; receipt_public_url?: string | null }>
  deposit_transactions?: PosDepositTransaction[]
  hold_expires_at?: string | null
  hold_deposit_order?: {
    id: number
    order_number: string
    status: string
    payment_status: string
    payment_method?: string
    grand_total?: number
  } | null
  payment_proofs?: Array<{
    id?: string | number
    file_url?: string | null
    url?: string | null
    payment_proof_url?: string | null
    uploaded_at?: string | null
    payment_method?: string | null
    note?: string | null
    status?: string | null
  }>
  uploaded_item_photos?: Array<{ id: number; image_path?: string | null; image_url?: string | null; created_at?: string | null }>
  service_photos?: Array<{ id: number; booking_id?: number | null; image_path?: string | null; image_url?: string | null; caption?: string | null; created_at?: string | null }>
}

export type ServiceAddonOption = {
  id: number
  label: string
  cn_name?: string | null
  cn_label?: string | null
  linked_cn_name?: string | null
  extra_duration_min: number
  extra_price: number
  price_mode?: string | null
  price_range_min?: number | null
  price_range_max?: number | null
  linked_price_mode?: string | null
  linked_price_range_min?: number | null
  linked_price_range_max?: number | null
}

export type ServiceAddonQuestion = {
  id: number
  title: string
  cn_title?: string | null
  description?: string | null
  cn_description?: string | null
  question_type: string
  is_required: boolean
  options: ServiceAddonOption[]
}
