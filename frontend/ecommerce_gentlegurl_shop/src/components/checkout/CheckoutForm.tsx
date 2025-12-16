"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { createOrder, getBankAccounts, PublicBankAccount } from "@/lib/apiClient";

export default function CheckoutForm() {
  const router = useRouter();
  const {
    selectedItems,
    sessionToken,
    shippingMethod,
    setShippingMethod,
    totals,
    applyVoucher,
    voucherError,
    voucherMessage,
    isApplyingVoucher,
    appliedVoucher,
    shippingLabel,
  } = useCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "manual_transfer" | "billplz_fpx"
  >("manual_transfer");
  const [error, setError] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [bankAccounts, setBankAccounts] = useState<PublicBankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);

  const [form, setForm] = useState({
    shipping_name: "",
    shipping_phone: "",
    shipping_address_line1: "",
    shipping_address_line2: "",
    shipping_city: "",
    shipping_state: "",
    shipping_country: "Malaysia",
    shipping_postcode: "",
  });

  useEffect(() => {
    getBankAccounts()
      .then((accounts) => setBankAccounts(accounts))
      .catch(() => setBankAccounts([]));
  }, []);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyVoucher = async () => {
    await applyVoucher(voucherCode.trim() || undefined);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItems || selectedItems.length === 0) {
      setError("Please select at least one item in your cart.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        items: selectedItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        session_token: sessionToken ?? undefined,
        payment_method: paymentMethod,
        shipping_method: shippingMethod,
        ...form,
      };

      const order = await createOrder(payload);

      if (order.payment_method === "billplz_fpx" && order.payment?.billplz_url) {
        window.location.href = order.payment.billplz_url!;
        return;
      }

      const query = new URLSearchParams({
        order_no: order.order_no,
        order_id: String(order.order_id),
        payment_method: order.payment_method,
      }).toString();

      router.push(`/thank-you?${query}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create order.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedItems || selectedItems.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 text-[var(--foreground)]">
        <h1 className="mb-4 text-2xl font-semibold">Checkout</h1>
        <p className="text-sm text-[var(--foreground)]/70">
          Your cart is empty. Please add items before checking out.
        </p>
      </main>
    );
  }

  const selectedBank = bankAccounts.find((bank) => bank.id === selectedBankId) ?? bankAccounts[0];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-[var(--foreground)]">
      <h1 className="mb-6 text-2xl font-semibold">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid gap-8 md:grid-cols-[2fr,1fr]">
        {/* 左侧：Shipping 信息 */}
        <div className="space-y-4 rounded-lg border border-[var(--muted)] bg-white/80 p-4 shadow-sm">
          <details open className="space-y-3">
            <summary className="cursor-pointer text-lg font-semibold">Shipping Details</summary>

            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                  Full Name
                </label>
                <input
                  required
                  value={form.shipping_name}
                  onChange={(e) => handleChange("shipping_name", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                  Phone
                </label>
                <input
                  required
                  value={form.shipping_phone}
                  onChange={(e) => handleChange("shipping_phone", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                  Address Line 1
                </label>
                <input
                  required={shippingMethod === "shipping"}
                  value={form.shipping_address_line1}
                  onChange={(e) => handleChange("shipping_address_line1", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                  Address Line 2 (Optional)
                </label>
                <input
                  value={form.shipping_address_line2}
                  onChange={(e) => handleChange("shipping_address_line2", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                    City
                  </label>
                  <input
                    required={shippingMethod === "shipping"}
                    value={form.shipping_city}
                    onChange={(e) => handleChange("shipping_city", e.target.value)}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                    State
                  </label>
                  <input
                    required={shippingMethod === "shipping"}
                    value={form.shipping_state}
                    onChange={(e) => handleChange("shipping_state", e.target.value)}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                    Country
                  </label>
                  <input
                    required={shippingMethod === "shipping"}
                    value={form.shipping_country}
                    onChange={(e) => handleChange("shipping_country", e.target.value)}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                    Postcode
                  </label>
                  <input
                    required={shippingMethod === "shipping"}
                    value={form.shipping_postcode}
                    onChange={(e) => handleChange("shipping_postcode", e.target.value)}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* 右侧：Shipping & Payment + 下单按钮 */}
        <aside className="space-y-4 rounded-lg border border-[var(--muted)] bg-white/80 p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Summary</h2>

          <div>
            <div className="mb-1 text-xs font-medium text-[var(--foreground)]/70">
              Shipping Method
            </div>
            <div className="space-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="shipping_method"
                  value="shipping"
                  checked={shippingMethod === "shipping"}
                  onChange={() => setShippingMethod("shipping")}
                />
                <span>Shipping ({shippingLabel ?? "Flat Rate"})</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="shipping_method"
                  value="pickup"
                  checked={shippingMethod === "pickup"}
                  onChange={() => setShippingMethod("pickup")}
                />
                <span>Self Pickup (RM 0)</span>
              </label>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-[var(--foreground)]/70">Voucher</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                placeholder="Enter voucher"
                className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleApplyVoucher}
                disabled={isApplyingVoucher || !voucherCode.trim()}
                className="rounded bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplyingVoucher ? "Applying..." : "Apply"}
              </button>
            </div>
            {appliedVoucher && (
              <p className="mt-1 text-xs text-[var(--foreground)]/70">
                Voucher {appliedVoucher.code} applied.
              </p>
            )}
            {voucherMessage && !appliedVoucher && (
              <p className="mt-1 text-xs text-[var(--foreground)]/70">{voucherMessage}</p>
            )}
            {voucherError && <p className="mt-1 text-xs text-[#c26686]">{voucherError}</p>}
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-[var(--foreground)]/70">
              Payment Method
            </div>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment_method"
                  value="manual_transfer"
                  checked={paymentMethod === "manual_transfer"}
                  onChange={() => setPaymentMethod("manual_transfer")}
                />
                <span>Manual Bank Transfer</span>
              </label>
              {paymentMethod === "manual_transfer" && bankAccounts.length > 0 && (
                <div className="rounded border border-[var(--muted)]/70 bg-[var(--muted)]/20 p-3 text-xs text-[var(--foreground)]">
                  <p className="mb-2 font-medium text-[var(--foreground)]">Choose Bank</p>
                  <div className="space-y-2">
                    {bankAccounts.map((bank) => (
                      <label key={bank.id} className="flex items-start gap-2 rounded border border-transparent p-2 hover:border-[var(--accent)]/60">
                        <input
                          type="radio"
                          name="bank_account"
                          value={bank.id}
                          checked={(selectedBank?.id ?? bankAccounts[0]?.id) === bank.id}
                          onChange={() => setSelectedBankId(bank.id)}
                        />
                        <div>
                          <div className="font-semibold">{bank.bank_name}</div>
                          <div className="text-[var(--foreground)]/70">{bank.account_name}</div>
                          <div className="text-[var(--foreground)]/70">{bank.account_no}</div>
                          {bank.branch && (
                            <div className="text-[var(--foreground)]/60">Branch: {bank.branch}</div>
                          )}
                          {bank.qr_image_url && (
                            <img
                              src={bank.qr_image_url}
                              alt={`${bank.bank_name} QR`}
                              className="mt-2 h-20 w-20 rounded border border-[var(--muted)] object-contain"
                            />
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {paymentMethod === "manual_transfer" && bankAccounts.length === 0 && (
                <p className="text-xs text-[var(--foreground)]/70">
                  Bank transfer instructions will be shared after placing the order.
                </p>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment_method"
                  value="billplz_fpx"
                  checked={paymentMethod === "billplz_fpx"}
                  onChange={() => setPaymentMethod("billplz_fpx")}
                />
                <span>Online Banking (Billplz FPX)</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded bg-[var(--muted)] px-3 py-2 text-xs text-[#b8527a]">
              {error}
            </div>
          )}

          <div className="mt-4 space-y-2 text-sm">
            <p className="text-xs font-medium text-[var(--foreground)]/70">Items in this order:</p>
            <ul className="max-h-32 overflow-auto text-xs text-[var(--foreground)]">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span className="line-clamp-1">{item.name}</span>
                  <span className="ml-2">
                    x{item.quantity} (RM {Number(item.line_total).toFixed(2)})
                  </span>
                </li>
              ))}
            </ul>
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
              <span>{shippingMethod === "shipping" ? shippingLabel ?? "Shipping" : "Self Pickup"}</span>
              <span>RM {Number(totals.shipping_fee).toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-2 flex justify-between border-t pt-3 text-sm font-semibold">
            <span>To Pay</span>
            <span>RM {Number(totals.grand_total).toFixed(2)}</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Placing Order..." : "Place Order"}
          </button>
        </aside>
      </form>
    </main>
  );
}
