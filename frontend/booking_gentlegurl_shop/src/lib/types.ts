export type BookingServiceCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  is_active: boolean;
  sort_order: number;
};

export type Service = {
  id: number;
  name: string;
  description?: string;
  service_type: "premium" | "standard";
  duration_minutes: number;
  deposit_amount: number;
  payment_status?: string;
  price: number;
  category?: string;
  image_path?: string | null;
  image_url?: string | null;
  primary_slots?: Array<{ id: number; start_time: string; sort_order: number; is_active: boolean }>;
  questions?: BookingServiceQuestion[];
};
export type BookingServiceQuestion = {
  id: number;
  title: string;
  description?: string | null;
  question_type: "single_choice" | "multi_choice";
  is_required: boolean;
  sort_order: number;
  options: BookingServiceQuestionOption[];
};

export type BookingServiceQuestionOption = {
  id: number;
  label: string;
  linked_booking_service_id?: number | null;
  extra_duration_min: number;
  extra_price: number;
  sort_order: number;
  is_active: boolean;
};

export type Staff = {
  id: number;
  name: string;
  avatar?: string | null;
  avatar_path?: string | null;
  avatar_url?: string | null;
  position?: string | null;
  description?: string | null;
  bio?: string;
};

export type BookingSlot = {
  start_at?: string;
  end_at?: string;
  start_time?: string;
  end_time?: string;
  is_available?: boolean;
  label?: string;
  slot_kind?: "primary" | "fallback" | "standard";
  configured_primary_time?: string | null;
  matched_primary_time?: string | null;
  is_primary?: boolean;
  is_fallback?: boolean;
};

export type BookingCartItem = {
  id: number;
  service_id: number;
  service_name: string;
  staff_id: number;
  staff_name: string;
  service_type: "premium" | "standard";
  start_at: string;
  end_at: string;
  addon_duration_min?: number;
  addon_price?: number;
  selected_options?: BookingServiceQuestionOption[];
  expires_at: string;
  status: string;
  deposit_amount?: number | null;
  package_claim_status?: "reserved" | "consumed" | "released" | null;
};

export type BookingCart = {
  id: string | null;
  status: string;
  items: BookingCartItem[];
  package_items: BookingCartPackageItem[];
  deposit_total: number;
  addon_total?: number;
  package_total: number;
  cart_total: number;
  next_expiry_at: string | null;
};

export type BookingCartPackageItem = {
  id: number;
  service_package_id: number;
  package_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  status: string;
};

export type BookingRecord = {
  id: number;
  booking_code?: string | null;
  status: string;
  service_name: string;
  add_ons?: Array<{
    id?: number | null;
    name: string;
    extra_duration_min: number;
    extra_price: number;
  }>;
  addon_total_duration_min?: number;
  addon_total_price?: number;
  staff_name?: string | null;
  starts_at: string;
  deposit_amount: number;
  payment_status?: string;
  reschedule_count?: number;
  cancellation_request?: {
    id: number;
    status: 'pending' | 'approved' | 'rejected';
    requested_at?: string | null;
  } | null;
  package_claim_status?: 'reserved' | 'consumed' | 'released' | null;
  latest_payment?: {
    id: number;
    status: string;
    provider: string;
    payment_method?: string | null;
    payment_url?: string | null;
    manual_status?: string | null;
    manual_slip_url?: string | null;
  } | null;
  paid_via_order?: {
    order_id: number;
    order_number: string;
    deposit_order_item_id: number;
  } | null;
  receipts?: Array<{
    order_id: number;
    order_number: string;
    line_type: string;
    stage_label: string;
    amount: number;
    payment_method?: string | null;
    paid_at?: string | null;
    receipt_public_url?: string | null;
  }>;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  phone?: string;
};

export type CustomerProfile = {
  id: number;
  name: string;
  email: string;
  phone: string;
  avatar: string | null;
  gender: string | null;
  date_of_birth: string | null;
  tier?: string;
};

export type CustomerProfileWithAddresses = CustomerProfile & {
  addresses: CustomerAddress[];
};

export type CustomerAddress = {
  id: number;
  label: string | null;
  type: "billing" | "shipping";
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postcode: string | null;
  country: string;
  is_default: boolean;
};

export type AddressPayload = {
  label?: string | null;
  type: "billing" | "shipping";
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postcode?: string | null;
  country: string;
  is_default?: boolean;
};

export type UpdateCustomerProfilePayload = Partial<{
  name: string;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  photo: File | null;
}>;


export type ServicePackage = {
  id: number;
  name: string;
  description?: string | null;
  selling_price: number;
  valid_days?: number | null;
  is_active?: boolean;
  items?: Array<{
    id: number;
    booking_service_id: number;
    quantity: number;
    booking_service?: { id: number; name: string };
  }>;
};

export type ServicePackageAvailability = {
  customer_service_package_id: number;
  service_package_id?: number;
  service_package_name?: string;
  booking_service_id: number;
  remaining_qty: number;
  expires_at?: string | null;
};


export type MyServicePackage = {
  id: number;
  status: string;
  started_at?: string | null;
  expires_at?: string | null;
  service_package?: ServicePackage;
  balances?: Array<{
    id: number;
    booking_service_id: number;
    total_qty: number;
    used_qty: number;
    remaining_qty: number;
    booking_service?: { id: number; name: string };
  }>;
};


export type BookingPolicy = {
  reschedule: {
    enabled: boolean;
    max_changes: number;
    cutoff_hours: number;
  };
  cancel: {
    customer_cancel_allowed: boolean;
    deposit_refundable: boolean;
  };
};
