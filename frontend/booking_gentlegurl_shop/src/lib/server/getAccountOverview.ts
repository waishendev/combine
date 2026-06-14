import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/types";

type AccountOverviewResponse = {
  profile?: AuthUser;
};

export async function getAccountOverview(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    if (!cookieHeader) {
      return null;
    }

    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${base}/api/public/shop/account/overview`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: cookieHeader,
        "X-Workspace": "booking",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return null;
      }
      return null;
    }

    const payload = await response.json();
    const data = (payload?.data ?? null) as AccountOverviewResponse | AuthUser | null;
    if (!data || typeof data !== "object") return null;
    if ("profile" in data && data.profile) {
      return data.profile;
    }
    return data as AuthUser;
  } catch {
    return null;
  }
}
