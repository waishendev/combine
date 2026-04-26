"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getBookingPolicySettings,
  getMyBookings,
  payBooking,
  removeMyBookingItemPhoto,
  requestBookingCancellation,
  rescheduleBooking,
  uploadMyBookingItemPhotos,
} from "@/lib/apiClient";
import { BookingPolicy, BookingRecord } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

const defaultPolicy: BookingPolicy = {
  reschedule: { enabled: true, max_changes: 1, cutoff_hours: 72 },
  cancel: { customer_cancel_allowed: false, deposit_refundable: false },
};

const BOOKING_ACTION_STATUS = new Set(["CONFIRMED"]);
const BOOKING_PHOTO_UPLOAD_STATUS = new Set(["CONFIRMED", "HOLD"]);
const formatCurrency = (value?: number | null) => `RM ${Number(value ?? 0).toFixed(2)}`;

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
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [photoBusyBookingId, setPhotoBusyBookingId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/account/bookings");
    }
  }, [authLoading, user, router]);

  const reload = async () => {
    const [myBookings, bookingPolicy] = await Promise.all([getMyBookings(), getBookingPolicySettings()]);
    setBookings(myBookings);
    setPolicy(bookingPolicy);
  };

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      setLoading(true);
      try {
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to fetch bookings");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user]);

  const getActionState = (booking: BookingRecord) => {
    const now = Date.now();
    const bookingAt = new Date(booking.starts_at).getTime();
    const isFuture = bookingAt > now;
    const isActionStatus = BOOKING_ACTION_STATUS.has(booking.status);
    const currentCount = Number(booking.reschedule_count ?? 0);
    const cutoffTime = now + policy.reschedule.cutoff_hours * 60 * 60 * 1000;
    const passesCutoff = bookingAt >= cutoffTime;
    const hasPendingCancellation = booking.cancellation_request?.status === "pending";

    const canReschedule =
      isActionStatus &&
      isFuture &&
      policy.reschedule.enabled &&
      passesCutoff &&
      currentCount < policy.reschedule.max_changes;

    const canRequestCancellation = isActionStatus && isFuture && !hasPendingCancellation;

    return {
      canReschedule,
      canRequestCancellation,
      hasPendingCancellation,
      currentCount,
      isFuture,
      passesCutoff,
    };
  };

  const handleReschedule = async (booking: BookingRecord) => {
    const nextTime = window.prompt("Enter new time (ISO format, e.g. 2026-03-19T15:00:00+08:00)");
    if (!nextTime) return;

    try {
      await rescheduleBooking(booking.id, nextTime);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reschedule booking.");
    }
  };

  const handleCreateCancellationRequest = async () => {
    if (!modalBooking) return;

    try {
      setCancelSubmitting(true);
      await requestBookingCancellation(modalBooking.id, cancelReason || undefined);
      setCancelFeedback("Cancellation request submitted. Our team will review it.");
      setCancelReason("");
      await reload();
    } catch (err) {
      setCancelFeedback(err instanceof Error ? err.message : "Unable to submit cancellation request.");
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleBookingPhotoUpload = async (booking: BookingRecord, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    const existing = booking.uploaded_item_photos ?? [];
    const remaining = 3 - existing.length;

    if (remaining <= 0) {
      setError("Maximum 3 photos are allowed for this booking.");
      return;
    }

    if (!BOOKING_PHOTO_UPLOAD_STATUS.has(String(booking.status))) {
      setError("Photo upload is only available for HOLD or CONFIRMED bookings.");
      return;
    }

    if (!(booking.service?.allow_photo_upload ?? false)) {
      setError("This service does not allow photo upload.");
      return;
    }

    const filesToUpload = selected.slice(0, remaining);
    if (filesToUpload.some((file) => !file.type.startsWith("image/"))) {
      setError("Only image files are allowed.");
      return;
    }

    if (filesToUpload.some((file) => file.size > 5 * 1024 * 1024)) {
      setError("Each photo must be 5MB or smaller.");
      return;
    }

    try {
      setPhotoBusyBookingId(booking.id);
      setError(null);
      await uploadMyBookingItemPhotos(booking.id, filesToUpload);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload booking photos.");
    } finally {
      setPhotoBusyBookingId(null);
    }
  };

  const handleRemoveBookingPhoto = async (bookingId: number, photoId: number) => {
    try {
      setPhotoBusyBookingId(bookingId);
      setError(null);
      await removeMyBookingItemPhoto(bookingId, photoId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove booking photo.");
    } finally {
      setPhotoBusyBookingId(null);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-semibold">My Bookings</h1>
      {loading ? <p className="mt-4">Loading bookings...</p> : null}
      {error ? <p className="mt-4 text-[var(--status-error)]">{error}</p> : null}

      <div className="mt-6 space-y-3">
        {bookings.map((booking) => {
          const state = getActionState(booking);

          return (
            <div key={booking.id} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <p className="font-semibold">{booking.service_name}</p>
              {(booking.add_ons?.length ?? 0) > 0 ? (
                <div className="mt-2 rounded-xl border border-[var(--card-border)] bg-[var(--background)]/60 p-3">
                  <p className="text-sm font-semibold">Selected Add-ons</p>
                  <div className="mt-1 space-y-1">
                    {booking.add_ons?.map((addon, index) => (
                      <p key={`${addon.id ?? addon.name}-${index}`} className="text-sm text-[var(--text-muted)]">
                        {addon.name} (+{Number(addon.extra_duration_min ?? 0)} mins, +{formatCurrency(Number(addon.extra_price ?? 0))})
                      </p>
                    ))}
                    <p className="pt-1 text-sm font-medium text-[var(--foreground)]">
                      Summary: +{Number(booking.addon_total_duration_min ?? 0)} mins, +{formatCurrency(booking.addon_total_price)}
                    </p>
                  </div>
                </div>
              ) : null}
              <p className="text-sm text-[var(--text-muted)]">Staff: {booking.staff_name || "Any staff"}</p>
              <p className="text-sm text-[var(--text-muted)]">
                Date: {new Date(booking.starts_at).toLocaleDateString("en-MY", { dateStyle: "medium" })}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Time: {new Date(booking.starts_at).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="mt-1 text-sm">Status: {booking.status}</p>
              <p className="mt-1 text-sm">Rescheduled: {state.currentCount} / {policy.reschedule.max_changes}</p>

              {(booking.service?.allow_photo_upload ?? false) || (booking.uploaded_item_photos?.length ?? 0) > 0 ? (
                <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-[var(--background)]/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Reference Photos</p>
                    <label className="inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-medium">
                      {(booking.uploaded_item_photos?.length ?? 0) > 0 ? "Upload More" : "Upload Photos"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={
                          photoBusyBookingId === booking.id ||
                          !BOOKING_PHOTO_UPLOAD_STATUS.has(String(booking.status)) ||
                          !(booking.service?.allow_photo_upload ?? false) ||
                          (booking.uploaded_item_photos?.length ?? 0) >= 3
                        }
                        onChange={(event) => {
                          void handleBookingPhotoUpload(booking, event.target.files);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    You can upload up to 3 photos. Upload is available only for HOLD or CONFIRMED bookings.
                  </p>

                  {(booking.uploaded_item_photos?.length ?? 0) > 0 ? (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {booking.uploaded_item_photos?.map((photo) => (
                        <div key={photo.id} className="relative overflow-hidden rounded border border-[var(--card-border)]">
                          <a href={photo.file_url} target="_blank" rel="noreferrer" className="block">
                            <img src={photo.file_url} alt={photo.original_name || "Booking photo"} className="h-20 w-full object-cover" />
                          </a>
                          {BOOKING_PHOTO_UPLOAD_STATUS.has(String(booking.status)) ? (
                            <button
                              type="button"
                              className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
                              disabled={photoBusyBookingId === booking.id}
                              onClick={() => void handleRemoveBookingPhoto(booking.id, photo.id)}
                            >
                              <i className="fa-solid fa-xmark text-[10px]" />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">No photos uploaded yet.</p>
                  )}
                </div>
              ) : null}

              {(booking.receipts?.length ?? 0) > 0 ? (
                <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-[var(--background)]/60 p-3">
                  <p className="text-sm font-semibold">Receipts</p>
                  <div className="mt-2 space-y-2">
                    {booking.receipts?.map((receipt, index) => (
                      <div key={`${receipt.order_id}-${receipt.line_type}-${index}`} className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{receipt.stage_label || "Receipt"}</p>
                          <p>Order: {receipt.order_number} · Amount: RM {Number(receipt.amount ?? 0).toFixed(2)}</p>
                        </div>
                        {receipt.receipt_public_url ? (
                          <a
                            href={receipt.receipt_public_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border px-3 py-1 text-[11px] font-medium text-[var(--foreground)]"
                          >
                            Open Receipt
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {state.hasPendingCancellation ? (
                <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  Cancellation Requested
                </span>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const nextParams = new URLSearchParams({
                      order_id: String(booking.id),
                      payment_method: String(booking.latest_payment?.payment_method || "manual_transfer"),
                      provider: String(booking.latest_payment?.provider || "manual"),
                    });
                    if (booking.booking_code) {
                      nextParams.set("order_no", booking.booking_code);
                    }
                    router.push(`/payment-result?${nextParams.toString()}`);
                  }}
                  className="rounded-full border px-4 py-2 text-sm"
                >
                  View
                </button>

                {booking.payment_status !== "PAID" ? (
                  <button
                    onClick={async () => {
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
                    }}
                    className="rounded-full bg-[var(--accent-strong)] px-4 py-2 text-sm text-white"
                  >
                    Pay Now
                  </button>
                ) : null}

                {state.canReschedule ? (
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
                    title={!state.isFuture ? "Booking is in the past." : !state.passesCutoff ? `Booking time cannot be changed within ${policy.reschedule.cutoff_hours} hours.` : "Reschedule is unavailable for this booking status."}
                  >
                    Reschedule
                  </button>
                )}

                {state.canRequestCancellation ? (
                  <button
                    onClick={() => {
                      setModalBooking(booking);
                      setCancelReason("");
                      setCancelFeedback(null);
                    }}
                    className="rounded-full border px-4 py-2 text-sm"
                  >
                    Request Cancellation
                  </button>
                ) : null}
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
              Booking #{modalBooking.id} · {modalBooking.service_name} · {new Date(modalBooking.starts_at).toLocaleString("en-MY")}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              This sends a request to our team. Your booking remains CONFIRMED until review.
            </p>

            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason (optional)"
              className="mt-4 w-full rounded-lg border border-slate-200 p-3 text-sm"
            />

            {cancelFeedback ? <p className="mt-2 text-sm text-emerald-700">{cancelFeedback}</p> : null}

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleCreateCancellationRequest}
                disabled={cancelSubmitting}
                className="rounded-full border px-4 py-2 text-sm"
              >
                {cancelSubmitting ? "Submitting..." : "Submit Request"}
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
