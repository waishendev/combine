"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { WishlistToggleButton } from "@/components/wishlist/WishlistToggleButton";
import { ProductReviewsSection } from "@/components/product/ProductReviewsSection";
import { RewardRedeemPanel } from "@/components/product/RewardRedeemPanel";
import { ProductGallery } from "@/components/product/ProductGallery";
import { buildProductGalleryMedia, getVideoPoster, type ProductMediaItem } from "@/lib/productMedia";
import { normalizeImageUrl } from "@/lib/imageUrl";
import type { ReviewSettings, ReviewSummary } from "@/lib/types/reviews";

export type VariantItem = {
  id: number;
  name: string;
  sku?: string | null;
  price?: number | string | null;
  sale_price?: number | string | null;
  sale_price_start_at?: string | null;
  sale_price_end_at?: string | null;
  original_price?: number | string | null;
  effective_price?: number | string | null;
  is_on_sale?: boolean | null;
  promotion_active?: boolean | null;
  promotion_end_at?: string | null;
  discount_percent?: number | null;
  stock?: number | null;
  derived_available_qty?: number | null;
  track_stock?: boolean | null;
  is_active?: boolean | null;
  is_bundle?: boolean | null;
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
    sale_price?: number | string | null;
    sale_price_start_at?: string | null;
    sale_price_end_at?: string | null;
    original_price?: number | string | null;
    effective_price?: number | string | null;
    is_on_sale?: boolean | null;
    promotion_active?: boolean | null;
    promotion_end_at?: string | null;
    discount_percent?: number | null;
    stock?: number | null;
    is_reward_only?: boolean;
    description?: string | null;
    sold_count?: number | null;
    sold_total?: number | null;
    extra_sold?: number | null;
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
  showGalleryArrows: boolean;
};

export default function ProductDetailClient({
  slug,
  product,
  reviewsData,
  eligibility,
  isRewardContext,
  rewardPoints,
  showGalleryArrows,
}: ProductDetailClientProps) {
  const isRewardOnly = product.is_reward_only === true;
  const isVariantProduct = product.type === "variant";
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = product.type === "variant" && variants.length > 0;
  const normalVariants = variants.filter((variant) => variant.is_bundle !== true);
  const bundleVariants = variants.filter((variant) => variant.is_bundle === true);
  const combinedVariants = [...normalVariants, ...bundleVariants];
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  const parseAmount = (value: number | string | null | undefined) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatAmount = (value: number) => value.toFixed(2);

  const parseDateTime = (value: string | null | undefined) => {
    if (!value) return null;
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatPromoEndAt = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  };

  const formatCountdown = (diffMs: number) => {
    if (diffMs <= 0) return "00:00:00";
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const timeLabel = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(seconds).padStart(2, "0")}`;
    return days > 0 ? `${days} days ${timeLabel}` : timeLabel;
  };

  const getDiscountPercent = (price: number | null, salePrice: number | null) => {
    if (!price || !salePrice) return null;
    if (salePrice >= price) return null;
    return Math.round((1 - salePrice / price) * 100);
  };

  const formatRange = (min: number, max: number) => {
    if (min === max) return formatAmount(min);
    return `${formatAmount(min)} – ${formatAmount(max)}`;
  };

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [variants, selectedVariantId],
  );

  const activeImageUrl = selectedVariant?.image_url
    ? normalizeImageUrl(selectedVariant.image_url)
    : null;

  const baseGalleryMedia = useMemo(() => buildProductGalleryMedia(product), [product]);
  const galleryMedia = useMemo(() => {
    const variantImageItems = variants
      .map((variant) => {
        if (!variant.image_url) {
          return null;
        }
        const normalized = normalizeImageUrl(variant.image_url);
        return normalized
          ? ({
              id: `variant-${variant.id}`,
              type: "image",
              url: normalized,
              sort_order: 1000 + variant.id,
            } satisfies ProductMediaItem)
          : null;
      })
      .filter((item): item is ProductMediaItem => Boolean(item?.url));

    const seen = new Set(baseGalleryMedia.map((item) => item.url));
    const merged = [...baseGalleryMedia];
    variantImageItems.forEach((item) => {
      if (!item.url || seen.has(item.url)) {
        return;
      }
      seen.add(item.url);
      merged.push(item);
    });

    if (!activeImageUrl) {
      return merged;
    }
    const hasVariantImage = merged.some((item) => item.url === activeImageUrl);
    if (hasVariantImage) {
      return merged;
    }
    const variantMedia: ProductMediaItem = {
      id: `variant-${selectedVariant?.id ?? "image"}`,
      type: "image",
      url: activeImageUrl,
      sort_order: -1,
    };
    return [variantMedia, ...merged];
  }, [activeImageUrl, baseGalleryMedia, selectedVariant?.id, variants]);
  const videoItem = galleryMedia.find((item) => item.type === "video");
  const videoPoster = videoItem ? getVideoPoster(product, videoItem) : null;
  const initialIndex = galleryMedia.findIndex((item) => item.type === "video");

  const baseOriginalPrice = parseAmount(
    selectedVariant?.original_price ?? selectedVariant?.price ?? product.original_price ?? product.price ?? 0,
  );
  const baseEffectivePrice = parseAmount(
    selectedVariant?.effective_price ??
      selectedVariant?.sale_price ??
      product.effective_price ??
      product.sale_price ??
      product.price ??
      0,
  );
  const baseIsOnSale = selectedVariant
    ? selectedVariant.is_on_sale === true
    : product.is_on_sale === true;
  const selectedDiscountPercent =
    typeof (selectedVariant?.discount_percent ?? product.discount_percent) === "number"
      ? Number(selectedVariant?.discount_percent ?? product.discount_percent)
      : getDiscountPercent(baseOriginalPrice, baseEffectivePrice);
  const saleEndAt = parseDateTime(
    selectedVariant?.sale_price_end_at ?? product.sale_price_end_at ?? null,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!saleEndAt) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [saleEndAt?.getTime()]);

  const isPromoExpired = saleEndAt ? now >= saleEndAt.getTime() : false;
  const displayIsOnSale = baseIsOnSale && !isPromoExpired;
  const displayPrice = baseOriginalPrice !== null ? formatAmount(baseOriginalPrice) : "0.00";
  const displaySalePrice =
    displayIsOnSale && baseEffectivePrice !== null ? formatAmount(baseEffectivePrice) : null;
  const countdownLabel =
    saleEndAt && displayIsOnSale ? formatCountdown(saleEndAt.getTime() - now) : null;

  const variantPriceRange = useMemo(() => {
    if (!hasVariants || selectedVariant) {
      return null;
    }
    const prices = variants
      .filter((variant) => variant.is_active !== false)
      .map((variant) =>
        parseAmount(variant.original_price ?? variant.price ?? product.original_price ?? product.price ?? 0),
      )
      .filter((value): value is number => value !== null);
    if (prices.length === 0) {
      return null;
    }
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    return formatRange(minPrice, maxPrice);
  }, [hasVariants, selectedVariant, variants, product.price]);

  const variantSaleRange = useMemo(() => {
    if (!hasVariants || selectedVariant) {
      return null;
    }
    const sales = variants
      .filter((variant) => variant.is_active !== false)
      .map((variant) => {
        if (variant.is_on_sale !== true) {
          return null;
        }
        return parseAmount(variant.effective_price ?? variant.sale_price ?? null);
      })
      .filter((value): value is number => value !== null);
    if (sales.length === 0) {
      return null;
    }
    const minSale = Math.min(...sales);
    const maxSale = Math.max(...sales);
    return formatRange(minSale, maxSale);
  }, [hasVariants, selectedVariant, variants, product.price]);

  const variantDiscountPercent = useMemo(() => {
    if (!hasVariants || selectedVariant) {
      return null;
    }
    const discounts = variants
      .filter((variant) => variant.is_active !== false)
      .map((variant) => {
        if (typeof variant.discount_percent === "number") {
          return variant.discount_percent;
        }
        return getDiscountPercent(
          parseAmount(variant.original_price ?? variant.price ?? product.original_price ?? product.price ?? 0),
          parseAmount(variant.effective_price ?? variant.sale_price ?? null),
        );
      })
      .filter((value): value is number => value !== null);
    if (discounts.length === 0) {
      return null;
    }
    return Math.max(...discounts);
  }, [hasVariants, selectedVariant, variants, product.price]);

  const productTrackStock = (product as { track_stock?: boolean | null }).track_stock ?? true;
  const stockValue = isVariantProduct
    ? selectedVariant?.is_bundle
      ? selectedVariant?.derived_available_qty ?? null
      : selectedVariant?.stock ?? null
    : product.stock ?? null;
  const trackStock = isVariantProduct
    ? (selectedVariant?.track_stock ?? true)
    : productTrackStock;
  const showStock = !isRewardOnly && trackStock && (!isVariantProduct || !!selectedVariant);
  const stockForCart = trackStock ? stockValue : null;

  const soldCountValue = Number(
    product.sold_total ?? (Number(product.sold_count ?? 0) + Number(product.extra_sold ?? 0)),
  );
  const soldCount = Number.isFinite(soldCountValue) ? soldCountValue : 0;
  const reviewSummary = product.review_summary as ReviewSummary | undefined;
  const ratingLabel =
    reviewSummary && reviewSummary.count > 0
      ? `${reviewSummary.avg_rating.toFixed(1)} (${reviewSummary.count})`
      : null;

  const relatedProducts = Array.isArray(product.related_products)
    ? product.related_products
    : [];

  const baseReferencePrice = parseAmount(
    product.effective_price ?? product.sale_price ?? product.price ?? null,
  );

  const getVariantPriceLabel = (variant: VariantItem) => {
    const variantPrice = parseAmount(
      variant.effective_price ?? variant.sale_price ?? variant.price ?? null,
    );
    if (variantPrice === null || baseReferencePrice === null) {
      return "Price updates";
    }
    const diff = variantPrice - baseReferencePrice;
    if (diff === 0) {
      return null;
    }
    const prefix = diff > 0 ? "+" : "-";
    return `${prefix}RM${formatAmount(Math.abs(diff))}`;
  };

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
            showArrows={showGalleryArrows}
          />
          <div className="absolute right-3 top-3 z-10">
            <WishlistToggleButton
              productId={product.id}
              initialIsWishlisted={product.is_in_wishlist ?? false}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            {(ratingLabel || (!isRewardOnly && soldCount > 0)) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-muted)]">
                {ratingLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-2.5 py-1 text-[color:var(--foreground)]">
                    <span className="text-[color:var(--status-warning)]">★</span>
                    <span className="font-semibold">{ratingLabel}</span>
                  </span>
                )}
                {!isRewardOnly && soldCount > 0 && (
                  <span className="inline-flex items-center rounded-full border border-[var(--card-border)] bg-[var(--background-soft)] px-2.5 py-1 font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                    Sold {soldCount}
                  </span>
                )}
              </div>
            )}
            {isRewardOnly && (
              <span className="inline-flex items-center rounded-full bg-[var(--status-warning-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--status-warning)]">
                Reward Item
              </span>
            )}
          </div>

          {!isRewardOnly && (
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-4 shadow-sm">
              <div className="flex flex-wrap items-end gap-2">
                {variantPriceRange && !selectedVariant ? (
                  variantSaleRange ? (
                    <>
                      <span className="text-sm font-semibold text-[color:var(--text-muted)] line-through">
                        RM {variantPriceRange}
                      </span>
                      <span className="text-3xl font-semibold text-[var(--accent-strong)]">
                        RM {variantSaleRange}
                      </span>
                      {variantDiscountPercent !== null && (
                        <span className="rounded-full bg-[var(--status-warning-bg)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--status-warning)]">
                          UP TO -{variantDiscountPercent}%
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-3xl font-semibold text-[var(--accent-strong)]">
                      RM {variantPriceRange}
                    </span>
                  )
                ) : displaySalePrice ? (
                  <>
                    <span className="text-sm font-semibold text-[color:var(--text-muted)] line-through">
                      RM {displayPrice}
                    </span>
                    <span className="text-3xl font-semibold text-[var(--accent-strong)]">
                      RM {displaySalePrice}
                    </span>
                    {selectedDiscountPercent !== null && (
                      <span className="rounded-full bg-[var(--status-warning-bg)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--status-warning)]">
                        -{selectedDiscountPercent}%
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-3xl font-semibold text-[var(--accent-strong)]">
                    RM {displayPrice}
                  </span>
                )}
              </div>
              {selectedVariant ? (
                <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                  Selected: <span className="font-semibold text-[var(--foreground)]">{selectedVariant.name}</span>
                </p>
              ) : hasVariants ? (
                <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                  Select an option to see the exact price.
                </p>
              ) : null}
            </div>
          )}

          {displayIsOnSale && saleEndAt && countdownLabel && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-full border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)]/40 px-4 py-2 text-xs">
              <span className="font-semibold text-[color:var(--status-warning)]">
                Promo ends in {countdownLabel}
              </span>
              <span className="text-[color:var(--text-muted)]">
                Ends at {formatPromoEndAt(saleEndAt)}
              </span>
            </div>
          )}

          {hasVariants && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--foreground)]">Options</p>
                {selectedVariant && (
                  <span className="text-xs font-medium text-[color:var(--text-muted)]">
                    {selectedVariant.name} selected
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {combinedVariants.map((variant) => {
                  const isSelected = variant.id === selectedVariantId;
                  const isActive = variant.is_active !== false;
                  const availableQty = variant.is_bundle
                    ? variant.derived_available_qty ?? 0
                    : variant.stock ?? 0;
                  const outOfStock = (variant.track_stock ?? true) && availableQty <= 0;
                  const isAvailable = isActive && !outOfStock;
                  const disabledLabel = !isActive ? "Unavailable" : "Out of stock";
                  const priceLabel = getVariantPriceLabel(variant);
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => {
                        if (!isAvailable) return;
                        setSelectedVariantId((current) =>
                          current === variant.id ? null : variant.id,
                        );
                      }}
                      disabled={!isAvailable}
                      title={!isAvailable ? disabledLabel : undefined}
                      className={`group relative flex min-w-[9.5rem] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                        isSelected
                          ? "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-sm"
                          : !isAvailable
                            ? "border-[var(--card-border)] bg-[var(--background-soft)] text-[var(--text-muted)] opacity-70"
                            : "border-[var(--card-border)] bg-white text-[var(--foreground)] hover:border-[var(--accent)]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                            isSelected
                              ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white"
                              : "border-[var(--card-border)] text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="font-medium">{variant.name}</span>
                      </span>
                      <span className="text-xs text-[color:var(--text-muted)]">
                        {priceLabel ?? ""}
                      </span>
                      {!isAvailable && (
                        <span className="absolute right-2 top-1.5 rounded-full bg-[var(--status-error-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--status-error)]">
                          {disabledLabel}
                        </span>
                      )}
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
                stock={stockForCart}
                productVariantId={selectedVariantId}
                requiresVariant={product.type === "variant"}
              />
            </div>
          )}

          {product.description && (
            <div className="prose max-w-none text-sm text-[color:var(--text-muted)]">
              {product.description}
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
