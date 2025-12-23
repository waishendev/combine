"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const FILTERS = [
  { value: "all", label: "All" },
  { value: "voucher", label: "Voucher" },
  { value: "product", label: "Product" },
];

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

const PLACEHOLDER = "/images/placeholder.png";

export function RewardsCenter() {
  const router = useRouter();
  const { customer, refreshProfile } = useAuth();
  const { reloadCart } = useCart();

  const [overview, setOverview] = useState<AccountOverview | null>(customer);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(!customer);
  const [hasRequestedOverview, setHasRequestedOverview] = useState<boolean>(false);

  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState<boolean>(true);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const availablePoints = overview?.loyalty.points.available ?? 0;

  const filteredRewards = useMemo(() => {
    if (filter === "all") return rewards;
    return rewards.filter((reward) => reward.type === filter);
  }, [filter, rewards]);

  const syncOverview = useCallback(() => {
    setOverview(customer ?? null);
  }, [customer]);

  useEffect(() => {
    syncOverview();
  }, [syncOverview]);

  useEffect(() => {
    if (customer || hasRequestedOverview) {
      setLoadingOverview(false);
      return;
    }

    setHasRequestedOverview(true);
    setLoadingOverview(true);
    void refreshProfile().finally(() => setLoadingOverview(false));
  }, [customer, hasRequestedOverview, refreshProfile]);

  const fetchRewards = useCallback(async () => {
    setLoadingRewards(true);
    setRewardsError(null);
    try {
      const data = await getLoyaltyRewards();
      setRewards(data ?? []);
    } catch {
      setRewards([]);
      setRewardsError("Unable to load rewards at the moment. Please try again.");
    } finally {
      setLoadingRewards(false);
    }
  }, []);

  useEffect(() => {
    void fetchRewards();

    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, [fetchRewards]);

  const showToast = useCallback((state: ToastState) => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast(state);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const handleRedeem = useCallback(
    async (reward: LoyaltyReward) => {
      if (!customer) {
        showToast({
          type: "info",
          message: "Please log in to redeem rewards.",
          actionLabel: "Login",
          actionHref: "/login?redirect=/rewards",
        });
        router.push("/login?redirect=/rewards");
        return;
      }

      const hasEnoughPoints = availablePoints >= reward.points_required;
      if (!hasEnoughPoints) {
        showToast({ type: "error", message: "You don't have enough points for this reward yet." });
        return;
      }

      setRedeemingId(reward.id);
      try {
        await redeemLoyaltyReward(reward.id);
        await refreshProfile();

        if (reward.type === "product") {
          showToast({
            type: "success",
            message: "Reward added to cart.",
            actionLabel: "View Cart",
            actionHref: "/cart",
          });
          await reloadCart();
        } else if (reward.type === "voucher") {
          showToast({
            type: "success",
            message: "Voucher claimed successfully.",
            actionLabel: "View My Vouchers",
            actionHref: "/account/vouchers",
          });
        } else {
          showToast({ type: "success", message: "Reward redeemed successfully." });
        }
      } catch (error) {
        const apiError = error as ApiError;
        if (apiError?.status === 401) {
          showToast({ type: "error", message: "Please log in to redeem rewards." });
          router.push("/login?redirect=/rewards");
        } else if (apiError?.status === 422) {
          showToast({ type: "error", message: extractApiError(apiError) });
        } else {
          showToast({ type: "error", message: "Unable to redeem this reward right now." });
        }
      } finally {
        setRedeemingId((current) => (current === reward.id ? null : current));
      }
    },
    [availablePoints, customer, refreshProfile, reloadCart, router, showToast],
  );

  const renderToast = toast ? (
    <div
      className={`flex flex-col gap-2 rounded-xl border px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
        toast.type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : toast.type === "info"
            ? "border-blue-200 bg-blue-50 text-blue-800"
            : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="text-sm">{toast.message}</span>
      {toast.actionLabel && toast.actionHref && (
        <Link
          href={toast.actionHref}
          className="inline-flex items-center justify-center rounded-full border border-current px-3 py-1 text-xs font-semibold uppercase tracking-wide transition hover:bg-white/40"
        >
          {toast.actionLabel}
        </Link>
      )}
    </div>
  ) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-2xl border border-pink-50 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#ec4899]">Rewards</p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">Rewards Center</h1>
            <p className="mt-1 text-sm text-gray-600">
              Discover vouchers, products, and more. Redeem when you have enough points.
            </p>
          </div>

          <div className="rounded-xl border border-pink-100 bg-pink-50/60 px-4 py-3 text-sm text-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-bold text-[#ec4899]">
                {loadingOverview ? "…" : availablePoints.toLocaleString()}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#ec4899]">Available Points</p>
                <p className="text-sm font-semibold text-gray-900">
                  {loadingOverview ? "Loading..." : `${availablePoints.toLocaleString()} pts`}
                </p>
              </div>
            </div>
            {customer ? (
              <p className="mt-2 text-xs text-gray-600">
                Tier: {customer.loyalty.current_tier?.name ?? "—"} · Total earned:{" "}
                {customer.loyalty.points.total_earned.toLocaleString()}
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-600">Login to see your full loyalty summary.</p>
            )}
          </div>
        </div>

        {renderToast && <div className="mt-4">{renderToast}</div>}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {FILTERS.map((item) => {
          const isActive = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-[#ec4899] bg-[#ec4899] text-white shadow-sm"
                  : "border-pink-100 bg-white text-gray-700 hover:border-[#ec4899] hover:text-[#ec4899]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            void fetchRewards();
            void refreshProfile();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-pink-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-[#ec4899] hover:text-[#ec4899]"
        >
          Refresh
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.985 15.015v-4.992h4.992" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.04 4.357a9 9 0 0 0-15.946 2.331M3.96 19.643a9 9 0 0 0 15.946-2.331" />
          </svg>
        </button>
      </div>

      <section className="mt-6">
        {rewardsError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {rewardsError}
          </div>
        )}

        {loadingRewards ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-pink-50 bg-white/80 p-4 shadow-sm">
                <div className="h-36 w-full rounded-xl bg-pink-50" />
                <div className="mt-3 h-5 w-1/2 rounded bg-pink-50" />
                <div className="mt-2 h-4 w-2/3 rounded bg-pink-50" />
                <div className="mt-4 h-10 w-full rounded-full bg-pink-50" />
              </div>
            ))}
          </div>
        ) : filteredRewards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-pink-100 bg-white/70 px-6 py-10 text-center text-sm text-gray-600">
            No rewards available for this filter right now. Please check back later.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRewards.map((reward) => {
              const imageUrl = reward.thumbnail || reward.product?.thumbnail || PLACEHOLDER;
              const hasEnoughPoints = availablePoints >= reward.points_required;
              const isRedeeming = redeemingId === reward.id;
              const shouldDisable = customer ? !hasEnoughPoints || isRedeeming : isRedeeming;
              const typeLabel = reward.type
                ? `${reward.type.charAt(0).toUpperCase()}${reward.type.slice(1)}`
                : "Reward";
              const buttonLabel = !customer
                ? "Login to redeem"
                : isRedeeming
                  ? "Redeeming..."
                  : hasEnoughPoints
                    ? "Redeem"
                    : "Not enough points";

              return (
                <div
                  key={reward.id}
                  className="flex h-full flex-col justify-between rounded-2xl border border-pink-50 bg-white/80 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="relative h-40 w-full overflow-hidden rounded-xl bg-pink-50/70">
                      <Image
                        src={imageUrl}
                        alt={reward.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-contain"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-lg font-semibold text-gray-900">{reward.title}</p>
                      <span className="rounded-full bg-pink-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#ec4899]">
                        {typeLabel}
                      </span>
                    </div>

                    {reward.description && (
                      <p className="text-sm text-gray-600 line-clamp-3">{reward.description}</p>
                    )}

                    <div className="flex items-center justify-between text-sm font-semibold text-[#ec4899]">
                      <span>{reward.points_required.toLocaleString()} pts</span>
                      {reward.type === "product" && reward.product?.name && (
                        <span className="text-xs font-medium text-gray-500">Product reward</span>
                      )}
                      {reward.type === "voucher" && (
                        <span className="text-xs font-medium text-gray-500">Voucher reward</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRedeem(reward)}
                    disabled={shouldDisable}
                    className={`mt-4 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                      shouldDisable
                        ? "cursor-not-allowed bg-pink-100 text-gray-500"
                        : "bg-[#ec4899] text-white shadow-sm hover:bg-[#db2777]"
                    }`}
                  >
                    {buttonLabel}
                  </button>

                  {!customer && (
                    <p className="mt-2 text-center text-[12px] text-gray-500">
                      Login required to redeem.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
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
