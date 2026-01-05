import Link from "next/link";
import { redirect } from "next/navigation";
import { getReturnRequest } from "@/lib/server/getReturnRequest";
import { getPrimaryProductImage } from "@/lib/productMedia";
import { TrackingFormClient } from "./TrackingFormClient";

type ReturnDetailPageProps = {
  params: Promise<{ id: string }>;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const formatAmount = (value?: string | number | null) => {
  if (value === null || value === undefined) return "0.00";
  const num = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default async function ReturnDetailPage({ params }: ReturnDetailPageProps) {
  const { id } = await params;
  const returnId = Number(id);
  const returnRequest = await getReturnRequest(returnId);

  if (!returnRequest) {
    redirect("/login");
  }

  const canSubmitTracking = returnRequest.status === "approved";
  const isCancelled = returnRequest.status === "cancelled";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--foreground)]/70">
            Order #{returnRequest.order_number ?? returnRequest.order_id}
          </p>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Return #{returnRequest.id}</h2>
        </div>
        <span className="rounded-full border border-[var(--card-border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
          {returnRequest.status}
        </span>
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Request Details</h3>
        <div className="mt-3 grid gap-4 text-sm text-[var(--foreground)]/80 md:grid-cols-2">
          <div>
            <p className="font-semibold text-[var(--foreground)]">Reason</p>
            <p>{returnRequest.reason ?? "—"}</p>
          </div>
          <div>
            <p className="font-semibold text-[var(--foreground)]">Description</p>
            <p>{returnRequest.description ?? "—"}</p>
          </div>
          <div>
            <p className="font-semibold text-[var(--foreground)]">Admin Note</p>
            <p>{returnRequest.admin_note ?? "—"}</p>
          </div>
          <div>
            <p className="font-semibold text-[var(--foreground)]">Timeline</p>
            <p>Requested: {formatDateTime(returnRequest.timestamps?.created_at)}</p>
            <p>Reviewed: {formatDateTime(returnRequest.timestamps?.reviewed_at)}</p>
            <p>Received: {formatDateTime(returnRequest.timestamps?.received_at)}</p>
            <p>Refunded: {formatDateTime(returnRequest.timestamps?.completed_at)}</p>
          </div>
          {(returnRequest.refund_amount ||
            returnRequest.refund_method ||
            returnRequest.refund_proof_url ||
            returnRequest.refunded_at) && (
            <div>
              <p className="font-semibold text-[var(--foreground)]">Refund</p>
              <p>Amount: RM {formatAmount(returnRequest.refund_amount)}</p>
              <p>Method: {returnRequest.refund_method ?? "—"}</p>
              <p>Refunded At: {formatDateTime(returnRequest.refunded_at)}</p>
              {returnRequest.refund_proof_url && (
                <a
                  href={returnRequest.refund_proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  View refund proof
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Items</h3>
        <div className="mt-3 space-y-3">
          {returnRequest.items?.map((item) => (
            <div
              key={item.order_item_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--card-border)] px-3 py-2"
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getPrimaryProductImage(item)}
                  alt={item.product_name ?? "Item"}
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.product_name ?? "Item"}</p>
                  <p className="text-xs text-[var(--foreground)]/70">SKU: {item.sku ?? "—"}</p>
                </div>
              </div>
              <div className="text-sm text-[var(--foreground)]/70">
                Qty: {item.requested_quantity ?? 0} / {item.order_quantity ?? 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {returnRequest.initial_image_urls && returnRequest.initial_image_urls.length > 0 && (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Submitted Photos</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {returnRequest.initial_image_urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Return" className="h-24 w-24 rounded-lg border border-[var(--card-border)] object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Return Shipping</h3>
          <div className="mt-3 space-y-1 text-sm text-[var(--foreground)]/70">
            <p>Courier: {returnRequest.return_courier_name ?? "—"}</p>
            <p>Tracking: {returnRequest.return_tracking_no ?? "—"}</p>
            <p>Shipped At: {formatDateTime(returnRequest.return_shipped_at)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Next Step</h3>
          {canSubmitTracking ? (
            <TrackingFormClient returnId={returnRequest.id} />
          ) : (
            <p className="mt-2 text-sm text-[var(--foreground)]/70">
              {isCancelled
                ? "Cancelled (No tracking submitted)."
                : "Tracking can be submitted once your return has been approved."}
            </p>
          )}
        </div>
      </div>

      <div>
        <Link href="/account/returns" className="text-sm font-semibold text-[var(--accent)]">
          ← Back to returns
        </Link>
      </div>
    </div>
  );
}
