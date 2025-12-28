"use client";

import { useEffect, useState } from "react";
import { CustomerVoucher, getCustomerVouchers } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountVouchersPage() {
  const { customer } = useAuth();
  const [vouchers, setVouchers] = useState<CustomerVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getCustomerVouchers()
    // getCustomerVouchers({ is_reward_only: false })
      .then((data) => {
        setVouchers(data ?? []);
        setError(null);
      })
      .catch(() => setError("Unable to load vouchers. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">My Vouchers</h2>
          <p className="text-sm text-[var(--foreground)]/70">Track your claimed vouchers and usage.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error)]">{error}</div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-16 rounded-lg border border-[var(--card-border)]/60 bg-[var(--muted)]/30" />
          ))}
        </div>
      ) : vouchers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--background)] px-5 py-8 text-center text-sm text-[var(--foreground)]/70">
          {customer ? "You have no vouchers yet." : "Login to view your vouchers."}
        </div>
      ) : (
        <div className="space-y-3">
          {vouchers.map((voucher) => (
            <div
              key={voucher.id}
              className="flex flex-col gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{voucher.voucher?.code ?? "Voucher"}</p>
                <p className="text-xs text-[var(--foreground)]/70">Status: {voucher.status}</p>
                {voucher.expires_at && (
                  <p className="text-xs text-[var(--foreground)]/60">Expires: {new Date(voucher.expires_at).toLocaleString()}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    voucher.status === "active"
                      ? "bg-[var(--status-success-bg)] text-[color:var(--status-success)]"
                      : voucher.status === "used"
                        ? "bg-[var(--muted)] text-[var(--foreground)]/80"
                        : "bg-[var(--status-warning-bg)] text-[color:var(--status-warning-text)]"
                  }`}
                >
                  {voucher.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
