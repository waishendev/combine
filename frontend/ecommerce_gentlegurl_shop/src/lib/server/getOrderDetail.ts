import { cookies } from "next/headers";

export type OrderDetail = {
  id: number;
  order_no: string;
  status: string;
  payment_status: string;
  created_at: string;
  subtotal?: string | number;
  discount_total?: string | number;
  shipping_fee?: string | number;
  grand_total?: string | number;
  items?: Array<{
    id: number;
    name: string;
    sku: string;
    quantity: number;
    unit_price: string | number;
    line_total: string | number;
  }>;
  voucher?: {
    code: string;
    discount_amount: string | number;
  } | null;
  slips?: Array<{
    id: number;
    file_url: string;
  }>;
  returns?: Array<{
    id: number;
    status: string;
    tracking_no?: string | null;
  }>;
  [key: string]: unknown;
};

export async function getOrderDetail(
  orderId: string | number,
): Promise<OrderDetail | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const API_BASE =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

    const res = await fetch(`${API_BASE}/api/public/shop/orders/${orderId}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("[getOrderDetail] Failed:", res.status, text);
      return null;
    }

    const json = await res.json();

    return json?.data?.order ?? null;
  } catch (error) {
    console.error("[getOrderDetail] Error:", error);
    return null;
  }
}
