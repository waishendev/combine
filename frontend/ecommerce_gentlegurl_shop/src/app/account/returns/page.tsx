import Link from "next/link";
import { redirect } from "next/navigation";
import { getReturns } from "@/lib/server/getReturns";
import { formatReturnStatusLabel, getReturnStatusBadgeClasses } from "@/lib/returns/returnStatus";
import { getPrimaryProductImage } from "@/lib/productMedia";

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
        <div className="space-y-4">
          {returns.map((returnRequest) => (
            <div
              key={returnRequest.id}
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm transition hover:border-[var(--accent)]/60"
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className={getReturnStatusBadgeClasses(returnRequest.status)}>
                    {formatReturnStatusLabel(returnRequest.status)}
                  </span>
                  <Link
                    href={`/account/returns/${returnRequest.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-[var(--foreground)] transition hover:border-[var(--accent-strong)] hover:bg-[var(--muted)]/60"
                  >
                    View Details
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="h-4 w-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 6.75 4.5 4.5-4.5 4.5" />
                    </svg>
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-[var(--foreground)]/70 sm:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Requested</p>
                  <p className="text-base font-medium text-[var(--foreground)]">
                    {returnRequest.created_at
                      ? new Date(returnRequest.created_at).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Items</p>
                  <p className="text-base font-medium text-[var(--foreground)]">{returnRequest.total_items ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Qty</p>
                  <p className="text-base font-medium text-[var(--foreground)]">{returnRequest.total_quantity ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Refund</p>
                  <p className="text-base font-semibold text-[var(--foreground)]">
                    RM {formatAmount(returnRequest.refund_amount)}
                  </p>
                </div>

                {Array.isArray(returnRequest.items) && returnRequest.items.length > 0 && (
                  <div className="sm:col-span-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">
                      Items
                    </p>
                    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                      {returnRequest.items.map((item, index) => (
                        <div
                          key={item.order_item_id ?? `${returnRequest.id}-${index}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--card-border)] px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getPrimaryProductImage(item)}
                              alt={item.product_name ?? "Product image"}
                              className="h-12 w-12 rounded-lg object-cover"
                            />
                            <div>
                              <p className="text-sm font-semibold text-[var(--foreground)]">
                                {item.product_name ?? "Item"}
                              </p>
                              {item.sku && (
                                <p className="text-xs text-[var(--foreground)]/60">SKU: {item.sku}</p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-[var(--foreground)]/70">
                            Qty: {item.requested_quantity ?? item.quantity ?? 0}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
