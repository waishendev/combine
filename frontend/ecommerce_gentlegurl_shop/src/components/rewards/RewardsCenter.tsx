"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import {
  AccountOverview,
  ApiError,
  LoyaltyReward,
  getLoyaltyRewards,
  redeemLoyaltyReward,
} from "@/lib/apiClient";
import { RedeemModal, RedeemModalState } from "./RedeemModal";

const FILTERS = [
  { value: "product", label: "Products" },
  { value: "voucher", label: "Vouchers" },
];

const PLACEHOLDER = "/images/placeholder.png";

export function RewardsCenter() {
  const router = useRouter();
  const { customer, refreshProfile } = useAuth();
  const { reloadCart } = useCart();

  const [overview, setOverview] = useState<AccountOverview | null>(customer);
  const [hasRequestedOverview, setHasRequestedOverview] = useState<boolean>(false);

  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState<boolean>(true);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("product");
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [redeemModal, setRedeemModal] = useState<RedeemModalState | null>(null);

  const availablePoints = overview?.loyalty.points.available ?? 0;

  const filteredRewards = useMemo(() => {
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
      return;
    }

    setHasRequestedOverview(true);
    void refreshProfile();
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
  }, [fetchRewards]);

  const formatAmount = useCallback((value?: number | string | null) => {
    if (value === null || value === undefined || value === "") return "N/A";
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return String(value);
    return `RM ${parsed.toFixed(2)}`;
  }, []);

  const handleRedeem = useCallback(
    async (reward: LoyaltyReward) => {
      if (!customer) {
        router.push("/login?redirect=/rewards");
        return;
      }

      const hasEnoughPoints = availablePoints >= reward.points_required;
      if (!hasEnoughPoints) {
        setRedeemModal({ status: "error", title: "Redeem failed", description: "You don't have enough points for this reward yet." });
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
          await reloadCart();
          setRedeemModal({
            status: "success",
            title: "Reward item claimed",
            description: "Item added to your cart.",
            rewardType: "product",
          });
        } else if (reward.type === "voucher") {
          setRedeemModal({
            status: "success",
            title: "Voucher claimed",
            description: "Your voucher is ready to use at checkout.",
            rewardType: "voucher",
            voucherCode: reward.voucher_code ?? reward.voucher?.code,
          });
        } else {
          setRedeemModal({ status: "success", title: "Reward redeemed", description: "Reward redeemed successfully." });
        }
      } catch (error) {
        const apiError = error as ApiError;
        if (apiError?.status === 401) {
          router.push("/login?redirect=/rewards");
        } else if (apiError?.status === 422) {
          setRedeemModal({ status: "error", title: "Redeem failed", description: extractApiError(apiError) });
        } else {
          setRedeemModal({ status: "error", title: "Redeem failed", description: "Unable to redeem this reward right now." });
        }
      } finally {
        setRedeemingId((current) => (current === reward.id ? null : current));
      }
    },
    [availablePoints, customer, fetchRewards, refreshProfile, reloadCart, router],
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-2xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent-strong)]">Rewards</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">Rewards Center</h1>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Discover vouchers, products, and more. Redeem when you have enough points.
            </p>
          </div>
        </div>
{/* 
        {renderToast && <div className="mt-4">{renderToast}</div>} */}
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
                  ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white shadow-sm"
                  : "border-[var(--card-border)] bg-[var(--card)] text-[color:var(--text-muted)] hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <section className="mt-6">
        {rewardsError && (
          <div className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[color:var(--status-warning)]">
            {rewardsError}
          </div>
        )}

        {loadingRewards ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-4 shadow-sm">
                <div className="h-36 w-full rounded-xl bg-[var(--background-soft)]" />
                <div className="mt-3 h-5 w-1/2 rounded bg-[var(--background-soft)]" />
                <div className="mt-2 h-4 w-2/3 rounded bg-[var(--background-soft)]" />
                <div className="mt-4 h-10 w-full rounded-full bg-[var(--background-soft)]" />
              </div>
            ))}
          </div>
        ) : filteredRewards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--card-border)] bg-[var(--card)]/70 px-6 py-10 text-center text-sm text-[color:var(--text-muted)]">
            No rewards available for this filter right now. Please check back later.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRewards.map((reward) => {
              const isProduct = reward.type === "product";
              const imageUrl =
                reward.product?.image_url ||
                reward.thumbnail ||
                PLACEHOLDER;
              const hasEnoughPoints = availablePoints >= reward.points_required;
              const isRedeeming = redeemingId === reward.id;
              const isAvailable = reward.is_available !== false;
              const shouldDisable = customer ? !hasEnoughPoints || !isAvailable || isRedeeming : !isAvailable || isRedeeming;
              const productLink =
                isProduct && reward.product?.slug ? `/product/${reward.product.slug}?reward=1` : null;
              const buttonLabel = !customer
                ? "Login to redeem"
                : isRedeeming
                  ? "Redeeming..."
                  : !isAvailable
                    ? "Unavailable"
                    : hasEnoughPoints
                    ? "Redeem"
                    : "Not enough points";
              const remainingLabel = isProduct
                ? `Stock left: ${reward.remaining ?? 0}`
                : reward.remaining == null
                  ? "Remaining: Unlimited"
                  : `Remaining: ${reward.remaining}`;

              const voucherBenefit = reward.voucher
                ? reward.voucher.type === "percent"
                  ? `${reward.voucher.value}% off`
                  : reward.voucher.amount
                    ? formatAmount(reward.voucher.amount)
                    : reward.voucher.value
                      ? formatAmount(reward.voucher.value)
                      : "Benefit available"
                : null;

              return (
                <div
                  key={reward.id}
                  className="flex h-full flex-col justify-between rounded-2xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  {isProduct ? (
                    <div className="space-y-3">
                      <div className="relative h-40 w-full overflow-hidden rounded-xl bg-[var(--background-soft)]/70">
                        <Image
                          src={imageUrl}
                          alt={reward.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-contain"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-lg font-semibold text-[var(--foreground)]">{reward.title}</p>
                      </div>

                      {reward.description && (
                        <p className="text-sm text-[color:var(--text-muted)] line-clamp-3">{reward.description}</p>
                      )}

                      <div className="flex items-center justify-between text-sm font-semibold text-[var(--accent-strong)]">
                        <span>{reward.points_required.toLocaleString()} pts</span>
                        <span className="text-xs font-medium text-[color:var(--text-muted)]">Product reward</span>
                      </div>
                      <div className="text-xs text-[color:var(--text-muted)]">{remainingLabel}</div>
                      {!isAvailable && (
                        <span className="text-xs font-semibold text-[color:var(--status-error)]">Out of stock</span>
                      )}

                      {productLink && (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--text-muted)]">
                          <Link
                            href={productLink}
                            className="inline-flex items-center gap-1 font-semibold text-[var(--accent-strong)] transition hover:text-[var(--accent-stronger)]"
                          >
                            View details
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">{reward.title}</p>
                          {reward.description && (
                            <p className="text-xs text-[color:var(--text-muted)] line-clamp-2">{reward.description}</p>
                          )}
                        </div>
                        <span className="rounded-full bg-[var(--background-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                          Voucher
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold text-[var(--accent-strong)]">
                        <span>{reward.points_required.toLocaleString()} pts</span>
                        {voucherBenefit && <span className="text-xs text-[color:var(--text-muted)]">{voucherBenefit}</span>}
                      </div>
                      <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)]">
                        <span>Benefit: {voucherBenefit ?? "Reward voucher"}</span>
                        <span>
                          Min spend:{" "}
                          {reward.voucher?.min_order_amount
                            ? formatAmount(reward.voucher.min_order_amount)
                            : "None"}
                        </span>
                      </div>
                      <div className="text-xs text-[color:var(--text-muted)]">{remainingLabel}</div>
                      {!isAvailable && (
                        <span className="text-xs font-semibold text-[color:var(--status-error)]">Fully redeemed</span>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRedeem(reward)}
                    disabled={shouldDisable}
                    className={`mt-4 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                      shouldDisable
                        ? "cursor-not-allowed bg-[var(--muted)] text-[color:var(--text-muted)]"
                        : "bg-[var(--accent-strong)] text-white shadow-sm hover:bg-[var(--accent-stronger)]"
                    }`}
                  >
                    {buttonLabel}
                  </button>

                  {!customer && (
                    <p className="mt-2 text-center text-[12px] text-[color:var(--text-muted)]">
                      Login required to redeem.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {redeemModal && (
        <RedeemModal
          state={redeemModal}
          onClose={() => setRedeemModal(null)}
          actions={
            redeemModal.status === "success"
              ? redeemModal.rewardType === "product"
                ? [
                    { label: "Go to Cart", href: "/cart" },
                  ]
                : redeemModal.rewardType === "voucher"
                  ? [
                      { label: "Go to Checkout", href: "/checkout" },
                      { label: "Go to Cart", href: "/cart", variant: "secondary" },
                    ]
                  : []
              : [
                  { label: "Close", onClick: () => setRedeemModal(null), variant: "secondary" },
                ]
          }
        />
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
