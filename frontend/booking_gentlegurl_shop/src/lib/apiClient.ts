import { getOrCreateBookingGuestToken } from "./bookingGuestToken";
import { 
  AddressPayload, 
  AuthUser, 
  BookingCart, 
  BookingPolicy,
  BookingRecord, 
  BookingSlot, 
  CustomerAddress, 
  CustomerProfileWithAddresses, 
  MyServicePackage, 
  Service, 
  ServicePackage, 
  ServicePackageAvailability, 
  Staff,
  UpdateCustomerProfilePayload 
} from "./types";

const API_PREFIX = "/api/proxy";


export type PublicBookingBankAccount = {
  id: number;
  label?: string | null;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch?: string | null;
  swift_code?: string | null;
  logo_url?: string | null;
  qr_image_url?: string | null;
  instructions?: string | null;
  is_default?: boolean;
};

export type PublicBookingPaymentGateway = {
  id: number;
  key: string;
  name: string;
  is_active?: boolean;
  is_default?: boolean;
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (!(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");
  if (path.startsWith("/booking/cart")) {
    const guestToken = getOrCreateBookingGuestToken();
    if (guestToken) {
      headers.set("X-Booking-Guest-Token", guestToken);
    }
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      payload?.message || payload?.error || "Something went wrong. Please try again.",
      response.status,
    );
  }

  return payload;
}

const unwrapData = <T>(input: { data?: T } | T): T => {
  if (input && typeof input === "object" && "data" in input) {
    return (input as { data: T }).data;
  }
  return input as T;
};

export async function getBookingServices(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const response = await request<{ data: Service[] } | Service[]>(`/booking/services${query}`);
  return unwrapData<Service[]>(response);
}

export async function getBookingServiceDetail(id: string) {
  const response = await request<{ data: Service & { staffs?: Staff[] } } | (Service & { staffs?: Staff[] })>(`/booking/services/${id}`);
  return unwrapData<Service & { staffs?: Staff[] }>(response);
}

export async function getAvailability(serviceId: string, staffId: string, date: string) {
  return request<{ success?: boolean; message?: string; data?: { slots?: BookingSlot[] } }>(
    `/booking/availability?service_id=${serviceId}&staff_id=${staffId}&date=${date}`,
  );
}

export async function addCartItem(payload: {
  service_id: number;
  staff_id: number;
  start_at: string;
}) {
  const response = await request<{ data: BookingCart } | BookingCart>("/booking/cart/add", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return unwrapData<BookingCart>(response);
}

export async function addPackageCartItem(payload: {
  service_package_id: number;
  qty?: number;
}) {
  const response = await request<{ data: BookingCart } | BookingCart>("/booking/cart/add-package", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return unwrapData<BookingCart>(response);
}

export async function getBookingCart() {
  const response = await request<{ data: BookingCart } | BookingCart>("/booking/cart");
  return unwrapData<BookingCart>(response);
}

export async function removeCartItem(itemId: number) {
  const response = await request<{ data: BookingCart } | BookingCart>(`/booking/cart/item/${itemId}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });

  return unwrapData<BookingCart>(response);
}

export async function removePackageCartItem(itemId: number) {
  const response = await request<{ data: BookingCart } | BookingCart>(`/booking/cart/package-item/${itemId}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });

  return unwrapData<BookingCart>(response);
}

export async function checkoutCart(payload?: {
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
}) {
  return request<{ status: string; booking_ids: number[]; owned_package_ids?: number[]; deposit_total: number; package_total?: number; cart_total?: number }>(`/booking/cart/checkout`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}


export async function getBookingBankAccounts() {
  const response = await request<{ data?: PublicBookingBankAccount[] } | PublicBookingBankAccount[]>("/public/shop/bank-accounts?type=booking");
  return unwrapData<PublicBookingBankAccount[]>(response) ?? [];
}

export async function getBookingPaymentGateways() {
  const response = await request<{ data?: { payment_gateways?: PublicBookingPaymentGateway[] } }>("/public/shop/homepage?type=booking");
  return response?.data?.payment_gateways ?? [];
}

export async function payBooking(bookingId: string | number, payload?: {
  payment_method?: "manual_transfer" | "billplz_fpx" | "billplz_card";
  bank_account_id?: number;
}) {
  return request<{ data?: { payment_url?: string; status?: string; provider?: string; payment_method?: string; manual_bank_account?: PublicBookingBankAccount } }>(`/booking/${bookingId}/pay?type=booking`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function loginCustomer(payload: { email: string; password: string }) {
  return request<{ success: boolean }>("/public/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registerCustomer(payload: {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
}) {
  return request<{ success: boolean }>("/public/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMe() {
  const response = await request<{ data: AuthUser } | AuthUser>("/public/shop/account/overview");
  const data = unwrapData<AuthUser | { profile?: AuthUser }>(response);
  return "profile" in data ? data.profile : data;
}

export async function logoutCustomer() {
  return request<{ success: boolean }>("/public/auth/logout", { method: "POST", body: JSON.stringify({}) });
}


export async function getBookingPaymentDetail(bookingId: number | string) {
  const response = await request<{ data?: {
    booking_id: number;
    booking_code?: string | null;
    booking_status: string;
    payment_status: string;
    amount: number;
    payment?: {
      id: number;
      status: string;
      provider: string;
      ref?: string | null;
      payment_method?: string | null;
      payment_url?: string | null;
      manual_bank_account?: PublicBookingBankAccount | null;
      slip_url?: string | null;
      manual_status?: string | null;
    } | null;
  } }>(`/booking/${bookingId}/payment-detail?type=booking`);
  return response.data;
}

export async function uploadBookingPaymentSlip(bookingId: number | string, file: File) {
  const formData = new FormData();
  formData.append("slip", file);

  const response = await request<{ data?: { payment_id: number; slip_url: string; manual_status: string } }>(`/booking/${bookingId}/upload-slip?type=booking`, {
    method: "POST",
    body: formData,
  });

  return response.data;
}

export async function getMyBookings() {
  const response = await request<{ data: BookingRecord[] } | BookingRecord[]>("/public/shop/bookings");
  return unwrapData<BookingRecord[]>(response);
}

export { ApiError };


export async function getServicePackages() {
  const response = await request<
    { data?: ServicePackage[] | { data?: ServicePackage[] } } | ServicePackage[]
  >("/booking/service-packages?is_active=1&per_page=100");

  const unwrapped = unwrapData<ServicePackage[] | { data?: ServicePackage[] }>(response);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (unwrapped && typeof unwrapped === "object" && Array.isArray(unwrapped.data)) {
    return unwrapped.data;
  }
  return [];
}

export async function getServicePackageAvailableFor(customerId: number, serviceId: number) {
  const response = await request<{ data: ServicePackageAvailability[] } | ServicePackageAvailability[]>(`/customers/${customerId}/service-package-available-for/${serviceId}`);
  return unwrapData<ServicePackageAvailability[]>(response);
}

export async function redeemServicePackage(payload: {
  customer_id: number;
  booking_service_id: number;
  source: "BOOKING" | "POS" | "ADMIN";
  source_ref_id?: number;
  used_qty?: number;
}) {
  return request<{ success?: boolean; message?: string }>("/service-packages/redeem", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export async function purchaseServicePackage(payload: {
  service_package_id: number;
}) {
  return request<{ success?: boolean; message?: string; data?: unknown }>("/booking/service-packages/purchase", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMyServicePackages() {
  const response = await request<{ data: MyServicePackage[] } | MyServicePackage[]>("/booking/my/service-packages");
  return unwrapData<MyServicePackage[]>(response);
}

// Customer Profile APIs
export async function getCustomerProfile() {
  const response = await request<{ data: CustomerProfileWithAddresses } | CustomerProfileWithAddresses>("/public/auth/profile");
  return { data: unwrapData<CustomerProfileWithAddresses>(response) };
}

export async function updateCustomerProfile(payload: UpdateCustomerProfilePayload) {
  const formData = new FormData();

  if (payload.name !== undefined) {
    formData.append("name", payload.name);
  }

  if (payload.phone !== undefined) {
    formData.append("phone", payload.phone ?? "");
  }

  if (payload.gender !== undefined) {
    formData.append("gender", payload.gender ?? "");
  }

  if (payload.date_of_birth !== undefined) {
    formData.append("date_of_birth", payload.date_of_birth ?? "");
  }

  if (payload.photo !== undefined && payload.photo !== null) {
    formData.append("photo", payload.photo);
  }

  const response = await request<{ data: CustomerProfileWithAddresses }>("/public/auth/profile", {
    method: "PUT",
    body: formData,
  });

  return { data: unwrapData<CustomerProfileWithAddresses>(response) };
}

export async function changeCustomerPassword(payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}) {
  const response = await request<{ data: CustomerProfileWithAddresses }>("/public/auth/password", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return { data: unwrapData<CustomerProfileWithAddresses>(response) };
}

// Customer Address APIs
export async function getCustomerAddresses() {
  const response = await request<{ data: CustomerAddress[] } | CustomerAddress[]>("/public/auth/addresses");
  return { data: unwrapData<CustomerAddress[]>(response) };
}

export async function createCustomerAddress(payload: AddressPayload) {
  const response = await request<{ data: CustomerAddress } | CustomerAddress>("/public/auth/addresses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { data: unwrapData<CustomerAddress>(response) };
}

export async function updateCustomerAddress(id: number, payload: AddressPayload) {
  const response = await request<{ data: CustomerAddress } | CustomerAddress>(`/public/auth/addresses/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return { data: unwrapData<CustomerAddress>(response) };
}

export async function deleteCustomerAddress(id: number) {
  const response = await request<{ data: null } | null>(`/public/auth/addresses/${id}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
  return { data: unwrapData<null>(response) };
}

export async function makeDefaultCustomerAddress(id: number) {
  const response = await request<{ data: CustomerAddress } | CustomerAddress>(`/public/auth/addresses/${id}/default`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
  return { data: unwrapData<CustomerAddress>(response) };
}

export async function getBookingPolicySettings() {
  const response = await request<{ data?: { booking_policy?: BookingPolicy } }>("/ecommerce/shop-settings?type=booking");
  return response?.data?.booking_policy ?? {
    reschedule: { enabled: true, max_changes: 1, cutoff_hours: 72 },
    cancel: { customer_cancel_allowed: false, deposit_refundable: false },
  };
}

export async function rescheduleBooking(id: number, startAt: string, reason?: string) {
  return request<{ success: boolean; message?: string }>(`/booking/${id}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ start_at: startAt, reason }),
  });
}

export async function requestBookingCancellation(id: number, reason?: string) {
  return request<{ success: boolean; message?: string }>(`/booking/${id}/cancellation-request`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
