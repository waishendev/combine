"use client";

import { useState } from "react";
import { useCart } from "@/hooks/useCart";

export function AddToCart({ productId, stock }: { productId: number; stock: number }) {
  const { addOrUpdateItem, loading } = useCart();
  const [quantity, setQuantity] = useState(1);

  async function handleAdd() {
    await addOrUpdateItem(productId, quantity);
  }

  function increase() {
    setQuantity((prev) => Math.min(prev + 1, stock));
  }

  function decrease() {
    setQuantity((prev) => Math.max(1, prev - 1));
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-full border bg-white shadow-sm">
        <button type="button" onClick={decrease} className="px-3 py-2 text-lg" aria-label="Decrease quantity">
          -
        </button>
        <span className="w-10 text-center font-semibold">{quantity}</span>
        <button type="button" onClick={increase} className="px-3 py-2 text-lg" aria-label="Increase quantity">
          +
        </button>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={loading || stock <= 0}
        className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {stock <= 0 ? "Out of stock" : "Add to cart"}
      </button>
    </div>
  );
}

