"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { lookupBookingOrder, uploadBookingOrderSlip, type BookingOrderLookupResponse } from "@/lib/apiClient";

type Props = {
  orderNo: string;
  orderId?: number | null;
  paymentMethod?: string | null;
};

export default function ThankYouClient({ orderNo, orderId, paymentMethod }: Props) {
  const [order, setOrder] = useState<BookingOrderLookupResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await lookupBookingOrder(orderNo, orderId ?? undefined);
      setOrder(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to load booking details.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, orderNo]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const isManualTransfer = (paymentMethod ?? order?.payment_method) === "manual_transfer";
  const latestUpload = useMemo(() => {
    if (!order?.uploads?.length) return null;
    return order.uploads[order.uploads.length - 1];
  }, [order?.uploads]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center text-[var(--foreground)]">
      <h1 className="text-3xl font-semibold">Thank you for your booking!</h1>

      <p className="mt-4 text-sm text-[var(--foreground)]/80">
        Your booking number is <span className="font-mono font-semibold">{orderNo}</span>.
      </p>

      {isLoading && <p className="mt-4 text-sm text-[var(--foreground)]/70">Loading booking details...</p>}
      {error && <p className="mt-4 text-sm text-[color:var(--status-error)]">{error}</p>}

      {order && (
        <div className="mt-6 space-y-4 text-left text-sm text-[var(--foreground)]">
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)]/90 p-4 shadow-sm">
            <p className="font-medium">Booking Summary</p>
            <div className="mt-2 space-y-2 text-[var(--foreground)]/80">
              <div className="flex items-center justify-between">
                <span className="text-[var(--foreground)]/70">Amount</span>
                <span className="font-semibold">RM {Number(order.grand_total).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--foreground)]/70">Status</span>
                <span className="rounded-full bg-[var(--muted)]/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
                  {order.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--foreground)]/70">Payment Status</span>
                <span className="rounded-full bg-[var(--muted)]/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
                  {order.payment_status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--foreground)]/70">Payment Method</span>
                <span className="font-medium">{(order.payment_provider || "").includes("billplz") ? "Billplz" : "Manual Transfer"}</span>
              </div>
            </div>
          </div>

          {isManualTransfer && (
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)]/90 p-4 shadow-sm">
              <p className="font-medium">Manual Bank Transfer</p>
              {order.bank_account ? (
                <div className="mt-2 space-y-1 text-[var(--foreground)]/80">
                  <p><span className="font-semibold">Bank:</span> {order.bank_account.bank_name}</p>
                  <p><span className="font-semibold">Account Name:</span> {order.bank_account.account_name}</p>
                  <p><span className="font-semibold">Account Number:</span> {order.bank_account.account_no ?? order.bank_account.account_number}</p>
                  {order.bank_account.qr_image_url && (
                    <div className="mt-3 h-32 w-32 overflow-hidden rounded border border-[var(--card-border)] bg-[var(--card)]">
                      <Image src={order.bank_account.qr_image_url} alt="Bank QR" width={128} height={128} className="h-full w-full object-contain" />
                    </div>
                  )}
                  {order.bank_account.instructions && (
                    <p className="whitespace-pre-wrap text-[var(--foreground)]/70">{order.bank_account.instructions}</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-[var(--foreground)]/70">Bank information will be shared by our team.</p>
              )}

              <div className="mt-4 space-y-2">
                <p className="text-xs text-[var(--foreground)]/80">Upload your bank-in slip</p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !order.order_id) return;
                    setIsUploading(true);
                    setError(null);
                    try {
                      await uploadBookingOrderSlip(order.order_id, order.order_no, file);
                      await loadOrder();
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : "Failed to upload payment slip.");
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                />
                {latestUpload ? (
                  <p className="text-xs text-[var(--foreground)]/70">
                    Current slip: <a href={latestUpload.file_url} className="underline" target="_blank" rel="noreferrer">View</a>
                  </p>
                ) : null}
                {isUploading ? <p className="text-xs text-[var(--foreground)]/70">Uploading...</p> : null}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="rounded-full border px-4 py-2">Continue browsing</Link>
        <Link href="/account/bookings" className="rounded-full bg-[var(--accent)] px-4 py-2 text-white">My Bookings</Link>
      </div>
    </main>
  );
}
