"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toggleWishlist } from "@/lib/apiClient";
import { WishlistToggleButton } from "../wishlist/WishlistToggleButton";

type WishlistItem = {
  id?: number;
  product_id?: number;
  slug?: string;
  product_slug?: string;
  name?: string;
  product_name?: string;
  price?: number | string;
  product_price?: number | string;
  image?: string | null;
  thumbnail?: string | null;
  product?: {
    id?: number;
    slug?: string;
    name?: string;
    price?: number | string;
    images?: { image_path?: string }[];
    thumbnail?: string | null;
  };
};

type AccountWishlistGridProps = {
  initialItems: WishlistItem[];
};

export function AccountWishlistGrid({ initialItems }: AccountWishlistGridProps) {
  const [items, setItems] = useState<WishlistItem[]>(initialItems);

  const handleRemove = async (productId?: number) => {
    if (!productId) return;
    await toggleWishlist(productId);
    setItems((prev) => prev.filter((item) => (item.product_id ?? item.id ?? item.product?.id) !== productId));
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start justify-center rounded-xl border border-dashed border-[var(--muted)] bg-[var(--background)] p-10 shadow-sm">
        <p className="mb-3 text-lg font-semibold text-[var(--foreground)]">Your wishlist is empty.</p>
        <p className="mb-4 text-sm text-[var(--foreground)]/70">Browse products you love and save them here.</p>
        <Link
          href="/shop"
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => {
        const productSlug = item.slug ?? item.product_slug ?? item.product?.slug ?? "";
        const productId = item.product_id ?? item.id ?? item.product?.id;
        const productName = item.name ?? item.product_name ?? item.product?.name ?? "Wishlist item";
        const price = item.price ?? item.product_price ?? item.product?.price;
        const image = item.image ?? item.thumbnail ?? item.product?.thumbnail ?? item.product?.images?.[0]?.image_path;
        const key = productId ?? `${productSlug}-${index}`;

        return (
          <div
            key={key}
            className="group flex h-full flex-col rounded-xl border border-[var(--muted)] bg-[var(--background)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Link href={`/product/${productSlug}`} className="relative mb-3 block h-48 overflow-hidden rounded-lg bg-[var(--muted)]/40">
              {image ? (
                <Image src={image} alt={productName} fill className="object-cover transition duration-300 group-hover:scale-105" sizes="(min-width: 1024px) 300px, 45vw" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[var(--foreground)]/60">No image</div>
              )}
            </Link>

            <div className="flex flex-1 flex-col gap-2">
              <div className="space-y-1">
                <Link href={`/product/${productSlug}`} className="text-base font-semibold text-[var(--foreground)] hover:text-[var(--accent-strong)]">
                  {productName}
                </Link>
                {price !== undefined && price !== null && (
                  <p className="text-sm font-semibold text-[var(--accent-strong)]">RM {Number(price).toFixed(2)}</p>
                )}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2">
                {productId ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(productId)}
                    className="rounded-full border border-[var(--muted)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--accent-strong)] hover:bg-[var(--muted)]/60"
                  >
                    Remove
                  </button>
                ) : (
                  <span className="text-xs text-[var(--foreground)]/60">Unavailable</span>
                )}
                <Link
                  href={`/product/${productSlug}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                >
                  View
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="h-3.5 w-3.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 6.75 4.5 4.5-4.5 4.5" />
                  </svg>
                </Link>
                {productId && (
                  <WishlistToggleButton
                    productId={productId}
                    initialIsWishlisted
                    variant="link"
                    className="text-xs"
                    onToggled={() => handleRemove(productId)}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
