"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { ApiError, LoyaltyReward, getLoyaltyRewards, redeemLoyaltyReward } from "@/lib/apiClient";
import { RedeemModal, RedeemModalState } from "../rewards/RedeemModal";

type RewardRedeemPanelProps = {
  productId: number;
  slug: string;
  fallbackPoints?: number | null;
  isRewardOnly: boolean;
  stock?: number | null;
};

export function RewardRedeemPanel({ productId, slug, fallbackPoints, isRewardOnly, stock }: RewardRedeemPanelProps) {
  const router = useRouter();
  const { customer, refreshProfile } = useAuth();
  const { reloadCart } = useCart();

  const [reward, setReward] = useState<LoyaltyReward | null>(null);
  const [loadingReward, setLoadingReward] = useState<boolean>(true);
  const [redeeming, setRedeeming] = useState<boolean>(false);
  const [redeemModal, setRedeemModal] = useState<RedeemModalState | null>(null);
  const [claimed, setClaimed] = useState<boolean>(false);

  const availablePoints = customer?.loyalty?.points?.available ?? 0;

  const requiredPoints = useMemo(() => {
    if (reward?.points_required != null) return reward.points_required;
    if (fallbackPoints != null) return fallbackPoints;
    return null;
  }, [fallbackPoints, reward?.points_required]);

  const fetchReward = useCallback(async () => {
    setLoadingReward(true);
    try {
      const rewards = await getLoyaltyRewards();
      const match = rewards.find((item) => item.type === "product" && item.product_id === productId);
      setReward(match ?? null);
    } catch {
      setReward(null);
    } finally {
      setLoadingReward(false);
    }
  }, [productId]);

  useEffect(() => {
    void fetchReward();
  }, [fetchReward]);

  const handleRedeem = useCallback(async () => {
    if (!customer) {
      router.push(`/login?redirect=/product/${slug}?reward=1`);
      return;
    }

    if (!reward?.id) {
      setRedeemModal({
        status: "error",
        title: "Redeem failed",
        description: "This reward is not available right now.",
      });
      return;
    }

    if (requiredPoints != null && availablePoints < requiredPoints) {
      setRedeemModal({
        status: "error",
        title: "Redeem failed",
        description: "You don't have enough points for this reward yet.",
      });
      return;
    }

    setRedeeming(true);
    try {
      await redeemLoyaltyReward(reward.id);
      setClaimed(true);
      await Promise.all([refreshProfile(), reloadCart()]);
      setRedeemModal({
        status: "success",
        title: "Reward item claimed",
        description: "Item added to your cart.",
        rewardType: "product",
      });
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError?.status === 401) {
        router.push(`/login?redirect=/product/${slug}?reward=1`);
      } else if (apiError?.status === 422) {
        setRedeemModal({
          status: "error",
          title: "Redeem failed",
          description: extractApiError(apiError),
        });
      } else {
        setRedeemModal({
          status: "error",
          title: "Redeem failed",
          description: "Unable to redeem this reward right now.",
        });
      }
    } finally {
      setRedeeming(false);
    }
  }, [availablePoints, customer, reloadCart, refreshProfile, requiredPoints, reward?.id, router, slug]);

  const hasEnoughPoints = requiredPoints == null || availablePoints >= requiredPoints;
  const isLoggedIn = !!customer;
  const isOutOfStock = stock != null && stock <= 0;

  return (
    <div className="space-y-3 rounded-xl border border-pink-100 bg-pink-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[#ec4899]">Reward Redeem</p>
          <p className="text-lg font-semibold text-gray-900">
            {requiredPoints != null ? `${requiredPoints.toLocaleString()} pts` : "Reward redeem"}
          </p>
          <p className="text-xs text-gray-600">Redeem with your points to get this item.</p>
          {stock != null && (
            <p className="mt-1 text-xs text-gray-600">Stock left: {stock}</p>
          )}
        </div>
        {loadingReward ? (
          <div className="h-10 w-24 animate-pulse rounded-full bg-white/70" />
        ) : (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#ec4899]">
            {requiredPoints != null ? `${requiredPoints.toLocaleString()} pts needed` : "Reward available"}
          </span>
        )}
      </div>

      {claimed && (
        <div className="rounded-lg bg-white px-3 py-2 text-sm text-emerald-700">
          Reward item added to your cart.{" "}
          <button
            type="button"
            onClick={() => router.push("/cart")}
            className="font-semibold text-[#ec4899] underline-offset-4 hover:underline"
          >
            Go to cart
          </button>
        </div>
      )}

      {isOutOfStock && (
        <div className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-rose-600">
          Out of stock
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!isOutOfStock && (
          <button
            type="button"
            onClick={handleRedeem}
            disabled={redeeming || (isLoggedIn ? !hasEnoughPoints : false)}
            className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
              !isLoggedIn || hasEnoughPoints
                ? "bg-[#ec4899] text-white shadow-sm hover:bg-[#db2777]"
                : "cursor-not-allowed bg-pink-100 text-gray-500"
            }`}
          >
            {!isLoggedIn
              ? "Login to redeem"
              : redeeming
                ? "Redeeming..."
                : hasEnoughPoints
                  ? "Redeem"
                  : "Not enough points"}
          </button>
        )}
        {!isRewardOnly && (
          <p className="text-xs text-gray-600">
            Reward redemption available. Standard purchase also applies when not redeeming.
          </p>
        )}
      </div>

      {redeemModal && (
        <RedeemModal
          state={redeemModal}
          onClose={() => setRedeemModal(null)}
          actions={[
            redeemModal.status === "success"
              ? { label: "Go to Cart", href: "/cart" }
              : { label: "Close", onClick: () => setRedeemModal(null), variant: "secondary" },
          ]}
        />
      )}
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
