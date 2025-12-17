"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
    if (applied) setShowVoucherModal(false);
  };

  const handleVoucherChange = (value: string) => {
    setVoucherCode(value);
    clearVoucherFeedback();
  };

  // ✅ 如果你的 totals 里面有 discount/shipping/grand_total 就用；没有就 fallback
  const safeTotals = useMemo(() => {
    const subtotal = Number(totals?.subtotal ?? 0);
    const discount = Number((totals as any)?.discount_total ?? 0);
    const shipping = Number((totals as any)?.shipping_fee ?? 0);
    const grand = Number((totals as any)?.grand_total ?? subtotal - discount + shipping);

    return { subtotal, discount, shipping, grand };
  }, [totals]);

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

  const allSelected = items.length > 0 && selectedItemIds.length === items.length;
  const selectedCount = selectedItems.length;

  const gridCols =
  "md:grid-cols-[24px_minmax(260px,1fr)_130px_150px_150px_64px]";


  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-[var(--foreground)] pb-24 md:pb-8">
      <h1 className="mb-4 text-2xl font-semibold">Shopping Cart</h1>

      <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
        {/* Left */}
        <div className="space-y-4">
          {/* Whole “sticky list” container */}
          <div className="overflow-hidden rounded-lg border border-[var(--muted)] bg-white/85 shadow-sm">
            {/* Header row */}
            <div className="bg-white/90 px-4 py-3">
              <div className={`grid items-center gap-3 md:gap-4 ${gridCols}`}>

                {/* checkbox column */}
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={allSelected}
                    onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                  />
                </div>

                {/* Product header — 对齐 image */}
                <div className="text-sm font-medium text-[var(--foreground)]/80">
                  Product
                  <span className="ml-2 text-xs text-[var(--foreground)]/60">
                    ({selectedItemIds.length}/{items.length})
                  </span>
                </div>

                <div className="hidden md:block text-right text-xs text-[var(--foreground)]/60">
                  Unit Price
                </div>
                <div className="hidden md:block text-center text-xs text-[var(--foreground)]/60">
                  Qty
                </div>
                <div className="hidden md:block text-right text-xs text-[var(--foreground)]/60">
                  Subtotal
                </div>
                <div className="hidden md:block text-right text-xs text-[var(--foreground)]/60">
                  Action
                </div>
              </div>
            </div>

            {/* Divider under header */}
            <div className="h-px bg-[var(--muted)]" />

            {/* Items */}
            <div>
              {items.map((item, idx) => {
                const product = (item as any).product ?? {};
                const slug = (item as any).product_slug ?? product.slug;
                const name = (item as any).product_name ?? item.name;
                const sku = (item as any).sku;
                const unitPrice = Number((item as any).unit_price ?? 0);
                const lineTotal = Number(
                  (item as any).line_total ?? unitPrice * Number(item.quantity ?? 1)
                );

                const mainImage =
                  (item as any).product_image ||
                  (item as any).product_image_path ||
                  product.images?.find((img: any) => img.is_main)?.image_path ||
                  product.images?.[0]?.image_path;

                const checked = selectedItemIds.includes(item.id);
                const isLast = idx === items.length - 1;

                return (
                  <div
                    key={item.id}
                    className={[
                      "px-4 py-3",
                      !isLast ? "border-b border-[var(--muted)]" : "",
                    ].join(" ")}
                  >
                    <div className={`grid items-center gap-3 md:gap-4 ${gridCols}`}>
                      {/* checkbox */}
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={() => toggleSelectItem(item.id)}
                        />
                      </div>

                      {/* product cell */}
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-[var(--muted)]">
                          {mainImage ? (
                            <Image src={mainImage} alt={name} fill className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--foreground)]/50">
                              No Image
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          {slug ? (
                            <Link
                              href={`/product/${slug}`}
                              className="block truncate text-sm font-semibold text-[var(--foreground)] hover:underline"
                            >
                              {name}
                            </Link>
                          ) : (
                            <div className="truncate text-sm font-semibold">{name}</div>
                          )}

                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--foreground)]/60">
                            {sku && <span>SKU: {sku}</span>}
                            {(item as any).variant_label && <span>{(item as any).variant_label}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Unit price */}
                      <div className="text-right">
                        <div className="md:hidden text-[11px] text-[var(--foreground)]/60">Unit</div>
                        <div className="text-sm font-medium">RM {unitPrice.toFixed(2)}</div>
                      </div>

                      {/* Qty */}
                      <div className="flex justify-end md:justify-center">
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
                                Math.max(1, Number(e.target.value) || 1)
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
                      </div>

                      {/* Subtotal */}
                      <div className="text-right">
                        <div className="md:hidden text-[11px] text-[var(--foreground)]/60">Subtotal</div>
                        <div className="text-sm font-semibold">RM {lineTotal.toFixed(2)}</div>
                      </div>

                      {/* Action */}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-[#c26686] transition hover:bg-[#c26686]/10 hover:text-[var(--accent-strong)]"
                          title="Remove"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right summary (Desktop sticky) */}
        <aside className="hidden md:block">
          <div className="sticky top-24 rounded-lg border border-[var(--muted)] bg-white/90 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Order Summary</h2>
                <p className="mt-0.5 text-xs text-[var(--foreground)]/60">
                  {selectedCount === 0 ? "Select items to checkout." : `Selected: ${selectedCount} item${selectedCount > 1 ? "s" : ""}`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  clearVoucherFeedback();
                  setVoucherCode(appliedVoucher?.code ?? "");
                  setShowVoucherModal(true);
                }}
                className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)]"
              >
                Voucher
              </button>
            </div>

            {/* Applied voucher pill */}
            {appliedVoucher && (
              <div className="mt-3 flex items-center justify-between rounded-md border border-[var(--muted)] bg-[var(--muted)]/15 px-3 py-2">
                <div className="text-xs">
                  <div className="font-semibold text-[var(--foreground)]/80">Applied Voucher</div>
                  <div className="text-[var(--foreground)]/60">{appliedVoucher.code}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    removeVoucher();
                    setVoucherCode("");
                  }}
                  className="rounded-md border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-white"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Pricing */}
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--foreground)]/70">Subtotal</span>
                <span className="font-medium">RM {safeTotals.subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-[var(--foreground)]/70">Discount</span>
                <span className="font-medium">- RM {safeTotals.discount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-[var(--foreground)]/70">Shipping</span>
                <span className="font-medium">RM {safeTotals.shipping.toFixed(2)}</span>
              </div>
            </div>

            {/* Total */}
            <div className="mt-4 rounded-lg border border-[var(--muted)] bg-[var(--muted)]/15 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">To Pay</span>
                <span className="text-lg font-bold">RM {safeTotals.grand.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout */}
            <button
              type="button"
              onClick={() => router.push("/checkout")}
              disabled={selectedCount === 0}
              className="mt-4 w-full rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {selectedCount === 0 ? "Select items to checkout" : `Proceed to Checkout (${selectedCount})`}
            </button>

          </div>
        </aside>

      </div>

      {/* Mobile bottom checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--muted)] bg-white/95 p-3 shadow-[0_-6px_20px_rgba(0,0,0,0.06)] md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-1">
          {/* Left: total info */}
          <div className="min-w-0">
            <div className="text-xs text-[var(--foreground)]/60">
              Selected {selectedCount} item{selectedCount === 1 ? "" : "s"}
            </div>

            <div className="truncate text-base font-semibold">
              Total: RM {safeTotals.grand.toFixed(2)}
            </div>

            <button
              type="button"
              onClick={() => {
                clearVoucherFeedback();
                setVoucherCode(appliedVoucher?.code ?? "");
                setShowVoucherModal(true);
              }}
              className="mt-0.5 text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              {appliedVoucher ? `Voucher: ${appliedVoucher.code} (Change)` : "Apply voucher"}
            </button>
          </div>

          {/* Right: actions */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/checkout")}
              disabled={selectedCount === 0}
              className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>



      {/* Voucher modal */}
      {showVoucherModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            // click outside to close
            if (e.target === e.currentTarget) setShowVoucherModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-4 text-[var(--foreground)] shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Voucher</h3>
                <p className="mt-0.5 text-xs text-[var(--foreground)]/60">
                  Enter your voucher code to apply discount.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="rounded-md px-2 py-1 text-sm text-[var(--foreground)]/70 transition hover:bg-[var(--muted)]/40 hover:text-[var(--accent)]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {voucherError && (
                <div className="rounded-lg border border-[#c26686]/30 bg-[#c26686]/10 px-3 py-2 text-xs text-[#c26686]">
                  Error: {voucherError}
                </div>
              )}


              <input
                type="text"
                value={voucherCode}
                onChange={(e) => handleVoucherChange(e.target.value)}
                placeholder="e.g. NEW10"
                className="w-full rounded-lg border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10"
              />

              <button
                type="button"
                onClick={handleApplyVoucher}
                disabled={isApplyingVoucher || !voucherCode.trim()}
                className="w-full rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplyingVoucher ? "Applying..." : "Apply"}
              </button>


              {/* {voucherMessage && !appliedVoucher && (
                <div className="rounded-lg border border-[var(--muted)] bg-[var(--muted)]/20 px-3 py-2 text-xs text-[var(--foreground)]/70">
                  {voucherMessage}
                </div>
              )} */}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
