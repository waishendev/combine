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
  const [selectedVoucher, setSelectedVoucher] = useState<LoyaltyReward | null>(null);
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

  const formatAmount = useCallback((value?: number | string | null) => {
    if (value === null || value === undefined || value === "") return "N/A";
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return String(value);
    return `RM ${parsed.toFixed(2)}`;
  }, []);

  const formatDate = useCallback((value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString();
  }, []);

  const closeVoucherModal = useCallback(() => setSelectedVoucher(null), []);

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
        setOverview((current) => {
          if (!current) return current;
          const currentPoints = current.loyalty.points?.available ?? 0;
          return {
            ...current,
            loyalty: {
              ...current.loyalty,
              points: {
                ...current.loyalty.points,
                available: Math.max(currentPoints - reward.points_required, 0),
              },
            },
          };
        });
        await refreshProfile();
        await fetchRewards();

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
    [availablePoints, customer, fetchRewards, refreshProfile, reloadCart, router, showToast],
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

  const selectedVoucherDetails = selectedVoucher?.voucher;
  const voucherBenefit = selectedVoucherDetails
    ? selectedVoucherDetails.type === "percent"
      ? `${selectedVoucherDetails.value}% off`
      : selectedVoucherDetails.amount
        ? formatAmount(selectedVoucherDetails.amount)
        : selectedVoucherDetails.value
          ? formatAmount(selectedVoucherDetails.value)
          : "Discount voucher"
    : null;
  const voucherValidityStart = formatDate(selectedVoucherDetails?.start_at);
  const voucherValidityEnd = formatDate(selectedVoucherDetails?.end_at);
  const voucherValidity = voucherValidityStart || voucherValidityEnd
    ? `${voucherValidityStart ?? "Now"} - ${voucherValidityEnd ?? "No expiry set"}`
    : "Validity follows voucher rules upon redemption.";
  const voucherUsage =
    (selectedVoucherDetails?.max_uses_per_customer ?? selectedVoucherDetails?.usage_limit_per_customer)
      ? `${selectedVoucherDetails?.max_uses_per_customer ?? selectedVoucherDetails?.usage_limit_per_customer} per customer`
      : "Standard usage limits apply.";

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
              const imageUrl =
                reward.product?.image_url ||
                reward.thumbnail ||
                reward.product?.thumbnail ||
                PLACEHOLDER;
              const hasEnoughPoints = availablePoints >= reward.points_required;
              const isRedeeming = redeemingId === reward.id;
              const shouldDisable = customer ? !hasEnoughPoints || isRedeeming : isRedeeming;
              const typeLabel = reward.type
                ? `${reward.type.charAt(0).toUpperCase()}${reward.type.slice(1)}`
                : "Reward";
              const productLink =
                reward.type === "product" && reward.product?.slug
                  ? `/product/${reward.product.slug}?reward=1`
                  : null;
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

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                      {reward.type === "voucher" && (
                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(reward)}
                          className="inline-flex items-center gap-1 font-semibold text-[#ec4899] transition hover:text-[#db2777]"
                        >
                          View details
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}

                      {productLink && (
                        <Link
                          href={productLink}
                          className="inline-flex items-center gap-1 font-semibold text-[#ec4899] transition hover:text-[#db2777]"
                        >
                          View details
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
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

      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#ec4899]">Voucher Reward</p>
                <h3 className="mt-1 text-xl font-semibold text-gray-900">{selectedVoucher.title}</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {selectedVoucher.description ?? "Review the voucher rules before redeeming."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeVoucherModal}
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close voucher details"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Points Required</p>
                <p className="mt-1 text-base font-semibold text-[#ec4899]">
                  {selectedVoucher.points_required.toLocaleString()} pts
                </p>
              </div>

              {voucherBenefit && (
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Benefit</p>
                  <p className="mt-1 font-semibold text-gray-900">{voucherBenefit}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Min Spend</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {selectedVoucherDetails?.min_order_amount
                    ? formatAmount(selectedVoucherDetails.min_order_amount)
                    : "No minimum spend"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-pink-50 px-3 py-2 text-xs text-pink-800">
              Redeem to add this voucher to your account. Login is required to redeem.
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeVoucherModal}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Close
              </button>
              {!customer && (
                <button
                  type="button"
                  onClick={() => {
                    router.push("/login?redirect=/rewards");
                    closeVoucherModal();
                  }}
                  className="rounded-full bg-[#ec4899] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#db2777]"
                >
                  Login to redeem
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
