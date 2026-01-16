import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/server/getProduct";
import { getHomepage } from "@/lib/server/getHomepage";
import { getProductReviewEligibility } from "@/lib/server/getProductReviewEligibility";
import { getProductReviews } from "@/lib/server/getProductReviews";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { getPrimaryProductImage } from "@/lib/productMedia";
import { cache } from "react";
import { mapSeoToMetadata, type SeoPayload } from "@/lib/seo";
import ProductDetailClient from "@/components/product/ProductDetailClient";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getHomepageCached = cache(getHomepage);
const getProductCached = cache(getProduct);

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [homepage, product] = await Promise.all([
    getHomepageCached(),
    getProductCached(slug),
  ]);

  if (!product) {
    return {};
  }

  const productSlug = (product as { slug?: string | null }).slug ?? slug;
  const homepageSeo = homepage?.seo ?? null;
  const productSeo = (product as { seo?: SeoPayload | null }).seo ?? null;
  const baseMetadata = mapSeoToMetadata(productSeo, homepageSeo);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const canonicalUrl = new URL(`/product/${productSlug}`, siteUrl).toString();

  const resolvedTitle =
    typeof baseMetadata.title === "string" ? baseMetadata.title : product.name;
  const resolvedDescription = baseMetadata.description ?? undefined;

  const ogImage =
    productSeo?.meta_og_image ??
    homepageSeo?.meta_og_image ??
    getPrimaryProductImage(product) ??
    null;
  const ogImageUrl = ogImage
    ? ogImage.startsWith("/images/")
      ? ogImage
      : normalizeImageUrl(ogImage)
    : undefined;

  return {
    ...baseMetadata,
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      ...(baseMetadata.openGraph ?? {}),
      title: resolvedTitle,
      description: resolvedDescription,
      url: canonicalUrl,
      type: "website",
      ...(ogImageUrl ? { images: [{ url: ogImageUrl }] } : {}),
    },
    twitter: {
      ...(baseMetadata.twitter ?? {}),
      title: resolvedTitle,
      description: resolvedDescription,
      ...(ogImageUrl
        ? { images: [ogImageUrl], card: "summary_large_image" }
        : { card: "summary" }),
    },
  };
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const [{ slug }, searchParamsResolved] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const resolvedSearchParams: Record<string, string | string[] | undefined> = searchParamsResolved;

  const rewardParam = Array.isArray(resolvedSearchParams?.reward)
    ? resolvedSearchParams.reward[0]
    : resolvedSearchParams?.reward;
  const isRewardContext = typeof rewardParam === "string"
    ? ["1", "true", "yes", "reward"].includes(rewardParam.toLowerCase())
    : false;

  const product = await getProduct(slug, { reward: isRewardContext });
  if (!product) return notFound();

  const productSlug = (product as { slug?: string | null }).slug ?? slug;
  const rewardPoints =
    (product as { points_required?: number | null })?.points_required ??
    (product as { reward_points_required?: number | null })?.reward_points_required ??
    null;

  const [reviewsData, eligibility] = await Promise.all([
    getProductReviews(productSlug),
    getProductReviewEligibility(productSlug),
  ]);

  return (
    <ProductDetailClient
      slug={productSlug}
      product={{
        ...product,
        related_products: Array.isArray(product.related_products)
          ? (product.related_products as Array<{
              id: number | string;
              name: string;
              slug?: string;
              price: number | string;
              thumbnail?: string | null;
            }>)
          : [],
      }}
      reviewsData={reviewsData}
      eligibility={eligibility}
      isRewardContext={isRewardContext}
      rewardPoints={rewardPoints}
    />
  );
}
