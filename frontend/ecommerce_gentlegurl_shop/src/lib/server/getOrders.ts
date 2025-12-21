import { cookies } from "next/headers";

export type OrderItemSummary = {
  id: number;
  product_id: number;
  product_slug?: string | null;
  name?: string;
  sku?: string | null;
  quantity: number;
  unit_price?: string | number;
  line_total?: string | number;
  product_image?: string | null;
};

export type OrderSummary = {
  id: number;
  order_no: string;
  status: string;
  payment_status: string;
  grand_total: string | number;
  created_at: string;
  items?: OrderItemSummary[];
  [key: string]: unknown;
};

export type OrdersResult = {
  orders: OrderSummary[];
  pagination?: unknown;
} | null;

export async function getOrders(): Promise<OrdersResult> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const API_BASE =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

    const res = await fetch(`${API_BASE}/api/public/shop/orders`, {
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
      console.error("[getOrders] Failed:", res.status, text);
      return null;
    }

    const json = await res.json();

    return {
      orders: json?.data?.orders ?? [],
      pagination: json?.data?.pagination,
    };
  } catch (error) {
    console.error("[getOrders] Error:", error);
    return null;
  }
}
