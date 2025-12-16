"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleWishlist } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  productId: number;
  initialIsWishlisted?: boolean;
  variant?: "icon" | "button" | "link";
  className?: string;
  onToggled?: (isWishlisted: boolean) => void;
};

export function WishlistToggleButton({
  productId,
  initialIsWishlisted = false,
  variant = "icon",
  className,
  onToggled,
}: Props) {
  const [isWishlisted, setIsWishlisted] = useState(initialIsWishlisted);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { customer } = useAuth();

  const handleClick = async () => {
    if (!customer) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);
      await toggleWishlist(productId);
      setIsWishlisted((prev) => {
        const next = !prev;
        onToggled?.(next);
        return next;
      });
    } catch (error) {
      console.error("[WishlistToggleButton] Error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`rounded-full border px-3 py-1 text-xs hover:border-gray-400 ${className ?? ""}`}
      >
        {loading ? "..." : isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
      </button>
    );
  }

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`text-xs text-red-500 hover:underline ${className ?? ""}`}
      >
        {loading ? "..." : isWishlisted ? "Remove" : "Add to wishlist"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      className="rounded-full border bg-white/80 p-1.5 text-xs shadow-sm hover:bg-red-50"
    >
      <span className={isWishlisted ? "text-red-500" : "text-gray-400"}>
        {isWishlisted ? "♥" : "♡"}
      </span>
    </button>
  );
}
