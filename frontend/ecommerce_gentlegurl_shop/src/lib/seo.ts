import type { Metadata } from "next";
import { normalizeImageUrl } from "@/lib/imageUrl";

export type SeoPayload = {
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | string[] | null;
  meta_og_image?: string | null;
};

function resolveKeywords(
  keywords?: string | string[] | null,
  fallback?: string | string[] | null
): string | string[] | undefined {
  const resolved = keywords ?? fallback;
  if (!resolved) return undefined;
  return resolved;
}

function resolveOgImage(
  seo?: SeoPayload | null,
  fallback?: SeoPayload | null
): string | undefined {
  const image = seo?.meta_og_image ?? fallback?.meta_og_image;
  if (!image) return undefined;
  return normalizeImageUrl(image);
}

export function mapSeoToMetadata(
  seo?: SeoPayload | null,
  fallback?: SeoPayload | null
): Metadata {
  const title = seo?.meta_title ?? fallback?.meta_title ?? undefined;
  const description = seo?.meta_description ?? fallback?.meta_description ?? undefined;
  const keywords = resolveKeywords(seo?.meta_keywords, fallback?.meta_keywords);
  const ogImage = resolveOgImage(seo, fallback);

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      title,
      description,
      ...(ogImage
        ? { images: [ogImage], card: "summary_large_image" }
        : { card: "summary" }),
    },
  };
}
