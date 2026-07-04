"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { formatBookingDateTime, formatBookingTime } from "@/lib/bookingTime";
import BookingServiceBlocksSection from "@/components/booking/BookingServiceBlocksSection";


function ServiceNameStack({ name, cnName }: { name: string; cnName?: string | null }) {
  return (
    <>
      <p className="font-semibold">{name}</p>
      {cnName ? <p className="mt-0.5 text-sm text-[var(--text-muted)]">{cnName}</p> : null}
    </>
  );
}

const defaultPolicy: BookingPolicy = {
  reschedule: { enabled: true, max_changes: 1, cutoff_hours: 72 },
  cancel: { customer_cancel_allowed: false, deposit_refundable: false },
};

const BOOKING_ACTION_STATUS = new Set(["CONFIRMED"]);
const BOOKING_PHOTO_UPLOAD_STATUS = new Set(["CONFIRMED", "HOLD"]);
const formatCurrency = (value?: number | string | null) => `RM ${Number(value ?? 0).toFixed(2)}`;

const isBookingProductRecord = (booking: BookingRecord) => String(booking.item_type ?? "").toLowerCase() === "booking_product";

const bookingProductOptions = (booking: BookingRecord) =>
  (booking.selected_booking_product_options ?? []).flatMap((group) => group.options ?? []);
const normalizeStatus = (value?: string | null) => String(value || "—").toUpperCase();

const bookingBadgeClass = (value?: string | null) => {
  const status = normalizeStatus(value);
  if (["CONFIRMED", "PAID", "COMPLETED"].includes(status)) return "bg-emerald-100 text-emerald-700";
  if (["HOLD", "PARTIAL", "PENDING"].includes(status)) return "bg-amber-100 text-amber-700";
  if (["CANCELLED", "CANCELED", "UNPAID", "FAILED"].includes(status)) return "bg-rose-100 text-rose-700";
  return "bg-[var(--background)] text-[var(--foreground)]";
};

const pickPaymentNumber = (...values: Array<number | null | undefined>) => {
  for (const value of values) {
    const numeric = Number(value ?? NaN);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return 0;
};

const getPaymentSummary = (booking: BookingRecord) => {
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
  const helperText = paymentStatus === "UNPAID"
    ? "No payment received yet."
    : paymentStatus === "PARTIAL"
      ? "Deposit received. Remaining balance will be paid at the salon."
      : "Fully paid.";

  return { serviceTotal, addonTotal, depositPaid, settlementPaid, packageOffset, balanceDue, totalPaid, paymentStatus, helperText };
};

const resolveServicePhotoUrl = (photo: { image_url?: string | null; image_path?: string | null }) => {
  const path = photo.image_url || photo.image_path || '';
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.startsWith('/storage/') ? normalized : `/storage${normalized}`;
};

type PhotoLightboxItem = { url: string; alt?: string };

const getReferencePhotoUploadState = (booking: BookingRecord) => {
  const count = booking.uploaded_item_photos?.length ?? 0;
  const serviceAllows = booking.service?.allow_photo_upload ?? false;
  const statusAllows = BOOKING_PHOTO_UPLOAD_STATUS.has(String(booking.status));

  if (!serviceAllows) {
    return { canUpload: false, reason: "Photo upload is not available for this service." };
  }
  if (!statusAllows) {
    return { canUpload: false, reason: "Upload is not available for this booking status." };
  }
  if (count >= 3) {
    return { canUpload: false, reason: "You have reached the maximum of 3 reference photos." };
  }
  return { canUpload: true, reason: null };
};

export default function BookingDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const bookingId = Number(params.id);
  const { user, loading: authLoading } = useAuth();

  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [policy, setPolicy] = useState<BookingPolicy>(defaultPolicy);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalBooking, setModalBooking] = useState<BookingRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [rescheduleBookingModal, setRescheduleBookingModal] = useState<BookingRecord | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleFeedback, setRescheduleFeedback] = useState<string | null>(null);
  const [photoBusyBookingId, setPhotoBusyBookingId] = useState<number | null>(null);
  const [photoModal, setPhotoModal] = useState<"completed" | "reference" | null>(null);
  const [referenceUploadOpen, setReferenceUploadOpen] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState<{ items: PhotoLightboxItem[]; index: number } | null>(null);

  const closePhotoModals = () => {
    setPhotoModal(null);
    setReferenceUploadOpen(false);
    setPhotoLightbox(null);
  };

  const openPhotoLightbox = (items: PhotoLightboxItem[], index: number) => {
    if (!items[index]?.url) return;
    setPhotoLightbox({ items, index });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/account/bookings/${bookingId || ""}`);
    }
  }, [authLoading, user, router, bookingId]);

  const reload = useCallback(async () => {
    setError(null);
    const [myBookings, bookingPolicy] = await Promise.all([getMyBookings(), getBookingPolicySettings()]);
    const matchedBooking = myBookings.find((item) => item.id === bookingId);
    setBookings(matchedBooking ? [matchedBooking] : []);
    setPolicy(bookingPolicy);
    if (!matchedBooking) {
      setError("Booking not found.");
    }
  }, [bookingId]);

  useEffect(() => {
    if (!user || !Number.isFinite(bookingId)) return;
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
  }, [user, bookingId, reload]);

  const getActionState = (booking: BookingRecord) => {
    const now = Date.now();
    const bookingAt = booking.starts_at ? new Date(booking.starts_at).getTime() : 0;
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

  const toIsoWithOffset = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const offsetHH = pad(Math.floor(abs / 60));
    const offsetMM = pad(abs % 60);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${offsetHH}:${offsetMM}`;
  };

  const getRescheduleTimeOptions = () => {
    const options: string[] = [];
    for (let minutes = 9 * 60; minutes <= 20 * 60; minutes += 30) {
      const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
      const mm = String(minutes % 60).padStart(2, "0");
      options.push(`${hh}:${mm}`);
    }
    return options;
  };

  const openRescheduleModal = (booking: BookingRecord) => {
    const start = new Date(booking.starts_at || new Date().toISOString());
    const yyyy = String(start.getFullYear());
    const mm = String(start.getMonth() + 1).padStart(2, "0");
    const dd = String(start.getDate()).padStart(2, "0");
    const hh = String(start.getHours()).padStart(2, "0");
    const min = String(start.getMinutes()).padStart(2, "0");

    setRescheduleBookingModal(booking);
    setRescheduleDate(`${yyyy}-${mm}-${dd}`);
    setRescheduleTime(`${hh}:${min}`);
    setRescheduleFeedback(null);
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleBookingModal) return;
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleFeedback("Please select a date and time.");
      return;
    }

    const [yearRaw, monthRaw, dayRaw] = rescheduleDate.split("-");
    const [hourRaw, minuteRaw] = rescheduleTime.split(":");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute)
    ) {
      setRescheduleFeedback("Invalid date/time.");
      return;
    }

    const nextLocal = new Date(year, month - 1, day, hour, minute, 0, 0);
    const nextIso = toIsoWithOffset(nextLocal);

    try {
      setRescheduleSubmitting(true);
      setRescheduleFeedback(null);
      await rescheduleBooking(rescheduleBookingModal.id, nextIso);
      await reload();
      setRescheduleBookingModal(null);
    } catch (err) {
      setRescheduleFeedback(err instanceof Error ? err.message : "Unable to reschedule booking.");
    } finally {
      setRescheduleSubmitting(false);
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
      const compressImageToFile = async (file: File) => {
        const sourceBitmap = await createImageBitmap(file);
        const srcW = sourceBitmap.width;
        const srcH = sourceBitmap.height;
        const maxLongEdge = 1600;
        const longEdge = Math.max(srcW, srcH);
        const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
        const targetW = Math.max(1, Math.round(srcW * scale));
        const targetH = Math.max(1, Math.round(srcH * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          sourceBitmap.close();
          return file;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(sourceBitmap, 0, 0, targetW, targetH);
        sourceBitmap.close();

        const preferWebp = (() => {
          try {
            return canvas.toDataURL("image/webp").startsWith("data:image/webp");
          } catch {
            return false;
          }
        })();
        const outType = preferWebp ? "image/webp" : "image/jpeg";
        const quality = 0.78;

        const blob: Blob | null = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), outType, quality);
        });
        if (!blob) return file;

        const ext = outType === "image/webp" ? "webp" : "jpg";
        const nextName = file.name.replace(/\.[^/.]+$/, "") + `.${ext}`;
        return new File([blob], nextName, { type: outType, lastModified: Date.now() });
      };

      const processedFiles = await Promise.all(filesToUpload.map((file) => compressImageToFile(file)));
      await uploadMyBookingItemPhotos(booking.id, processedFiles);
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

  const currentBooking = bookings[0] ?? null;
  const currentPayment = currentBooking ? getPaymentSummary(currentBooking) : null;
  const referenceUploadState = currentBooking ? getReferencePhotoUploadState(currentBooking) : null;
  const completedLightboxItems: PhotoLightboxItem[] = currentBooking
    ? (currentBooking.service_photos ?? [])
        .map((photo, index) => ({
          url: resolveServicePhotoUrl(photo),
          alt: photo.caption || `Completed photo ${index + 1}`,
        }))
        .filter((item) => Boolean(item.url))
    : [];
  const referenceLightboxItems: PhotoLightboxItem[] = currentBooking
    ? (currentBooking.uploaded_item_photos ?? [])
        .map((photo) => ({
          url: photo.file_url,
          alt: photo.original_name || "Reference photo",
        }))
        .filter((item) => Boolean(item.url))
    : [];

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-[var(--text-muted)]">Account / My Bookings / {currentBooking?.booking_code || (bookingId ? `BOOKING-${bookingId}` : "Booking")}</p>
          <h1 className="text-3xl font-semibold">Booking Details</h1>
          <p className="mt-1 font-mono text-sm text-[var(--text-muted)]">
            {currentBooking?.booking_code || (bookingId ? `BOOKING-${bookingId}` : "Booking")}
          </p>
          {currentBooking && currentPayment ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${bookingBadgeClass(currentBooking.status)}`}>
                Status: {normalizeStatus(currentBooking.status)}
              </span>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${bookingBadgeClass(currentPayment.paymentStatus)}`}>
                Payment: {currentPayment.paymentStatus}
              </span>
            </div>
          ) : null}
        </div>
        <Link href="/account/bookings" className="inline-flex w-fit rounded-full border border-[var(--card-border)] px-4 py-2 text-sm font-medium">
          Back to My Bookings
        </Link>
      </div>

      {loading ? <p className="mt-4">Loading booking...</p> : null}
      {error ? <p className="mt-4 text-[var(--status-error)]">{error}</p> : null}

      <div className="mt-6 space-y-4">
        {bookings.map((booking) => {
          const state = getActionState(booking);
          const payment = getPaymentSummary(booking);
          const isBookingProduct = isBookingProductRecord(booking);
          const productOptions = bookingProductOptions(booking);
          const startsAt = booking.starts_at ? new Date(booking.starts_at) : null;
          const duration = Number(booking.estimated_duration_min ?? 0) ||
            Number(booking.service?.duration_min ?? 0) + Number(booking.addon_total_duration_min ?? 0);
          const canPayNow = String(booking.status).toUpperCase() === "HOLD" && payment.paymentStatus !== "PAID";
          const hasActions = canPayNow || state.canReschedule || state.canRequestCancellation || state.hasPendingCancellation;

          return (
            <div key={booking.id} className="space-y-4">
              <section>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-3 sm:col-span-2">
                    {isBookingProduct ? (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Booking Product</p>
                        <div className="mt-1">
                          <ServiceNameStack name={booking.service_name} cnName={booking.service_cn_name ?? booking.service?.cn_name} />
                        </div>
                      </>
                    ) : (
                      <BookingServiceBlocksSection booking={booking} />
                    )}
                  </div>

                  {isBookingProduct ? (
                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-3 sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Options</p>
                      {productOptions.length > 0 ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {productOptions.map((option, index) => (
                            <div key={`${option.id ?? option.label ?? index}`} className="rounded-lg bg-[var(--card)] p-3 text-sm">
                              <p className="font-medium">{option.label}</p>
                              {option.cn_label ? <p className="mt-0.5 text-xs text-[var(--text-muted)]">{option.cn_label}</p> : null}
                              <p className="mt-1 text-xs text-[var(--text-muted)]">{formatCurrency(option.extra_price)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-[var(--text-muted)]">No options selected.</p>
                      )}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Staff</p>
                    <p className="mt-1 font-medium">{isBookingProduct ? "-" : (booking.staff_name || "Any staff")}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Date</p>
                    <p className="mt-1 font-medium">{startsAt && !isBookingProduct ? startsAt.toLocaleDateString("en-MY", { dateStyle: "medium" }) : "-"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Time</p>
                    <p className="mt-1 font-medium">{isBookingProduct ? "-" : formatBookingTime(booking)}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Duration</p>
                    <p className="mt-1 font-medium">{isBookingProduct ? "-" : (duration > 0 ? `${duration} mins` : "—")}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-3 sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Rescheduled</p>
                    <p className="mt-1 font-medium">{state.currentCount} / {policy.reschedule.max_changes}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Reschedule is only allowed more than {policy.reschedule.cutoff_hours} hours before the booking time.
                    </p>
                  </div>
                </div>

                {booking.customer_remarks ? (
                  <div className="mt-4 rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-3">
                    <p className="text-sm font-semibold">Remarks</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-muted)]">{booking.customer_remarks}</p>
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold">Payment Summary</p>
                    <p className="text-xs text-[var(--text-muted)]">Deposit and remaining balance</p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${bookingBadgeClass(payment.paymentStatus)}`}>
                    {payment.paymentStatus}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4"><span className="text-[var(--text-muted)]">Service Total</span><span className="font-medium">{formatCurrency(payment.serviceTotal)}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="text-[var(--text-muted)]">Add-ons</span><span className="font-medium">{formatCurrency(payment.addonTotal)}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="text-[var(--text-muted)]">Deposit Paid</span><span className="font-medium text-emerald-700">{formatCurrency(payment.depositPaid)}</span></div>
                  {payment.packageOffset > 0 ? (
                    <div className="flex items-center justify-between gap-4"><span className="text-[var(--text-muted)]">Package Offset</span><span className="font-medium">-{formatCurrency(payment.packageOffset)}</span></div>
                  ) : null}
                  <div className="flex items-center justify-between gap-4"><span className="text-[var(--text-muted)]">Paid In Store</span><span className="font-medium">{formatCurrency(payment.settlementPaid)}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="text-[var(--text-muted)]">Total Paid</span><span className="font-medium">{formatCurrency(payment.totalPaid)}</span></div>
                  <div className="border-t border-[var(--card-border)] pt-3">
                    <div className="flex items-center justify-between gap-4 text-base"><span className="font-semibold">Balance Due</span><span className="font-semibold text-[var(--accent-strong)]">{formatCurrency(payment.balanceDue)}</span></div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-[var(--background)]/30 p-3 text-sm text-[var(--text-muted)]">
                  <p>{payment.helperText}</p>
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--background)]">
                    <i className="fa-regular fa-images text-[var(--text-muted)]" aria-hidden />
                  </span>
                  <div>
                    <p className="text-lg font-semibold">Booking Photos</p>
                    <p className="text-xs text-[var(--text-muted)]">View your reference uploads and completed service photos</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPhotoModal("completed")}
                    className="flex items-start gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-4 text-left transition hover:border-[var(--accent-strong)]/40 hover:bg-[var(--background)]/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--card)]">
                      <i className="fa-solid fa-check text-[var(--accent-strong)]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--foreground)]">Completed Photo</span>
                      <span className="mt-0.5 block text-xs text-[var(--text-muted)]">Photos from your completed visit</span>
                      {(booking.service_photos?.length ?? 0) > 0 ? (
                        <span className="mt-2 inline-flex rounded-full bg-[var(--muted)]/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                          {booking.service_photos?.length} photo(s)
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoModal("reference")}
                    className="flex items-start gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-4 text-left transition hover:border-[var(--accent-strong)]/40 hover:bg-[var(--background)]/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--card)]">
                      <i className="fa-regular fa-image text-[var(--text-muted)]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--foreground)]">Reference Photo</span>
                      <span className="mt-0.5 block text-xs text-[var(--text-muted)]">Your uploads for the salon team</span>
                      <span className="mt-2 inline-flex rounded-full bg-[var(--muted)]/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {booking.uploaded_item_photos?.length ?? 0}/3 uploaded
                      </span>
                    </span>
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
                <p className="text-lg font-semibold">Actions</p>
                {hasActions ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canPayNow ? (
                      <button
                        type="button"
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
                      <button type="button" onClick={() => openRescheduleModal(booking)} className="rounded-full bg-[var(--accent-strong)] px-4 py-2 text-sm text-white">
                        Reschedule
                      </button>
                    ) : null}

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

                    {state.hasPendingCancellation ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700">
                        Cancellation Requested
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--text-muted)]">No payment or booking changes are available right now.</p>
                )}
              </section>
            </div>
          );
        })}
      </div>

      {modalBooking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h2 className="text-xl font-semibold">Request Cancellation</h2>
            <div className="mt-2 text-sm text-slate-600">
              <p>Booking #{modalBooking.id}</p>
              <ServiceNameStack name={modalBooking.service_name} cnName={modalBooking.service_cn_name ?? modalBooking.service?.cn_name} />
              <p>{formatBookingDateTime(modalBooking)}</p>
            </div>
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

      {rescheduleBookingModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h2 className="text-xl font-semibold">Reschedule Booking</h2>
            <div className="mt-2 text-sm text-slate-600">
              <p>Booking #{rescheduleBookingModal.id}</p>
              <ServiceNameStack
                name={rescheduleBookingModal.service_name}
                cnName={rescheduleBookingModal.service_cn_name ?? rescheduleBookingModal.service?.cn_name}
              />
              <p>Current: {formatBookingDateTime(rescheduleBookingModal)}</p>
            </div>
            <p className="mt-2 text-sm text-slate-600">Pick a new date and time. We’ll confirm availability after you submit.</p>
            <p className="mt-2 text-xs text-slate-500">
              Note: Reschedule is only allowed more than {policy.reschedule.cutoff_hours} hours before the booking time.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Date</span>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Time</span>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {getRescheduleTimeOptions().map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {rescheduleFeedback ? <p className="mt-3 text-sm text-[var(--status-error)]">{rescheduleFeedback}</p> : null}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => void handleConfirmReschedule()}
                disabled={rescheduleSubmitting}
                className="rounded-full bg-[var(--accent-strong)] px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {rescheduleSubmitting ? "Rescheduling..." : "Confirm Reschedule"}
              </button>
              <button
                onClick={() => setRescheduleBookingModal(null)}
                disabled={rescheduleSubmitting}
                className="ml-auto rounded-full border px-4 py-2 text-sm disabled:opacity-60"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {photoModal && currentBooking ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={closePhotoModals}
        >
          <div
            className="flex max-h-[min(90dvh,800px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">
                  {photoModal === "completed" ? "Completed Photo" : "Reference Photo"}
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Tap a photo to view it larger.</p>
                {photoModal === "reference" && referenceUploadState?.canUpload ? (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Use Upload Photo below to add more.</p>
                ) : null}
                {photoModal === "reference" && !referenceUploadState?.canUpload && referenceUploadState?.reason ? (
                  <p className="mt-2 rounded-lg bg-amber-50 text-xs font-medium text-amber-800">
                    {referenceUploadState.reason}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closePhotoModals}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--muted)]/40 hover:text-[var(--foreground)]"
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
              {photoModal === "completed" ? (
                (currentBooking.service_photos?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(currentBooking.service_photos ?? []).map((photo, index) => {
                      const url = resolveServicePhotoUrl(photo);
                      return (
                        <button
                          key={`service-photo-modal-${currentBooking.id}-${photo.id}`}
                          type="button"
                          onClick={() => {
                            if (!url) return;
                            const lbIndex = completedLightboxItems.findIndex((item) => item.url === url);
                            openPhotoLightbox(completedLightboxItems, lbIndex >= 0 ? lbIndex : 0);
                          }}
                          className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 shadow-sm transition hover:ring-2 hover:ring-[var(--accent-strong)]/50"
                        >
                          {url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={url}
                              alt={photo.caption || `Completed photo ${index + 1}`}
                              className="aspect-square w-full object-cover"
                            />
                          ) : (
                            <span className="flex aspect-square items-center justify-center p-2 text-center text-[10px] text-[var(--text-muted)]">
                              Image unavailable
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl bg-[var(--background)]/20 p-4 text-sm text-[var(--text-muted)]">
                    No completed photos yet. They will appear here after your visit.
                  </p>
                )
              ) : referenceLightboxItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {referenceLightboxItems.map((item, index) => (
                    <button
                      key={`reference-view-${currentBooking.id}-${index}`}
                      type="button"
                      onClick={() => openPhotoLightbox(referenceLightboxItems, index)}
                      className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 shadow-sm transition hover:ring-2 hover:ring-[var(--accent-strong)]/50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.alt} className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-[var(--background)]/20 p-4 text-sm text-[var(--text-muted)]">
                  No reference photos uploaded yet.
                </p>
              )}
            </div>

            <div
              className={[
                "border-t border-[var(--card-border)] px-5 py-4",
                photoModal === "reference" && referenceUploadState?.canUpload
                  ? "flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3"
                  : "",
              ].join(" ")}
            >
              {photoModal === "reference" && referenceUploadState?.canUpload ? (
                <button
                  type="button"
                  onClick={() => setReferenceUploadOpen(true)}
                  className="w-full rounded-full bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 sm:flex-1"
                >
                  <i className="fa-solid fa-cloud-arrow-up mr-2" aria-hidden />
                  Upload Photo
                </button>
              ) : null}
              <button
                type="button"
                onClick={closePhotoModals}
                className={[
                  "w-full rounded-full border border-[var(--card-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--background)]/40",
                  photoModal === "reference" && referenceUploadState?.canUpload ? "sm:flex-1" : "",
                ].join(" ")}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {referenceUploadOpen && currentBooking && photoModal === "reference" ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setReferenceUploadOpen(false)}
        >
          <div
            className="flex max-h-[min(90dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reference-upload-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4">
              <div>
                <h2 id="reference-upload-title" className="text-xl font-semibold text-[var(--foreground)]">
                  Upload Reference Photo
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Up to 3 photos. Tap an empty slot to add.</p>
              </div>
              <button
                type="button"
                onClick={() => setReferenceUploadOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--muted)]/40 hover:text-[var(--foreground)]"
                aria-label="Close upload"
              >
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <input
                id={`booking-photo-input-${currentBooking.id}`}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={
                  photoBusyBookingId === currentBooking.id || !referenceUploadState?.canUpload
                }
                onChange={(event) => {
                  void handleBookingPhotoUpload(currentBooking, event.target.files);
                  event.currentTarget.value = "";
                }}
              />

              <div className="mb-3 flex items-center justify-between gap-2 text-xs font-semibold text-[var(--text-muted)]">
                <span>Slots</span>
                <span>{(currentBooking.uploaded_item_photos?.length ?? 0)}/3</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 3 }).map((_, index) => {
                      const photo = currentBooking.uploaded_item_photos?.[index] ?? null;
                      const isEmpty = !photo;
                      const canUpload =
                        Boolean(referenceUploadState?.canUpload) &&
                        photoBusyBookingId !== currentBooking.id;

                      return (
                        <button
                          key={index}
                          type="button"
                          className={[
                            "group relative aspect-square overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200",
                            isEmpty
                              ? "border-[var(--card-border)] bg-[var(--muted)]/10 hover:bg-[var(--muted)]/20"
                              : "border-[var(--card-border)] bg-[var(--card)] shadow-sm hover:shadow-md",
                          ].join(" ")}
                          onClick={() => {
                            if (isEmpty && canUpload) {
                              const input = document.getElementById(
                                `booking-photo-input-${currentBooking.id}`,
                              ) as HTMLInputElement | null;
                              input?.click();
                            }
                          }}
                          disabled={photoBusyBookingId === currentBooking.id || (isEmpty && !canUpload)}
                          aria-label={isEmpty ? "Click to upload" : `Photo ${index + 1}`}
                        >
                          {isEmpty ? (
                            <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
                              <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--muted)]/40 transition group-hover:bg-[var(--muted)]/60">
                                <i className="fa-solid fa-cloud-arrow-up text-sm text-[var(--text-muted)]" aria-hidden />
                              </div>
                              <span className="text-[10px] font-medium text-[var(--text-muted)]">Click to upload</span>
                            </div>
                          ) : (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.file_url}
                                alt={photo.original_name || "Reference photo"}
                                className="h-full w-full object-cover"
                              />
                              {BOOKING_PHOTO_UPLOAD_STATUS.has(String(currentBooking.status)) ? (
                                <button
                                  type="button"
                                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
                                  disabled={photoBusyBookingId === currentBooking.id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleRemoveBookingPhoto(currentBooking.id, photo.id);
                                  }}
                                  aria-label={`Remove ${photo.original_name || "photo"}`}
                                >
                                  <i className="fa-solid fa-xmark text-[10px]" />
                                </button>
                              ) : null}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>

              {photoBusyBookingId === currentBooking.id ? (
                <p className="mt-3 text-center text-xs text-[var(--text-muted)]">Uploading…</p>
              ) : null}
            </div>

            <div className="border-t border-[var(--card-border)] px-5 py-4">
              <button
                type="button"
                onClick={() => setReferenceUploadOpen(false)}
                className="w-full rounded-full border border-[var(--card-border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--background)]/40"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {photoLightbox ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          role="presentation"
          onClick={() => setPhotoLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setPhotoLightbox(null)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close preview"
          >
            <i className="fa-solid fa-xmark text-lg" aria-hidden />
          </button>

          {photoLightbox.items.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setPhotoLightbox((prev) => {
                    if (!prev) return prev;
                    const nextIndex = (prev.index - 1 + prev.items.length) % prev.items.length;
                    return { ...prev, index: nextIndex };
                  });
                }}
                className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
                aria-label="Previous photo"
              >
                <i className="fa-solid fa-chevron-left" aria-hidden />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setPhotoLightbox((prev) => {
                    if (!prev) return prev;
                    const nextIndex = (prev.index + 1) % prev.items.length;
                    return { ...prev, index: nextIndex };
                  });
                }}
                className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
                aria-label="Next photo"
              >
                <i className="fa-solid fa-chevron-right" aria-hidden />
              </button>
            </>
          ) : null}

          <div
            className="flex max-h-[92dvh] max-w-[min(96vw,1100px)] flex-col items-center"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoLightbox.items[photoLightbox.index]?.url}
              alt={photoLightbox.items[photoLightbox.index]?.alt || "Photo preview"}
              className="max-h-[min(82dvh,900px)] w-auto max-w-full rounded-lg object-contain"
            />
            {photoLightbox.items.length > 1 ? (
              <p className="mt-3 text-sm text-white/80">
                {photoLightbox.index + 1} / {photoLightbox.items.length}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
