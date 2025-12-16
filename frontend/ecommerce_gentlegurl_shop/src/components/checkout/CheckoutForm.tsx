"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { createOrder } from "@/lib/apiClient";

export default function CheckoutForm() {
  const router = useRouter();
  const { selectedItems, sessionToken } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "manual_transfer" | "billplz_fpx"
  >("manual_transfer");
  const [shippingMethod, setShippingMethod] = useState<"shipping" | "pickup">(
    "shipping",
  );
  const [error, setError] = useState<string | null>(null);

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

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-[var(--foreground)]">
      <h1 className="mb-6 text-2xl font-semibold">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid gap-8 md:grid-cols-[2fr,1fr]">
        {/* 左侧：Shipping 信息 */}
        <div className="space-y-4 rounded-lg border border-[var(--muted)] bg-white/80 p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Shipping Details</h2>

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
                required
                value={form.shipping_address_line1}
                onChange={(e) =>
                  handleChange("shipping_address_line1", e.target.value)
                }
                className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                Address Line 2 (Optional)
              </label>
              <input
                value={form.shipping_address_line2}
                onChange={(e) =>
                  handleChange("shipping_address_line2", e.target.value)
                }
                className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                  City
                </label>
                <input
                  required
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
                  required
                  value={form.shipping_state}
                  onChange={(e) => handleChange("shipping_state", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-[2fr,1fr] gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                  Country
                </label>
                <input
                  required
                  value={form.shipping_country}
                  onChange={(e) =>
                    handleChange("shipping_country", e.target.value)
                  }
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                  Postcode
                </label>
                <input
                  required
                  value={form.shipping_postcode}
                  onChange={(e) =>
                    handleChange("shipping_postcode", e.target.value)
                  }
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </div>
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
                <span>Shipping</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="shipping_method"
                  value="pickup"
                  checked={shippingMethod === "pickup"}
                  onChange={() => setShippingMethod("pickup")}
                />
                <span>Self Pickup</span>
              </label>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-[var(--foreground)]/70">
              Payment Method
            </div>
            <div className="space-y-1 text-sm">
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
