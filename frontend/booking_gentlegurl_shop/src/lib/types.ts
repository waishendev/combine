export type Service = {
  id: number;
  name: string;
  description?: string;
  service_type: "premium" | "standard";
  duration_minutes: number;
  deposit_amount: number;
  price: number;
  category?: string;
};

export type Staff = {
  id: number;
  name: string;
  avatar?: string | null;
  bio?: string;
};

export type BookingSlot = {
  start_at?: string;
  end_at?: string;
  start_time?: string;
  end_time?: string;
  is_available?: boolean;
  label?: string;
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
  expires_at: string;
  status: string;
};

export type BookingCart = {
  id: string | null;
  status: string;
  items: BookingCartItem[];
  package_items: BookingCartPackageItem[];
  deposit_total: number;
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
  status: string;
  service_name: string;
  staff_name?: string | null;
  starts_at: string;
  deposit_amount: number;
  package_claim_status?: 'reserved' | 'consumed' | 'released' | null;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  phone?: string;
};


export type ServicePackage = {
  id: number;
  name: string;
  description?: string | null;
  selling_price: number;
  total_sessions: number;
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
