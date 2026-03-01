import { getOrCreateSessionToken } from "./sessionToken";
import { AuthUser, BookingHold, BookingRecord, BookingSlot, Service, Staff } from "./types";

const API_PREFIX = "/api/proxy";

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
  headers.set("X-Session-Token", getOrCreateSessionToken());

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
  const response = await request<{ data: Service & { staff?: Staff[] } } | (Service & { staff?: Staff[] })>(`/booking/services/${id}`);
  return unwrapData<Service & { staff?: Staff[] }>(response);
}

export async function getAvailability(serviceId: string, staffId: string, date: string) {
  const response = await request<{ data: BookingSlot[] } | BookingSlot[]>(
    `/booking/availability?service_id=${serviceId}&staff_id=${staffId}&date=${date}`,
  );
  return unwrapData<BookingSlot[]>(response);
}

export async function createHold(payload: {
  service_id: number;
  staff_id: number;
  start_at: string;
}) {
  const response = await request<{ data: BookingHold } | BookingHold>("/booking/hold", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return unwrapData<BookingHold>(response);
}

export async function payBooking(bookingId: string) {
  return request<{ checkout_url?: string; status: string }>(`/booking/${bookingId}/pay`, {
    method: "POST",
    body: JSON.stringify({}),
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

export async function getMyBookings() {
  const response = await request<{ data: BookingRecord[] } | BookingRecord[]>("/booking/my");
  return unwrapData<BookingRecord[]>(response);
}

export { ApiError };
