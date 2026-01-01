import { cookies } from "next/headers";

export type ReturnRequestSummary = {
  id: number;
  order_id: number;
  order_number?: string | null;
  request_type: string;
  status: string;
  reason?: string | null;
  created_at?: string | null;
  total_items?: number | null;
  total_quantity?: number | null;
};

export type ReturnsResult = {
  returns: ReturnRequestSummary[];
  pagination?: unknown;
} | null;

export async function getReturns(): Promise<ReturnsResult> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const API_BASE =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

    const res = await fetch(`${API_BASE}/api/public/shop/returns`, {
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
      console.error("[getReturns] Failed:", res.status, text);
      return null;
    }

    const json = await res.json();
    const payload = json?.data ?? {};

    return {
      returns: payload?.data ?? [],
      pagination: payload,
    };
  } catch (error) {
    console.error("[getReturns] Error:", error);
    return null;
  }
}
