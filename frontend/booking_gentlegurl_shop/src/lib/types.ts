export type Service = {
  id: number;
  name: string;
  description?: string;
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

export type BookingHold = {
  booking_id: number;
  expires_at: string;
  status: string;
  service: Service;
  staff?: Staff | null;
  slot: BookingSlot;
  deposit_amount: number;
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
