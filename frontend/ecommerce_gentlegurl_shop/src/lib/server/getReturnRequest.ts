import { cookies } from "next/headers";

export type ReturnRequestItem = {
  order_item_id: number;
  product_name?: string | null;
  sku?: string | null;
  product_sku?: string | null;
  product_variant_id?: number | null;
  product_type?: string | null;
  is_variant_product?: boolean | null;
  variant_name?: string | null;
  variant_sku?: string | null;
  order_quantity?: number | null;
  requested_quantity?: number | null;
  product_image?: string | null;
  cover_image_url?: string | null;
  unit_price?: string | number | null;
};

export type ReturnRequestDetail = {
  id: number;
  order_id: number;
  order_number?: string | null;
  request_type: string;
  status: string;
  reason?: string | null;
  description?: string | null;
  admin_note?: string | null;
  initial_image_urls?: string[] | null;
  return_courier_name?: string | null;
  return_tracking_no?: string | null;
  return_shipped_at?: string | null;
  refund_amount?: string | number | null;
  refund_method?: string | null;
  refund_proof_url?: string | null;
  refunded_at?: string | null;
  items?: ReturnRequestItem[];
  timestamps?: {
    created_at?: string | null;
    reviewed_at?: string | null;
    received_at?: string | null;
    completed_at?: string | null;
  };
};

export async function getReturnRequest(
  id: number,
): Promise<ReturnRequestDetail | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const API_BASE =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

    const res = await fetch(`${API_BASE}/api/public/shop/returns/${id}`, {
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
      console.error("[getReturnRequest] Failed:", res.status, text);
      return null;
    }

    const json = await res.json();
    return (json?.data as ReturnRequestDetail) ?? null;
  } catch (error) {
    console.error("[getReturnRequest] Error:", error);
    return null;
  }
}
