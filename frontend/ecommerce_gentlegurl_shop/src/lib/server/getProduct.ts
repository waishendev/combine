import { cookies } from "next/headers";
import { normalizeImageUrl } from "../imageUrl";
import { ReviewItem, ReviewSettings, ReviewSummary } from "../types/reviews";

export type ProductImage = {
  id: number;
  image_path: string;
  is_main?: boolean;
  sort_order?: number;
  url?: string | null;
  [key: string]: unknown;
};

export type ProductMedia = {
  id?: number | string;
  type?: "image" | "video" | string;
  url?: string | null;
  thumbnail_url?: string | null;
  sort_order?: number | null;
  status?: string | null;
};

export type ProductDetail = {
  id: number;
  name: string;
  slug: string;
  type?: string | null;
  price: string | number;
  image_url?: string | null;
  cover_image_url?: string | null;
  description?: string | null;
  stock?: number | null;
  low_stock_threshold?: number | null;
  images?: ProductImage[];
  media?: ProductMedia[];
  video?: ProductMedia | null;
  gallery?: (ProductImage | string)[];
  is_in_wishlist?: boolean;
  dummy_sold_count?: number | null;
  real_sold_count?: number | null;
  sold_count?: number | null;
  is_reward_only?: boolean;
  related_products?: unknown;
  review_summary?: ReviewSummary;
  recent_reviews?: ReviewItem[];
  review_settings?: ReviewSettings;
  variants?: Array<{
    id: number;
    name: string;
    sku?: string | null;
    price?: string | number | null;
    stock?: number | null;
    track_stock?: boolean | null;
    is_active?: boolean | null;
    low_stock_threshold?: number | null;
    image_url?: string | null;
  }>;
  seo?: {
    meta_title?: string | null;
    meta_description?: string | null;
    meta_keywords?: string | string[] | null;
    meta_og_image?: string | null;
  } | null;
  [key: string]: unknown;
};

function normalizeProductImages(product: ProductDetail): ProductDetail {
  const images = (product.images ?? []).map((image) => {
    const resolvedPath = image.image_path ?? image.url ?? "";
    const normalizedPath = normalizeImageUrl(resolvedPath);
    return {
      ...image,
      image_path: normalizedPath,
      url: normalizeImageUrl(image.url ?? image.image_path ?? resolvedPath),
    };
  });

  const media = (product.media ?? []).map((item) => ({
    ...item,
    url: normalizeImageUrl(item.url ?? ""),
    thumbnail_url: normalizeImageUrl(item.thumbnail_url ?? ""),
  }));

  const coverImageUrl = product.cover_image_url
    ? normalizeImageUrl(product.cover_image_url)
    : null;

  const variants = Array.isArray(product.variants)
    ? product.variants.map((variant) => ({
        ...variant,
        image_url: variant.image_url ? normalizeImageUrl(variant.image_url) : variant.image_url,
      }))
    : product.variants;

  return { ...product, images, media, variants, cover_image_url: coverImageUrl };
}

export async function getProduct(slug: string, options?: { reward?: boolean }): Promise<ProductDetail | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Get session_token from cookie as fallback for query parameter
    const sessionToken = cookieStore.get("shop_session_token")?.value;

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const searchParams = new URLSearchParams();
    if (sessionToken) {
      searchParams.set("session_token", sessionToken);
    }
    if (options?.reward) {
      searchParams.set("reward", "1");
    }
    const qs = searchParams.toString();
    const url = `${siteUrl}/api/proxy/public/shop/products/${slug}${qs ? `?${qs}` : ""}`;

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
