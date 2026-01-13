"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LoyaltyTier, getMembershipTiers } from "@/lib/apiClient";

export default function MembershipPage() {
  const { customer, refreshProfile, isLoading } = useAuth();
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [loadingTiers, setLoadingTiers] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTiers = async () => {
      setLoadingTiers(true);
      setError(null);
      try {
        const data = await getMembershipTiers();
        setTiers(data);
      } catch (err) {
        console.error("[membership] Failed to load tiers", err);
        setError("Unable to load membership tiers right now. Please try again later.");
      } finally {
        setLoadingTiers(false);
      }
    };

    void loadTiers();
  }, []);

  const currentTierCode = customer?.loyalty.current_tier?.code;
  const nextTierCode = customer?.loyalty.spending.next_tier?.code ?? null;
  const progressPercent = customer?.loyalty.spending.progress_percent ?? 0;
  const amountToNextTier = customer?.loyalty.spending.amount_to_next_tier ?? 0;
  const nextTierName = customer?.loyalty.spending.next_tier?.name ?? null;

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
        minimumFractionDigits: 2,
      }),
    [],
  );

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined) return "—";
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return "—";
    return currencyFormatter.format(numeric);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-2xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent-strong)]">Membership</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">Membership Tiers</h1>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Explore membership tiers, earning multipliers, and exclusive benefits
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/rewards"
              className="inline-flex items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
            >
              Rewards Center
            </Link>
          </div>
        </div>
      </div>

      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Tier Benefits</h2>
          {loadingTiers && <span className="text-xs text-[color:var(--text-muted)]">Loading tiers…</span>}
        </div>

        {error && (
          <div className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[color:var(--status-warning-text)]">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.code}
              className="flex h-full flex-col justify-between rounded-2xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-4 shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {/* <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">{tier.code}</p> */}
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">{tier.name}</h3>
                  </div>
                  {/* {tier.badge_image_url ? (
                    <div className="relative h-12 w-12 overflow-hidden rounded-full bg-[var(--background-soft)]">
                      <Image src={tier.badge_image_url} alt={tier.name} fill className="object-contain" />
                    </div>
                  ) 
                  : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--background-soft)] text-xs font-semibold text-[var(--accent-strong)]">
                      {(tier.name || tier.code).charAt(0)}
                    </div>
                  )} */}
                </div>
                <p className="text-sm text-[color:var(--text-muted)]">
                  Earns{" "}
                  <span className="font-semibold">
                    {(tier.multiplier * 1).toFixed(2)} pts / RM
                  </span>
                </p>
                <p className="text-sm text-[color:var(--text-muted)]">
                  Min spend: <span className="font-semibold">{formatCurrency(tier.min_spend)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {!loadingTiers && tiers.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-[var(--card-border)] bg-[var(--card)]/70 px-6 py-8 text-center text-sm text-[color:var(--text-muted)]">
            No membership tiers configured yet.
          </div>
        )}
      </section>
    </main>
  );
}
