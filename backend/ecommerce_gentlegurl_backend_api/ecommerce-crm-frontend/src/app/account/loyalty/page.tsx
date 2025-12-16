import { LoyaltyRewards } from "@/components/account/LoyaltyRewards";
import { requireCustomer } from "@/lib/require-auth";
import { fetchLoyaltyHistory, fetchLoyaltyRewards, fetchLoyaltySummary } from "@/lib/shop-api";
import type { LoyaltyHistoryItem, LoyaltySummary } from "@/lib/shop-types";

export default async function LoyaltyPage() {
  await requireCustomer("/account/loyalty");
  const [summaryRes, historyRes, rewardsRes] = await Promise.all([
    fetchLoyaltySummary(),
    fetchLoyaltyHistory(),
    fetchLoyaltyRewards(),
  ]);

  const summary: LoyaltySummary = summaryRes.data;
  const history: LoyaltyHistoryItem[] = historyRes.data;
  const rewards = rewardsRes.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm uppercase text-blue-700">Current points</div>
          <div className="text-4xl font-semibold">{summary.current_points} pts</div>
          <p className="text-sm text-slate-600">Tier: {summary.tier}</p>
          {summary.tier_expire_at && <p className="text-sm text-slate-600">Tier expires: {summary.tier_expire_at}</p>}
          {summary.next_review_at && <p className="text-sm text-slate-600">Next review: {summary.next_review_at}</p>}
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm uppercase text-blue-700">Rewards</div>
          <p className="text-sm text-slate-600">Redeem your points for perks.</p>
          <LoyaltyRewards rewards={rewards} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-3">{item.date}</td>
                <td className="px-4 py-3 uppercase">{item.type}</td>
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3 text-right font-semibold">{item.points_change}</td>
                <td className="px-4 py-3 text-right">{item.balance}</td>
              </tr>
            ))}
            {!history.length && (
              <tr>
                <td className="px-4 py-3 text-sm text-slate-600" colSpan={5}>
                  No loyalty history yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
