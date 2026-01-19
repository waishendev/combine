"use client";

import { useEffect, useMemo, useState } from "react";
import { getPublicVoucherDetail, type PublicVoucherDetail } from "@/lib/apiClient";

type VoucherDetailsModalProps = {
  open: boolean;
  onClose: () => void;
  voucherId: number | null;
};

const scopeLabels: Record<string, string> = {
  all: "Storewide",
  products: "Specific Products",
  categories: "Specific Categories",
};

const formatAmount = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return "N/A";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return String(value);
  return `RM ${parsed.toFixed(2)}`;
};

export default function VoucherDetailsModal({
  open,
  onClose,
  voucherId,
}: VoucherDetailsModalProps) {
  const [voucher, setVoucher] = useState<PublicVoucherDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !voucherId) {
      setVoucher(null);
      setError(null);
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);

    getPublicVoucherDetail(voucherId)
      .then((data) => {
        if (!isActive) return;
        setVoucher(data);
      })
      .catch(() => {
        if (!isActive) return;
        setError("Unable to load voucher details.");
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [open, voucherId]);

  const scopeLabel = scopeLabels[voucher?.scope_type ?? "all"] ?? "Storewide";
  const discountLabel = useMemo(() => {
    if (!voucher) return "N/A";
    const value = voucher.value ?? 0;
    if (voucher.type === "percent") {
      return `${value}% off`;
    }
    return `${formatAmount(value)} off`;
  }, [voucher]);

  const validityLabel = useMemo(() => {
    if (!voucher) return "N/A";
    if (!voucher.start_at && !voucher.end_at) return "No expiry";
    const start = voucher.start_at ?? "-";
    const end = voucher.end_at ?? "-";
    return `${start} - ${end}`;
  }, [voucher]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-[var(--card)] p-5 text-[var(--foreground)] shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--card-border)] pb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">Voucher Details</p>
            {/* <h2 className="text-lg font-semibold">{voucher?.code ?? "Voucher"}</h2> */}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--card-border)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]/70 transition hover:text-[var(--foreground)]"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="py-6 text-sm text-[var(--foreground)]/70">Loading details...</div>
        ) : error ? (
          <div className="py-6 text-sm text-[color:var(--status-error)]">{error}</div>
        ) : voucher ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[var(--foreground)]/60">Discount</p>
                <p className="font-semibold text-[var(--foreground)]">{discountLabel}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground)]/60">Min spend</p>
                <p className="font-semibold text-[var(--foreground)]">
                  {formatAmount(voucher.min_order_amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground)]/60">Validity</p>
                <p className="font-semibold text-[var(--foreground)]">{validityLabel}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground)]/60">Scope</p>
                <span className="inline-flex rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]/70">
                  {scopeLabel}
                </span>
              </div>
            </div>

            {voucher.scope_type === "products" && (
              <div>
                <p className="text-xs font-semibold text-[var(--foreground)]/70">Eligible products</p>
                <ul className="mt-2 space-y-1 text-xs text-[var(--foreground)]/70">
                  {voucher.products && voucher.products.length > 0 ? (
                    voucher.products.map((product) => (
                      <li key={product.id} className="flex items-center justify-between gap-2">
                        <span>{product.name ?? "Unnamed product"}</span>
                        <span className="text-[var(--foreground)]/50">{product.sku ?? "-"}</span>
                      </li>
                    ))
                  ) : (
                    <li>No products assigned.</li>
                  )}
                </ul>
              </div>
            )}

            {voucher.scope_type === "categories" && (
              <div>
                <p className="text-xs font-semibold text-[var(--foreground)]/70">Eligible categories</p>
                <ul className="mt-2 space-y-1 text-xs text-[var(--foreground)]/70">
                  {voucher.categories && voucher.categories.length > 0 ? (
                    voucher.categories.map((category) => (
                      <li key={category.id}>{category.name ?? "Unnamed category"}</li>
                    ))
                  ) : (
                    <li>No categories assigned.</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-sm text-[var(--foreground)]/70">No details available.</div>
        )}
      </div>
    </div>
  );
}
