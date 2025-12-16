"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/contexts/CartContext";

export default function CartPageClient() {
  const router = useRouter();
  const {
    items,
    totals,
    isLoading,
    isApplyingVoucher,
    updateItemQuantity,
    removeItem,
    selectedItems,
    selectedItemIds,
    applyVoucher,
    removeVoucher,
    appliedVoucher,
    voucherError,
    voucherMessage,
    clearVoucherFeedback,
    toggleSelectItem,
    selectAll,
    clearSelection,
    shippingLabel,
  } = useCart();

  const [voucherCode, setVoucherCode] = useState("");
  const [showVoucherModal, setShowVoucherModal] = useState(false);

  useEffect(() => {
    setVoucherCode(appliedVoucher?.code ?? "");
  }, [appliedVoucher]);

  const handleApplyVoucher = async () => {
    const applied = await applyVoucher(voucherCode.trim() || undefined);
    if (applied) {
      setShowVoucherModal(false);
    }
  };

  const handleVoucherChange = (value: string) => {
    setVoucherCode(value);
    clearVoucherFeedback();
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 text-[var(--foreground)]">
        <div className="h-8 w-40 animate-pulse rounded bg-[var(--muted)]" />
        <div className="mt-6 space-y-3">
          <div className="h-24 rounded bg-white/70 shadow-sm" />
          <div className="h-24 rounded bg-white/70 shadow-sm" />
        </div>
      </main>
    );
  }

  if (!items || items.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 text-[var(--foreground)]">
        <h1 className="mb-4 text-2xl font-semibold">Shopping Cart</h1>
        <p className="text-sm text-[var(--foreground)]/70">Your cart is empty.</p>
        <button
          onClick={() => router.push("/shop")}
          className="mt-4 rounded bg-[var(--accent)] px-4 py-2 text-sm text-white transition hover:bg-[var(--accent-strong)]"
        >
          Continue Shopping
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-[var(--foreground)]">
      <h1 className="mb-6 text-2xl font-semibold">Shopping Cart</h1>

      <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
        {/* Cart Items */}
        <div className="space-y-4">
          <div className="mb-3 flex items-center justify-between text-xs text-[var(--foreground)]/70">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={items.length > 0 && selectedItemIds.length === items.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    selectAll();
                  } else {
                    clearSelection();
                  }
                }}
              />
              <span>Select All ({selectedItemIds.length}/{items.length})</span>
            </div>

            {selectedItemIds.length === 0 && items.length > 0 && (
              <span className="text-[#c26686]">No item selected</span>
            )}
          </div>

          {items.map((item) => {
            const product = item.product ?? {};
            const mainImage =
              item.product_image ||
              product.images?.find((img) => img.is_main)?.image_path ||
              product.images?.[0]?.image_path;

            return (
              <div
                key={item.id}
                className="flex gap-4 rounded-lg border border-[var(--muted)] bg-white/85 p-4 shadow-sm"
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => toggleSelectItem(item.id)}
                  />
                </div>

                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-[var(--muted)]">
                  {mainImage ? (
                    <Image
                      src={mainImage}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-[var(--foreground)]/50">
                      No Image
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    {product.slug ? (
                      <Link
                        href={`/product/${product.slug}`}
                        className="text-sm font-medium text-[var(--foreground)] hover:underline"
                      >
                        {item.name}
                      </Link>
                    ) : (
                      <div className="text-sm font-medium">{item.name}</div>
                    )}
                    {item.sku && (
                      <div className="text-xs text-[var(--foreground)]/60">SKU: {item.sku}</div>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center rounded border border-[var(--muted)] bg-white/70">
                      <button
                        type="button"
                        className="px-3 py-1 text-sm"
                        onClick={() =>
                          updateItemQuantity(item.id, Math.max(1, item.quantity - 1))
                        }
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        className="w-12 border-x border-[var(--muted)] px-2 py-1 text-center text-sm outline-none"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItemQuantity(
                            item.id,
                            Math.max(1, Number(e.target.value) || 1),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="px-3 py-1 text-sm"
                        onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>

                    <div className="text-sm font-semibold">
                      RM {Number(item.line_total).toFixed(2)}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-[#c26686] transition hover:text-[var(--accent-strong)]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <aside className="rounded-lg border border-[var(--muted)] bg-white/85 p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="rounded border border-[var(--muted)]/60 bg-[var(--muted)]/20 p-3 text-xs text-[var(--foreground)]/80">
              <p className="font-semibold text-[var(--foreground)]">Shipping</p>
              <p className="mt-1">Default shipping applies. Choose Shipping or Self Pickup during checkout.</p>
              <p className="mt-1 text-[var(--foreground)]/70">{shippingLabel ?? "Flat Rate Shipping"}</p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-[var(--foreground)]/70">Voucher / Discount</div>
                {appliedVoucher && (
                  <p className="text-xs text-[var(--foreground)]/70">Applied: {appliedVoucher.code}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {appliedVoucher && (
                  <button
                    type="button"
                    onClick={() => {
                      removeVoucher();
                      setVoucherCode("");
                    }}
                    className="rounded border border-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]/70"
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    clearVoucherFeedback();
                    setVoucherCode(appliedVoucher?.code ?? "");
                    setShowVoucherModal(true);
                  }}
                  className="rounded bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Voucher / Discount
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>RM {Number(totals.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>- RM {Number(totals.discount_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{shippingLabel ?? "Shipping"}</span>
              <span>RM {Number(totals.shipping_fee).toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 flex justify-between border-t pt-4 text-sm font-semibold">
            <span>To Pay</span>
            <span>RM {Number(totals.grand_total).toFixed(2)}</span>
          </div>

          <button
            type="button"
            onClick={() => router.push("/checkout")}
            disabled={selectedItems.length === 0}
            className="mt-6 w-full rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {selectedItems.length === 0
              ? "Select items to checkout"
              : `Proceed to Checkout (${selectedItems.length})`}
          </button>
        </aside>
      </div>

      {showVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 text-[var(--foreground)] shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Apply Voucher</h3>
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="text-sm text-[var(--foreground)]/70 hover:text-[var(--accent)]"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => handleVoucherChange(e.target.value)}
                placeholder="Enter voucher code"
                className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleApplyVoucher}
                disabled={isApplyingVoucher || !voucherCode.trim()}
                className="w-full rounded bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplyingVoucher ? "Applying..." : "Apply"}
              </button>
              {voucherError && <p className="text-xs text-[#c26686]">{voucherError}</p>}
              {voucherMessage && !appliedVoucher && (
                <p className="text-xs text-[var(--foreground)]/70">{voucherMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
