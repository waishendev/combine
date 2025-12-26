"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  LoyaltyHistoryEntry,
  LoyaltyHistoryResponse,
  getLoyaltyHistory,
} from "@/lib/apiClient";

type PaginationState = LoyaltyHistoryResponse["pagination"];

export default function PointsHistoryPage() {
  const [entries, setEntries] = useState<LoyaltyHistoryEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getLoyaltyHistory({ page, perPage: pagination.per_page });
      setEntries(response.items ?? []);
      setPagination(response.pagination);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError?.status === 401) {
        setError("Please login to view your points history.");
      } else {
        setError("Unable to load your points history right now. Please try again.");
      }
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.per_page]);

  useEffect(() => {
    void fetchHistory(1);
  }, [fetchHistory]);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > pagination.last_page || loading) return;
    void fetchHistory(nextPage);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Points History</h2>
        <p className="text-sm text-[var(--foreground)]/70">
          Review how you earned and spent loyalty points.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[color:var(--status-warning-text)]">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[var(--muted)] bg-[var(--background)] p-4 shadow-sm">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="h-4 w-32 animate-pulse rounded bg-[var(--muted)]/60" />
                <div className="h-4 w-20 animate-pulse rounded bg-[var(--muted)]/60" />
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--muted)]/60" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--foreground)]/70">
            No points history found yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--muted)]/80">
            {entries.map((entry) => (
              <div key={entry.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{formatType(entry.type)}</p>
                  <p className="text-xs text-[var(--foreground)]/70">{formatMeta(entry.meta)}</p>
                </div>
                <div className="text-sm text-[var(--foreground)]/60 sm:text-right">
                  {new Date(entry.created_at).toLocaleString()}
                </div>
                <div className={`text-right text-lg font-semibold ${entry.points_change >= 0 ? "text-[color:var(--status-success)]" : "text-[color:var(--status-error)]"}`}>
                  {entry.points_change >= 0 ? "+" : ""}
                  {entry.points_change}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--muted)]/80 pt-3 text-sm text-[var(--foreground)]/70">
          <div>
            Page {pagination.current_page} of {pagination.last_page} · {pagination.total} records
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(pagination.current_page - 1)}
              disabled={pagination.current_page <= 1 || loading}
              className="rounded-full border border-[var(--muted)] px-3 py-1 text-sm font-medium text-[var(--foreground)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--accent-strong)] hover:bg-[var(--muted)]/60"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(pagination.current_page + 1)}
              disabled={pagination.current_page >= pagination.last_page || loading}
              className="rounded-full border border-[var(--muted)] px-3 py-1 text-sm font-medium text-[var(--foreground)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--accent-strong)] hover:bg-[var(--muted)]/60"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatType(type: string) {
  const lookup: Record<string, string> = {
    earn: "Earn",
    redeem: "Redeem",
    expire: "Expire",
    adjust: "Adjust",
  };
  return lookup[type] ?? type;
}

function formatMeta(meta: unknown) {
  if (!meta || typeof meta !== "object") return "—";
  const details = meta as Record<string, unknown>;
  if (typeof details.note === "string" && details.note.trim()) return details.note;
  if (typeof details.reward_title === "string") return details.reward_title;
  if (typeof details.reason === "string") return details.reason;
  if (typeof details.source === "string") return details.source;
  if (typeof details.description === "string") return details.description;

  return Object.keys(details).length > 0 ? JSON.stringify(details) : "—";
}
