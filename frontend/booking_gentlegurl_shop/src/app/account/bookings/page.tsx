"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getBookingPolicySettings,
  getMyBookings,
  requestBookingCancellation,
  rescheduleBooking,
} from "@/lib/apiClient";
import { BookingPolicy, BookingRecord } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

const defaultPolicy: BookingPolicy = {
  reschedule: { enabled: true, max_changes: 1, cutoff_hours: 72 },
  cancel: { customer_cancel_allowed: false, deposit_refundable: false },
};

export default function MyBookingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [policy, setPolicy] = useState<BookingPolicy>(defaultPolicy);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalBooking, setModalBooking] = useState<BookingRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/account/bookings");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      setLoading(true);
      try {
        const [myBookings, bookingPolicy] = await Promise.all([getMyBookings(), getBookingPolicySettings()]);
        setBookings(myBookings);
        setPolicy(bookingPolicy);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to fetch bookings");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user]);

  const getRescheduleState = (booking: BookingRecord) => {
    const currentCount = Number(booking.reschedule_count ?? 0);
    const startAt = new Date(booking.starts_at).getTime();
    const cutoffTime = Date.now() + policy.reschedule.cutoff_hours * 60 * 60 * 1000;
    const withinCutoff = startAt < cutoffTime;
    const remaining = Math.max(0, policy.reschedule.max_changes - currentCount);
    const allowed =
      policy.reschedule.enabled &&
      booking.status === "CONFIRMED" &&
      !withinCutoff &&
      currentCount < policy.reschedule.max_changes;

    return { allowed, currentCount, remaining, withinCutoff };
  };

  const handleReschedule = async (booking: BookingRecord) => {
    const nextTime = window.prompt("Enter new time (ISO format, e.g. 2026-03-19T15:00:00+08:00)");
    if (!nextTime) return;
    try {
      await rescheduleBooking(booking.id, nextTime);
      const refreshed = await getMyBookings();
      setBookings(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reschedule booking.");
    }
  };

  const handleCreateCancellationRequest = async () => {
    if (!modalBooking) return;
    try {
      await requestBookingCancellation(modalBooking.id, cancelReason || undefined);
      setCancelFeedback("Cancellation request submitted. Admin will review it manually.");
      setCancelReason("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to submit cancellation request.";
      setCancelFeedback(message);
    }
  };

  const whatsappHref = useMemo(() => {
    if (!modalBooking) return "#";
    const message = encodeURIComponent(
      `Hi, I'd like to request cancellation for booking #${modalBooking.id} (${modalBooking.service_name}) on ${new Date(modalBooking.starts_at).toLocaleString("en-MY")}.`
    );
    return `https://wa.me/?text=${message}`;
  }, [modalBooking]);

  return (
    <>
      <h1 className="text-3xl font-semibold">My Bookings</h1>
      {loading ? <p className="mt-4">Loading bookings...</p> : null}
      {error ? <p className="mt-4 text-[var(--status-error)]">{error}</p> : null}
      <div className="mt-6 space-y-3">
        {bookings.map((booking) => {
          const state = getRescheduleState(booking);
          return (
            <div key={booking.id} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <p className="font-semibold">{booking.service_name}</p>
              <p className="text-sm text-[var(--text-muted)]">Staff: {booking.staff_name || "Any staff"}</p>
              <p className="text-sm text-[var(--text-muted)]">
                Date: {new Date(booking.starts_at).toLocaleDateString("en-MY", { dateStyle: "medium" })}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Time: {new Date(booking.starts_at).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="mt-1 text-sm">Status: {booking.status}</p>
              <p className="mt-1 text-sm">Rescheduled: {state.currentCount} / {policy.reschedule.max_changes}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded-full border px-4 py-2 text-sm">View</button>
                {state.allowed ? (
                  <button
                    onClick={() => handleReschedule(booking)}
                    className="rounded-full bg-[var(--accent-strong)] px-4 py-2 text-sm text-white"
                  >
                    Reschedule
                  </button>
                ) : (
                  <button
                    disabled
                    className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--text-muted)]"
                    title={state.withinCutoff ? `Booking time cannot be changed within ${policy.reschedule.cutoff_hours} hours.` : "Reschedule limit reached."}
                  >
                    Reschedule
                  </button>
                )}
                <button
                  onClick={() => {
                    setModalBooking(booking);
                    setCancelFeedback(null);
                    setCancelReason("");
                  }}
                  className="rounded-full border px-4 py-2 text-sm"
                >
                  Request Cancellation
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalBooking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h2 className="text-xl font-semibold">Request Cancellation</h2>
            <p className="mt-2 text-sm text-slate-600">
              Direct cancellation is disabled. Submit your request and admin will approve manually. Deposits are not refundable.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason (optional)"
              className="mt-4 w-full rounded-lg border border-slate-200 p-3 text-sm"
            />
            {cancelFeedback ? <p className="mt-2 text-sm text-emerald-700">{cancelFeedback}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="rounded-full bg-green-600 px-4 py-2 text-sm text-white">
                Send WhatsApp
              </a>
              <button onClick={handleCreateCancellationRequest} className="rounded-full border px-4 py-2 text-sm">
                Create Request Record
              </button>
              <button onClick={() => setModalBooking(null)} className="ml-auto rounded-full border px-4 py-2 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
