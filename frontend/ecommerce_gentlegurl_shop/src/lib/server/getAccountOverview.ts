import { cookies } from "next/headers";
import { AccountOverview } from "../apiClient";

export async function getAccountOverview(): Promise<AccountOverview | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const res = await fetch(`${siteUrl}/api/proxy/public/shop/account/overview`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[getAccountOverview] Failed:", res.status);
      return null;
    }

    const json = await res.json();
    return (json.data as AccountOverview) ?? null;
  } catch (error) {
    console.error("[getAccountOverview] Error:", error);
    return null;
  }
}
