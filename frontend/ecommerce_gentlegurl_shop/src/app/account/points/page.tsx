"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import {
  AccountOverview,
  ApiError,
  LoyaltyReward,
  getLoyaltyRewards,
  redeemLoyaltyReward,
} from "@/lib/apiClient";

type ToastState = { type: "success" | "error" | "info"; message: string };

export default function AccountPointsPage() {
  const { customer, refreshProfile } = useAuth();
  const { reloadCart } = useCart();
  const [overview, setOverview] = useState<AccountOverview | null>(customer);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState<boolean>(true);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(!customer);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const availablePoints = overview?.loyalty.points.available ?? 0;
  const tier = overview?.loyalty.current_tier;
  const spending = overview?.loyalty.spending;
  const nextTier = spending?.next_tier;
  const progressPercent = useMemo(() => {
    const value = spending?.progress_percent ?? 0;
    if (Number.isNaN(value)) return 0;
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
  }, [spending?.progress_percent]);

  const showToast = useCallback((state: ToastState) => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast(state);
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  const refreshOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      await refreshProfile();
    } finally {
      setLoadingOverview(false);
    }
  }, [refreshProfile]);

  const fetchRewards = useCallback(async () => {
    setLoadingRewards(true);
    setRewardsError(null);
    try {
      const data = await getLoyaltyRewards();
      setRewards(data ?? []);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError?.status === 401) {
        setRewardsError("Please login to view available rewards.");
      } else {
        setRewardsError("Unable to load rewards right now. Please try again.");
      }
      setRewards([]);
    } finally {
      setLoadingRewards(false);
    }
  }, []);

  useEffect(() => {
    setOverview(customer ?? null);
  }, [customer]);

  useEffect(() => {
    if (!customer) {
      void refreshOverview();
    } else {
      setLoadingOverview(false);
    }
  }, [customer, refreshOverview]);

  useEffect(() => {
    void fetchRewards();
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, [fetchRewards]);

  const handleRedeem = async (rewardId: number) => {
    setRedeemingId(rewardId);
    try {
      await redeemLoyaltyReward(rewardId);
      showToast({ type: "success", message: "Reward redeemed. Reward added to cart." });
      await refreshOverview();
      await reloadCart();
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError?.status === 401) {
        showToast({ type: "error", message: "Please login to redeem rewards." });
      } else if (apiError?.status === 422) {
        showToast({ type: "error", message: extractApiError(apiError) });
      } else {
        showToast({ type: "error", message: "Unable to redeem this reward right now." });
      }
    } finally {
      setRedeemingId((current) => (current === rewardId ? null : current));
    }
  };

  const loadingSummary = loadingOverview && !overview;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">My Points</h2>
          <p className="text-sm text-[var(--foreground)]/70">
            Track your loyalty balance and redeem exclusive rewards.
          </p>
        </div>
        {toast && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm shadow-sm ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : toast.type === "info"
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--muted)] bg-[var(--background)] p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--foreground)]/60">Available Points</p>
          {loadingSummary ? (
            <div className="mt-3 h-10 w-24 animate-pulse rounded-lg bg-[var(--muted)]/60" />
          ) : (
            <p className="mt-2 text-4xl font-bold text-[var(--accent-strong)]">
              {availablePoints.toLocaleString()}
            </p>
          )}
          <p className="mt-2 text-sm text-[var(--foreground)]/70">
            Points earned: {overview?.loyalty.points.total_earned?.toLocaleString() ?? "-"} · Redeemed:{" "}
            {overview?.loyalty.points.total_redeemed?.toLocaleString() ?? "-"}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--muted)] bg-[var(--background)] p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--foreground)]/60">Current Tier</p>
          {loadingSummary ? (
            <div className="mt-3 h-10 w-28 animate-pulse rounded-lg bg-[var(--muted)]/60" />
          ) : (
            <div className="mt-2 flex items-center gap-3">
              {tier?.badge_image_url ? (
                <div className="relative h-12 w-12 overflow-hidden rounded-full bg-[var(--muted)]/60">
                  <Image src={tier.badge_image_url} alt={tier.name} fill className="object-contain" sizes="48px" />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/15 text-lg font-semibold text-[var(--accent-strong)]">
                  {tier?.name?.charAt(0) ?? "T"}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">{tier?.name ?? "—"}</p>
                <p className="text-xs text-[var(--foreground)]/70">
                  Multiplier x{tier?.multiplier ?? 1} · {tier?.product_discount_percent ?? 0}% off products
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--muted)] bg-[var(--background)] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--foreground)]/60">Next Tier Progress</p>
            <span className="text-xs font-semibold text-[var(--foreground)]/70">{progressPercent}%</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[var(--muted)]/60">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 text-sm text-[var(--foreground)]/70">
            {nextTier ? (
              <p>
                {spending?.amount_to_next_tier
                  ? `Spend ${spending.amount_to_next_tier.toLocaleString()} more to reach ${nextTier.name}.`
                  : `You’re on your way to ${nextTier.name}.`}
              </p>
            ) : (
              <p>You’re enjoying the highest tier perks.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function extractApiError(error: ApiError) {
  const data = error?.data as { message?: string; errors?: Record<string, string[] | string> } | undefined;
  if (data?.errors) {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first)) {
      return first[0];
    }
    if (typeof first === "string") {
      return first;
    }
  }
  if (data?.message) return data.message;
  return "Something went wrong. Please try again.";
}
