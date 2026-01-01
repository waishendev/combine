"use client";

import { useState } from "react";

type TrackingFormClientProps = {
  returnId: number;
};

export function TrackingFormClient({ returnId }: TrackingFormClientProps) {
  const [courier, setCourier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/proxy/public/shop/returns/${returnId}/tracking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          return_courier_name: courier,
          return_tracking_no: trackingNo,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.message ?? "Unable to submit tracking details.");
        return;
      }

      setSuccess("Tracking submitted. We'll notify you once we receive the parcel.");
      setCourier("");
      setTrackingNo("");
    } catch (err) {
      setError((err as Error).message ?? "Unable to submit tracking details.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]">Courier Name</label>
        <input
          value={courier}
          onChange={(event) => setCourier(event.target.value)}
          className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm"
          placeholder="e.g. J&T, PosLaju"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]">Tracking Number</label>
        <input
          value={trackingNo}
          onChange={(event) => setTrackingNo(event.target.value)}
          className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm"
          placeholder="Enter tracking number"
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit Tracking"}
      </button>
    </form>
  );
}
