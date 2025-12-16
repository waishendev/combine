"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CartSummary } from "@/components/shop/CartSummary";
import { useCart } from "@/hooks/useCart";
import type { CartItem } from "@/lib/shop-types";

export default function CartPage() {
  const { cart, loading, addOrUpdateItem, removeItem } = useCart();
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // 默认选中所有项目
  useEffect(() => {
    if (cart?.items) {
      setSelectedItems(new Set(cart.items.map((item) => item.id)));
    }
  }, [cart]);

  function toggleItem(itemId: number) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function toggleAll() {
    if (!cart?.items) return;
    if (selectedItems.size === cart.items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(cart.items.map((item) => item.id)));
    }
  }

  function handleCheckout() {
    if (selectedItems.size === 0) {
      alert("Please select at least one item to checkout");
      return;
    }

    // 将选中的项目ID编码到URL参数中
    const selectedIds = Array.from(selectedItems).join(",");
    router.push(`/checkout?selected=${selectedIds}`);
  }

  const selectedCartItems = cart?.items.filter((item) => selectedItems.has(item.id)) ?? [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-blue-700">Cart</p>
          <h1 className="text-3xl font-semibold">Your shopping cart</h1>
        </div>
        <Link href="/shop" className="text-sm font-semibold text-blue-600">
          Continue shopping
        </Link>
      </div>

      <div className="grid gap-8 md:grid-cols-[1.8fr_1fr]">
        <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Items</h3>
            {cart?.items && cart.items.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={selectedItems.size === cart.items.length && cart.items.length > 0}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>Select all</span>
              </label>
            )}
          </div>
          {loading && <p className="text-sm text-slate-500">Loading cart...</p>}
          {!loading && cart?.items.length === 0 && <p className="text-sm text-slate-500">Cart is empty.</p>}

          <div className="space-y-4">
            {cart?.items.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                  selectedItems.has(item.id) ? "border-blue-500 bg-blue-50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <div>
                    <p className="text-sm text-slate-500">SKU #{item.product_id}</p>
                    <p className="text-lg font-semibold">{item.product_name}</p>
                    <p className="text-sm text-slate-600">RM {item.unit_price} each</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-full border bg-slate-50">
                    <button
                      type="button"
                      onClick={() => addOrUpdateItem(item.product_id, Math.max(1, item.quantity - 1))}
                      className="px-3 py-2"
                      aria-label="decrease quantity"
                    >
                      -
                    </button>
                    <span className="w-10 text-center font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => addOrUpdateItem(item.product_id, item.quantity + 1)}
                      className="px-3 py-2"
                      aria-label="increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Line total</p>
                    <p className="text-lg font-semibold">RM {item.line_total}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-sm font-semibold text-red-600 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <CartSummary cart={cart ?? null} selectedItems={selectedCartItems} onCheckout={handleCheckout} />
      </div>
    </section>
  );
}
