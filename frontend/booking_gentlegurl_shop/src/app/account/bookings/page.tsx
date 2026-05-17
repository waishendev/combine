"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyBookings } from "@/lib/apiClient";
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

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  if (normalized === "CONFIRMED") return "bg-blue-100 text-blue-800";
  if (normalized === "HOLD") return "bg-amber-100 text-amber-800";
  if (normalized.includes("CANCEL")) return "bg-rose-100 text-rose-800";
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

              return (
                <article
                  key={booking.id}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2 overflow-hidden">
                      <div className="min-w-0">
                        <ServiceNameStack name={booking.service_name} cnName={serviceCnName} />
                        <p className="mt-1 truncate font-mono text-xs text-[var(--text-muted)]">
                          {booking.booking_code || `BOOKING-${booking.id}`}
                        </p>
                      </div>

                      <div className="grid min-w-0 gap-1 text-sm text-[var(--text-muted)] sm:grid-cols-2 sm:gap-x-6">
                        <p className="min-w-0 truncate">
                          Date: <span className="text-[var(--foreground)]">{formatDate(booking.starts_at)}</span>
                        </p>
                        <p className="min-w-0 truncate">
                          Time: <span className="text-[var(--foreground)]">{formatTime(booking.starts_at)}</span>
                        </p>
                        <p className="min-w-0 truncate">
                          Staff: <span className="text-[var(--foreground)]">{booking.staff_name || "Any staff"}</span>
                        </p>
                        {addOns ? (
                          <p className="min-w-0 truncate sm:col-span-2">
                            Add-ons: <span className="text-[var(--foreground)]">{addOns}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(booking.status)}`}>
                        {booking.status}
                      </span>
                      <Link
                        href={`/account/bookings/${booking.id}`}
                        className="rounded-full bg-[var(--accent-strong)] px-4 py-2 text-sm font-medium text-white"
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
