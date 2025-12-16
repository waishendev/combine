import type {
  LoyaltyHistoryItem,
  LoyaltyReward,
  LoyaltySummary,
  OrderDetail,
  OrderSummary,
  ReturnRequest,
  WishlistItem,
} from "@/lib/shop-types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch (error) {
    return null;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new Error(body?.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMyOrders(params?: { page?: number }) {
  const search = params?.page ? `?page=${params.page}` : "";
  const res = await fetch(`${API_BASE}/public/shop/customer/orders${search}`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<{ data: OrderSummary[] }>(res);
}

export async function fetchMyOrderDetail(orderNo: string) {
  const res = await fetch(`${API_BASE}/public/shop/customer/orders/${orderNo}`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<{ data: OrderDetail }>(res);
}

export async function uploadOrderSlip(orderNo: string, file: File) {
  const form = new FormData();
  form.append("slip", file);
  const res = await fetch(`${API_BASE}/public/shop/orders/${orderNo}/upload-slip`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return handleResponse<{ message?: string }>(res);
}

export async function requestOrderReturn(
  orderNo: string,
  payload: { type: string; reason: string; description?: string },
) {
  const res = await fetch(`${API_BASE}/public/shop/orders/${orderNo}/returns`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ data: ReturnRequest }>(res);
}

export async function fetchReturns() {
  const res = await fetch(`${API_BASE}/public/shop/returns`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<{ data: ReturnRequest[] }>(res);
}

export async function fetchReturnDetail(id: string) {
  const res = await fetch(`${API_BASE}/public/shop/returns/${id}`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<{ data: ReturnRequest }>(res);
}

export async function submitReturnTracking(id: string, tracking_no: string) {
  const res = await fetch(`${API_BASE}/public/shop/returns/${id}/tracking`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tracking_no }),
  });
  return handleResponse<{ message?: string }>(res);
}

export async function fetchWishlist() {
  const res = await fetch(`${API_BASE}/public/shop/wishlist`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<{ data: WishlistItem[] }>(res);
}

export async function toggleWishlist(productId: number) {
  const res = await fetch(`${API_BASE}/public/shop/wishlist/toggle`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId }),
  });
  return handleResponse<{ message?: string }>(res);
}

export async function fetchLoyaltySummary() {
  const res = await fetch(`${API_BASE}/public/shop/loyalty/summary`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<{ data: LoyaltySummary }>(res);
}

export async function fetchLoyaltyHistory() {
  const res = await fetch(`${API_BASE}/public/shop/loyalty/history`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<{ data: LoyaltyHistoryItem[] }>(res);
}

export async function fetchLoyaltyRewards() {
  const res = await fetch(`${API_BASE}/public/shop/loyalty/rewards`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<{ data: LoyaltyReward[] }>(res);
}

export async function redeemLoyaltyReward(payload: { reward_id: number }) {
  const res = await fetch(`${API_BASE}/public/shop/loyalty/redeem`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ message?: string }>(res);
}
