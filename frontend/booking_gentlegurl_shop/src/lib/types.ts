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
  start_time: string;
  end_time: string;
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
  deposit_total: number;
  next_expiry_at: string | null;
};

export type BookingRecord = {
  id: number;
  status: string;
  service_name: string;
  staff_name?: string | null;
  starts_at: string;
  deposit_amount: number;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  phone?: string;
};
