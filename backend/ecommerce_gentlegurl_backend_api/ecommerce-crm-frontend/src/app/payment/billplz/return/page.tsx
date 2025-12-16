"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiPost } from "@/lib/api";

export default function BillplzReturnPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<"checking" | "success" | "failed">("checking");
  const [orderNo, setOrderNo] = useState<string | null>(null);

  useEffect(() => {
    const billId = searchParams.get("billplz[id]");
    const paid = searchParams.get("billplz[paid]");
    const orderNoFromRef = searchParams.get("order_no");

    if (!billId) {
      setState("failed");
      return;
    }

    setOrderNo(orderNoFromRef);

    apiPost<{ data: { order_no: string; status: string } }>(
      "/public/shop/payment/billplz/verify",
      {
        bill_id: billId,
        paid,
      },
    )
      .then((res) => {
        if (res.data.status === "paid") {
          setState("success");
          const o = res.data.order_no || orderNoFromRef;
          if (o) {
            setTimeout(() => {
              router.replace(`/orders/${o}/thank-you`);
            }, 1500);
          }
        } else {
          setState("failed");
        }
      })
      .catch(() => {
        setState("failed");
      });
  }, [router, searchParams]);

  if (state === "checking") {
    return <div className="py-20 text-center">Validating payment...</div>;
  }

  if (state === "success") {
    return <div className="py-20 text-center">Payment successful! Redirecting...</div>;
  }

  return (
    <div className="py-20 text-center">
      <p className="mb-4">Payment failed or cancelled.</p>
      {orderNo && (
        <button onClick={() => router.push(`/account/orders/${orderNo}`)} className="underline">
          View order
        </button>
      )}
    </div>
  );
}
