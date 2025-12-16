"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toggleWishlist } from "@/lib/shop-api";
import type { WishlistItem } from "@/lib/shop-types";

export function WishlistGrid({ items }: { items: WishlistItem[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function handleToggle(productId: number) {
    setLoadingId(productId);
    try {
      await toggleWishlist(productId);
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingId(null);
    }
  }

  if (!items.length) {
    return <p className="text-sm text-slate-600">No wishlist items yet.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((product) => (
        <div key={product.id} className="flex flex-col gap-3 rounded-lg border bg-white p-4 shadow-sm">
          <div className="h-40 overflow-hidden rounded-md bg-slate-100">
            {product.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.thumbnail_url} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No image</div>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Link href={`/product/${product.slug}`} className="text-lg font-semibold text-slate-900 hover:text-blue-600">
              {product.name}
            </Link>
            <div className="text-sm text-slate-600">RM {product.price}</div>
          </div>
          <div className="flex gap-2 text-sm">
            <Link href={`/product/${product.slug}`} className="flex-1 rounded border px-3 py-2 text-center font-semibold">
              View
            </Link>
            <button
              type="button"
              onClick={() => handleToggle(product.id)}
              disabled={loadingId === product.id}
              className="flex-1 rounded bg-red-50 px-3 py-2 font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {loadingId === product.id ? "Updating..." : "Remove"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
