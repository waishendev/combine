import { getOrCreateSessionToken, setSessionToken } from "./sessionToken";

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

export type LoyaltyReward = {
  id: number;
  title: string;
  description?: string | null;
  type: string;
  points_required: number;
  product_id?: number | null;
  voucher_id?: number | null;
  is_active?: boolean;
  sort_order?: number | null;
  thumbnail?: string | null;
  image_url?: string | null;
  remaining?: number | null;
  is_available?: boolean;
  product?: {
    id: number;
    name: string;
    slug?: string | null;
    image_url?: string | null;
    stock?: number | null;
  } | null;
  voucher_code?: string | null;
  voucher?: {
    code: string;
    type: string;
    value: number;
    min_order_amount?: number | string | null;
    max_discount_amount?: number | string | null;
    start_at?: string | null;
    end_at?: string | null;
    usage_limit_total?: number | null;
    usage_limit_per_customer?: number | null;
    max_uses?: number | null;
    max_uses_per_customer?: number | null;
    is_reward_only?: boolean;
  } | null;
};

export type LoyaltyHistoryEntry = {
  id: number;
  customer_id: number;
  type: "earn" | "redeem" | "expire" | "adjust" | string;
  points_change: number;
  source_type?: string | null;
  source_id?: number | null;
  meta?: unknown;
  created_at: string;
  updated_at?: string;
};

export type LoyaltyHistoryResponse = {
  items: LoyaltyHistoryEntry[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
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
  product_stock?: number | null;
  unit_price: string;
  quantity: number;
  line_total: string;
  is_reward?: boolean;
  reward_redemption_id?: number | null;
  locked?: boolean;
  product?: {
    slug?: string;
    cover_image_url?: string | null;
    images?: { image_path: string; is_main?: boolean; sort_order?: number | null }[];
    media?: { type?: string; url?: string | null; sort_order?: number | null }[];
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

export type WishlistItem = {
  id?: number;
  product_id?: number;
  slug?: string;
  product_slug?: string;
  name?: string;
  product_name?: string;
  price?: number | string;
  product_price?: number | string;
  image?: string | null;
  thumbnail?: string | null;
  created_at?: string;
  product?: {
    id?: number;
    slug?: string;
    name?: string;
    price?: number | string;
    cover_image_url?: string | null;
    images?: { image_path?: string; sort_order?: number | null }[];
    media?: { type?: string; url?: string | null; sort_order?: number | null }[];
    thumbnail?: string | null;
  };
};

export type CheckoutPreviewVoucher = {
  id: number;
  code: string;
  discount_amount: number;
  type: string;
  value: number;
  customer_voucher_id?: number | null;
};

export type CheckoutPreviewResponse = {
  items: {
    product_id: number;
    name: string;
    sku?: string | null;
    quantity: number;
    unit_price: number | string;
    line_total: number | string;
    is_reward?: boolean;
    reward_redemption_id?: number | null;
    locked?: boolean;
    cover_image_url?: string | null;
  }[];
  subtotal: number | string;
  discount_total: number | string;
  shipping_fee: number | string;
  grand_total: number | string;
  shipping?: {
    zone?: string | null;
    label?: string | null;
    fee?: number | string;
    is_free?: boolean;
    free_shipping_min_order_amount?: number | null;
  } | null;
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
  instructions?: string | null;
};

export type PublicPaymentGateway = {
  id: number;
  key: string;
  name: string;
  is_active: boolean;
  is_default: boolean;
  config?: Record<string, unknown> | null;
};

export type CustomerVoucher = {
  id: number;
  status: "active" | "used" | "expired" | string;
  claimed_at?: string | null;
  used_at?: string | null;
  expires_at?: string | null;
  voucher?: {
    id: number;
    code: string;
    type: string;
    value: number;
    min_order_amount?: number | string | null;
    max_discount_amount?: number | string | null;
    start_at?: string | null;
    end_at?: string | null;
  } | null;
};

export type PageReview = {
  id: number;
  store_location_id: number;
  customer_id?: number | null;
  name: string;
  email?: string | null;
  rating: number;
  title?: string | null;
  body: string;
  created_at?: string;
  updated_at?: string;
  photos?: ReviewPhoto[];
};

export type PageReviewList = {
  items: PageReview[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
};

export type PageReviewSetting = {
  enabled: boolean;
};

export type ReviewPhoto = {
  id: number;
  review_id: number;
  file_path: string;
  file_url?: string | null;
};

export type StoreLocationImage = {
  id: number;
  store_location_id: number;
  image_path: string;
  image_url?: string | null;
  sort_order?: number;
};

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type ApiRequestOptions = RequestInit & {
  jsonBody?: unknown;
  includeSessionToken?: boolean;
};

export type ApiError = Error & { status?: number; data?: unknown };

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
    let parsed: unknown = text;

    try {
      parsed = text ? JSON.parse(text) : text;
    } catch {
      // keep original text
    }

    const error: ApiError = new Error(`API error ${response.status}`);
    error.status = response.status;
    error.data = parsed;

    throw error;
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
  return get<{ data: CustomerProfileWithAddresses }>("/public/auth/profile");
}

export type UpdateCustomerProfilePayload = Partial<{
  name: string;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  photo: File | null;
}>;

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

  return put<{ data: CustomerProfileWithAddresses }>("/public/auth/profile", undefined, {
    body: formData,
  });
}

export async function changeCustomerPassword(payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}) {
  return put<{ data: CustomerProfileWithAddresses }>("/public/auth/password", payload);
}

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

export async function getCustomerAddresses() {
  return get<{ data: CustomerAddress[] }>("/public/auth/addresses");
}

export async function createCustomerAddress(payload: AddressPayload) {
  return post<{ data: CustomerAddress }>("/public/auth/addresses", payload);
}

export async function updateCustomerAddress(id: number, payload: AddressPayload) {
  return put<{ data: CustomerAddress }>(`/public/auth/addresses/${id}`, payload);
}

export async function deleteCustomerAddress(id: number) {
  return del<{ data: null }>(`/public/auth/addresses/${id}`);
}

export async function makeDefaultCustomerAddress(id: number) {
  return put<{ data: CustomerAddress }>(`/public/auth/addresses/${id}/default`);
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

export async function addCartItemIncrement(payload: {
  product_id: number;
  quantity: number;
}): Promise<CartResponse> {
  const response = await post<{ data: CartResponse }>(
    "/public/shop/cart/items/add",
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
  items?: { product_id: number; quantity: number; is_reward?: boolean; reward_redemption_id?: number | null }[];
  voucher_code?: string | null;
  customer_voucher_id?: number | null;
  shipping_method: "shipping" | "self_pickup";
  store_location_id?: number | null;
  shipping_postcode?: string | null;
  shipping_country?: string | null;
  shipping_state?: string | null;
  billing_same_as_shipping?: boolean;
  billing_name?: string;
  billing_phone?: string;
  billing_address_line1?: string;
  billing_address_line2?: string | null;
  billing_city?: string;
  billing_state?: string;
  billing_postcode?: string;
  billing_country?: string;
  session_token?: string | null;
};

export type CheckoutPayload = {
  items?: Array<{
    product_id: number;
    quantity: number;
    is_reward?: boolean;
    reward_redemption_id?: number;
  }>;
  session_token?: string | null;
  payment_method: string;
  shipping_method: "shipping" | "self_pickup";
  shipping_name?: string;
  shipping_phone?: string;
  shipping_address_line1?: string;
  shipping_address_line2?: string | null;
  shipping_city?: string;
  shipping_state?: string;
  shipping_country?: string;
  shipping_postcode?: string;
  billing_same_as_shipping?: boolean;
  billing_name?: string;
  billing_phone?: string;
  billing_address_line1?: string;
  billing_address_line2?: string | null;
  billing_city?: string;
  billing_state?: string;
  billing_country?: string;
  billing_postcode?: string;
  store_location_id?: number | null;
  bank_account_id?: number | null;
  voucher_code?: string | null;
  customer_voucher_id?: number | null;
};

export type CreateOrderResponse = {
  order_id: number;
  order_no: string;
  grand_total: string;
  payment_status: string;
  status: string;
  payment_method: string;
  payment_provider?: string | null;
  payment_reference?: string | null;
  payment_url?: string | null;
  payment: {
    provider: "billplz" | "manual";
    billplz_id?: string | null;
    billplz_url?: string | null;
  };
  bank_account?: PublicBankAccount | null;
};

export type PublicStoreLocation = {
  id: number;
  name: string;
  code?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string | null;
  postcode: string | null;
  country: string;
  phone: string | null;
  opening_hours?: Record<string, string> | null;
  images?: StoreLocationImage[];
};

export type OrderLookupResponse = {
  order_id: number;
  order_no: string;
  grand_total: number | string;
  payment_method: string;
  payment_provider?: string | null;
  payment_reference?: string | null;
  payment_url?: string | null;
  payment_status: string;
  status: string;
  bank_account?: PublicBankAccount | null;
  pickup_store?: PublicStoreLocation | null;
  uploads: { id: number; file_url: string | null; status?: string; note?: string | null; created_at: string }[];
};

export type OrderTrackingResponse = {
  data: {
    order_no: string;
    status: string;
    tracking_no: string | null;
    courier: string | null;
    shipped_at?: string | null;
    shipping_method: string;
    totals: {
      subtotal: number | string;
      discount_total: number | string;
      shipping_fee: number | string;
      grand_total: number | string;
    };
    items: {
      product_id?: number | null;
      product_name: string;
      product_slug?: string | null;
      product_image?: string | null;
      cover_image_url?: string | null;
      quantity: number;
      unit_price: number | string;
      line_total: number | string;
    }[];
  } | null;
  success: boolean;
  message?: string | null;
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

export type CancelOrderResponse = {
  order: {
    id: number;
    status: string;
    payment_status: string;
    reserve_expires_at?: string | null;
  };
};

export async function cancelOrder(orderId: number): Promise<CancelOrderResponse> {
  const response = await post<{ data: CancelOrderResponse }>(
    `/public/shop/orders/${orderId}/cancel`,
    undefined,
    { headers: { Accept: "application/json" } },
  );

  return response.data;
}

export type OrderPaymentResponse = {
  redirect_url: string;
};

export async function payOrder(orderId: number): Promise<OrderPaymentResponse> {
  const response = await post<{ data: OrderPaymentResponse }>(
    `/public/shop/orders/${orderId}/pay`,
    undefined,
    { headers: { Accept: "application/json" } },
  );

  return response.data;
}

export type CompleteOrderResponse = {
  order: {
    id: number;
    status: string;
    payment_status: string;
    completed_at?: string | null;
  };
};

export async function completeOrder(orderId: number): Promise<CompleteOrderResponse> {
  const response = await post<{ data: CompleteOrderResponse }>(
    `/public/shop/orders/${orderId}/complete`,
    undefined,
    { headers: { Accept: "application/json" } },
  );

  return response.data;
}

export async function getBankAccounts(): Promise<PublicBankAccount[]> {
  const response = await get<{ data: PublicBankAccount[] }>("/public/shop/bank-accounts", {
    headers: { Accept: "application/json" },
  });

  return response.data;
}

export async function getPaymentGateways(): Promise<PublicPaymentGateway[]> {
  const response = await get<{ data?: { payment_gateways?: PublicPaymentGateway[] } }>(
    "/public/shop/homepage",
    { includeSessionToken: true, headers: { Accept: "application/json" } },
  );

  return response.data?.payment_gateways ?? [];
}

export async function getStoreLocations(): Promise<PublicStoreLocation[]> {
  const response = await get<{ data: PublicStoreLocation[] }>("/public/shop/store-locations", {
    headers: { Accept: "application/json" },
  });

  return response.data;
}

export async function getStoreLocationDetail(id: number): Promise<PublicStoreLocation> {
  const response = await get<{ data: PublicStoreLocation }>(`/public/shop/store-locations/${id}`, {
    headers: { Accept: "application/json" },
  });

  return response.data;
}

export async function getCustomerVouchers(params?: { status?: string }): Promise<CustomerVoucher[]>{

// export async function getCustomerVouchers(params?: {
//   status?: string;
//   is_reward_only?: boolean;
// }): Promise<CustomerVoucher[]> {
  const search = new URLSearchParams();
  if (params?.status) {
    search.set("status", params.status);
  }
  // if (params?.is_reward_only !== undefined) {
  //   search.set("is_reward_only", String(params.is_reward_only));
  // }

  const response = await get<{ data: CustomerVoucher[] }>(
    `/public/shop/vouchers${search.toString() ? `?${search.toString()}` : ""}`,
    { headers: { Accept: "application/json" } },
  );

  return response.data ?? [];
}

export async function getPageReviewSettings(): Promise<PageReviewSetting> {
  const response = await get<{ data: PageReviewSetting }>("/public/shop/reviews/settings", {
    headers: { Accept: "application/json" },
  });

  return response.data;
}

export async function getPageReviews(params: {
  store_location_id: number;
  page?: number;
  per_page?: number;
}): Promise<PageReviewList> {
  const search = new URLSearchParams({ store_location_id: String(params.store_location_id) });

  if (params.page) {
    search.set("page", String(params.page));
  }

  if (params.per_page) {
    search.set("per_page", String(params.per_page));
  }

  const response = await get<{ data: PageReviewList }>(`/public/shop/reviews?${search.toString()}`, {
    headers: { Accept: "application/json" },
  });

  return response.data;
}

export type SubmitPageReviewPayload = {
  store_location_id: number;
  name?: string;
  email?: string | null;
  rating: number;
  title?: string | null;
  body?: string;
  content?: string;
  photos?: File[] | null;
};

export async function submitPageReview(payload: SubmitPageReviewPayload): Promise<PageReview> {
  const formData = new FormData();
  formData.append("store_location_id", String(payload.store_location_id));
  formData.append("rating", String(payload.rating));

  if (payload.title !== undefined && payload.title !== null) {
    formData.append("title", payload.title);
  }

  if (payload.content ?? payload.body) {
    formData.append("content", payload.content ?? payload.body ?? "");
  }

  if (payload.name) {
    formData.append("name", payload.name);
  }

  if (payload.email) {
    formData.append("email", payload.email);
  }

  if (payload.photos) {
    payload.photos.forEach((file) => formData.append("photos[]", file));
  }

  const response = await post<{ data: PageReview }>("/public/shop/reviews", undefined, {
    body: formData,
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

export async function trackGuestOrder(payload: {
  order_no: string;
  email?: string;
  phone?: string;
}): Promise<OrderTrackingResponse> {
  const res = await fetch("/api/proxy/public/shop/orders/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  let json: OrderTrackingResponse;
  try {
    json = (await res.json()) as OrderTrackingResponse;
  } catch (error) {
    console.error("[trackGuestOrder] Failed to parse response", error);
    throw new Error("Unable to track order at this time.");
  }

  if (!res.ok) {
    return {
      data: null,
      success: false,
      message: json?.message ?? "Order not found or verification failed.",
    };
  }

  return json;
}

export async function uploadPaymentSlip(orderId: number, slip: File, note?: string) {
  const formData = new FormData();
  formData.append("slip", slip);

  if (note) {
    formData.append("note", note);
  }

  return post<{ success: boolean }>(
    `/public/shop/orders/${orderId}/upload-slip`,
    undefined,
    { body: formData, includeSessionToken: true, headers: { Accept: "application/json" } },
  );
}

export async function getLoyaltyRewards() {
  const response = await get<{ data?: LoyaltyReward[]; meta?: unknown }>(
    "/public/shop/loyalty/rewards",
    { headers: { Accept: "application/json" } },
  );

  const payload = (response as { data?: LoyaltyReward[] })?.data ?? response;
  return (Array.isArray(payload) ? payload : []) as LoyaltyReward[];
}

export async function getMembershipTiers() {
  const response = await get<{ data?: LoyaltyTier[]; meta?: unknown }>(
    "/public/shop/membership/tiers",
    { headers: { Accept: "application/json" } },
  );

  const payload = (response as { data?: LoyaltyTier[] })?.data ?? response;
  return (Array.isArray(payload) ? payload : []) as LoyaltyTier[];
}

export async function redeemLoyaltyReward(rewardId: number) {
  return post<{ data?: unknown; message?: string }>(
    "/public/shop/loyalty/redeem",
    { reward_id: rewardId },
    { headers: { Accept: "application/json" } },
  );
}

export async function getLoyaltyHistory(options?: { page?: number; perPage?: number }) {
  const params = new URLSearchParams();
  if (options?.page) {
    params.set("page", options.page.toString());
  }
  if (options?.perPage) {
    params.set("per_page", options.perPage.toString());
  }

  const query = params.toString();
  const response = await get<{
    data?: {
      data?: LoyaltyHistoryEntry[];
      current_page?: number;
      last_page?: number;
      per_page?: number;
      total?: number;
      meta?: unknown;
      [key: string]: unknown;
    } | LoyaltyHistoryEntry[];
    meta?: unknown;
  }>(
    `/public/shop/loyalty/history${query ? `?${query}` : ""}`,
    { headers: { Accept: "application/json" } },
  );

  const payload = response?.data ?? response;
  const items: LoyaltyHistoryEntry[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray((payload as { items?: LoyaltyHistoryEntry[] })?.items)
        ? ((payload as { items?: LoyaltyHistoryEntry[] }).items ?? [])
        : [];

  const metaPayload =
    (payload && typeof payload === "object"
      ? (payload as {
          current_page?: number;
          last_page?: number;
          per_page?: number;
          total?: number;
          meta?: { current_page?: number; last_page?: number; per_page?: number; total?: number };
        })
      : {}) ?? {};

  const metaFromNested = metaPayload.meta ?? {};

  const pagination = {
    current_page: Number(metaPayload.current_page ?? (metaFromNested as { current_page?: number }).current_page ?? 1),
    last_page: Number(metaPayload.last_page ?? (metaFromNested as { last_page?: number }).last_page ?? 1),
    per_page: Number(metaPayload.per_page ?? (metaFromNested as { per_page?: number }).per_page ?? items.length),
    total: Number(metaPayload.total ?? (metaFromNested as { total?: number }).total ?? items.length),
  };

  const normalizedItems = items.map((item) => ({
    ...item,
    type: item.type,
    points_change: Number(item.points_change),
  })) as LoyaltyHistoryEntry[];

  return {
    items: normalizedItems,
    pagination,
  } as LoyaltyHistoryResponse;
}

export async function getAccountOverview() {
  const response = await get<{ data: AccountOverview }>("/public/shop/account/overview", {
    headers: { Accept: "application/json" },
  });

  return response.data;
}

export async function toggleWishlist(productId: number) {
  const response = await post<{ data: { is_favorited: boolean; product_id: number; session_token?: string } }>(
    "/public/shop/wishlist/toggle",
    { product_id: productId },
    { includeSessionToken: true, headers: { Accept: "application/json" } },
  );

  const data = response.data;

  if (data.session_token) {
    setSessionToken(data.session_token);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("wishlist:updated", { detail: data }));
  }

  return data;
}

export async function getWishlistItems() {
  const response = await get<{
    data:
      | { items: WishlistItem[]; customer_id?: number | null; session_token?: string | null }
      | WishlistItem[];
  }>("/public/shop/wishlist", { includeSessionToken: true, headers: { Accept: "application/json" } });

  const payload = response.data;
  const items = Array.isArray(payload) ? payload : payload?.items ?? [];
  const sessionToken = Array.isArray(payload) ? null : payload?.session_token ?? null;
  const customerId = Array.isArray(payload) ? null : payload?.customer_id ?? null;

  if (sessionToken) {
    setSessionToken(sessionToken);
  }

  return { items, session_token: sessionToken, customer_id: customerId };
}

export async function mergeWishlist(payload?: { session_token?: string }) {
  return post<{ success?: boolean }>(
    "/public/shop/wishlist/merge",
    payload,
    { includeSessionToken: payload?.session_token === undefined },
  );
}
