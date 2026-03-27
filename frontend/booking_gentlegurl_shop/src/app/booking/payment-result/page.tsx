"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getBookingPaymentDetail, payBooking, uploadBookingPaymentSlip } from "@/lib/apiClient";

export default function BookingPaymentResultPage() {
  const params = useSearchParams();
  const bookingId = params.get("booking_id");
  const [data, setData] = useState<{
    booking_id: number;
    booking_code?: string | null;
      booking_status: string;
      payment_status: string;
      amount: number;
      package_claim_status?: "reserved" | "consumed" | "released" | null;
      payment?: {
      id: number;
      status: string;
      provider: string;
      payment_method?: string | null;
      payment_url?: string | null;
      manual_bank_account?: { label?: string | null; bank_name: string; account_name: string; account_number: string; qr_image_url?: string | null; instructions?: string | null; } | null;
      slip_url?: string | null;
        manual_status?: string | null;
      } | null;
      receipt_history?: Array<{
        order_id: number;
        order_number: string;
        line_type: "booking_deposit" | "booking_settlement" | string;
        amount: number;
        payment_method?: string | null;
        paid_at?: string | null;
        receipt_token?: string | null;
        receipt_invoice_url?: string | null;
      }>;
    } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await getBookingPaymentDetail(bookingId);
      setData(detail ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payment detail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [bookingId]);

  const payment = data?.payment;
  const isManual = payment?.payment_method === "manual_transfer";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-4">
      <h1 className="text-3xl font-semibold">Booking Payment Result</h1>

      {loading ? <p>Loading...</p> : null}
      {error ? <p className="text-[var(--status-error)]">{error}</p> : null}

      {data ? (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 space-y-2">
          <p><strong>Booking:</strong> {data.booking_code || data.booking_id}</p>
          <p><strong>Amount:</strong> RM {Number(data.amount || 0).toFixed(2)}</p>
          <p><strong>Booking Status:</strong> {data.booking_status}</p>
          <p><strong>Payment Status:</strong> {data.payment_status}</p>
          <p><strong>Payment Method:</strong> {payment?.payment_method || "-"}</p>
          {data.package_claim_status ? (
            <p><strong>Package Claim:</strong> {data.package_claim_status.toUpperCase()} (covered by package)</p>
          ) : null}

          {isManual && payment?.manual_bank_account ? (
            <div className="mt-4 rounded-lg border p-3 text-sm space-y-1">
              <p className="font-semibold">Manual Transfer Details</p>
              <p>{payment.manual_bank_account.label || payment.manual_bank_account.bank_name}</p>
              <p>{payment.manual_bank_account.account_name} · {payment.manual_bank_account.account_number}</p>
              {payment.manual_bank_account.qr_image_url ? (
                <img src={payment.manual_bank_account.qr_image_url} alt="Bank QR" className="h-32 w-32 rounded-md object-cover" />
              ) : null}
              {payment.manual_bank_account.instructions ? <p>{payment.manual_bank_account.instructions}</p> : null}

              <div className="pt-2">
                <label className="text-sm">Upload payment slip</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !bookingId) return;
                    setUploading(true);
                    try {
                      await uploadBookingPaymentSlip(bookingId, file);
                      await load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Upload failed.");
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
                {payment?.slip_url ? (
                  <p className="mt-2">Current slip: <a href={payment.slip_url} className="underline" target="_blank">View</a></p>
                ) : null}
                <p className="text-xs text-[var(--text-muted)]">{uploading ? "Uploading..." : payment?.manual_status || "pending_manual_review"}</p>
              </div>
            </div>
          ) : null}

          {!isManual && payment?.payment_url && data?.payment_status !== "PAID" ? (
            <button
              className="mt-4 rounded-full bg-[var(--accent-strong)] px-5 py-2 text-white"
              onClick={async () => {
                const resp = await payBooking(data.booking_id, { payment_method: (payment.payment_method || "billplz_fpx") as "billplz_fpx" | "billplz_card" | "manual_transfer" });
                const redirect = resp?.data?.payment_url || payment.payment_url;
                if (redirect) window.location.href = redirect;
              }}
            >
              Pay Now
            </button>
          ) : null}

          <div className="mt-4 rounded-lg border p-3 text-sm space-y-2">
            <p className="font-semibold">Receipts</p>
            {(data.receipt_history?.length ?? 0) === 0 ? (
              <p className="text-[var(--text-muted)]">No receipt available yet.</p>
            ) : (
              <div className="space-y-2">
                {data.receipt_history?.map((receipt) => (
                  <div key={`${receipt.order_id}-${receipt.line_type}`} className="rounded-md border border-[var(--card-border)] p-3">
                    <p><strong>{receipt.order_number}</strong> · {receipt.line_type === "booking_settlement" ? "Remaining Balance" : "Booking Deposit"}</p>
                    <p>Amount: RM {Number(receipt.amount ?? 0).toFixed(2)}</p>
                    <p>Method: {receipt.payment_method || "-"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {receipt.receipt_token ? (
                        <a
                          href={`/receipt/${receipt.receipt_token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border px-3 py-1 text-xs"
                        >
                          Open Page
                        </a>
                      ) : null}
                      {receipt.receipt_invoice_url ? (
                        <a
                          href={receipt.receipt_invoice_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border px-3 py-1 text-xs"
                        >
                          Download PDF
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <Link href="/account/bookings" className="inline-block rounded-full border px-4 py-2">Back to My Bookings</Link>
    </main>
  );
}
