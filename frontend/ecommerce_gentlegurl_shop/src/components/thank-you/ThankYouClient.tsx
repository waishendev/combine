"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { lookupOrder, uploadPaymentSlip, OrderLookupResponse } from "@/lib/apiClient";
import { useCart } from "@/contexts/CartContext";

type Props = {
  orderNo: string;
  orderId?: number | null;
  paymentMethod?: string | null;
};

export default function ThankYouClient({ orderNo, orderId, paymentMethod }: Props) {
  const [order, setOrder] = useState<OrderLookupResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { reloadCart } = useCart();

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await lookupOrder(orderNo, orderId);
      setOrder(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to load order details.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, orderNo]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (order?.payment_status === "paid") {
      void reloadCart();
    }
  }, [order?.payment_status, reloadCart]);

  const latestUpload = useMemo(() => {
    if (!order?.uploads?.length) return null;
    return order.uploads[order.uploads.length - 1];
  }, [order?.uploads]);

  const openModal = () => {
    setIsModalOpen(true);
    setUploadError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setNote("");
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setUploadError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (file && file.type.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleUpload = async () => {
    if (!order || !selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      await uploadPaymentSlip(order.order_id, selectedFile, note.trim() || undefined);
      setUploadMessage("Slip submitted • Pending verification");
      closeModal();
      void loadOrder();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload payment slip.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const isManualTransfer = (paymentMethod ?? order?.payment_method) === "manual_transfer";
  const isBillplzPayment = (paymentMethod ?? order?.payment_method)?.startsWith("billplz");
  const paymentProvider = order?.payment_provider ?? (isBillplzPayment ? "billplz" : "manual");
  const isPaid = order?.payment_status === "paid";

  // Status display logic based on new requirements
  const displayStatus = useMemo(() => {
    if (!order) return "";
    const statusKey = order.status ? order.status.toLowerCase() : "";
    const paymentStatusKey = order.payment_status ? order.payment_status.toLowerCase() : "";
    
    if (statusKey === "cancelled") {
      return "Cancelled";
    }
    if (paymentStatusKey === "failed") {
      return "Payment Failed";
    }
    if (statusKey === "reject_payment_proof" && paymentStatusKey === "unpaid") {
      return "Payment Proof Rejected";
    }
    if (statusKey === "pending" && paymentStatusKey === "unpaid") {
      return "Awaiting Payment";
    }
    if (statusKey === "processing" && paymentStatusKey === "unpaid") {
      return "Waiting for Verification";
    }
    if (statusKey === "confirmed" && paymentStatusKey === "paid") {
      return "Payment Confirmed";
    }
    if (statusKey === "processing" && paymentStatusKey === "paid") {
      return "Preparing";
    }
    if (statusKey === "ready_for_pickup" && paymentStatusKey === "paid") {
      return "Ready for Pickup";
    }
    if (statusKey === "shipped") {
      return "Shipped";
    }
    if (statusKey === "completed") {
      return "Completed";
    }
    return order.status;
  }, [order]);

  const badgeStyle = useMemo(() => {
    if (!order) return "bg-[var(--muted)]/60 text-[var(--foreground)] border-transparent";
    const statusKey = order.status ? order.status.toLowerCase() : "";
    const paymentStatusKey = order.payment_status ? order.payment_status.toLowerCase() : "";
    
    if (statusKey === "cancelled" || paymentStatusKey === "failed" || (statusKey === "reject_payment_proof" && paymentStatusKey === "unpaid")) {
      return "bg-[var(--status-error-bg)] text-[color:var(--status-error)] border-[var(--status-error-border)]";
    }
    if ((statusKey === "pending" && paymentStatusKey === "unpaid") || (statusKey === "processing" && paymentStatusKey === "unpaid")) {
      return "bg-[var(--status-warning-bg)] text-[color:var(--status-warning-text)] border-[var(--status-warning-border)]";
    }
    if ((statusKey === "confirmed" && paymentStatusKey === "paid") || (statusKey === "processing" && paymentStatusKey === "paid") || (statusKey === "ready_for_pickup" && paymentStatusKey === "paid") || statusKey === "shipped" || statusKey === "completed") {
      return "bg-[var(--status-success-bg)] text-[color:var(--status-success)] border-[var(--status-success-border)]";
    }
    return "bg-[var(--muted)]/60 text-[var(--foreground)] border-transparent";
  }, [order]);

  // Check if status is Payment Confirmed or Cancelled
  const isPaymentConfirmed = useMemo(() => {
    if (!order) return false;
    const statusKey = order.status ? order.status.toLowerCase() : "";
    const paymentStatusKey = order.payment_status ? order.payment_status.toLowerCase() : "";
    return statusKey === "confirmed" && paymentStatusKey === "paid";
  }, [order]);

  const isCancelled = useMemo(() => {
    if (!order) return false;
    const statusKey = order.status ? order.status.toLowerCase() : "";
    return statusKey === "cancelled";
  }, [order]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center text-[var(--foreground)]">
      <h1 className="text-3xl font-semibold">Thank you for your order!</h1>

      <p className="mt-4 text-sm text-[var(--foreground)]/80">
        Your order number is <span className="font-mono font-semibold">{orderNo}</span>.
      </p>

      {isLoading && <p className="mt-4 text-sm text-[var(--foreground)]/70">Loading order details...</p>}
      {error && <p className="mt-4 text-sm text-[color:var(--status-error)]">{error}</p>}

      {order && (
        <div className="mt-6 space-y-4 text-left text-sm text-[var(--foreground)]">
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)]/90 p-4 shadow-sm">
            <p className="font-medium">Order Summary</p>
            <div className="mt-2 space-y-2 text-[var(--foreground)]/80">
              <div className="flex items-center justify-between">
                <span className="text-[var(--foreground)]/70">Amount</span>
                <span className="font-semibold">RM {Number(order.grand_total).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--foreground)]/70">Status</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeStyle}`}>
                  {displayStatus}
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
                <span className="font-medium">
                  {paymentProvider === "billplz" ? "Billplz" : "Manual Transfer"}
                </span>
              </div>
            </div>

            {/* {!isPaid && (
              <div className="mt-3 flex flex-col gap-2 rounded-md bg-[var(--muted)]/40 p-3 text-xs text-[var(--foreground)]/80 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Payment is still processing{isBillplzPayment ? " • Billplz may take a few seconds to confirm." : "."}
                </p>
                <button
                  type="button"
                  onClick={() => void loadOrder()}
                  className="w-full rounded bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)] sm:w-auto"
                >
                  Refresh Status
                </button>
              </div>
            )} */}
          </div>

          {isManualTransfer && (
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)]/90 p-4 shadow-sm">
              <p className="font-medium">Manual Bank Transfer</p>
              {order.bank_account ? (
                <div className="mt-2 space-y-1 text-[var(--foreground)]/80">
                  <p>
                    <span className="font-semibold">Bank:</span> {order.bank_account.bank_name}
                  </p>
                  <p>
                    <span className="font-semibold">Account Name:</span> {order.bank_account.account_name}
                  </p>
                  <p>
                    <span className="font-semibold">Account Number:</span> {order.bank_account.account_no ?? order.bank_account.account_number}
                  </p>
                  {/* {order.bank_account.branch && (
                    <p>
                      <span className="font-semibold">Branch:</span> {order.bank_account.branch}
                    </p>
                  )}
                  {order.bank_account.swift_code && (
                    <p>
                      <span className="font-semibold">SWIFT:</span> {order.bank_account.swift_code}
                    </p>
                  )} */}
                  {order.bank_account.qr_image_url && (
                    <div className="mt-3 h-32 w-32 overflow-hidden rounded border border-[var(--card-border)] bg-[var(--card)]">
                      <Image
                        src={order.bank_account.qr_image_url}
                        alt="Bank QR"
                        width={128}
                        height={128}
                        className="h-full w-full object-contain"
                      />
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
                {!isPaymentConfirmed && (
                  <>
                    {!latestUpload && (
                      <p className="text-xs text-[var(--foreground)]/80">Upload your bank-in slip</p>
                    )}
                    {!latestUpload && (
                      <button
                        type="button"
                        onClick={openModal}
                        className="w-full rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
                      >
                        Upload Slip
                      </button>
                    )}
                    {latestUpload && (
                      <div className="text-xs text-[var(--foreground)]/70 space-y-1">
                        <p>Latest upload: {latestUpload.created_at}</p>
                        {!isCancelled && (
                          <>
                            <p className="font-medium text-[var(--accent-strong)]">Slip submitted • Pending verification</p>
                            <button
                              type="button"
                              onClick={openModal}
                              className="mt-2 w-full rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
                            >
                              Reupload Slip
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {!isManualTransfer && (
            <p className="text-center text-sm text-[var(--foreground)]/80">
              If you completed the online payment, you will receive an email confirmation shortly.
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-center gap-3 text-sm">
        <Link
          href="/shop"
          className="rounded border border-[var(--accent)] bg-[var(--card)]/80 px-4 py-2 text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/70"
        >
          Continue Shopping
        </Link>
        <Link
          href="/account/orders"
          className="rounded bg-[var(--accent)] px-4 py-2 text-white transition-colors hover:bg-[var(--accent-strong)]"
        >
          View My Orders
        </Link>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
          <div className="w-full max-w-2xl rounded-lg bg-[var(--card)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--muted)] px-6 py-4">
              <h3 className="text-lg font-semibold text-[var(--accent-strong)]">Upload Payment Slip</h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-1 text-[var(--accent-strong)] transition hover:bg-[var(--background-soft)]"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="flex flex-col gap-6 md:flex-row">
              {/* Left side - Preview */}
              <div className="w-full md:w-1/2">
                <div className="space-y-3">
                  <p className="text-left text-xs text-[color:var(--status-error)]">
                    * Required
                  </p>
                  <div className="h-48 w-full overflow-hidden rounded-lg border border-[var(--muted)] bg-[var(--background-soft)] flex items-center justify-center">
                    {previewUrl ? (
                      <Image
                        src={previewUrl}
                        alt="Slip preview"
                        width={192}
                        height={192}
                        className="h-full w-full object-contain"
                        unoptimized
                      />
                      
                    ) : selectedFile && !previewUrl ? (
                      <div className="text-center p-4">
                        <p className="text-sm font-medium text-[var(--accent-strong)] break-words break-all">{selectedFile.name}</p>
                        <p className="text-xs text-[var(--accent-strong)] mt-1">PDF file selected</p>
                      </div>
                    ) : (
                      <div className="text-center p-4">
                        <svg className="mx-auto h-12 w-12 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-[var(--accent-strong)] mt-2">No file chosen</p>
                      </div>
                    )}
                  </div>
                  
                  <label className="block cursor-pointer">
                    
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    <div className="w-full rounded-lg border border-[var(--muted)] bg-[var(--background-soft)] px-4 py-2 text-center text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--muted)]">
                      {selectedFile ? "Choose Different File" : "Choose File"}
                    </div>
                  </label>
                  {selectedFile && (
                    <p className="text-center text-xs text-[color:var(--text-muted)] break-words break-all px-2">
                      {selectedFile.name}
                    </p>
                  )}

                  <p className="text-center text-xs text-[color:var(--status-error)] opacity-70">
                    * Accepted: jpg, jpeg, png, webp, pdf (max 5MB)
                  </p>
                </div>
              </div>

              {/* Right side - Form */}
              <div className="w-full md:w-1/2 space-y-4">
                <div>
                  <label className="block text-left text-sm">
                    <span className="block text-[var(--accent-stronger)] font-medium mb-2">Note (Optional)</span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add any additional notes about your payment..."
                      className="mt-1 h-32 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm leading-relaxed focus:border-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 resize-none"
                    />
                  </label>
                </div>

                {uploadError && (
                  <div className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2">
                    <p className="text-xs text-[color:var(--status-error)]">{uploadError}</p>
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Footer - Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-[var(--muted)] px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[var(--muted)]/40"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUploading ? "Uploading..." : "Confirm Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
