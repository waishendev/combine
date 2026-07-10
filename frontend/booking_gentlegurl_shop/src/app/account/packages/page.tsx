"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyServicePackages } from "@/lib/apiClient";
import { formatAccountDateTime } from "@/lib/bookingTime";
import { MyServicePackage } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

function formatStatusLabel(status: string) {
  const normalized = status.trim().replace(/_/g, " ");
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

type PackageBalance = NonNullable<MyServicePackage["balances"]>[number];

function balanceTone(remaining: number, total: number) {
  if (remaining <= 0) {
    return {
      badge: "bg-slate-100 text-slate-600",
      bar: "bg-slate-300",
      label: "Used up",
      ring: "border-slate-200/80",
      showBadge: true,
    };
  }
  if (remaining <= Math.max(1, Math.ceil(total * 0.25))) {
    return {
      badge: "bg-amber-100 text-amber-800",
      bar: "bg-amber-500",
      label: "Low balance",
      ring: "border-amber-200/80",
      showBadge: true,
    };
  }
  return {
    badge: "",
    bar: "bg-emerald-500",
    label: "",
    ring: "border-emerald-200/70",
    showBadge: false,
  };
}

function PackageServiceBalances({ balances }: { balances: PackageBalance[] }) {
  return (
    <div className="mt-4 border-t border-[var(--card-border)] pt-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Service balances</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {balances.length} service{balances.length === 1 ? "" : "s"} included in this package
        </p>
      </div>

      <div className="space-y-3">
        {balances.map((bal) => {
          const total = Math.max(0, Number(bal.total_qty ?? 0));
          const remaining = Math.max(0, Number(bal.remaining_qty ?? 0));
          const progress = total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0;
          const tone = balanceTone(remaining, total);
          const serviceName = bal.booking_service?.name || `Service #${bal.booking_service_id}`;

          return (
            <div
              key={bal.id}
              className={`rounded-2xl border bg-[var(--card)] p-4 shadow-sm transition ${tone.ring}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--foreground)]">{serviceName}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {tone.showBadge ? (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                      {tone.label}
                    </span>
                  ) : null}
                  <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {remaining}<span className="text-[var(--text-muted)]">/{total}</span>
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-[var(--text-muted)]">
                  <span>Remaining sessions</span>
                  <span className="tabular-nums text-[var(--foreground)]">{progress}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--muted)]/50">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MyServicePackagesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<MyServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/account/packages");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMyServicePackages();
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load my service packages");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [user]);

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <>
      <h1 className="text-3xl font-semibold">My Packages</h1>
      {loading ? <p className="mt-4">Loading packages...</p> : null}
      {error ? <p className="mt-4 text-[var(--status-error)]">{error}</p> : null}

      <div className="mt-6 space-y-3">
        {rows.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-5 text-sm text-[var(--text-muted)]">No package purchased yet.</div>
        ) : null}

        {rows.map((row) => {
          const balances = row.balances ?? [];
          const expanded = expandedIds.has(row.id);
          const hasDetails = balances.length > 0;

          return (
            <div key={row.id} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--foreground)]">{row.service_package?.name || `Package #${row.id}`}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Status: <span className="text-[var(--foreground)]">{formatStatusLabel(row.status)}</span>
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Expires: <span className="text-[var(--foreground)]">{formatAccountDateTime(row.expires_at)}</span>
                  </p>
                  {row.started_at ? (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Started: <span className="text-[var(--foreground)]">{formatAccountDateTime(row.started_at)}</span>
                    </p>
                  ) : null}
                </div>

                {hasDetails ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(row.id)}
                    aria-expanded={expanded}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--background)]/40 px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--background)]/70"
                  >
                    <span>{expanded ? "Hide" : "Show"}</span>
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                ) : null}
              </div>

              {hasDetails && expanded ? <PackageServiceBalances balances={balances} /> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
