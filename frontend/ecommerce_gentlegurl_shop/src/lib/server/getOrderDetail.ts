import { cookies } from "next/headers";
import { OrderItemSummary } from "./getOrders";

export type OrderDetail = {
  id: number;
  order_no: string;
  status: string;
  payment_status: string;
  reserve_expires_at?: string | null;
  payment_method?: string | null;
  payment_provider?: string | null;
  subtotal: number | string;
  discount_total: number | string;
  shipping_fee: number | string;
  grand_total: number | string;
  pickup_or_shipping?: string | null;
  shipping_courier?: string | null;
  shipping_tracking_no?: string | null;
  shipped_at?: string | null;
  placed_at?: string | null;
  paid_at?: string | null;
  completed_at?: string | null;
  items: OrderItemSummary[];
  voucher?: {
    code: string;
    discount_amount: number | string;
  } | null;
  slips?: {
    id: number;
    type: string;
    file_url?: string | null;
    created_at?: string | null;
  }[];
  returns?: {
    id: number;
    status: string;
    tracking_no?: string | null;
  }[];
  shipping_address?: {
    name?: string | null;
    phone?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postcode?: string | null;
    country?: string | null;
  } | null;
  pickup_store?: {
    id: number;
    name: string;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postcode?: string | null;
    country?: string | null;
    phone?: string | null;
  } | null;
  bank_account?: {
    id: number;
    bank_name: string;
    account_name: string;
    account_number?: string | null;
    branch?: string | null;
    logo_url?: string | null;
    qr_image_url?: string | null;
  } | null;
};

export type OrderDetailResponse = {
  order: OrderDetail;
};

export async function getOrderDetail(id: number): Promise<OrderDetail | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

    const res = await fetch(`${API_BASE}/api/public/shop/orders/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("[getOrderDetail] Failed:", res.status, text);
      return null;
    }

    const json = await res.json();
    return (json?.data as OrderDetailResponse | undefined)?.order ?? null;
  } catch (error) {
    console.error("[getOrderDetail] Error:", error);
    return null;
  }
}
