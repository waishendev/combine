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

  const renderTierBadge = (tier: LoyaltyTier) => {
    if (tier.code === currentTierCode) {
      return (
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
          Current
        </span>
      );
    }
    if (tier.code === nextTierCode) {
      return (
        <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Next Tier
        </span>
      );
    }
    return null;
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-2xl border border-pink-50 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#ec4899]">Membership</p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">Membership Tiers</h1>
            <p className="mt-1 text-sm text-gray-600">
              Track your tier, multipliers, and benefits. This page is public—log in to see your personal progress.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/rewards"
              className="inline-flex items-center justify-center rounded-full border border-pink-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-[#ec4899] hover:text-[#ec4899]"
            >
              Rewards Center
            </Link>
            {customer ? (
              <button
                type="button"
                onClick={() => void refreshProfile()}
                disabled={isLoading}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                  isLoading
                    ? "cursor-not-allowed bg-pink-300"
                    : "bg-[#ec4899] hover:bg-[#db2777]"
                }`}
              >
                {isLoading ? "Refreshing..." : "Refresh overview"}
              </button>
            ) : (
              <Link
                href="/login?redirect=/membership"
                className="inline-flex items-center justify-center rounded-full bg-[#ec4899] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#db2777]"
              >
                Login
              </Link>
            )}
          </div>
        </div>

        {customer ? (
          <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-sm text-emerald-900 shadow-inner">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Current Tier</p>
                <h2 className="mt-1 text-2xl font-semibold text-gray-900">
                  {customer.loyalty.current_tier?.name ?? "—"}
                </h2>
                <p className="mt-1 text-sm text-gray-700">
                  Multiplier x{customer.loyalty.current_tier?.multiplier ?? 1} · Product discount{" "}
                  {(customer.loyalty.current_tier?.product_discount_percent ?? 0).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Next Tier
                </p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {nextTierName ?? "Top tier reached"}
                </p>
                {nextTierName && (
                  <p className="text-xs text-gray-600">
                    {amountToNextTier > 0
                      ? `${formatCurrency(amountToNextTier)} more to upgrade`
                      : "Keep shopping to upgrade"}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                <span>Progress</span>
                <span>{progressPercent.toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-2 rounded-full bg-[#ec4899] transition-[width]"
                  style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-pink-200 bg-white/70 p-5 text-sm text-gray-700">
            Log in to see your current tier, progress, and next milestone.
          </div>
        )}
      </div>

      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Tier Benefits</h2>
          {loadingTiers && <span className="text-xs text-gray-500">Loading tiers…</span>}
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.code}
              className="flex h-full flex-col justify-between rounded-2xl border border-pink-50 bg-white/80 p-4 shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">{tier.code}</p>
                    <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
                  </div>
                  {tier.badge_image_url ? (
                    <div className="relative h-12 w-12 overflow-hidden rounded-full bg-pink-50">
                      <Image src={tier.badge_image_url} alt={tier.name} fill className="object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-50 text-xs font-semibold text-[#ec4899]">
                      {(tier.name || tier.code).charAt(0)}
                    </div>
                  )}
                </div>
                {renderTierBadge(tier)}
                <p className="text-sm text-gray-700">
                  Multiplier <span className="font-semibold">x{tier.multiplier.toFixed(2)}</span>
                </p>
                <p className="text-sm text-gray-700">
                  Product discount <span className="font-semibold">{tier.product_discount_percent.toFixed(1)}%</span>
                </p>
                <p className="text-sm text-gray-700">
                  Min spend: <span className="font-semibold">{formatCurrency(tier.min_spend)}</span>
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>Badge</span>
                <span className="font-semibold">{tier.badge_image_url ? "Available" : "Not set"}</span>
              </div>
            </div>
          ))}
        </div>

        {!loadingTiers && tiers.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-pink-100 bg-white/70 px-6 py-8 text-center text-sm text-gray-600">
            No membership tiers configured yet.
          </div>
        )}
      </section>
    </main>
  );
}
