"use client";

import { useState } from "react";
import { useCart } from "@/contexts/CartContext";

type AddToCartButtonProps = {
  productId: number;
  stock?: number | null;
};

export default function AddToCartButton({ productId, stock }: AddToCartButtonProps) {
  const { addToCart } = useCart();
  const [qty, setQty] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const maxStock = typeof stock === "number" ? stock : null;
  const clampQuantity = (value: number) => {
    if (maxStock === null) {
      return Math.max(1, value);
    }

    return Math.min(Math.max(1, value), maxStock);
  };

  const handleAdd = async () => {
    if (qty <= 0) return;
    if (maxStock !== null && qty > maxStock) {
      setQty(maxStock);
      setNotice(`Only ${maxStock} available in stock.`);
      return;
    }
    setIsSubmitting(true);
    try {
      await addToCart(productId, qty);
      setNotice(null);
    } catch (error) {
      const message =
        typeof error === "object" && error && "data" in (error as never)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any).data?.message as string | undefined) ?? "Unable to add to cart."
          : "Unable to add to cart.";
      setNotice(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded border">
          <button
            type="button"
            className="px-3 py-2 text-sm"
            onClick={() => {
              const next = clampQuantity(qty - 1);
              setQty(next);
              setNotice(null);
            }}
          >
            -
          </button>
          <input
            type="number"
            min={1}
            max={maxStock ?? undefined}
            value={qty}
            onChange={(e) => {
              const rawValue = Number(e.target.value) || 1;
              const clamped = clampQuantity(rawValue);
              setQty(clamped);
              if (maxStock !== null && rawValue > maxStock) {
                setNotice(`Only ${maxStock} available in stock.`);
              } else {
                setNotice(null);
              }
            }}
            className="w-14 border-x px-2 py-1 text-center text-sm outline-none"
          />
          <button
            type="button"
            className="px-3 py-2 text-sm"
            onClick={() => {
              if (maxStock !== null && qty >= maxStock) {
                setNotice(`Only ${maxStock} available in stock.`);
                return;
              }
              setQty(clampQuantity(qty + 1));
              setNotice(null);
            }}
            disabled={maxStock !== null && qty >= maxStock}
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={isSubmitting || (maxStock !== null && maxStock <= 0)}
          className="rounded bg-[var(--accent)] px-6 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Adding..." : "Add to Cart"}
        </button>
      </div>
      {notice && <p className="text-xs font-medium text-[color:var(--status-warning)]">{notice}</p>}
    </div>
  );
}
