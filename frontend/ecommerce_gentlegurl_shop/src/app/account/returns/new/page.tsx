import Link from "next/link";
import { getOrderDetail } from "@/lib/server/getOrderDetail";
import { ReturnCreateFormClient } from "./ReturnCreateFormClient";

type ReturnCreatePageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
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
  const orderIdParam = searchParams?.order_id;
  const normalizedOrderId = Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam;
  const orderId = normalizedOrderId ? Number.parseInt(normalizedOrderId, 10) : Number.NaN;

  if (!orderId || Number.isNaN(orderId)) {
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
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Order not found</h2>
        <p className="text-sm text-[var(--foreground)]/70">
          We could not find this order or you do not have access to it.
        </p>
        <Link href="/account/orders" className="text-sm font-semibold text-[var(--accent)]">
          Back to orders
        </Link>
      </div>
    );
  }

  const returnWindowDays = order.return_window_days ?? 7;
  const isCompleted = order.status === "completed";
  const isWithinWindow = isWithinReturnWindow(order.completed_at, returnWindowDays);
  const canRequestReturn = isCompleted && isWithinWindow;

  if (!canRequestReturn) {
    if (!isCompleted) {
      return (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Order not completed yet</h2>
          <p className="text-sm text-[var(--foreground)]/70">
            Returns can only be requested after the order is marked as completed.
          </p>
          <Link href={`/account/orders/${orderId}`} className="text-sm font-semibold text-[var(--accent)]">
            Back to order
          </Link>
        </div>
      );
    }

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
