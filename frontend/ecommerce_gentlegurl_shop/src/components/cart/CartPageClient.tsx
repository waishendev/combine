"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import VoucherModal from "@/components/common/VoucherModal";
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

  const allSelected = useMemo(
    () => items.length > 0 && selectedItemIds.length === items.length,
    [items.length, selectedItemIds.length],
  );

  const handleApplyVoucher = async (code?: string) => {
    await applyVoucher(code);
    setVoucherCode(code ?? "");
    setShowVoucherModal(false);
  };

  const openVoucherModal = () => {
    clearVoucherFeedback();
    setShowVoucherModal(true);
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
          <div className="overflow-hidden rounded-lg border border-[var(--muted)] bg-white/85 shadow-sm">
            <div className="grid grid-cols-[60px,2.5fr,1fr,1fr,1fr,70px] items-center gap-2 bg-[var(--muted)]/30 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={allSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      selectAll();
                    } else {
                      clearSelection();
                    }
                  }}
                />
                <span>Select All</span>
              </div>
              <div className="col-span-2">Product</div>
              <div>Unit Price</div>
              <div>Quantity</div>
              <div className="text-right">Total</div>
              <div className="text-right">Action</div>
            </div>

            {items.map((item, index) => {
              const product = item.product ?? {};
              const mainImage =
                item.product_image ||
                product.images?.find((img) => img.is_main)?.image_path ||
                product.images?.[0]?.image_path;

              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-[60px,2.5fr,1fr,1fr,1fr,70px] items-center gap-2 px-4 py-4 text-sm ${index !== 0 ? "border-t border-[var(--muted)]/80" : ""}`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedItemIds.includes(item.id)}
                      onChange={() => toggleSelectItem(item.id)}
                    />
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-[var(--muted)]/70 bg-[var(--muted)]/40">
                      {mainImage ? (
                        <Image src={mainImage} alt={item.name} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--foreground)]/50">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      {product.slug ? (
                        <Link
                          href={`/product/${product.slug}`}
                          className="text-sm font-medium text-[var(--foreground)] hover:underline"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <div className="text-sm font-medium text-[var(--foreground)]">{item.name}</div>
                      )}
                      {item.sku && (
                        <div className="text-xs text-[var(--foreground)]/60">SKU: {item.sku}</div>
                      )}
                    </div>
                  </div>

                  <div className="font-semibold text-[var(--foreground)]">RM {Number(item.unit_price).toFixed(2)}</div>

                  <div className="flex items-center gap-2">
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
                        className="w-14 border-x border-[var(--muted)] px-2 py-1 text-center text-sm outline-none"
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

                  <div className="text-right text-sm font-semibold text-[var(--accent-strong)]">
                    RM {Number(item.line_total).toFixed(2)}
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-[#c26686] transition hover:text-[var(--accent-strong)]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--foreground)]/70">
            <div>
              Selected {selectedItemIds.length}/{items.length}
            </div>
            {selectedItemIds.length === 0 && <span className="text-[#c26686]">No item selected</span>}
          </div>
        </div>

        {/* Summary */}
        <aside className="h-fit rounded-lg border border-[var(--muted)] bg-white/85 p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
          <div className="space-y-3 text-sm">
            <div className="rounded border border-[var(--muted)]/60 bg-[var(--muted)]/20 p-3 text-xs text-[var(--foreground)]/80">
              <p className="font-semibold text-[var(--foreground)]">Shipping</p>
              <p className="mt-1">Default shipping applies. Choose Shipping or Self Pickup during checkout.</p>
              <p className="mt-1 text-[var(--foreground)]/70">{shippingLabel ?? "Flat Rate Shipping"}</p>
            </div>

            <div className="flex items-center justify-between rounded border border-dashed border-[var(--muted)] px-3 py-2">
              <div>
                <p className="text-xs font-medium text-[var(--foreground)]/70">Voucher / Discount</p>
                {appliedVoucher ? (
                  <p className="text-sm text-[var(--accent-strong)]">Applied: {appliedVoucher.code}</p>
                ) : (
                  <p className="text-xs text-[var(--foreground)]/70">Add a voucher to save more.</p>
                )}
                {voucherMessage && !appliedVoucher && (
                  <p className="text-[11px] text-[var(--foreground)]/70">{voucherMessage}</p>
                )}
                {voucherError && <p className="text-[11px] text-[#c26686]">{voucherError}</p>}
              </div>
              <div className="flex items-center gap-2">
                {appliedVoucher && (
                  <button
                    type="button"
                    onClick={removeVoucher}
                    disabled={isApplyingVoucher}
                    className="rounded border border-[var(--accent)] px-3 py-1 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--muted)]/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={openVoucherModal}
                  className="rounded bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Choose Voucher
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2 text-sm">
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

      <VoucherModal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        onApply={handleApplyVoucher}
        code={voucherCode}
        onCodeChange={setVoucherCode}
        isApplying={isApplyingVoucher}
        voucherError={voucherError}
        voucherMessage={voucherMessage}
        appliedVoucher={appliedVoucher ?? null}
        title="Apply Voucher"
      />
    </main>
  );
}
