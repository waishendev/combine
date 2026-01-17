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
    type?: string | null;
    variants?: Array<{
      id?: number | string;
      price?: number | string | null;
      sale_price?: number | string | null;
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

  const getDiscountPercent = (price: number | null, salePrice: number | null) => {
    if (!price || !salePrice) return null;
    if (salePrice >= price) return null;
    return Math.round((1 - salePrice / price) * 100);
  };

  const formatRange = (min: number, max: number) => {
    if (min === max) return formatAmount(min);
    return `${formatAmount(min)} - ${formatAmount(max)}`;
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
        const basePrice = parseAmount(product.price);
        const baseSalePrice = parseAmount(product.sale_price ?? null);
        const image = getPrimaryProductImage(product);
        const soldCountValue = Number(
          product.sold_total ?? (Number(product.sold_count ?? 0) + Number(product.extra_sold ?? 0)),
        );
        const soldCount = Number.isFinite(soldCountValue) ? soldCountValue : 0;
        const variantItems = Array.isArray(product.variants) ? product.variants : [];
        const activeVariants = variantItems.filter((variant) => variant.is_active !== false);
        const priceValues = (isVariantProduct ? activeVariants : [])
          .map((variant) => parseAmount(variant.price))
          .filter((value): value is number => value !== null);
        const saleValues = (isVariantProduct ? activeVariants : [])
          .map((variant) => {
            const price = parseAmount(variant.price);
            const sale = parseAmount(variant.sale_price ?? null);
            return price && sale && sale < price ? sale : null;
          })
          .filter((value): value is number => value !== null);
        const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : basePrice;
        const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : basePrice;
        const minSale = saleValues.length > 0 ? Math.min(...saleValues) : null;
        const maxSale = saleValues.length > 0 ? Math.max(...saleValues) : null;
        const rangeDiscounts = activeVariants
          .map((variant) =>
            getDiscountPercent(
              parseAmount(variant.price),
              parseAmount(variant.sale_price ?? null),
            ),
          )
          .filter((value): value is number => value !== null);
        const rangeDiscountPercent =
          saleValues.length > 0 && rangeDiscounts.length > 0
            ? Math.max(...rangeDiscounts)
            : null;
        const simpleDiscountPercent = getDiscountPercent(basePrice, baseSalePrice);
        const showSalePrice = simpleDiscountPercent !== null;
        const priceLabel =
          minPrice !== null && maxPrice !== null
            ? formatRange(minPrice, maxPrice)
            : basePrice !== null
              ? formatAmount(basePrice)
              : String(product.price ?? "0");
        const saleLabel =
          minSale !== null && maxSale !== null ? formatRange(minSale, maxSale) : null;

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
                    saleLabel ? (
                      <>
                        <span className="text-xs font-medium text-[color:var(--text-muted)] line-through">
                          RM {priceLabel}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--accent-strong)]">
                            RM {saleLabel}
                          </span>
                          {rangeDiscountPercent !== null && (
                            <span className="rounded-full bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--status-warning)]">
                              UP TO -{rangeDiscountPercent}%
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-[var(--accent-strong)]">
                        RM {priceLabel}
                      </span>
                    )
                  ) : showSalePrice && baseSalePrice !== null ? (
                    <>
                      <span className="text-xs font-medium text-[color:var(--text-muted)] line-through">
                        RM {formatAmount(basePrice ?? 0)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--accent-strong)]">
                          RM {formatAmount(baseSalePrice)}
                        </span>
                        {simpleDiscountPercent !== null && (
                          <span className="rounded-full bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--status-warning)]">
                            -{simpleDiscountPercent}%
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-[var(--accent-strong)]">
                      RM {priceLabel}
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
