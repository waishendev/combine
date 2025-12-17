"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { lookupOrder, uploadPaymentSlip, OrderLookupResponse } from "@/lib/apiClient";

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

  const resolveVerificationStatus = useCallback(
    (uploads?: OrderLookupResponse["uploads"], manualTransfer?: boolean) => {
      if (!manualTransfer) return null;

      const list = uploads ?? [];
      const latest = list[list.length - 1];

      if (!latest) {
        return { code: "awaiting", label: "Awaiting Payment Slip" } as const;
      }

      switch (latest.status) {
        case "pending":
          return { code: "pending", label: "Verification in progress" } as const;
        case "approved":
          return { code: "approved", label: "Verified" } as const;
        case "rejected":
          return { code: "rejected", label: "Rejected (please reupload)" } as const;
        default:
          return { code: "awaiting", label: "Awaiting Payment Slip" } as const;
      }
    },
    [],
  );

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

  const latestUpload = useMemo(() => {
    if (!order?.uploads?.length) return null;
    return order.uploads[order.uploads.length - 1];
  }, [order?.uploads]);

  const isManualTransfer = (paymentMethod ?? order?.payment_method) === "manual_transfer";

  const verificationStatus = useMemo(
    () => resolveVerificationStatus(order?.uploads, isManualTransfer),
    [isManualTransfer, order?.uploads, resolveVerificationStatus],
  );

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
      const response = await uploadPaymentSlip(order.order_id, selectedFile, note.trim() || undefined);

      setOrder(response.data);
      const nextStatus = resolveVerificationStatus(response.data.uploads, true);
      setUploadMessage(
        nextStatus ? `Slip submitted • ${nextStatus.label}` : response.message ?? "Payment slip uploaded.",
      );
      closeModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload payment slip.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center text-[var(--foreground)]">
      <h1 className="text-3xl font-semibold">Thank you for your order!</h1>

      <p className="mt-4 text-sm text-[var(--foreground)]/80">
        Your order number is <span className="font-mono font-semibold">{orderNo}</span>.
      </p>

      {isLoading && <p className="mt-4 text-sm text-[var(--foreground)]/70">Loading order details...</p>}
      {error && <p className="mt-4 text-sm text-[#c26686]">{error}</p>}

      {order && (
        <div className="mt-6 space-y-4 text-left text-sm text-[var(--foreground)]">
          <div className="rounded-lg border border-[var(--muted)] bg-white/80 p-4 shadow-sm">
            <p className="font-medium">Order Summary</p>
            <p className="mt-1 text-[var(--foreground)]/70">Amount: RM {Number(order.grand_total).toFixed(2)}</p>
            <p className="text-[var(--foreground)]/70">
              {isManualTransfer ? (
                <>
                  Verification Status: {verificationStatus?.label ?? "Awaiting Payment Slip"}
                </>
              ) : (
                <>Payment Status: {order.payment_status ?? "unpaid"}</>
              )}
            </p>
          </div>

          {isManualTransfer && (
            <div className="rounded-lg border border-[var(--muted)] bg-white/80 p-4 shadow-sm">
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
                    <div className="mt-3 h-32 w-32 overflow-hidden rounded border border-[var(--muted)] bg-white">
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
                <p className="text-xs text-[var(--foreground)]/80">Upload your bank-in slip</p>
                <button
                  type="button"
                  onClick={openModal}
                  className="w-full rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
                >
                  {latestUpload ? "Reupload Slip" : "Upload Slip"}
                </button>
                {uploadMessage && <p className="text-xs text-[var(--foreground)]/70">{uploadMessage}</p>}
                {latestUpload && (
                  <div className="text-xs text-[var(--foreground)]/70">
                    <p>Latest upload: {latestUpload.created_at}</p>
                    <p className="font-medium text-[var(--accent-strong)]">
                      {verificationStatus?.label ?? "Verification in progress"}
                    </p>
                  </div>
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
          className="rounded border border-[var(--accent)] bg-white/70 px-4 py-2 text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/70"
        >
          Continue Shopping
        </Link>
        <Link
          href="/orders"
          className="rounded bg-[var(--accent)] px-4 py-2 text-white transition-colors hover:bg-[var(--accent-strong)]"
        >
          View My Orders
        </Link>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
          <div className="w-full max-w-md rounded-lg bg-white p-6 text-left shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">Upload Payment Slip</p>
                <p className="text-xs text-[var(--foreground)]/70">Accepted: jpg, jpeg, png, webp, pdf (max 5MB)</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded p-1 text-sm text-[var(--foreground)]/70 hover:bg-[var(--muted)]/70"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />

              {selectedFile && (
                <div className="rounded border border-[var(--muted)] bg-white/80 p-3 text-sm text-[var(--foreground)]/80">
                  <p className="font-medium">Preview</p>
                  {previewUrl ? (
                    <div className="mt-2 overflow-hidden rounded border border-[var(--muted)]">
                      <Image
                        src={previewUrl}
                        alt="Slip preview"
                        width={640}
                        height={480}
                        className="max-h-64 w-full object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <p className="mt-1">{selectedFile.name}</p>
                  )}
                </div>
              )}

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)"
                className="h-20 w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />

              {uploadError && <p className="text-xs text-[#c26686]">{uploadError}</p>}

              <div className="flex justify-end gap-2 text-sm">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded border border-[var(--muted)] px-4 py-2 text-[var(--foreground)] hover:bg-[var(--muted)]/70"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="rounded bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-[var(--muted)]"
                >
                  {isUploading ? "Uploading..." : "Confirm upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
