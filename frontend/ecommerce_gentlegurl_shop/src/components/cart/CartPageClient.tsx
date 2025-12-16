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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-[var(--foreground)] pb-24 md:pb-8">
      <h1 className="mb-4 text-2xl font-semibold">Shopping Cart</h1>

      <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
        {/* Left */}
        <div className="space-y-4">
          {/* Header row (Shopee-like) */}
          <div className="rounded-lg border border-[var(--muted)] bg-white/80 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]/80">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={allSelected}
                  onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                />
                <span className="font-medium">
                  Select All ({selectedItemIds.length}/{items.length})
                </span>
              </label>

              <div className="hidden md:grid md:grid-cols-3 md:gap-6 text-xs text-[var(--foreground)]/60">
                <div className="text-right">Unit Price</div>
                <div className="text-center">Qty</div>
                <div className="text-right">Subtotal</div>
              </div>
            </div>

            {selectedItemIds.length === 0 && items.length > 0 && (
              <div className="mt-2 text-xs text-[#c26686]">No item selected</div>
            )}
          </div>

          {/* Items */}
          <div className="space-y-3">
            {items.map((item) => {
              const product = (item as any).product ?? {};
              const slug = (item as any).product_slug ?? product.slug;
              const name = (item as any).product_name ?? item.name;
              const sku = (item as any).sku;
              const unitPrice = Number((item as any).unit_price ?? 0);
              const lineTotal = Number((item as any).line_total ?? unitPrice * Number(item.quantity ?? 1));

              const mainImage =
                (item as any).product_image ||
                (item as any).product_image_path ||
                product.images?.find((img: any) => img.is_main)?.image_path ||
                product.images?.[0]?.image_path;

              const checked = selectedItemIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-[var(--muted)] bg-white/85 shadow-sm"
                >
                  <div className="flex gap-3 p-4">
                    {/* checkbox */}
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={() => toggleSelectItem(item.id)}
                      />
                    </div>

                    {/* image */}
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-[var(--muted)]">
                      {mainImage ? (
                        <Image src={mainImage} alt={name} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--foreground)]/50">
                          No Image
                        </div>
                      )}
                    </div>

                    {/* info + pricing columns */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        {/* left info */}
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

                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--foreground)]/60">
                            {sku && <span>SKU: {sku}</span>}
                            {/* Placeholder variant line (if you have variant data later) */}
                            {(item as any).variant_label && <span>{(item as any).variant_label}</span>}
                          </div>

                        </div>

                        {/* right: pricing */}
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 md:min-w-[340px]">
                          {/* unit */}
                          <div className="text-right">
                            <div className="text-[11px] text-[var(--foreground)]/60 md:hidden">
                              Unit
                            </div>
                            <div className="text-sm font-medium">
                              RM {unitPrice.toFixed(2)}
                            </div>
                          </div>

                          {/* qty */}
                          <div className="flex justify-end md:justify-center">
                            <div className="flex items-center rounded border border-[var(--muted)] bg-white/70">
                              <button
                                type="button"
                                className="px-3 py-1 text-sm"
                                onClick={() => updateItemQuantity(item.id, Math.max(1, item.quantity - 1))}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                className="w-12 border-x border-[var(--muted)] px-2 py-1 text-center text-sm outline-none"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItemQuantity(item.id, Math.max(1, Number(e.target.value) || 1))
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

                          {/* subtotal */}
                          <div className="text-right">
                            <div className="text-[11px] text-[var(--foreground)]/60 md:hidden">
                              Subtotal
                            </div>
                            <div className="text-sm font-semibold">
                              RM {lineTotal.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* remove row */}
                      <div className="mt-3 flex items-center justify-between border-t border-[var(--muted)]/60 pt-3">

                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-xs font-semibold text-[#c26686] transition hover:text-[var(--accent-strong)]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right summary (Desktop sticky) */}
        <aside className="hidden md:block">
          <div className="sticky top-24 rounded-lg border border-[var(--muted)] bg-white/85 p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>

            <div className="space-y-2 text-sm">
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

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal (Selected)</span>
                <span>RM {safeTotals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>- RM {safeTotals.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping Fee</span>
                <span>RM {safeTotals.shipping.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 flex justify-between border-t pt-4 text-sm font-semibold">
              <span>To Pay</span>
              <span>RM {safeTotals.grand.toFixed(2)}</span>
            </div>

            <button
              type="button"
              onClick={() => router.push("/checkout")}
              disabled={selectedCount === 0}
              className="mt-6 w-full rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {selectedCount === 0 ? "Select items to checkout" : `Proceed to Checkout (${selectedCount})`}
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile bottom checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--muted)] bg-white/95 p-3 shadow-[0_-6px_20px_rgba(0,0,0,0.06)] md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <div className="text-xs text-[var(--foreground)]/60">
              Selected {selectedCount} item{selectedCount === 1 ? "" : "s"}
            </div>
            <div className="truncate text-base font-semibold">
              Total: RM {safeTotals.grand.toFixed(2)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/checkout")}
            disabled={selectedCount === 0}
            className="shrink-0 rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Checkout
          </button>
        </div>
      </div>

      {/* Voucher modal (same as yours) */}
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
