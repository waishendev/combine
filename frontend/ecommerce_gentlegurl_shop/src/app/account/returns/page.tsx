import Link from "next/link";
import { redirect } from "next/navigation";
import { getReturns } from "@/lib/server/getReturns";

const formatAmount = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return "0.00";
  const num = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default async function AccountReturnsPage() {
  const returnsResult = await getReturns();

  if (!returnsResult) {
    redirect("/login");
  }

  const returns = returnsResult.returns ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">My Returns</h2>
          <p className="text-sm text-[var(--foreground)]/70">Track your return requests and statuses.</p>
        </div>
      </div>

      {returns.length === 0 ? (
        <div className="flex flex-col items-start justify-center rounded-xl border border-dashed border-[var(--muted)] bg-[var(--background)] p-10 text-center shadow-sm">
          <p className="mb-3 text-lg font-semibold text-[var(--foreground)]">No return requests yet.</p>
          <p className="mb-4 text-sm text-[var(--foreground)]/70">
            Eligible completed orders can be returned within the return window.
          </p>
          <Link
            href="/account/orders"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
          >
            View Orders
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((returnRequest) => (
            <Link
              key={returnRequest.id}
              href={`/account/returns/${returnRequest.id}`}
              className="block rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm transition hover:border-[var(--accent)]/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--foreground)]/70">
                    Order #{returnRequest.order_number ?? returnRequest.order_id}
                  </p>
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    Return #{returnRequest.id}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--card-border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
                  {returnRequest.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[var(--foreground)]/70">
                <span>Items: {returnRequest.total_items ?? 0}</span>
                <span>Qty: {returnRequest.total_quantity ?? 0}</span>
                <span>Refund: RM {formatAmount(returnRequest.refund_amount)}</span>
                {returnRequest.created_at && <span>Requested: {new Date(returnRequest.created_at).toLocaleString()}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
