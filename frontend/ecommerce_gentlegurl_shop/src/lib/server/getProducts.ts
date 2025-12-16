import { cookies } from "next/headers";

export async function getProducts(params?: { categorySlug?: string }) {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const searchParams = new URLSearchParams();
    if (params?.categorySlug) {
      searchParams.set("category_slug", params.categorySlug);
    }

    const qs = searchParams.toString();
    const url = `${siteUrl}/api/proxy/public/shop/products${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[getProducts] Failed:", res.status, await res.text());
      return [];
    }

    const json = await res.json();

    if (json.data?.data) return json.data.data;
    return json.data ?? [];
  } catch (error) {
    console.error("[getProducts] Error:", error);
    return [];
  }
}
