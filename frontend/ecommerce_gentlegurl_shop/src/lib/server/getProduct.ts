import { cookies } from "next/headers";
import { normalizeImageUrl } from "../imageUrl";

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
  gallery?: (ProductImage | string)[];
  is_in_wishlist?: boolean;
  [key: string]: unknown;
};

function normalizeProductImages(product: ProductDetail): ProductDetail {
  if (!product.images?.length) return product;

  const images = product.images.map((image) => ({
    ...image,
    image_path: normalizeImageUrl(image.image_path),
  }));

  return { ...product, images };
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("shop_session_token")?.value;
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const url = new URL(`${siteUrl}/api/proxy/public/shop/products/${slug}`);

    if (sessionToken) {
      url.searchParams.set("session_token", sessionToken);
    }

    console.log(url.toString());
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
    const product = (json.data as ProductDetail) ?? null;

    if (!product) return null;

    return normalizeProductImages(product);
  } catch (error) {
    console.error("[getProduct] Error:", error);
    return null;
  }
}
