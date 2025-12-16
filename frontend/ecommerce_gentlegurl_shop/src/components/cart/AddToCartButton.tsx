"use client";

import { useState } from "react";
import { useCart } from "@/contexts/CartContext";

type AddToCartButtonProps = {
  productId: number;
};

export default function AddToCartButton({ productId }: AddToCartButtonProps) {
  const { addToCart } = useCart();
  const [qty, setQty] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (qty <= 0) return;
    setIsSubmitting(true);
    try {
      await addToCart(productId, qty);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 flex items-center gap-3">
      <div className="flex items-center rounded border">
        <button
          type="button"
          className="px-3 py-2 text-sm"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
        >
          -
        </button>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) =>
            setQty(Math.max(1, Number(e.target.value) || 1))
          }
          className="w-14 border-x px-2 py-1 text-center text-sm outline-none"
        />
        <button
          type="button"
          className="px-3 py-2 text-sm"
          onClick={() => setQty((q) => q + 1)}
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={isSubmitting}
        className="rounded bg-[var(--accent)] px-6 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Adding..." : "Add to Cart"}
      </button>
    </div>
  );
}
