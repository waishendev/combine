import { getOrCreateSessionToken } from "./sessionToken";

export type LoyaltyTier = {
  code: string;
  name: string;
  multiplier: number;
  product_discount_percent: number;
  min_spend: number;
  badge_image_url: string | null;
};

export type LoyaltySpending = {
  window_months: number;
  total_spent: number;
  current_tier_min_spend: number;
  next_tier: {
    code: string;
    name: string;
    min_spend: number;
    badge_image_url: string | null;
  } | null;
  amount_to_next_tier: number;
  progress_percent: number;
  tier_review_at: string | null;
  days_remaining: number | null;
};

export type LoyaltySummary = {
  customer_id: number;
  current_tier: LoyaltyTier;
  points: {
    total_earned: number;
    total_redeemed: number;
    total_expired: number;
    available: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expiring_soon: any[];
  };
  spending: LoyaltySpending;
};

export type CustomerProfile = {
  id: number;
  name: string;
  email: string;
  phone: string;
  avatar: string | null;
  gender: string | null;
  date_of_birth: string | null;
  tier: string;
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

export type AccountOverview = {
  profile: CustomerProfile;
  loyalty: LoyaltySummary;
  addresses: CustomerAddress[];
};

export type Customer = CustomerProfile;

export type CartItem = {
  id: number;
  product_id: number;
  name: string;
  sku?: string | null;
  product_image?: string | null;
  product_image_url?: string | null;
  unit_price: string;
  quantity: number;
  line_total: string;
  product?: {
    slug?: string;
    images?: { image_path: string; is_main: boolean }[];
  };
};

export type CartResponse = {
  items: CartItem[];
  subtotal: string;
  discount_total: string;
  shipping_fee: string;
  grand_total: string;
  session_token?: string | null;
};

export type CheckoutPreviewVoucher = {
  id: number;
  code: string;
  discount_amount: number;
  type: string;
  value: number;
};

export type CheckoutPreviewResponse = {
  items: {
    product_id: number;
    name: string;
    sku?: string | null;
    quantity: number;
    unit_price: number | string;
    line_total: number | string;
  }[];
  subtotal: number | string;
  discount_total: number | string;
  shipping_fee: number | string;
  grand_total: number | string;
  voucher?: CheckoutPreviewVoucher | null;
  voucher_error?: string | null;
  voucher_valid?: boolean;
  voucher_message?: string | null;
};

export type PublicBankAccount = {
  id: number;
  bank_name: string;
  account_name: string;
  account_no: string;
  account_number?: string;
  branch: string | null;
  logo_url: string | null;
  qr_image_url: string | null;
  label?: string | null;
  swift_code?: string | null;
  is_default?: boolean;
};

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type ApiRequestOptions = RequestInit & {
  jsonBody?: unknown;
  includeSessionToken?: boolean;
};

async function apiRequest<T>(path: string, method: HttpMethod, options: ApiRequestOptions = {}): Promise<T> {
  const url = new URL(
    `/api/proxy${path.startsWith("/") ? "" : "/"}${path}`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
  );

  const { includeSessionToken, jsonBody: initialJsonBody, ...requestInit } = options;
  const headers: Record<string, string> = {
    ...(requestInit.headers as Record<string, string> || {}),
  };

  const isGetRequest = method === "GET";
  let body: BodyInit | undefined = requestInit.body as BodyInit | undefined;
  let jsonBody = initialJsonBody;

  if (includeSessionToken) {
    const token = getOrCreateSessionToken();
    if (token) {
      if (isGetRequest) {
        url.searchParams.set("session_token", token);
      } else if (jsonBody && typeof jsonBody === "object" && !Array.isArray(jsonBody)) {
        jsonBody = { ...(jsonBody as Record<string, unknown>), session_token: token };
      } else if (body instanceof FormData) {
        body.append("session_token", token);
      } else if (jsonBody === undefined) {
        jsonBody = { session_token: token };
      }
    }
  }

  if (jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(jsonBody);
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    credentials: "include",
    ...requestInit,
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export function get<T>(path: string, options?: ApiRequestOptions) {
  return apiRequest<T>(path, "GET", options);
}

export function post<T>(path: string, jsonBody?: unknown, options?: ApiRequestOptions) {
  return apiRequest<T>(path, "POST", { ...options, jsonBody });
}

export function put<T>(path: string, jsonBody?: unknown, options?: ApiRequestOptions) {
  return apiRequest<T>(path, "PUT", { ...options, jsonBody });
}

export function del<T>(path: string, options?: ApiRequestOptions) {
  return apiRequest<T>(path, "DELETE", options);
}

export async function getCustomerProfile() {
  return get<{ data: CustomerProfile }>("/public/auth/profile");
}

export async function loginCustomer(payload: { email: string; password: string }) {
  return post<{ success: boolean }>("/public/auth/login", payload);
}

export async function registerCustomer(payload: {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
}) {
  return post<{ success: boolean }>("/public/auth/register", payload);
}

export async function logoutCustomer() {
  return post<{ success: boolean }>("/public/auth/logout");
}

export async function getCart(): Promise<CartResponse> {
  const response = await get<{ data: CartResponse }>("/public/shop/cart", {
    includeSessionToken: true,
    headers: { Accept: "application/json" },
  });
  return response.data;
}

export async function addOrUpdateCartItem(payload: {
  product_id: number;
  quantity: number;
}): Promise<CartResponse> {
  const response = await post<{ data: CartResponse }>(
    "/public/shop/cart/items",
    payload,
    { includeSessionToken: true, headers: { Accept: "application/json" } },
  );

  return response.data;
}

export async function removeCartItem(itemId: number): Promise<CartResponse> {
  const response = await del<{ data: CartResponse }>(
    `/public/shop/cart/items/${itemId}`,
    { includeSessionToken: true, headers: { Accept: "application/json" } },
  );

  return response.data;
}

export async function resetCartSession(): Promise<CartResponse> {
  const response = await post<{ data: CartResponse }>(
    "/public/shop/cart/reset",
    undefined,
    { includeSessionToken: true, headers: { Accept: "application/json" } },
  );

  return response.data;
}

export async function mergeCart(payload?: { session_token?: string }) {
  return post<{ success: boolean }>("/public/shop/cart/merge", payload, { includeSessionToken: payload?.session_token === undefined });
}

export type CheckoutPreviewPayload = {
  items: { product_id: number; quantity: number }[];
  voucher_code?: string | null;
  shipping_method: "shipping" | "pickup";
  store_location_id?: number | null;
  shipping_postcode?: string | null;
  session_token?: string | null;
};

export type CheckoutPayload = {
  items: { product_id: number; quantity: number }[];
  session_token?: string | null;
  payment_method: "manual_transfer" | "billplz_fpx";
  shipping_method: "shipping" | "pickup";
  shipping_name: string;
  shipping_phone: string;
  shipping_address_line1: string;
  shipping_address_line2?: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_country: string;
  shipping_postcode: string;
  store_location_id?: number | null;
  bank_account_id?: number | null;
};

export type CreateOrderResponse = {
  order_id: number;
  order_no: string;
  grand_total: string;
  payment_status: string;
  status: string;
  payment_method: string;
  payment: {
    provider: "billplz" | "manual";
    billplz_url?: string | null;
  };
  bank_account?: PublicBankAccount | null;
};

export type PublicStoreLocation = {
  id: number;
  name: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string | null;
  postcode: string | null;
  country: string;
  phone: string | null;
};

export type OrderLookupResponse = {
  order_id: number;
  order_no: string;
  grand_total: number | string;
  payment_method: string;
  payment_status: string;
  status: string;
  bank_account?: PublicBankAccount | null;
  pickup_store?: PublicStoreLocation | null;
  uploads: { id: number; file_url: string; created_at: string }[];
};

export async function previewCheckout(
  payload: CheckoutPreviewPayload,
): Promise<CheckoutPreviewResponse> {
  const response = await post<{ data: CheckoutPreviewResponse }>(
    "/public/shop/checkout/preview",
    payload,
    { includeSessionToken: payload.session_token === undefined, headers: { Accept: "application/json" } },
  );

  return response.data;
}

export async function createOrder(payload: CheckoutPayload): Promise<CreateOrderResponse> {
  const response = await post<{ data: CreateOrderResponse }>(
    "/public/shop/orders",
    payload,
    { includeSessionToken: payload.session_token === undefined, headers: { Accept: "application/json" } },
  );

  return response.data;
}

export async function getBankAccounts(): Promise<PublicBankAccount[]> {
  const response = await get<{ data: PublicBankAccount[] }>("/public/shop/bank-accounts", {
    headers: { Accept: "application/json" },
  });

  return response.data;
}

export async function getStoreLocations(): Promise<PublicStoreLocation[]> {
  const response = await get<{ data: PublicStoreLocation[] }>("/public/shop/store-locations", {
    headers: { Accept: "application/json" },
  });

  return response.data;
}

export async function lookupOrder(orderNo: string, orderId?: number | null): Promise<OrderLookupResponse> {
  const search = new URLSearchParams({ order_no: orderNo });
  if (orderId) {
    search.set("order_id", String(orderId));
  }

  const response = await get<{ data: OrderLookupResponse }>(`/public/shop/orders/lookup?${search.toString()}`, {
    headers: { Accept: "application/json" },
  });

  return response.data;
}

export async function uploadPaymentSlip(orderId: number, fileUrl: string) {
  const response = await post<{ success: boolean }>(
    `/public/shop/orders/${orderId}/upload-slip`,
    { file_url: fileUrl },
    { headers: { Accept: "application/json" } },
  );

  return response;
}

export async function getAccountOverview() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const res = await fetch(`${siteUrl}/api/proxy/public/shop/account/overview`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to load account overview");
  }

  const json = await res.json();
  return json.data as AccountOverview;
}

export async function toggleWishlist(productId: number) {
  const res = await fetch("/api/proxy/public/shop/wishlist/toggle", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ product_id: productId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wishlist toggle failed: ${res.status} ${text}`);
  }

  return res.json();
}

export type { Customer };
