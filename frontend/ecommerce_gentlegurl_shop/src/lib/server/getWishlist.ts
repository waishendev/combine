import { cookies } from "next/headers";

export async function getWishlist() {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const baseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

    const url = `${baseUrl}/api/public/shop/wishlist`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return null;
      }

      console.error("[getWishlist] Failed:", res.status);
      return null;
    }

    const json = await res.json();

    return json.data;
  } catch (error) {
    console.error("[getWishlist] Error:", error);
    return null;
  }
}
