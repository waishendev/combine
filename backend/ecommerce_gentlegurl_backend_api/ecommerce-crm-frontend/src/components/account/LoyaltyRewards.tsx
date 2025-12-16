"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { redeemLoyaltyReward } from "@/lib/shop-api";
import type { LoyaltyReward } from "@/lib/shop-types";

export function LoyaltyRewards({ rewards }: { rewards: LoyaltyReward[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRedeem(id: number) {
    setError(null);
    setLoadingId(id);
    try {
      await redeemLoyaltyReward({ reward_id: id });
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to redeem");
    } finally {
      setLoadingId(null);
    }
  }

  if (!rewards.length) {
    return <p className="text-sm text-slate-600">No rewards available right now.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {rewards.map((reward) => (
          <div key={reward.id} className="space-y-2 rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-slate-900">{reward.name}</div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                {reward.required_points} pts
              </span>
            </div>
            <div className="text-sm uppercase text-slate-500">{reward.type}</div>
            {reward.description && <p className="text-sm text-slate-700">{reward.description}</p>}
            <button
              type="button"
              onClick={() => handleRedeem(reward.id)}
              disabled={loadingId === reward.id}
              className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {loadingId === reward.id ? "Redeeming..." : "Redeem"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
