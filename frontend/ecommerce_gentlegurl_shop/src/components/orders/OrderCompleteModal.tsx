"use client";

type OrderCompleteModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export default function OrderCompleteModal({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onConfirm,
}: OrderCompleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--muted)] px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--accent-strong)]">Mark as Completed</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[var(--accent-strong)] transition hover:bg-[var(--background-soft)]"
            aria-label="Close"
            disabled={isSubmitting}
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
        <div className="space-y-4 px-6 py-4 text-sm text-[var(--foreground)]/80">
          <p>Confirm you have received/picked up this order?</p>
          {error && (
            <div className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error)]">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--muted)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]/40 disabled:opacity-60"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Completing..." : "Mark as Completed"}
          </button>
        </div>
      </div>
    </div>
  );
}
