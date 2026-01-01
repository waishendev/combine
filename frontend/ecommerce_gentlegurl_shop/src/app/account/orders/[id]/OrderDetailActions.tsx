"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder, completeOrder, payOrder } from "@/lib/apiClient";
import UploadReceiptModal from "@/components/orders/UploadReceiptModal";

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
  paymentMethod,
  reserveExpiresAt,
}: OrderDetailActionsProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completeSuccess, setCompleteSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const statusKey = status.toLowerCase();
  const paymentStatusKey = paymentStatus.toLowerCase();
  const reserveExpiry = reserveExpiresAt ? new Date(reserveExpiresAt) : null;
  const remainingSeconds = reserveExpiry ? Math.max(0, Math.floor((reserveExpiry.getTime() - now) / 1000)) : null;
  const isExpired = remainingSeconds !== null && remainingSeconds === 0;
  const canPay = statusKey === "pending" && paymentStatus === "unpaid" && !isExpired;
  const canComplete =
    (statusKey === "ready_for_pickup" && paymentStatusKey === "paid") || statusKey === "shipped";
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

  const handleComplete = async () => {
    setCompleteError(null);
    setCompleteSuccess(null);

    if (!window.confirm("Confirm you have received/picked up this order?")) {
      return;
    }

    setIsCompleting(true);
    try {
      await completeOrder(orderId);
      setCompleteSuccess("Order marked as completed.");
      router.refresh();
    } catch (error) {
      const message =
        typeof error === "object" && error && "data" in (error as never)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any).data?.message as string | undefined) ?? "Unable to complete this order."
          : "Unable to complete this order.";
      setCompleteError(message);
    } finally {
      setIsCompleting(false);
    }
  };

  if (!canPay && !showCancelled && !showProcessing && !canComplete) {
    return null;
  }

  return (
    <>
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
              className="inline-flex items-center gap-2 rounded-full border border-[var(--status-error-border)] px-4 py-2 text-xs font-semibold uppercase text-[color:var(--status-error)] transition hover:border-[var(--status-error)] hover:bg-[var(--status-error-bg)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCancelling ? "Cancelling..." : "Cancel"}
            </button>
          </>
        ) : showProcessing ? (
          <>
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
        ) : canComplete ? (
          <button
            type="button"
            onClick={handleComplete}
            disabled={isCompleting}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCompleting ? "Completing..." : "Mark as Completed"}
          </button>
        ) : (
          <span className="text-xs font-semibold uppercase text-[color:var(--status-error)]">Cancelled</span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-[color:var(--status-error)]">{error}</p>}
      {completeError && <p className="mt-2 text-xs text-[color:var(--status-error)]">{completeError}</p>}
      {completeSuccess && <p className="mt-2 text-xs text-[color:var(--status-success)]">{completeSuccess}</p>}
      <UploadReceiptModal
        isOpen={showSlipModal}
        orderId={orderId}
        onClose={() => setShowSlipModal(false)}
        onSuccess={() => {
          setShowSlipModal(false);
          router.refresh();
        }}
      />
    </>
  );
}
