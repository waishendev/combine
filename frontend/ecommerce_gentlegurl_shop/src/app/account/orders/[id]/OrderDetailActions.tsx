"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder, payOrder } from "@/lib/apiClient";
import UploadReceiptModal from "@/components/orders/UploadReceiptModal";

type OrderDetailActionsProps = {
  orderId: number;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
};

export function OrderDetailActions({
  orderId,
  status,
  paymentStatus,
  paymentMethod,
}: OrderDetailActionsProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusKey = status.toLowerCase();
  const canPay = statusKey === "pending" && paymentStatus === "unpaid";
  const canUploadSlip =
    paymentMethod === "manual_transfer" &&
    (canPay || (statusKey === "processing" && paymentStatus !== "paid"));
  const isBillplzPayment = paymentMethod?.startsWith("billplz_");
  const showCancelled = statusKey === "cancelled";
  const showProcessing = statusKey === "processing";

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

  const handlePayNow = async () => {
    setError(null);

    if (paymentMethod === "manual_transfer") {
      setShowSlipModal(true);
      return;
    }

    if (!isBillplzPayment) {
      setError("Payment method is not supported.");
      return;
    }

    setIsPaying(true);
    try {
      const response = await payOrder(orderId);
      if (response.redirect_url) {
        window.location.href = response.redirect_url;
      } else {
        setError("Unable to initiate payment.");
      }
    } catch (error) {
      const message =
        typeof error === "object" && error && "data" in (error as never)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any).data?.message as string | undefined) ?? "Unable to initiate payment."
          : "Unable to initiate payment.";
      setError(message);
    } finally {
      setIsPaying(false);
    }
  };

  if (!canPay && !showCancelled && !showProcessing) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--muted)] bg-[var(--background)] p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">Actions</h3>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canPay ? (
          <>
            <button
              type="button"
              onClick={handlePayNow}
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
        ) : showProcessing ? (
          <>
            <span className="text-xs font-semibold uppercase text-amber-600">Waiting for verification</span>
            {canUploadSlip && (
              <button
                type="button"
                onClick={() => setShowSlipModal(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-[var(--accent)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
              >
                Reupload Slip
              </button>
            )}
          </>
        ) : (
          <span className="text-xs font-semibold uppercase text-rose-600">Cancelled</span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <UploadReceiptModal
        isOpen={showSlipModal}
        orderId={orderId}
        onClose={() => setShowSlipModal(false)}
        onSuccess={() => {
          setShowSlipModal(false);
          router.refresh();
        }}
      />
    </div>
  );
}
