"use client";

import { CustomerVoucher } from "@/lib/apiClient";

const scopeLabels: Record<string, string> = {
  all: "Storewide",
  products: "Specific Products",
  categories: "Specific Categories",
};

const formatCurrency = (value: number) => `RM ${value.toFixed(2)}`;

type VoucherEntry = {
  voucher: CustomerVoucher;
  minOrderAmount: number;
  minSpendMet: boolean;
  valueLabel: string;
  title: string;
  expiryLabel: string;
};

type VoucherListProps = {
  vouchers: VoucherEntry[];
  selectedVoucherId: number | null;
  onSelectVoucher: (voucherId: number | null) => void;
  onViewDetails: (voucherId: number) => void;
  clearVoucherFeedback?: () => void;
};

export default function VoucherList({
  vouchers,
  selectedVoucherId,
  onSelectVoucher,
  onViewDetails,
  clearVoucherFeedback,
}: VoucherListProps) {
  return (
    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
      {vouchers.map((entry) => {
        const isSelected = selectedVoucherId === entry.voucher.id;
        const isDisabled = !entry.minSpendMet;
        const scopeType = entry.voucher.voucher?.scope_type ?? "all";
        const scopeLabel = scopeLabels[scopeType] ?? "Storewide";
        const detailVoucherId = entry.voucher.voucher?.id ?? null;

        const handleSelectVoucher = () => {
          if (isDisabled) return;
          onSelectVoucher(isSelected ? null : entry.voucher.id);
          clearVoucherFeedback?.();
        };

        return (
          <div
            key={entry.voucher.id}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isDisabled}
            tabIndex={isDisabled ? -1 : 0}
            onClick={handleSelectVoucher}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleSelectVoucher();
              }
            }}
            className={`flex items-start gap-3 rounded-lg border px-3 py-3 transition
              ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--muted)]/70 bg-[var(--card)]"
              }
              ${
                isDisabled
                  ? "cursor-not-allowed border-[var(--muted)]/40 bg-[var(--card)]"
                  : "cursor-pointer hover:border-[var(--accent)]/60"
              }
            `}
          >
            <input
              type="radio"
              name="voucher_choice"
              className={`mt-1 ios-input ${isDisabled ? "opacity-50" : ""}`}
              checked={isSelected}
              disabled={isDisabled}
              onChange={handleSelectVoucher}
            />

            {/* ✅ 只把内容变淡，不动背景 */}
            <div
              className={`flex-1 text-xs ${
                isDisabled ? "text-[var(--foreground)]/55" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={`text-sm font-semibold ${isDisabled ? "opacity-80" : ""}`}>
                  {entry.title}
                </div>

                <span
                  className={`rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-semibold
                    ${isDisabled ? "text-[var(--foreground)]/50" : "text-[var(--foreground)]/70"}
                  `}
                >
                  {scopeLabel}
                </span>
              </div>

              <div className="mt-2 grid gap-1 text-[11px] sm:grid-cols-2">
                <div>
                  <span className={`font-semibold ${isDisabled ? "text-[var(--foreground)]/65" : "text-[var(--foreground)]/80"}`}>
                    Value:
                  </span>{" "}
                  {entry.valueLabel}
                </div>

                <div>
                  <span className={`font-semibold ${isDisabled ? "text-[var(--foreground)]/65" : "text-[var(--foreground)]/80"}`}>
                    Min spend:
                  </span>{" "}
                  {formatCurrency(entry.minOrderAmount)}
                </div>

                <div className="sm:col-span-2">
                  <span className={`font-semibold ${isDisabled ? "text-[var(--foreground)]/65" : "text-[var(--foreground)]/80"}`}>
                    Expiry:
                  </span>{" "}
                  {entry.expiryLabel}
                </div>
              </div>
              {/* ✅ T&C 永远清晰可点，不跟着变淡 */}
              {detailVoucherId && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onViewDetails(detailVoucherId);
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  className="relative z-10 mt-2 inline-flex items-center gap-1
                    text-[11px] font-semibold
                    text-blue-900
                    underline underline-offset-2
                    hover:text-blue-900
                    hover:no-underline cursor-pointer
                    transition-colors"
                >
                  T&amp;C
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
