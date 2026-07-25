"use client";

import Link from "next/link";
import { walletMoney } from "@/lib/walletUi";

export type WalletSuccessVariant = "payment_submitted" | "proof_submitted";

export type WalletSuccessState = {
  variant: WalletSuccessVariant;
  amount?: string | number | null;
  reference?: string | null;
  /** Gateway key from redirect / transaction, e.g. billplz_credit_card */
  paymentMethod?: string | null;
};

type Props = {
  state: WalletSuccessState | null;
  onClose: () => void;
  /** When set, shows a secondary link action (e.g. View Wallet Activity on account page). */
  activityHref?: string;
};

function paymentChannelLabel(paymentMethod?: string | null) {
  const key = String(paymentMethod ?? "").toLowerCase();
  if (key.includes("credit_card") || key === "billplz_card" || key.endsWith("_card")) {
    return "credit card";
  }
  if (key.includes("online_banking") || key.includes("fpx") || key === "billplz_fpx") {
    return "online banking";
  }
  return null;
}

function paymentSubmittedDescription(paymentMethod?: string | null) {
  const channel = paymentChannelLabel(paymentMethod);
  if (channel) {
    return `Your ${channel} payment was submitted. Your customer balance will update once the payment is confirmed.`;
  }
  return "Your payment was submitted. Your customer balance will update once the payment is confirmed.";
}

const COPY: Record<WalletSuccessVariant, { eyebrow: string; title: string; description: string }> = {
  payment_submitted: {
    eyebrow: "Top up submitted",
    title: "Payment successful",
    description: "",
  },
  proof_submitted: {
    eyebrow: "Proof received",
    title: "Transfer proof submitted",
    description:
      "We've received your payment slip. Our team will verify it and credit your balance shortly.",
  },
};

export default function WalletSuccessModal({ state, onClose, activityHref }: Props) {
  if (!state) return null;

  const copy = COPY[state.variant];
  const description =
    state.variant === "payment_submitted"
      ? paymentSubmittedDescription(state.paymentMethod)
      : copy.description;
  const amountLabel =
    state.amount !== undefined && state.amount !== null && String(state.amount).trim() !== ""
      ? walletMoney(state.amount)
      : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-0 backdrop-blur-sm sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-success-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-[var(--input-border)] bg-[var(--card)] shadow-2xl sm:rounded-2xl">
        <div className="relative px-6 pb-6 pt-8 text-center sm:px-8 sm:pb-8 sm:pt-10">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-90"
            style={{
              background:
                "radial-gradient(ellipse at top, rgba(16, 185, 129, 0.18), transparent 70%)",
            }}
          />

          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              className="h-8 w-8 text-emerald-600"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <p className="relative mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {copy.eyebrow}
          </p>
          <h3
            id="wallet-success-title"
            className="relative mt-2 text-2xl font-semibold tracking-tight text-[var(--accent-stronger)]"
          >
            {copy.title}
          </h3>
          <p className="relative mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
            {description}
          </p>

          {(amountLabel || state.reference) && (
            <div className="relative mt-6 rounded-xl border border-[var(--input-border)] bg-[var(--background-soft)]/70 px-4 py-4 text-left">
              {amountLabel ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Amount
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-[var(--accent-stronger)]">
                    {amountLabel}
                  </span>
                </div>
              ) : null}
              {state.reference ? (
                <div
                  className={`flex items-center justify-between gap-3 ${amountLabel ? "mt-2 border-t border-[var(--input-border)] pt-2" : ""}`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Reference
                  </span>
                  <span className="truncate text-sm font-medium text-[var(--foreground)]">
                    {state.reference}
                  </span>
                </div>
              ) : null}
            </div>
          )}

          <div className="relative mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)]"
            >
              Done
            </button>
            {activityHref ? (
              <Link
                href={activityHref}
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--background-soft)]"
              >
                View Wallet Activity
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
