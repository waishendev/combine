"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { submitReturnTracking } from "@/lib/shop-api";

export function ReturnTrackingForm({ returnId }: { returnId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const tracking = String(formData.get("tracking") || "").trim();
    if (!tracking) {
      setError("Please enter a tracking number");
      return;
    }
    setSubmitting(true);
    try {
      await submitReturnTracking(returnId, tracking);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to submit tracking");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-white p-4 text-sm shadow-sm">
      <div className="font-semibold text-slate-800">Provide return shipping tracking</div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <input name="tracking" className="w-full rounded border px-3 py-2" placeholder="Tracking number" />
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit tracking"}
      </button>
    </form>
  );
}
