import { getOrCreateBookingGuestToken } from "./bookingGuestToken";
import { 
  AddressPayload, 
  AuthUser, 
  BookingLandingPage,
  BookingServiceCategory,
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

export type BillplzPaymentGatewayOption = {
  id: number;
  name: string;
  code: string;
  logo_url?: string | null;
  is_default?: boolean;
  sort_order?: number;
};

class ApiError extends Error {
  status: number;
  code?: string;
  data?: Record<string, unknown>;

  constructor(message: string, status: number, payload?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = typeof payload?.code === "string" ? payload.code : undefined;
    this.data = payload;
  }
}

export { ApiError };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (!(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");
  // Let backend generate correct email links (verify/reset) for this frontend.
  if (!headers.has("X-Workspace")) {
    headers.set("X-Workspace", "booking");
  }
  if (path.startsWith("/booking/")) {
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
      typeof payload === "object" && payload !== null ? payload : undefined,
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

export async function resendCustomerVerification(payload: { email: string }) {
  return request<{ success?: boolean; message?: string }>("/public/shop/auth/email/resend-verification", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyCustomerEmail(payload: {
  id: string;
  hash: string;
  expires?: string | null;
  signature?: string | null;
}) {
  const query = new URLSearchParams();
  if (payload.expires) query.set("expires", payload.expires);
  if (payload.signature) query.set("signature", payload.signature);

  const queryString = query.toString();
  const url = `/public/shop/auth/email/verify/${payload.id}/${payload.hash}${queryString ? `?${queryString}` : ""}`;
  return request<{ success?: boolean; message?: string }>(url);
}

export async function forgotCustomerPassword(payload: { email: string }) {
  return request<{ success?: boolean; message?: string }>("/public/shop/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetCustomerPassword(payload: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}) {
  return request<{ success?: boolean; message?: string }>("/public/shop/auth/password/reset", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getBookingLandingPage() {
  const response = await request<{ data: BookingLandingPage } | BookingLandingPage>(`/booking/landing-page`);
  return unwrapData<BookingLandingPage>(response);
}

export async function getBookingServiceCategories() {
  const response = await request<{ data: BookingServiceCategory[] } | BookingServiceCategory[]>(`/booking/service-categories`);
  return unwrapData<BookingServiceCategory[]>(response);
}

export async function getBookingServices(search?: string, categoryId?: number) {
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (categoryId) qs.set("category_id", String(categoryId));
  const query = qs.toString();
  const response = await request<{ data: Service[] } | Service[]>(`/booking/services${query ? `?${query}` : ""}`);
  return unwrapData<Service[]>(response);
}

export async function getBookingServiceDetail(id: string) {
  const response = await request<{ data: Service & { staffs?: Staff[] } } | (Service & { staffs?: Staff[] })>(`/booking/services/${id}`);
  return unwrapData<Service & { staffs?: Staff[] }>(response);
}

export async function getAvailability(serviceId: string, staffId: string, date: string, extraDurationMin?: number) {
  const qs = new URLSearchParams();
  qs.set("service_id", serviceId);
  qs.set("staff_id", staffId);
  qs.set("date", date);
  if (typeof extraDurationMin === "number" && extraDurationMin > 0) {
    qs.set("extra_duration_min", String(extraDurationMin));
  }
  return request<{ success?: boolean; message?: string; data?: { slots?: BookingSlot[] } }>(
    `/booking/availability?${qs.toString()}`,
  );
}

/** All staff merged — pick time first, then choose stylist. Same slot rules as getAvailability (primary slots, etc.). */
export async function getAvailabilityPooled(serviceId: string, date: string, extraDurationMin?: number) {
  const qs = new URLSearchParams();
  qs.set("service_id", serviceId);
  qs.set("date", date);
  if (typeof extraDurationMin === "number" && extraDurationMin > 0) {
    qs.set("extra_duration_min", String(extraDurationMin));
  }
  const response = await request<{
    success?: boolean;
    message?: string;
    data?: { visible_slots?: BookingSlot[]; slots?: BookingSlot[] };
  }>(`/booking/availability/pooled?${qs.toString()}`);
  return unwrapData<{ visible_slots?: BookingSlot[]; slots?: BookingSlot[] }>(response);
}

export async function addCartItem(payload: {
  service_id: number;
  staff_id: number;
  start_at: string;
  selected_option_ids?: number[];
  notes?: string;
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


export async function uploadBookingCartItemPhotos(itemId: number, files: File[]) {
  const fd = new FormData();
  files.forEach((file) => fd.append('photos[]', file));
  const response = await request<{ data: BookingCart } | BookingCart>(`/booking/cart/item/${itemId}/photos`, {
    method: 'POST',
    body: fd,
  });
  return unwrapData<BookingCart>(response);
}

export async function removeBookingCartItemPhoto(itemId: number, photoId: number) {
  const response = await request<{ data: BookingCart } | BookingCart>(`/booking/cart/item/${itemId}/photos/${photoId}`, {
    method: 'DELETE',
    body: JSON.stringify({}),
  });
  return unwrapData<BookingCart>(response);
}


export async function updateBookingCartItemRemarks(itemId: number, notes?: string) {
  const response = await request<{ data: BookingCart } | BookingCart>(`/booking/cart/item/${itemId}/remarks`, {
    method: "PATCH",
    body: JSON.stringify({ notes }),
  });

  return unwrapData<BookingCart>(response);
}

export async function removeCartItem(itemId: number) {
  const response = await request<{ data: BookingCart } | BookingCart>(`/booking/cart/item/${itemId}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });

  return unwrapData<BookingCart>(response);
}

/** Undo package reservation for this line; slot stays in cart and full deposit rules apply again. */
export async function releaseBookingCartPackageClaim(itemId: number, usageId?: number) {
  const response = await request<{ data: BookingCart } | BookingCart>(`/booking/cart/item/${itemId}/release-package-claim-member`, {
    method: "POST",
    body: JSON.stringify(usageId ? { usage_id: usageId } : {}),
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

export async function updateBookingPackageCartItemQty(itemId: number, qty: number) {
  const next = Math.max(1, Math.min(10, Math.floor(qty)));
  const response = await request<{ data: BookingCart } | BookingCart>(`/booking/cart/package-item/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ qty: next }),
  });
  return unwrapData<BookingCart>(response);
}

export async function checkoutCart(payload?: {
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  billing_same_as_contact?: boolean;
  billing_name?: string;
  billing_phone?: string;
  billing_email?: string;
  payment_method?: "manual_transfer" | "billplz_online_banking" | "billplz_credit_card";
  bank_account_id?: number;
  billplz_gateway_option_id?: number;
}, options?: { authenticated?: boolean }) {
  const endpoint = options?.authenticated ? "/booking/cart/checkout-member" : "/booking/cart/checkout";
  const response = await request<{ data?: { status: string; booking_ids: number[]; owned_package_ids?: number[]; deposit_total: number; package_total?: number; cart_total?: number; order_id?: number; order_no?: string; payment_method?: string; payment_status?: string; payment_url?: string; redirect_url?: string } } | { status: string; booking_ids: number[]; owned_package_ids?: number[]; deposit_total: number; package_total?: number; cart_total?: number; order_id?: number; order_no?: string; payment_method?: string; payment_status?: string; payment_url?: string; redirect_url?: string }>(endpoint, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });

  return unwrapData<{ status: string; booking_ids: number[]; owned_package_ids?: number[]; deposit_total: number; package_total?: number; cart_total?: number; order_id?: number; order_no?: string; payment_method?: string; payment_status?: string; payment_url?: string; redirect_url?: string }>(response);
}

export async function payPublicOrder(orderId: number, payload?: { payment_method?: "billplz_online_banking" | "billplz_credit_card"; billplz_gateway_option_id?: number }) {
  const response = await request<{ data?: { redirect_url?: string }; redirect_url?: string }>(`/public/shop/orders/${orderId}/pay`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
  const unwrapped = unwrapData<{ redirect_url?: string }>(response);
  const redirectUrl = unwrapped?.redirect_url ?? response.redirect_url;
  if (!redirectUrl) {
    throw new ApiError("Unable to initiate payment.", 422);
  }
  return { redirect_url: redirectUrl };
}

export type CancelOrderResponse = {
  order: {
    id: number;
    status: string;
    payment_status: string;
    reserve_expires_at?: string | null;
  };
};

export async function cancelOrder(orderId: number): Promise<CancelOrderResponse> {
  const response = await request<{ data?: CancelOrderResponse } | CancelOrderResponse>(`/public/shop/orders/${orderId}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return unwrapData<CancelOrderResponse>(response);
}

export type PublicAccountOrder = {
  id: number;
  order_no: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  payments?: Array<{ method: string; amount: number }>;
  grand_total: number;
  created_at?: string | null;
  reserve_expires_at?: string | null;
  receipt_public_url?: string | null;
  items?: Array<{
    id: number;
    line_type?: string | null;
    name?: string | null;
    cn_name?: string | null;
    quantity?: number | null;
    line_total?: number | null;
    line_total_snapshot?: number | null;
    effective_line_total?: number | null;
    covered_by_package?: boolean;
    unit_price?: number | null;
    booking_id?: number | null;
    service_package_id?: number | null;
    product_type?: string | null;
    product_variant_id?: number | null;
    variant_name?: string | null;
    variant_cn_name?: string | null;
    variant_sku?: string | null;
    cover_image_url?: string | null;
    product_image?: string | null;
    selected_booking_product_options?: Array<{ options?: Array<{ id?: number; label?: string | null; cn_label?: string | null; extra_price?: number | string | null }> }>;
    package_applied_name?: string | null;
  }>;
};

export async function getMyOrders() {
  const response = await request<{ data?: { orders?: PublicAccountOrder[] } | PublicAccountOrder[] }>("/public/shop/orders?scope=booking_related");
  const unwrapped = unwrapData<{ orders?: PublicAccountOrder[] } | PublicAccountOrder[]>(response);
  if (Array.isArray(unwrapped)) return unwrapped;
  return unwrapped?.orders ?? [];
}

export async function getMyEcommerceOrders() {
  const response = await request<{ data?: { orders?: PublicAccountOrder[] } | PublicAccountOrder[] }>("/public/shop/orders?scope=ecommerce_products");
  const unwrapped = unwrapData<{ orders?: PublicAccountOrder[] } | PublicAccountOrder[]>(response);
  if (Array.isArray(unwrapped)) return unwrapped;
  return unwrapped?.orders ?? [];
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
  payment_method?: "manual_transfer" | "billplz_online_banking" | "billplz_credit_card";
  bank_account_id?: number;
  billplz_gateway_option_id?: number;
}) {
  return request<{ data?: { payment_url?: string; status?: string; provider?: string; payment_method?: string; manual_bank_account?: PublicBookingBankAccount; payment_result_url?: string; order_id?: number; order_no?: string } }>(`/booking/${bookingId}/pay?type=booking`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export type PaymentLinkDetail = {
  token: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";
  purpose: string;
  amount: number;
  is_payable: boolean;
  expires_at?: string | null;
  paid_at?: string | null;
  provider?: string | null;
  manual_review_status?: string | null;
  manual_slip_url?: string | null;
  appointment?: {
    booking_code: string;
    service_name: string;
    staff_name?: string;
    start_at?: string | null;
    end_at?: string | null;
    customer_name?: string | null;
    service_blocks?: PaymentLinkServiceBlock[];
    service_total?: number;
    addon_total?: number;
    items_total?: number;
    deposit_collected?: number;
    estimated_duration_min?: number;
    multi_service?: boolean;
  } | null;
};

export type PaymentLinkServiceBlockAddon = {
  id?: number | null;
  name: string;
  cn_name?: string | null;
  quantity?: number | null;
  extra_price?: number | null;
  extra_duration_min?: number | null;
  line_gross_amount?: number | null;
  price_mode?: string | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  price_finalized?: boolean | null;
};

export type PaymentLinkServiceBlock = {
  service_id?: number | null;
  name: string;
  cn_name?: string | null;
  amount?: number | null;
  price_mode?: string | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  price_finalized?: boolean | null;
  duration_min?: number | null;
  is_original?: boolean | null;
  add_ons?: PaymentLinkServiceBlockAddon[];
};

export type PaymentLinkPayResponse = {
  status: string;
  payment_method: string;
  payment_url?: string | null;
  requires_slip_upload?: boolean;
  manual_bank_account?: PublicBookingBankAccount | null;
};

export async function getPaymentLink(token: string) {
  const response = await request<{ data?: PaymentLinkDetail } | PaymentLinkDetail>(`/public/payment-links/${token}`);
  return unwrapData<PaymentLinkDetail>(response);
}

export async function payPaymentLink(token: string, payload: {
  payment_method: "manual_transfer" | "billplz_online_banking" | "billplz_credit_card";
  bank_account_id?: number;
  billplz_gateway_option_id?: number;
  payer_name?: string;
  payer_phone?: string;
  payer_email?: string;
}) {
  const response = await request<{ data?: PaymentLinkPayResponse } | PaymentLinkPayResponse>(`/public/payment-links/${token}/pay`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrapData<PaymentLinkPayResponse>(response);
}

export async function uploadPaymentLinkSlip(token: string, file: File, note?: string) {
  const formData = new FormData();
  formData.append("slip", file);
  if (note && note.trim()) {
    formData.append("note", note.trim());
  }
  const response = await request<{ data?: { status?: string; manual_review_status?: string; manual_slip_url?: string } }>(`/public/payment-links/${token}/upload-slip`, {
    method: "POST",
    body: formData,
  });
  return response.data ?? null;
}

export async function cancelPaymentLinkSlip(token: string) {
  const response = await request<{ data?: { status?: string; manual_review_status?: string } }>(`/public/payment-links/${token}/cancel-slip`, {
    method: "POST",
  });
  return response.data ?? null;
}

export async function getBillplzPaymentGatewayOptions(params: {
  type: "ecommerce" | "booking";
  gateway_group: "online_banking" | "credit_card";
}) {
  const qs = new URLSearchParams({
    type: params.type,
    gateway_group: params.gateway_group,
  });
  const response = await request<{ data?: BillplzPaymentGatewayOption[] } | BillplzPaymentGatewayOption[]>(`/payment-gateway-options?${qs.toString()}`);
  return unwrapData<BillplzPaymentGatewayOption[]>(response) ?? [];
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
  type: string;
  gender: string;
  date_of_birth: string;
}) {
  return request<{ success: boolean }>("/public/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<AuthUser | undefined> {
  try {
    const response = await fetch(`${API_PREFIX}/public/shop/account/overview`, {
      headers: {
        Accept: "application/json",
        "X-Workspace": "booking",
      },
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return undefined;
    }

    if (!response.ok) {
      return undefined;
    }

    const payload = await response.json().catch(() => null);
    const data = unwrapData<AuthUser | { profile?: AuthUser }>(payload ?? {});
    if (!data || typeof data !== "object") return undefined;
    if ("profile" in data) {
      return data.profile;
    }
    return data as AuthUser;
  } catch {
    return undefined;
  }
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

export type BookingOrderLookupResponse = {
  order_id: number;
  order_no: string;
  grand_total: number;
  payment_method?: string | null;
  payment_provider?: string | null;
  payment_reference?: string | null;
  payment_url?: string | null;
  receipt_public_url?: string | null;
  payment_status: string;
  status: string;
  bank_account?: {
    bank_name?: string | null;
    account_name?: string | null;
    account_number?: string | null;
    account_no?: string | null;
    qr_image_url?: string | null;
    instructions?: string | null;
  } | null;
  uploads?: Array<{
    id: number;
    file_url: string;
    note?: string | null;
    status?: string | null;
    created_at?: string | null;
  }>;
};

export async function lookupBookingOrder(orderNo?: string | null, orderId?: number | null) {
  const query = new URLSearchParams();
  if (orderNo) {
    query.set("order_no", orderNo);
  }
  if (typeof orderId === "number" && Number.isFinite(orderId)) {
    query.set("order_id", String(orderId));
  }
  const response = await request<{ data?: BookingOrderLookupResponse } | BookingOrderLookupResponse>(`/public/shop/bookings/lookup?${query.toString()}`);
  return unwrapData<BookingOrderLookupResponse>(response);
}

export async function uploadBookingOrderSlip(orderId: number, orderNo: string, file: File, note?: string) {
  const formData = new FormData();
  formData.append("order_no", orderNo);
  formData.append("slip", file);
  if (note && note.trim()) {
    formData.append("note", note.trim());
  }

  const response = await request<{ data?: { upload?: { id: number; file_url: string; status?: string | null; created_at?: string | null } } }>(`/public/shop/bookings/${orderId}/upload-slip`, {
    method: "POST",
    body: formData,
  });

  return response.data?.upload ?? null;
}

export async function lookupPublicOrder(orderNo?: string | null, orderId?: number | null) {
  const query = new URLSearchParams();
  if (orderNo) query.set("order_no", orderNo);
  if (typeof orderId === "number" && Number.isFinite(orderId)) query.set("order_id", String(orderId));
  const response = await request<{ data?: BookingOrderLookupResponse } | BookingOrderLookupResponse>(`/public/shop/orders/lookup?${query.toString()}`);
  return unwrapData<BookingOrderLookupResponse>(response);
}

export async function uploadPublicOrderSlip(orderId: number, file: File, note?: string) {
  const formData = new FormData();
  formData.append("slip", file);
  if (note && note.trim()) {
    formData.append("note", note.trim());
  }

  const response = await request<{ data?: { upload?: { id: number; file_url: string; status?: string | null; created_at?: string | null } } }>(`/public/shop/orders/${orderId}/upload-slip`, {
    method: "POST",
    body: formData,
  });

  return response.data?.upload ?? null;
}

export async function getMyBookings() {
  const response = await request<{ data: BookingRecord[] } | BookingRecord[]>("/public/shop/bookings");
  return unwrapData<BookingRecord[]>(response);
}

export async function uploadMyBookingItemPhotos(bookingId: number, files: File[]) {
  const fd = new FormData();
  files.forEach((file) => fd.append("photos[]", file));
  const response = await request<{ data?: { uploaded_item_photos?: unknown[] } } | { uploaded_item_photos?: unknown[] }>(
    `/booking/my/${bookingId}/item-photos`,
    { method: "POST", body: fd },
  );
  return unwrapData<{ uploaded_item_photos?: unknown[] }>(response);
}

export async function removeMyBookingItemPhoto(bookingId: number, photoId: number) {
  const response = await request<{ data?: { uploaded_item_photos?: unknown[] } } | { uploaded_item_photos?: unknown[] }>(
    `/booking/my/${bookingId}/item-photos/${photoId}`,
    { method: "DELETE", body: JSON.stringify({}) },
  );
  return unwrapData<{ uploaded_item_photos?: unknown[] }>(response);
}

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
  customer_service_package_id?: number;
}) {
  return request<{ success?: boolean; message?: string }>("/booking/service-packages/redeem", {
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
  const hasPhoto = payload.photo != null;

  if (hasPhoto) {
    const formData = new FormData();
    formData.append("_method", "PUT");

    if (payload.name !== undefined) {
      formData.append("name", payload.name);
    }

    if (payload.phone !== undefined) {
      formData.append("phone", payload.phone ?? "");
    }

    if (payload.gender !== undefined) {
      formData.append("gender", payload.gender ?? "");
    }

    formData.append("photo", payload.photo as File);

    const response = await request<{ data: CustomerProfileWithAddresses }>("/public/auth/profile", {
      method: "POST",
      body: formData,
    });

    return { data: unwrapData<CustomerProfileWithAddresses>(response) };
  }

  const jsonBody: Record<string, string | null> = {};

  if (payload.name !== undefined) {
    jsonBody.name = payload.name;
  }

  if (payload.phone !== undefined) {
    jsonBody.phone = payload.phone;
  }

  if (payload.gender !== undefined) {
    jsonBody.gender = payload.gender;
  }

  const response = await request<{ data: CustomerProfileWithAddresses }>("/public/auth/profile", {
    method: "PUT",
    body: JSON.stringify(jsonBody),
  });

  return { data: unwrapData<CustomerProfileWithAddresses>(response) };
}

export async function changeCustomerPassword(payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
  type: string;
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
  // Use public homepage endpoint (admin shop-settings requires admin auth)
  const response = await request<{ data?: { settings?: { booking_policy?: BookingPolicy } } }>(
    "/public/shop/homepage?type=booking",
  );
  return response?.data?.settings?.booking_policy ?? {
    reschedule: { enabled: true, max_changes: 1, cutoff_hours: 72 },
    cancel: { customer_cancel_allowed: false, deposit_refundable: false },
  };
}

export async function getBookingServiceDepositNote(): Promise<string | null> {
  const response = await request<{ data?: { settings?: { booking_service_deposit_note?: string | null } } }>(
    "/public/shop/homepage?type=booking",
  );
  const note = response?.data?.settings?.booking_service_deposit_note;
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}


export type BookingDepositTncSettings = {
  booking_deposit_tnc_enabled: boolean;
  booking_deposit_tnc_text: string;
  booking_deposit_tnc_image: string | null;
};

export async function getBookingDepositTncSettings(): Promise<BookingDepositTncSettings> {
  const response = await request<{ data?: { settings?: { booking_deposit_tnc_enabled?: boolean; booking_deposit_tnc_text?: string | null; booking_deposit_tnc_image?: string | null } } }>(
    "/public/shop/homepage?type=booking",
  );

  const enabled = Boolean(response?.data?.settings?.booking_deposit_tnc_enabled);
  const rawText = response?.data?.settings?.booking_deposit_tnc_text;
  const text = typeof rawText === "string" && rawText.trim().length > 0 ? rawText.trim() : "";
  const rawImage = response?.data?.settings?.booking_deposit_tnc_image;
  const image = typeof rawImage === "string" && rawImage.trim().length > 0 ? rawImage.trim() : null;

  return {
    booking_deposit_tnc_enabled: enabled,
    booking_deposit_tnc_text: text,
    booking_deposit_tnc_image: image,
  };
}


export type BookingSlotsHelpNoteSettings = {
  booking_slots_help_note_enabled: boolean;
  booking_slots_help_note_text: string;
};

export async function getBookingSlotsHelpNoteSettings(): Promise<BookingSlotsHelpNoteSettings> {
  const response = await request<{ data?: { settings?: { booking_slots_help_note_enabled?: boolean; booking_slots_help_note_text?: string | null } } }>(
    "/public/shop/homepage?type=booking",
  );

  const enabled = Boolean(response?.data?.settings?.booking_slots_help_note_enabled);
  const rawText = response?.data?.settings?.booking_slots_help_note_text;
  const text = typeof rawText === "string" && rawText.trim().length > 0 ? rawText.trim() : "";

  return {
    booking_slots_help_note_enabled: enabled,
    booking_slots_help_note_text: text,
  };
}


export async function getBookingMaxAdvanceDays(): Promise<number> {
  const response = await request<{ data?: { settings?: { booking_max_advance_days?: number | string | null } } }>(
    "/public/shop/homepage?type=booking",
  );
  const value = Number(response?.data?.settings?.booking_max_advance_days ?? 365);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 365;
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

export type CustomerWalletTransaction = {
  id: number; transaction_no: string; type: string; direction: "credit" | "debit" | string; amount: string;
  balance_before: string; balance_after: string; workspace_type?: string | null; payment_method_label?: string | null;
  reference_no?: string | null; status: string; remark?: string | null; created_at: string; completed_at?: string | null;
};

export type CustomerWallet = { balance: string; wallet_balance: string; customer_id: number };

export async function getCustomerWallet(): Promise<CustomerWallet> {
  const response = await request<{ data?: CustomerWallet }>("/public/shop/customer/wallet");
  return response.data ?? { balance: "0.00", wallet_balance: "0.00", customer_id: 0 };
}

export async function getCustomerWalletTransactions(status: string = "completed") {
  const response = await request<{ data?: { transactions?: { data?: CustomerWalletTransaction[] } | CustomerWalletTransaction[] } }>(`/public/shop/customer/wallet/transactions?status=${encodeURIComponent(status)}`);
  const tx = response.data?.transactions;
  return Array.isArray(tx) ? tx : tx?.data ?? [];
}

export async function getCustomerWalletPaymentGateways(workspaceType: string = "booking") {
  const response = await request<{ data?: { payment_gateways?: Array<{ key: string; name: string; config?: unknown }> } }>(`/public/shop/customer/wallet/payment-gateways?workspace_type=${encodeURIComponent(workspaceType)}`);
  return response.data?.payment_gateways ?? [];
}

export async function createCustomerWalletTopup(payload: { amount: number | string; payment_gateway_key: string; payment_method_label?: string; workspace_type?: string }) {
  return request<{ success?: boolean; message?: string; data?: { topup?: CustomerWalletTransaction } }>("/public/shop/customer/wallet/topups", {
    method: "POST",
    body: JSON.stringify({ ...payload, workspace_type: payload.workspace_type ?? "booking" }),
  });
}
