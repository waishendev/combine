"use client";

import type { CheckoutPreviewVoucher } from "@/lib/apiClient";

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (code?: string) => Promise<void> | void;
  code: string;
  onCodeChange: (value: string) => void;
  isApplying?: boolean;
  voucherError?: string | null;
  voucherMessage?: string | null;
  appliedVoucher?: CheckoutPreviewVoucher | null;
  title?: string;
}

export default function VoucherModal({
  isOpen,
  onClose,
  onApply,
  code,
  onCodeChange,
  isApplying,
  voucherError,
  voucherMessage,
  appliedVoucher,
  title = "Voucher / Discount",
}: VoucherModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[var(--foreground)]/70 hover:text-[var(--accent-strong)]"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Voucher Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                placeholder="Enter voucher"
                className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => onApply(code.trim() || undefined)}
                disabled={isApplying || !code.trim()}
                className="rounded bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplying ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>

          {appliedVoucher && (
            <p className="text-xs text-[var(--foreground)]/80">Voucher {appliedVoucher.code} applied.</p>
          )}
          {voucherMessage && !appliedVoucher && (
            <p className="text-xs text-[var(--foreground)]/70">{voucherMessage}</p>
          )}
          {voucherError && <p className="text-xs text-[#c26686]">{voucherError}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)] hover:border-[var(--accent)]/80"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(code.trim() || undefined)}
            disabled={isApplying || !code.trim()}
            className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApplying ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
