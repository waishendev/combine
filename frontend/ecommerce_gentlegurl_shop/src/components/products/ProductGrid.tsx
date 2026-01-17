"use client";

import Link from "next/link";
import { useState } from "react";
import { WishlistToggleButton } from "@/components/wishlist/WishlistToggleButton";
import { getPrimaryProductImage } from "@/lib/productMedia";

interface ProductGridProps {
  items: Array<{
    id: number | string;
    name: string;
    price: number | string;
    sale_price?: number | string | null;
    sale_price_start_at?: string | null;
    sale_price_end_at?: string | null;
    original_price?: number | string | { min: number; max: number } | null;
    effective_price?: number | string | null;
    is_on_sale?: boolean | null;
    price_display?: string | null;
    sale_price_display?: string | null;
    promotion_active?: boolean | null;
    promotion_end_at?: string | null;
    discount_percent?: number | null;
    type?: string | null;
    variants?: Array<{
      id?: number | string;
      price?: number | string | null;
      sale_price?: number | string | null;
      sale_price_start_at?: string | null;
      sale_price_end_at?: string | null;
      original_price?: number | string | { min: number; max: number } | null;
      effective_price?: number | string | null;
      is_on_sale?: boolean | null;
      promotion_active?: boolean | null;
      promotion_end_at?: string | null;
      discount_percent?: number | null;
      is_active?: boolean | null;
    }>;
    slug?: string;
    cover_image_url?: string | null;
    images?: Array<{ image_path?: string | null; url?: string | null; sort_order?: number | null }>;
    media?: Array<{ type?: string; url?: string | null; sort_order?: number | null }>;
    is_in_wishlist?: boolean;
    sold_count?: number | string;
    sold_total?: number | string;
    extra_sold?: number | string;
  }>;
}

export default function ProductGrid({ items }: ProductGridProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const parseAmount = (value: number | string | null | undefined) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatAmount = (value: number) => value.toFixed(2);

  const formatRange = (min: number, max: number) => {
    if (min === max) return formatAmount(min);
    return `${formatAmount(min)} - ${formatAmount(max)}`;
  };

  const formatPriceValue = (
    value?: number | string | { min: number; max: number } | null,
  ): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "object") {
      return formatRange(value.min, value.max);
    }
    const parsed = parseAmount(value);
    return parsed !== null ? formatAmount(parsed) : null;
  };

  const handleImageError = (imageSrc: string) => {
    setImageErrors((prev) => new Set(prev).add(imageSrc));
  };

  const getImageSrc = (imageSrc: string) =>
    imageErrors.has(imageSrc) ? "/images/placeholder.png" : imageSrc;

  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
      {items?.map((product) => {
        const normalizedSlug =
          typeof product.slug === "string" ? product.slug.trim().toLowerCase() : null;
        const resolvedSlug =
          normalizedSlug && !["null", "undefined"].includes(normalizedSlug)
            ? product.slug!.trim()
            : product.id
              ? String(product.id)
              : "";
        const isVariantProduct =
          product.type === "variant" ||
          (Array.isArray(product.variants) && product.variants.length > 0);
        const priceDisplay = product.price_display ?? formatPriceValue(product.original_price);
        const salePriceDisplay =
          product.sale_price_display ?? formatPriceValue(product.sale_price ?? null);
        const promotionActive = product.promotion_active === true || product.is_on_sale === true;
        const image = getPrimaryProductImage(product);
        const soldCountValue = Number(
          product.sold_total ?? (Number(product.sold_count ?? 0) + Number(product.extra_sold ?? 0)),
        );
        const soldCount = Number.isFinite(soldCountValue) ? soldCountValue : 0;
        const discountPercent =
          typeof product.discount_percent === "number" ? product.discount_percent : null;
        const showPromotionBadge = promotionActive && (discountPercent ?? 0) >= 1;

        return (
          <div
            key={product.id}
            className="group relative overflow-hidden rounded-md border border-[var(--card-border)] bg-[var(--card)]/80 shadow-[0_12px_45px_-30px_rgba(17,24,39,0.65)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_70px_-32px_rgba(109,40,217,0.35)]"
          >
            <div className="absolute right-3 top-3 z-10">
              <WishlistToggleButton
                productId={Number(product.id)}
                initialIsWishlisted={product.is_in_wishlist ?? false}
              />
            </div>

            <Link href={`/product/${resolvedSlug}`} prefetch={false} className="block">
              <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-b from-[var(--background-soft)] to-[var(--card)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {/* <Image
                    // src={image}
                    src={"/images/placeholder.png"}
                    alt={product.name}
                    fill
                    className="object-cover transition duration-500 ease-out group-hover:scale-105"
                  /> */}
                <img
                  src={getImageSrc(image)}
                  alt={product.name}
                  className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
                  onError={() => handleImageError(image)}
                />
              </div>
              <div className="space-y-2 p-4">
                <h3 className="text-sm font-semibold leading-snug text-[var(--foreground)] md:text-base">
                  {product.name}
                </h3>

                <div className="space-y-1">
                  {isVariantProduct ? (
                    promotionActive && salePriceDisplay ? (
                      <>
                        <span className="text-xs font-medium text-[color:var(--text-muted)] line-through">
                          RM {priceDisplay ?? "0.00"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--accent-strong)]">
                            RM {salePriceDisplay}
                          </span>
                          {showPromotionBadge && discountPercent !== null && (
                            <span className="rounded-full bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--status-warning)]">
                              -{discountPercent}%
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-[var(--accent-strong)]">
                        RM {priceDisplay ?? "0.00"}
                      </span>
                    )
                  ) : promotionActive && salePriceDisplay ? (
                    <>
                      <span className="text-xs font-medium text-[color:var(--text-muted)] line-through">
                        RM {priceDisplay ?? "0.00"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--accent-strong)]">
                          RM {salePriceDisplay}
                        </span>
                        {showPromotionBadge && discountPercent !== null && (
                          <span className="rounded-full bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--status-warning)]">
                            -{discountPercent}%
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-[var(--accent-strong)]">
                      RM {priceDisplay ?? "0.00"}
                    </span>
                  )}
                </div>

                <p className="text-xs font-medium text-[color:var(--text-muted)]">
                  Sold {soldCount}
                </p>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
