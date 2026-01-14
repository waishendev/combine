"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { WishlistToggleButton } from "@/components/wishlist/WishlistToggleButton";
import { ProductReviewsSection } from "@/components/product/ProductReviewsSection";
import { RewardRedeemPanel } from "@/components/product/RewardRedeemPanel";
import { ProductGallery } from "@/components/product/ProductGallery";
import { buildProductGalleryMedia, getVideoPoster, type ProductMediaItem } from "@/lib/productMedia";
import { normalizeImageUrl } from "@/lib/imageUrl";
import type { ReviewSettings } from "@/lib/types/reviews";

export type VariantItem = {
  id: number;
  name: string;
  sku?: string | null;
  price?: number | string | null;
  stock?: number | null;
  track_stock?: boolean | null;
  image_url?: string | null;
};

type ProductDetailClientProps = {
  slug: string;
  product: {
    id: number;
    name: string;
    slug: string;
    type?: string | null;
    price: number | string;
    stock?: number | null;
    is_reward_only?: boolean;
    description?: string | null;
    sold_count?: number | null;
    variants?: VariantItem[];
    related_products?: Array<{
      id: number | string;
      name: string;
      slug?: string;
      price: number | string;
      thumbnail?: string | null;
    }>;
    review_settings?: ReviewSettings;
    review_summary?: unknown;
    recent_reviews?: unknown;
    [key: string]: unknown;
  };
  reviewsData: unknown;
  eligibility: unknown;
  isRewardContext: boolean;
  rewardPoints: number | string | null;
};

export default function ProductDetailClient({
  slug,
  product,
  reviewsData,
  eligibility,
  isRewardContext,
  rewardPoints,
}: ProductDetailClientProps) {
  const isRewardOnly = product.is_reward_only === true;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = product.type === "variant" && variants.length > 0;
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [variants, selectedVariantId],
  );

  const activeImageUrl = selectedVariant?.image_url
    ? normalizeImageUrl(selectedVariant.image_url)
    : null;

  const baseGalleryMedia = useMemo(() => buildProductGalleryMedia(product), [product]);
  const galleryMedia = useMemo(() => {
    if (!activeImageUrl) {
      return baseGalleryMedia;
    }
    const hasVariantImage = baseGalleryMedia.some((item) => item.url === activeImageUrl);
    if (hasVariantImage) {
      return baseGalleryMedia;
    }
    const variantMedia: ProductMediaItem = {
      id: `variant-${selectedVariant?.id ?? "image"}`,
      type: "image",
      url: activeImageUrl,
      sort_order: -1,
    };
    return [variantMedia, ...baseGalleryMedia];
  }, [activeImageUrl, baseGalleryMedia, selectedVariant?.id]);
  const videoItem = galleryMedia.find((item) => item.type === "video");
  const videoPoster = videoItem ? getVideoPoster(product, videoItem) : null;
  const initialIndex = galleryMedia.findIndex((item) => item.type === "video");

  const priceNumber = Number(
    selectedVariant?.price ?? product.price ?? 0,
  );
  const displayPrice = Number.isFinite(priceNumber)
    ? priceNumber.toFixed(2)
    : String(selectedVariant?.price ?? product.price ?? "0");

  const stockValue = selectedVariant?.stock ?? product.stock ?? null;
  const trackStock = selectedVariant?.track_stock ?? true;
  const showStock = !isRewardOnly && trackStock;

  const soldCountValue = Number(product.sold_count ?? 0);
  const soldCount = Number.isFinite(soldCountValue) ? soldCountValue : 0;

  const relatedProducts = Array.isArray(product.related_products)
    ? product.related_products
    : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative">
          <ProductGallery
            media={galleryMedia}
            initialIndex={initialIndex >= 0 ? initialIndex : 0}
            videoPoster={videoPoster}
            alt={product.name}
            activeUrl={activeImageUrl}
          />
          <div className="absolute right-3 top-3 z-10">
            <WishlistToggleButton
              productId={product.id}
              initialIsWishlisted={product.is_in_wishlist ?? false}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">{product.name}</h1>

          <div className="flex flex-wrap items-center gap-3">
            {!isRewardOnly && (
              <div className="text-xl font-bold text-[var(--accent-strong)]">
                RM {displayPrice}
              </div>
            )}
            {!isRewardOnly && (
              <span className="rounded-full bg-[var(--background-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                Sold {soldCount}
              </span>
            )}
            {isRewardOnly && (
              <span className="rounded-full bg-[var(--status-warning-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--status-warning)]">
                Reward Item
              </span>
            )}
          </div>

          {hasVariants && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">Variants</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((variant) => {
                  const isActive = variant.id === selectedVariantId;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`rounded border px-3 py-2 text-sm transition ${
                        isActive
                          ? "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                          : "border-[var(--card-border)] bg-white text-[var(--foreground)] hover:border-[var(--accent)]"
                      }`}
                    >
                      {variant.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showStock && stockValue !== null && (
            <div className="text-sm text-[color:var(--text-muted)]">
              <p>Stock left: {stockValue}</p>
              {stockValue <= 0 && (
                <p className="mt-1 font-semibold text-[color:var(--status-error)]">Out of stock</p>
              )}
            </div>
          )}

          {isRewardOnly && product.stock != null && (
            <div className="text-sm text-[color:var(--text-muted)]">
              <p>Stock left: {product.stock}</p>
              {product.stock <= 0 && (
                <p className="mt-1 font-semibold text-[color:var(--status-error)]">Out of stock</p>
              )}
            </div>
          )}

          {product.description && (
            <div className="prose max-w-none text-sm text-[color:var(--text-muted)]">
              {product.description}
            </div>
          )}

          {isRewardOnly || isRewardContext ? (
            <RewardRedeemPanel
              productId={product.id}
              slug={slug}
              fallbackPoints={rewardPoints}
              isRewardOnly={isRewardOnly}
              stock={product.stock ?? null}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <AddToCartButton
                productId={product.id}
                stock={showStock ? stockValue : null}
                productVariantId={selectedVariantId}
                requiresVariant={product.type === "variant"}
              />
            </div>
          )}
        </div>
      </div>

      <ProductReviewsSection
        slug={slug}
        initialReviews={reviewsData}
        initialEligibility={eligibility}
        settings={product.review_settings as ReviewSettings | undefined}
      />

      {relatedProducts.length > 0 && (
        <section className="mt-12 space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent-strong)]">
              Recommended
            </p>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              You May Also Like
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((related) => {
              const relatedPriceNumber = Number(related.price);
              const priceLabel = Number.isFinite(relatedPriceNumber)
                ? relatedPriceNumber.toFixed(2)
                : related.price;
              const thumbnail = related.thumbnail
                ? normalizeImageUrl(related.thumbnail)
                : null;

              return (
                <Link
                  key={related.id}
                  href={`/product/${related.slug ?? related.id}`}
                  className="group relative overflow-hidden rounded-md border border-[var(--card-border)] bg-[var(--card)]/90 shadow-[0_16px_50px_-36px_rgba(15,23,42,0.6)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_-36px_rgba(var(--accent-rgb),0.45)]"
                >
                  <div className="aspect-square w-full overflow-hidden">
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnail}
                        alt={related.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--muted)] text-xs text-[var(--text-muted)]">
                        No Image
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 px-3 py-3">
                    <p className="line-clamp-2 text-sm font-medium text-[var(--foreground)]">
                      {related.name}
                    </p>
                    <p className="text-sm font-semibold text-[var(--accent-strong)]">
                      RM {priceLabel}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
