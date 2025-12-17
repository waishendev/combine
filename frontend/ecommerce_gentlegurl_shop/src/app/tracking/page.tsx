"use client";

import { useState } from "react";

import Link from "next/link";

import type { OrderTrackingResponse } from "@/lib/apiClient";
import { trackGuestOrder } from "@/lib/apiClient";

export default function TrackingPage() {
  const [orderNo, setOrderNo] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderTrackingResponse["data"] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await trackGuestOrder({ order_no: orderNo, email, phone });
      if (!response.success || !response.data) {
        setError(response.message || "Order not found or verification failed.");
        return;
      }

      setResult(response.data);
    } catch (err) {
      console.error(err);
      setError("Unable to find order. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-pink-100">
        <h1 className="text-2xl font-semibold text-[var(--accent-strong)]">Track your order</h1>
        <p className="mt-2 text-sm text-[var(--foreground)]/70">
          Enter your order number and either the email or phone you used during checkout.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Order Number
            </label>
            <input
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              required
              className="w-full rounded-xl border border-pink-100 bg-[var(--background-soft)]/60 px-3 py-2 text-[var(--foreground)] shadow-inner focus:border-[var(--accent-strong)] focus:outline-none"
              placeholder="e.g. ORD2025..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-pink-100 bg-[var(--background-soft)]/60 px-3 py-2 text-[var(--foreground)] shadow-inner focus:border-[var(--accent-strong)] focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Phone (optional)
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-pink-100 bg-[var(--background-soft)]/60 px-3 py-2 text-[var(--foreground)] shadow-inner focus:border-[var(--accent-strong)] focus:outline-none"
              placeholder="0123456789"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[var(--accent-strong)] px-5 py-2 text-white shadow hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Checking..." : "Track Order"}
            </button>
            <p className="text-xs text-[var(--foreground)]/70">
              We need your order number and at least one contact detail to verify.
            </p>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50/70 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-4 rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-pink-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--foreground)]/60">Order</p>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">{result.order_no}</h2>
            </div>
            <span className="rounded-full bg-[var(--muted)] px-4 py-2 text-sm font-medium text-[var(--foreground)]">
              {result.status.replaceAll("_", " ")}
            </span>
          </div>

          <div className="grid gap-3 text-sm text-[var(--foreground)]/80 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--foreground)]">Shipping Method:</span>
              <span className="capitalize">
                {result.shipping_method === "self_pickup" ? "Self Pickup" : "Shipping"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--foreground)]">Shipping Fee:</span>
              <span>RM {Number(result.totals.shipping_fee).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--foreground)]">Discount:</span>
              <span>RM {Number(result.totals.discount_total).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--foreground)]">Total:</span>
              <span className="font-semibold text-[var(--accent-strong)]">
                RM {Number(result.totals.grand_total).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <span className="font-semibold text-[var(--foreground)]">Tracking No:</span>
              <span>{result.tracking_no ?? "Not shipped yet"}</span>
              {result.courier && (
                <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs text-[var(--foreground)]">
                  {result.courier}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-pink-100">
            <div className="bg-[var(--background-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
              Items
            </div>
            <div className="divide-y divide-pink-50">
              {result.items.map((item, idx) => (
                <div key={`${item.product_name}-${idx}`} className="grid gap-2 px-4 py-3 sm:grid-cols-12 sm:items-center">
                  <div className="sm:col-span-6 font-medium text-[var(--foreground)]">{item.product_name}</div>
                  <div className="sm:col-span-2 text-sm text-[var(--foreground)]/70">Qty: {item.quantity}</div>
                  <div className="sm:col-span-2 text-sm text-[var(--foreground)]/70">RM {Number(item.unit_price).toFixed(2)}</div>
                  <div className="sm:col-span-2 text-right font-semibold text-[var(--foreground)]">
                    RM {Number(item.line_total).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-[var(--foreground)]/60">
            Need help? Contact us via <Link href="/contact" className="text-[var(--accent-strong)] underline">support</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
