import { cookies } from "next/headers";

export type ProductImage = {
  id: number;
  image_path: string;
  is_main?: boolean;
  sort_order?: number;
  [key: string]: unknown;
};

export type ProductDetail = {
  id: number;
  name: string;
  slug: string;
  price: string | number;
  description?: string | null;
  stock?: number | null;
  low_stock_threshold?: number | null;
  images?: ProductImage[];
  is_in_wishlist?: boolean;
  [key: string]: unknown;
};

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const url = `${siteUrl}/api/proxy/public/shop/products/${slug}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[getProduct] Failed:", res.status, await res.text());
      return null;
    }

    const json = await res.json();
    return (json.data as ProductDetail) ?? null;
  } catch (error) {
    console.error("[getProduct] Error:", error);
    return null;
  }
}
