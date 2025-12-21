import { cookies } from "next/headers";
import { ProductReviewsData } from "../types/reviews";

export async function getProductReviews(slug: string): Promise<ProductReviewsData | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const res = await fetch(`${siteUrl}/api/proxy/public/shop/products/${slug}/reviews`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[getProductReviews] Failed:", res.status, await res.text());
      return null;
    }

    const json = await res.json();
    return (json.data as ProductReviewsData) ?? null;
  } catch (error) {
    console.error("[getProductReviews] Error:", error);
    return null;
  }
}
