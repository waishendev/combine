"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderDetail } from "@/lib/server/getOrderDetail";

type ReturnCreateFormClientProps = {
  order: OrderDetail;
};

type ItemSelection = Record<number, number>;

const reasons = [
  "Damaged item",
  "Wrong item",
  "Size issue",
  "Changed mind",
  "Other",
];

export function ReturnCreateFormClient({ order }: ReturnCreateFormClientProps) {
  const router = useRouter();
  const [reason, setReason] = useState(reasons[0]);
  const [description, setDescription] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [selection, setSelection] = useState<ItemSelection>(() => {
    const initial: ItemSelection = {};
    order.items.forEach((item) => {
      initial[item.id] = 0;
    });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItems = useMemo(() => {
    return order.items
      .map((item) => ({
        order_item_id: item.id,
        quantity: selection[item.id] ?? 0,
      }))
      .filter((item) => item.quantity > 0);
  }, [order.items, selection]);

  const handleQuantityChange = (itemId: number, qty: number) => {
    setSelection((prev) => ({ ...prev, [itemId]: qty }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (selectedItems.length === 0) {
      setError("Please select at least one item to return.");
      setSubmitting(false);
      return;
    }

    const parsedImages = imageUrls
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    try {
      const res = await fetch("/api/proxy/public/shop/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: order.id,
          request_type: "return",
          reason,
          description,
          items: selectedItems,
          initial_image_urls: parsedImages.length > 0 ? parsedImages : undefined,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.message ?? "Unable to submit return request.");
        return;
      }

      const returnId = json?.data?.id;
      if (returnId) {
        router.push(`/account/returns/${returnId}`);
      } else {
        router.push("/account/returns");
      }
    } catch (err) {
      setError((err as Error).message ?? "Unable to submit return request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Select Items</h3>
        <div className="mt-3 space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                <p className="text-xs text-[var(--foreground)]/70">Ordered qty: {item.quantity}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/70">
                <label htmlFor={`qty-${item.id}`} className="sr-only">
                  Quantity
                </label>
                <select
                  id={`qty-${item.id}`}
                  className="rounded-lg border border-[var(--card-border)] px-3 py-1 text-sm"
                  value={selection[item.id] ?? 0}
                  onChange={(event) => handleQuantityChange(item.id, Number(event.target.value))}
                >
                  {Array.from({ length: item.quantity + 1 }, (_, idx) => idx).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Reason</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]">Reason</label>
            <select
              className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {reasons.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]">Description</label>
            <textarea
              className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add more details (optional)"
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">Photo URLs (optional)</label>
          <input
            className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm"
            value={imageUrls}
            onChange={(event) => setImageUrls(event.target.value)}
            placeholder="Paste image URLs separated by commas"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Return"}
        </button>
        <span className="text-sm text-[var(--foreground)]/70">
          Return requests are reviewed by our team before approval.
        </span>
      </div>
    </form>
  );
}
