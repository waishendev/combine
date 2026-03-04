"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FlushCachePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: { cleared_keys?: string[] };
  } | null>(null);
  const router = useRouter();

  const handleFlushCache = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/proxy/public/shop/homepage/flush-cache?type=booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      setResult(data);
      if (data?.success) {
        router.refresh();
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to flush cache",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8 shadow-sm">
        <h1 className="mb-4 text-2xl font-semibold text-[var(--foreground)]">Clear Booking Homepage Cache</h1>
        <p className="mb-6 text-sm text-[var(--foreground)]/70">
          This clears booking homepage cache only (`type=booking`) so you can verify latest booking settings immediately.
        </p>

        <button
          onClick={handleFlushCache}
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Clearing..." : "Clear Booking Cache"}
        </button>

        {result && (
          <div
            className={`mt-6 rounded-lg border p-4 ${
              result.success
                ? "border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]"
                : "border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] text-[color:var(--status-error)]"
            }`}
          >
            <p className="font-semibold">{result.message}</p>
            {result.data?.cleared_keys && (
              <div className="mt-2 text-xs">
                <p className="font-medium">Cleared cache keys:</p>
                <ul className="mt-1 list-inside list-disc">
                  {result.data.cleared_keys.map((key) => (
                    <li key={key}>{key}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
