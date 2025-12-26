"use client";

import Link from "next/link";

export type RedeemModalState = {
  status: "success" | "error";
  title: string;
  description?: string;
  rewardType?: "product" | "voucher";
  voucherCode?: string | null;
  details?: Array<{ label: string; value: string }>;
};

type RedeemModalAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
};

type RedeemModalProps = {
  state: RedeemModalState;
  onClose: () => void;
  actions?: RedeemModalAction[];
};

export function RedeemModal({ state, onClose, actions = [] }: RedeemModalProps) {
  const isSuccess = state.status === "success";

  const renderAction = (action: RedeemModalAction, index: number) => {
    const className = `inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
      action.variant === "secondary"
        ? "border border-[var(--card-border)] bg-[var(--card)] text-[color:var(--text-muted)] hover:border-[var(--muted)]"
        : "bg-[var(--accent-strong)] text-white shadow-sm hover:bg-[var(--accent-stronger)]"
    }`;

    if (action.href) {
      return (
        <Link key={`${action.label}-${index}`} href={action.href} className={className} onClick={onClose}>
          {action.label}
        </Link>
      );
    }

    return (
      <button
        key={`${action.label}-${index}`}
        type="button"
        onClick={() => {
          action.onClick?.();
          onClose();
        }}
        className={className}
      >
        {action.label}
      </button>
    );
  };

  const isProduct = state.rewardType === "product";
  const isVoucher = state.rewardType === "voucher";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" role="dialog" aria-modal>
      <div className="w-full max-w-sm rounded-2xl bg-[var(--card)] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p
              className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                isSuccess ? "text-[color:var(--status-success)]" : "text-[color:var(--status-error)]"
              }`}
            >
              {isSuccess ? "Redeem Successful" : "Redeem Failed"}
            </p>
            
            {/* For PRODUCT: description first, then title */}
            {isProduct && (
              <>
                {state.description && <p className="mt-2 text-sm text-[color:var(--text-muted)]">{state.description}</p>}
                <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{state.title}</h3>
              </>
            )}
            
            {/* For VOUCHER: description first, then title */}
            {isVoucher && (
              <>
                {state.description && <p className="mt-2 text-sm text-[color:var(--text-muted)]">{state.description}</p>}
                <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{state.title}</h3>
              </>
            )}
            
            {/* For other types: title first, then description */}
            {!isProduct && !isVoucher && (
              <>
                <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{state.title}</h3>
                {state.description && <p className="mt-1 text-sm text-[color:var(--text-muted)]">{state.description}</p>}
              </>
            )}
            
            {state.details && state.details.length > 0 && (
              <div className="mt-1 space-y-2 text-sm text-[color:var(--text-muted)]">
                {state.details.map((detail) => (
                  <div key={detail.label} className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-[0.08em] text-[var(--accent-strong)]">{detail.label}</span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">{detail.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[color:var(--text-muted)] transition hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
            aria-label="Close redeem modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {actions.map((action, index) => renderAction(action, index))}
          </div>
        )}
      </div>
    </div>
  );
}
