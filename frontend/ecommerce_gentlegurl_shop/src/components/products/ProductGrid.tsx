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

  const handleImageError = (imageSrc: string) => {
    setImageErrors((prev) => new Set(prev).add(imageSrc));
  };

  const getImageSrc = (imageSrc: string) =>
    imageErrors.has(imageSrc) ? "/images/placeholder.png" : imageSrc;

  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
      {items?.map((product) => {
        const resolvedSlug =
          typeof product.slug === "string" && product.slug.trim().length > 0
            ? product.slug.trim()
            : product.id
              ? String(product.id)
              : "";
        const priceNumber = Number(product.price);
        const priceLabel = Number.isFinite(priceNumber) ? priceNumber.toFixed(2) : product.price;
        const image = getPrimaryProductImage(product);
        const soldCountValue = Number(
          product.sold_total ?? (Number(product.sold_count ?? 0) + Number(product.extra_sold ?? 0)),
        );
        const soldCount = Number.isFinite(soldCountValue) ? soldCountValue : 0;

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

                <span className="text-sm font-semibold text-[var(--accent-strong)]">
                  RM {priceLabel}
                </span>

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
