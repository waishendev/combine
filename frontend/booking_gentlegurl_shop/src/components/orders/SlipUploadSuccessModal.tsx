"use client";

type SlipUploadSuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderNo?: string | null;
  amount?: string | number | null;
  entityLabel?: "order" | "booking";
};

function formatAmount(amount?: string | number | null) {
  if (amount === undefined || amount === null || String(amount).trim() === "") return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return `RM ${value.toFixed(2)}`;
}

export default function SlipUploadSuccessModal({
  isOpen,
  onClose,
  orderNo,
  amount,
  entityLabel = "order",
}: SlipUploadSuccessModalProps) {
  if (!isOpen) return null;

  const amountLabel = formatAmount(amount);
  const nextLabel = entityLabel === "booking" ? "booking" : "order";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-0 backdrop-blur-sm sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slip-upload-success-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-2xl border border-[var(--input-border)] bg-[var(--card)] shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative px-6 pb-6 pt-8 text-center sm:px-8 sm:pb-8 sm:pt-10">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-90"
            style={{
              background: "radial-gradient(ellipse at top, rgba(16, 185, 129, 0.18), transparent 70%)",
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
            Upload successful
          </p>
          <h3
            id="slip-upload-success-title"
            className="relative mt-2 text-2xl font-semibold tracking-tight text-[var(--accent-stronger)]"
          >
            Waiting for approval
          </h3>
          <p className="relative mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
            We&apos;ve received your payment slip. Our team will review it and confirm your {nextLabel} shortly.
            You can safely leave this page.
          </p>

          {(amountLabel || orderNo) && (
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
              {orderNo ? (
                <div className={`flex items-center justify-between gap-3 ${amountLabel ? "mt-2 border-t border-[var(--input-border)] pt-2" : ""}`}>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {entityLabel === "booking" ? "Booking" : "Order"}
                  </span>
                  <span className="truncate font-mono text-sm font-medium text-[var(--foreground)]">{orderNo}</span>
                </div>
              ) : null}
            </div>
          )}

          <ol className="relative mt-5 space-y-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]/60 px-4 py-4 text-left">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                1
              </span>
              <p className="text-sm leading-snug text-[var(--foreground)]/85">Your slip has been submitted.</p>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                2
              </span>
              <p className="text-sm leading-snug text-[var(--foreground)]/85">
                Our team is verifying the payment — this usually takes a short while.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--input-border)] bg-[var(--card)] text-[10px] font-bold text-[var(--accent-strong)]">
                3
              </span>
              <p className="text-sm leading-snug text-[var(--foreground)]/85">
                Once approved, your {nextLabel} status will update automatically.
              </p>
            </li>
          </ol>

          <div className="relative mt-7">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-[var(--accent-stronger)]"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
