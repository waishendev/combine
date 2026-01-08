import Link from "next/link";
import { redirect } from "next/navigation";
import { getReturnRequest } from "@/lib/server/getReturnRequest";
import { getPrimaryProductImage } from "@/lib/productMedia";
import { TrackingFormClient } from "./TrackingFormClient";
import { formatReturnStatusLabel, getReturnStatusBadgeClasses } from "@/lib/returns/returnStatus";

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

const resolveReturnMediaUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
  if (value.startsWith("/")) {
    return `${baseUrl}${value}`;
  }
  return `${baseUrl}/storage/${value}`;
};

const isVideoUrl = (value?: string | null) => {
  if (!value) return false;
  const lower = value.toLowerCase().split("?")[0];
  return [".mp4", ".mov", ".webm", ".m4v", ".ogv"].some((ext) => lower.endsWith(ext));
};

const isEmbeddedVideoUrl = (value?: string | null) => {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("vimeo.com");
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
  const status = returnRequest.status?.toLowerCase();
  const refundProofUrl = resolveReturnMediaUrl(returnRequest.refund_proof_url);
  const refundProofIsPdf = refundProofUrl
    ? refundProofUrl.toLowerCase().split("?")[0].endsWith(".pdf")
    : false;
  const nextStepMessage = (() => {
    switch (status) {
      case "requested":
        return "We’re reviewing your return request.";
      case "approved":
        return "Please submit your tracking details to proceed with the return.";
      case "in_transit":
        return "Tracking submitted. We’ll notify you once we receive the parcel and complete our checks before confirming the refund.";
      case "received":
        return "We’ve received your parcel. Our team is checking the items before confirming your refund.";
      case "refunded":
        return "Your refund has been completed. If you need help, please reach out to support.";
      case "rejected":
        return "Your return request was rejected. Please contact support if you need help.";
      case "cancelled":
        return "Cancelled (No tracking submitted).";
      default:
        return "Tracking can be submitted once your return has been approved.";
    }
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--foreground)]/70">
            Order #{returnRequest.order_number ?? returnRequest.order_id}
          </p>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Return #{returnRequest.id}</h2>
        </div>
        <span className={getReturnStatusBadgeClasses(returnRequest.status)}>
          {formatReturnStatusLabel(returnRequest.status)}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Request Details</h3>
          <div className="mt-3 space-y-4 text-sm text-[var(--foreground)]/80">
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
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Submitted Media</h3>
          {returnRequest.initial_image_urls && returnRequest.initial_image_urls.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {returnRequest.initial_image_urls.map((rawUrl) => {
                const resolvedUrl = resolveReturnMediaUrl(rawUrl);
                if (!resolvedUrl) return null;
                if (isEmbeddedVideoUrl(resolvedUrl)) {
                  return (
                    <div key={resolvedUrl} className="h-24 w-24 rounded-lg border border-[var(--card-border)] overflow-hidden">
                      <iframe
                        src={resolvedUrl}
                        title="Return video"
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                }
                if (isVideoUrl(resolvedUrl)) {
                  return (
                    <video
                      key={resolvedUrl}
                      src={resolvedUrl}
                      controls
                      className="h-24 w-24 rounded-lg border border-[var(--card-border)] object-cover"
                    />
                  );
                }
                return (
                  <a key={resolvedUrl} href={resolvedUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolvedUrl} alt="Return" className="h-24 w-24 rounded-lg border border-[var(--card-border)] object-cover" />
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--foreground)]/70">No media submitted yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
                  Refund Qty: {item.requested_quantity ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Next Step</h3>
          {canSubmitTracking ? (
            <TrackingFormClient returnId={returnRequest.id} />
          ) : (
            <p className="mt-2 text-sm text-[var(--foreground)]/70">{isCancelled ? "Cancelled (No tracking submitted)." : nextStepMessage}</p>
          )}
        </div>
      </div>

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
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Refund Details</h3>
          {(returnRequest.refund_amount ||
            returnRequest.refund_method ||
            returnRequest.refunded_at ||
            returnRequest.refund_proof_url) ? (
            <div className="mt-3 space-y-3 text-sm text-[var(--foreground)]/80">
              <div>
                <p className="font-semibold text-[var(--foreground)]">Amount</p>
                <p>RM {formatAmount(returnRequest.refund_amount)}</p>
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">Method</p>
                <p>{returnRequest.refund_method ?? "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">Refunded At</p>
                <p>{formatDateTime(returnRequest.refunded_at)}</p>
              </div>
              {refundProofUrl && (
                <div>
                  <p className="font-semibold text-[var(--foreground)]">Refund Proof</p>
                  {refundProofIsPdf ? (
                    <a
                      href={refundProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      View refund proof
                    </a>
                  ) : (
                    <a href={refundProofUrl} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={refundProofUrl}
                        alt="Refund proof"
                        className="mt-2 h-24 w-24 rounded-lg border border-[var(--card-border)] object-cover"
                      />
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--foreground)]/70">No refund details yet.</p>
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
