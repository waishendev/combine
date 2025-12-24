"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPaymentSlip } from "@/lib/apiClient";

type UploadSlipFormProps = {
  orderId: number | string;
  variant?: "page" | "embedded";
  onSuccess?: () => void;
  onCancel?: () => void;
};

export default function UploadSlipForm({
  orderId,
  variant = "page",
  onSuccess,
  onCancel,
}: UploadSlipFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setIsSubmitting(true);
    try {
      await uploadPaymentSlip(Number(orderId), file, note.trim() || undefined);

      setSuccessMessage("Slip uploaded successfully.");
      setFile(null);
      setNote("");
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload slip.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[var(--muted)] bg-white/80 p-4 shadow-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
          Bank-in Slip
        </label>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          rows={3}
          placeholder="Add a note for this payment slip"
        />
      </div>

      {error && (
        <div className="rounded bg-[var(--muted)] px-3 py-2 text-xs text-[#b8527a]">{error}</div>
      )}
      {successMessage && (
        <div className="rounded bg-[var(--muted)] px-3 py-2 text-xs text-[#7a4d63]">
          {successMessage}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Uploading..." : "Upload Slip"}
        </button>
        {variant === "page" ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded border border-[var(--accent)] px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/70"
          >
            Go Back
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onCancel?.()}
            className="rounded border border-[var(--accent)] px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/70"
          >
            Close
          </button>
        )}
      </div>
    </form>
  );

  if (variant === "embedded") {
    return content;
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12 text-[var(--foreground)]">
      <h1 className="text-2xl font-semibold">Upload Payment Slip</h1>
      <p className="mt-2 text-sm text-[var(--foreground)]/70">
        Order ID: <span className="font-mono">{orderId}</span>
      </p>
      <div className="mt-6">{content}</div>
    </main>
  );
}
