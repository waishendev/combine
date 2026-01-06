"use client";

import { useState } from "react";

import Image from "next/image";
import Link from "next/link";

import type { OrderTrackingResponse } from "@/lib/apiClient";
import { trackGuestOrder } from "@/lib/apiClient";
import { getPrimaryProductImage } from "@/lib/productMedia";

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not shipped yet";
  const date = new Date(value);
  return date.toLocaleString();
};

export default function TrackingPage() {
  const [orderNo, setOrderNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderTrackingResponse["data"] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await trackGuestOrder({ order_no: orderNo});
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
      <div className="rounded-3xl bg-[var(--card)]/80 p-6 shadow-sm ring-1 ring-[var(--card-border)]">
        <h1 className="text-2xl font-semibold text-[var(--accent-strong)]">Track your order</h1>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Order Number
            </label>
            <input
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--foreground)] shadow-inner focus:border-[var(--accent-strong)] focus:outline-none"
              placeholder="e.g. ORD2025..."
            />
          </div>

          <div className="  items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[var(--accent-strong)] px-5 py-2 text-white shadow hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Checking..." : "Track Order"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error)]">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-4 rounded-3xl bg-[var(--card)]/90 p-6 shadow-sm ring-1 ring-[var(--card-border)]">
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
            <div className="flex items-center gap-2 sm:col-span-2">
              <span className="font-semibold text-[var(--foreground)]">Shipped At:</span>
              <span>{formatDateTime(result.shipped_at)}</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--muted)]">
            <div className="divide-y divide-[var(--background-soft)]">
              {/* Table Header */}
              <div className="bg-[var(--background-soft)] hidden grid-cols-12 gap-4 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/70 sm:grid">
                <div className="col-span-6">Items</div>
                <div className="col-span-2 text-right">Unit</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Subtotal</div>
              </div>
              {/* Table Rows */}
              {result.items.map((item, idx) => {
                const imageUrl = getPrimaryProductImage(item);

                return (
                  <div
                    key={`${item.product_name}-${idx}`}
                    className="grid grid-cols-12 gap-4 px-4 py-3 sm:items-center"
                  >
                    <div className="col-span-12 flex items-center gap-3 sm:col-span-6">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--muted)]">
                        <Image
                          src={imageUrl}
                          alt={item.product_name}
                          width={48}
                          height={48}
                          className="h-12 w-12 object-cover"
                        />
                      </div>
                      <div className="font-medium text-[var(--foreground)]">{item.product_name}</div>
                    </div>
                    <div className="col-span-6 text-right text-sm text-[var(--foreground)]/70 sm:col-span-2 sm:text-right">
                      <span className="sm:hidden">Unit: </span>
                      RM {Number(item.unit_price).toFixed(2)}
                    </div>
                    <div className="col-span-6 text-right text-sm text-[var(--foreground)]/70 sm:col-span-2 sm:text-right">
                      <span className="sm:hidden">Qty: </span>
                      {item.quantity}
                    </div>
                    <div className="col-span-12 text-right font-semibold text-[var(--foreground)] sm:col-span-2">
                      <span className="sm:hidden">Subtotal: </span>
                      RM {Number(item.line_total).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* <p className="text-xs text-[var(--foreground)]/60">
            Need help? Contact us via <Link href="/contact" className="text-[var(--accent-strong)] underline">support</Link>.
          </p> */}
        </div>
      )}
    </div>
  );
}
