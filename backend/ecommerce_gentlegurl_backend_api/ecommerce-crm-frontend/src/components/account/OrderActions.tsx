"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { cancelMyOrder, payOrderAgain } from "@/lib/order-actions";
import { requestOrderReturn, uploadOrderSlip } from "@/lib/shop-api";

export function OrderPaymentActions({
  orderNo,
  canCancel,
  canPayAgain,
}: {
  orderNo: string;
  canCancel?: boolean;
  canPayAgain?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"cancel" | "pay" | null>(null);
  const router = useRouter();

  async function handleCancel() {
    setError(null);
    setAction("cancel");
    try {
      await cancelMyOrder(orderNo);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to cancel order");
    } finally {
      setAction(null);
    }
  }

  async function handlePayAgain() {
    setError(null);
    setAction("pay");
    try {
      const res = await payOrderAgain(orderNo);
      if (res.data.billplz_url) {
        window.location.href = res.data.billplz_url;
      } else {
        setError("Payment link unavailable");
      }
    } catch (err: any) {
      setError(err.message || "Failed to start payment");
      setAction(null);
    }
  }

  if (!canCancel && !canPayAgain) return null;

  return (
    <div className="space-y-2 rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-800">Order actions</div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2 text-sm">
        {canCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={action === "cancel"}
            className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50 disabled:opacity-50"
          >
            {action === "cancel" ? "Cancelling..." : "Cancel order"}
          </button>
        )}
        {canPayAgain && (
          <button
            type="button"
            onClick={handlePayAgain}
            disabled={action === "pay"}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {action === "pay" ? "Redirecting..." : "Pay with Billplz"}
          </button>
        )}
      </div>
    </div>
  );
}

export function UploadSlipForm({ orderNo }: { orderNo: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const file = formData.get("slip");
    if (!(file instanceof File) || !file.name) {
      setError("Please choose a file");
      return;
    }
    setUploading(true);
    try {
      await uploadOrderSlip(orderNo, file);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border bg-slate-50 p-4 text-sm">
      <div className="font-semibold text-slate-800">Upload payment slip</div>
      <input name="slip" type="file" accept="image/*,.pdf" className="w-full text-sm" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={uploading}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}

export function ReturnRequestForm({ orderNo }: { orderNo: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const type = String(formData.get("type") || "return");
    const reason = String(formData.get("reason") || "").trim();
    const description = String(formData.get("description") || "").trim();
    if (!reason) {
      setError("Please provide a reason");
      return;
    }
    setSubmitting(true);
    try {
      await requestOrderReturn(orderNo, { type, reason, description });
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <div className="font-semibold">Request a return / refund</div>
        <p className="text-sm text-slate-600">We will review your request based on the order policies.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-2 text-sm">
        <label className="block font-semibold text-slate-800">Type</label>
        <select name="type" className="w-full rounded border px-3 py-2">
          <option value="return">Return</option>
          <option value="refund">Refund</option>
        </select>
      </div>
      <div className="space-y-2 text-sm">
        <label className="block font-semibold text-slate-800">Reason</label>
        <input name="reason" className="w-full rounded border px-3 py-2" placeholder="Tell us why" required />
      </div>
      <div className="space-y-2 text-sm">
        <label className="block font-semibold text-slate-800">Description</label>
        <textarea
          name="description"
          className="w-full rounded border px-3 py-2"
          rows={3}
          placeholder="Optional additional details"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}
