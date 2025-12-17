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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 transition-all duration-200"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

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
      className={`group relative flex items-center justify-center rounded-full bg-white/95 p-2.5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white hover:shadow-xl active:scale-95 ${
        isWishlisted
          ? "text-[#ec4899] hover:text-[#db2777]"
          : "text-gray-400 hover:text-[#ec4899]"
      } ${loading ? "opacity-50" : ""} ${className ?? ""}`}
    >
      <HeartIcon filled={isWishlisted} />
      {/* {isWishlisted && (
        <span className="absolute inset-0 animate-ping rounded-full bg-[#ec4899]/20 opacity-75" />
      )} */}
    </button>
  );
}
