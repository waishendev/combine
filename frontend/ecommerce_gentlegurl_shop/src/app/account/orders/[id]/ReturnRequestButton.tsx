"use client";

import { useRouter } from "next/navigation";

type ReturnRequestButtonProps = {
  orderId: number;
};

export function ReturnRequestButton({ orderId }: ReturnRequestButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/account/returns/new?order_id=${encodeURIComponent(orderId)}`)}
      className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
    >
      Request Return
    </button>
  );
}
