"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder, payOrder } from "@/lib/apiClient";
import UploadSlipForm from "@/components/orders/UploadSlipForm";

type OrderDetailActionsProps = {
  orderId: number;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  reserveExpiresAt?: string | null;
};

export function OrderDetailActions({
  orderId,
  status,
  paymentStatus,
  paymentMethod = "",
  reserveExpiresAt,
}: OrderDetailActionsProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const reserveExpiry = reserveExpiresAt ? new Date(reserveExpiresAt) : null;
  const isExpired = reserveExpiry ? reserveExpiry.getTime() < Date.now() : false;
  const isManual = paymentMethod === "manual_transfer";
  const isBillplz = paymentMethod.startsWith("billplz");
  const isPendingUnpaid = status === "pending" && paymentStatus === "unpaid" && !isExpired;
  const isProcessing = status === "processing";
  const canPayBillplz = isBillplz && isPendingUnpaid;
  const canUploadSlip = isManual && (isPendingUnpaid || isProcessing);
  const showExpired = status === "cancelled" || isExpired;

  const handleCancel = async () => {
    setError(null);
    setIsCancelling(true);
    try {
      await cancelOrder(orderId);
      router.refresh();
    } catch (error) {
      const message =
        typeof error === "object" && error && "data" in (error as never)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any).data?.message as string | undefined) ?? "Unable to cancel this order."
          : "Unable to cancel this order.";
      setError(message);
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePay = async () => {
    setPaymentError(null);
    setIsPaying(true);
    try {
      const response = await payOrder(orderId);
      if (response.redirect_url) {
        window.location.href = response.redirect_url;
      } else {
        setPaymentError("Unable to start payment. Please try again.");
      }
    } catch (error) {
      const message =
        typeof error === "object" && error && "data" in (error as never)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any).data?.message as string | undefined) ?? "Unable to start payment."
          : "Unable to start payment.";
      setPaymentError(message);
    } finally {
      setIsPaying(false);
    }
  };

  if (!canPayBillplz && !canUploadSlip && !showExpired) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--muted)] bg-[var(--background)] p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">Actions</h3>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canPayBillplz && (
          <>
            <button
              type="button"
              onClick={handlePay}
              disabled={isPaying}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPaying ? "Redirecting..." : "Pay Now"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold uppercase text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCancelling ? "Cancelling..." : "Cancel"}
            </button>
          </>
        )}
        {canUploadSlip && (
          <>
            <button
              type="button"
              onClick={() => setShowSlipModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)]"
            >
              {isProcessing ? "Reupload Slip" : "Upload Slip"}
            </button>
            {isPendingUnpaid && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold uppercase text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancelling ? "Cancelling..." : "Cancel"}
              </button>
            )}
            {isProcessing && (
              <span className="text-xs font-semibold uppercase text-amber-600">
                Waiting for verification
              </span>
            )}
          </>
        )}
        {showExpired && (
          <span className="text-xs font-semibold uppercase text-rose-600">Expired / Cancelled</span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {paymentError && <p className="mt-2 text-xs text-rose-600">{paymentError}</p>}

      {showSlipModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowSlipModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Upload Payment Slip</h3>
                <p className="text-xs text-gray-500">Order #{orderId}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSlipModal(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <UploadSlipForm
              orderId={orderId}
              variant="embedded"
              onSuccess={() => {
                setShowSlipModal(false);
                router.refresh();
              }}
              onCancel={() => setShowSlipModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
