"use client";

import Link from "next/link";

export type RedeemModalState = {
  status: "success" | "error";
  title: string;
  description?: string;
  rewardType?: "product" | "voucher";
  voucherCode?: string | null;
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
        ? "border border-gray-200 bg-white text-gray-700 hover:border-gray-300"
        : "bg-[#ec4899] text-white shadow-sm hover:bg-[#db2777]"
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                isSuccess ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {isSuccess ? "Redeem Successful" : "Redeem Failed"}
            </p>
            <h3 className="mt-1 text-xl font-semibold text-gray-900">{state.title}</h3>
            {state.description && <p className="mt-1 text-sm text-gray-600">{state.description}</p>}
            {state.voucherCode && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span>Voucher Code</span>
                <span className="rounded bg-white px-2 py-1 text-[13px] text-emerald-800">{state.voucherCode}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close redeem modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {actions.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {actions.map((action, index) => renderAction(action, index))}
          </div>
        )}
      </div>
    </div>
  );
}
