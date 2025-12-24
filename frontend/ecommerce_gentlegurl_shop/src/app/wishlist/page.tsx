"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountWishlistGrid } from "@/components/account/AccountWishlistGrid";
import { useAuth } from "@/contexts/AuthContext";
import { getWishlistItems, type WishlistItem } from "@/lib/apiClient";

export default function WishlistPage() {
  const { customer } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getWishlistItems()
      .then((data) => {
        if (!active) return;
        setItems(data.items ?? []);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [customer?.profile?.id]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Wishlist</h1>
          <p className="text-sm text-[var(--foreground)]/70">
            Save the products you love and access them anytime.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 rounded-xl border border-[var(--muted)] bg-white p-6 shadow-sm">
          <div className="h-5 w-32 animate-pulse rounded bg-[var(--muted)]/60" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="h-40 rounded-lg border border-[var(--muted)]/60 bg-[var(--muted)]/30"
              />
            ))}
          </div>
        </div>
      ) : (
        <AccountWishlistGrid initialItems={items} />
      )}
    </div>
  );
}
