"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyBookings, payBooking } from "@/lib/apiClient";
import { BookingRecord } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

function ServiceNameStack({ name, cnName }: { name: string; cnName?: string | null }) {
  return (
    <>
      <p className="line-clamp-2 font-semibold text-[var(--foreground)]">{name}</p>
      {cnName ? <p className="mt-0.5 line-clamp-2 text-sm text-[var(--text-muted)]">{cnName}</p> : null}
    </>
  );
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-MY", { dateStyle: "medium" });

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });

const addonSummary = (booking: BookingRecord) => {
  const addOns = booking.add_ons ?? [];
  if (addOns.length === 0) return null;
  const names = addOns.slice(0, 2).map((addon) => addon.name).join(", ");
  const remaining = addOns.length > 2 ? ` +${addOns.length - 2} more` : "";
  return `${names}${remaining}`;
};

const formatCurrency = (value?: number | null) => `RM ${Number(value ?? 0).toFixed(2)}`;

const pickPaymentNumber = (...values: Array<number | null | undefined>) => {
  for (const value of values) {
    const numeric = Number(value ?? NaN);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return 0;
};

const getCustomerPaymentSummary = (booking: BookingRecord) => {
  const serviceTotal = Number(booking.service_total ?? 0);
  const addonTotal = Number(booking.addon_total_price ?? 0);
  const depositPaid = pickPaymentNumber(
    booking.deposit_paid,
    booking.linked_booking_deposit_total,
    booking.deposit_previously_collected_amount,
  );
  const settlementPaid = Number(booking.settlement_paid ?? 0);
  const packageOffset = Number(booking.package_offset ?? 0);
  const calculatedBalance = Math.max(0, serviceTotal + addonTotal - depositPaid - settlementPaid - packageOffset);
  const balanceDue = Number(booking.balance_due ?? booking.amount_due_now ?? calculatedBalance);
  const totalPaid = Number(booking.total_paid ?? depositPaid + settlementPaid);
  const paymentStatus = totalPaid <= 0
    ? "UNPAID"
    : balanceDue > 0
      ? "PARTIAL"
      : "PAID";

  return { balanceDue, depositPaid, paymentStatus, totalPaid };
};

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (["COMPLETED", "PAID"].includes(normalized)) return "bg-emerald-100 text-emerald-800";
  if (normalized === "CONFIRMED") return "bg-blue-100 text-blue-800";
  if (["HOLD", "PARTIAL", "PENDING"].includes(normalized)) return "bg-amber-100 text-amber-800";
  if (normalized.includes("CANCEL") || ["UNPAID", "FAILED"].includes(normalized)) return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

export default function MyBookingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/account/bookings");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        setBookings(await getMyBookings());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to fetch bookings");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [user]);

  const handlePayNow = async (booking: BookingRecord) => {
    const method = booking.latest_payment?.payment_method || "manual_transfer";
    if (method === "manual_transfer") {
      const nextParams = new URLSearchParams({
        order_id: String(booking.id),
        payment_method: method,
        provider: String(booking.latest_payment?.provider || "manual"),
      });
      if (booking.booking_code) {
        nextParams.set("order_no", booking.booking_code);
      }
      router.push(`/payment-result?${nextParams.toString()}`);
      return;
    }

    try {
      const normalizedMethod =
        method === "billplz_fpx"
          ? "billplz_online_banking"
          : method === "billplz_card"
            ? "billplz_credit_card"
            : method;
      const resp = await payBooking(booking.id, { payment_method: normalizedMethod as "billplz_online_banking" | "billplz_credit_card" | "manual_transfer" });
      const redirectUrl = resp?.data?.payment_url || booking.latest_payment?.payment_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        const nextParams = new URLSearchParams({
          order_id: String(resp?.data?.order_id ?? booking.id),
          payment_method: String(resp?.data?.payment_method ?? method),
          provider: String(resp?.data?.provider ?? booking.latest_payment?.provider ?? "billplz"),
        });
        if (resp?.data?.order_no || booking.booking_code) {
          nextParams.set("order_no", String(resp?.data?.order_no || booking.booking_code));
        }
        router.push(`/payment-result?${nextParams.toString()}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue payment.");
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[var(--text-muted)]">Account / My Bookings</p>
          <h1 className="text-3xl font-semibold">My Bookings</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)]">{bookings.length} booking{bookings.length === 1 ? "" : "s"}</p>
      </div>

      {loading ? <p className="mt-4">Loading bookings...</p> : null}
      {error ? <p className="mt-4 text-[var(--status-error)]">{error}</p> : null}

      {!loading && !error && bookings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-sm text-[var(--text-muted)]">
          You do not have any bookings yet.
        </div>
      ) : null}

      {!loading && !error && bookings.length > 0 ? (
        <div className="mt-6 max-h-[min(70vh,720px)] overflow-y-auto overscroll-contain pr-1">
          <div className="grid gap-3">
            {bookings.map((booking) => {
              const addOns = addonSummary(booking);
              const serviceCnName = booking.service_cn_name ?? booking.service?.cn_name;
              const payment = getCustomerPaymentSummary(booking);
              const canPayNow = String(booking.status).toUpperCase() === "HOLD" && payment.paymentStatus !== "PAID";

              return (
                <article
                  key={booking.id}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
                >
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <ServiceNameStack name={booking.service_name} cnName={serviceCnName} />
                        <p className="mt-1 truncate font-mono text-xs text-[var(--text-muted)]">
                          {booking.booking_code || `BOOKING-${booking.id}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(booking.status)}`}>
                          Status: {booking.status}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(payment.paymentStatus)}`}>
                          Payment: {payment.paymentStatus}
                        </span>
                      </div>
                    </div>

                    <div className="grid min-w-0 gap-2 rounded-xl bg-[var(--background)]/20 p-3 text-sm text-[var(--text-muted)] sm:grid-cols-2 sm:gap-x-6">
                      <p className="min-w-0 truncate">
                        Date: <span className="text-[var(--foreground)]">{formatDate(booking.starts_at)}</span>
                      </p>
                      <p className="min-w-0 truncate">
                        Time: <span className="text-[var(--foreground)]">{formatTime(booking.starts_at)}</span>
                      </p>
                      <p className="min-w-0 truncate">
                        Staff: <span className="text-[var(--foreground)]">{booking.staff_name || "Any staff"}</span>
                      </p>
                      <p className="min-w-0 truncate">
                        Add-ons: <span className="text-[var(--foreground)]">{addOns || "None"}</span>
                      </p>
                      <p className="min-w-0 truncate">
                        Deposit Paid: <span className="text-emerald-700">{formatCurrency(payment.depositPaid)}</span>
                      </p>
                      {payment.balanceDue > 0 ? (
                        <p className="min-w-0 truncate font-medium">
                          Balance Due: <span className="text-[var(--accent-strong)]">{formatCurrency(payment.balanceDue)}</span>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--card-border)] pt-4">
                      {canPayNow ? (
                        <button
                          type="button"
                          onClick={() => void handlePayNow(booking)}
                          className="rounded-full bg-[var(--accent-strong)] px-4 py-2 text-sm font-medium text-white"
                        >
                          Pay Now
                        </button>
                      ) : null}
                      <Link
                        href={`/account/bookings/${booking.id}`}
                        className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm font-medium"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
