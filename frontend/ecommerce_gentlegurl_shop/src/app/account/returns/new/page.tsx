import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrderDetail } from "@/lib/server/getOrderDetail";
import { ReturnCreateFormClient } from "./ReturnCreateFormClient";

type ReturnCreatePageProps = {
  searchParams: { order_id?: string };
};

const isWithinReturnWindow = (completedAt?: string | null, windowDays?: number | null) => {
  if (!completedAt || !windowDays) return false;
  const completedDate = new Date(completedAt);
  if (Number.isNaN(completedDate.getTime())) return false;
  const windowEnds = new Date(completedDate);
  windowEnds.setDate(windowEnds.getDate() + windowDays);
  return windowEnds.getTime() >= Date.now();
};

export default async function ReturnCreatePage({ searchParams }: ReturnCreatePageProps) {
  const orderId = Number(searchParams.order_id);

  if (!orderId) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Request a Return</h2>
        <p className="text-sm text-[var(--foreground)]/70">Please select an order to start a return request.</p>
        <Link href="/account/orders" className="text-sm font-semibold text-[var(--accent)]">
          Back to orders
        </Link>
      </div>
    );
  }

  const order = await getOrderDetail(orderId);

  if (!order) {
    redirect("/login");
  }

  const returnWindowDays = order.return_window_days ?? 7;
  const canRequestReturn = order.status === "completed" && isWithinReturnWindow(order.completed_at, returnWindowDays);

  if (!canRequestReturn) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Return Window Expired</h2>
        <p className="text-sm text-[var(--foreground)]/70">
          This order is no longer eligible for return. Returns are available for {returnWindowDays} days after completion.
        </p>
        <Link href={`/account/orders/${orderId}`} className="text-sm font-semibold text-[var(--accent)]">
          Back to order
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-[var(--foreground)]/70">Order #{order.order_no}</p>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Request a Return</h2>
      </div>
      <ReturnCreateFormClient order={order} />
    </div>
  );
}
