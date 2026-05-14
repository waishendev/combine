"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { ServiceTierBadge } from "@/components/booking/ServiceTierBadge";
import { addCartItem, getAvailabilityPooled, getBookingServiceDetail, uploadBookingCartItemPhotos } from "@/lib/apiClient";
import { depositPreviewForService } from "@/lib/bookingDepositPreview";
import { clearBookingPhotoDraft, loadBookingPhotoDraft } from "@/lib/bookingPhotoDraft";
import { Service, Staff } from "@/lib/types";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

type ServiceDetail = Service & { staffs?: Staff[] };

export default function ServiceStaffPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;
  const selectedOptionIdsParam = searchParams.get("selected_option_ids") || "";
  const categoryId = searchParams.get("category_id");
  const remarksParam = searchParams.get("remarks") || "";
  const slotDate = searchParams.get("date") || "";
  const startAt = searchParams.get("start_at") || "";
  const endAt = searchParams.get("end_at") || "";
  const availableStaffIdsParam = searchParams.get("available_staff_ids") || "";

  const selectedOptionIds = useMemo(
    () => selectedOptionIdsParam.split(",").map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0),
    [selectedOptionIdsParam]
  );

  const availableStaffIds = useMemo(
    () => availableStaffIdsParam.split(",").map((v) => Number.parseInt(v, 10)).filter((n) => Number.isFinite(n) && n > 0),
    [availableStaffIdsParam]
  );

  const slotsBackQs = new URLSearchParams();
  if (selectedOptionIdsParam) slotsBackQs.set("selected_option_ids", selectedOptionIdsParam);
  if (categoryId) slotsBackQs.set("category_id", categoryId);
  if (remarksParam) slotsBackQs.set("remarks", remarksParam);
  const slotsBackHref = `/booking/service/${id}/slots${slotsBackQs.toString() ? `?${slotsBackQs.toString()}` : ""}`;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifiedAvailableStaffIds, setVerifiedAvailableStaffIds] = useState<number[] | null>(null);
  const [verifyingAvailability, setVerifyingAvailability] = useState(false);
  const [confirmStaff, setConfirmStaff] = useState<Staff | null>(null);
  const [adding, setAdding] = useState(false);
  const [cartAddSuccessOpen, setCartAddSuccessOpen] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const detail = await getBookingServiceDetail(id);
        setService(detail as ServiceDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load service");
      }
    };
    run();
  }, [id]);

  const staffs = service?.staffs ?? [];

  const extraDuration = useMemo(
    () =>
      (service?.questions ?? [])
        .flatMap((q) => q.options ?? [])
        .filter((o) => selectedOptionIds.includes(o.id))
        .reduce((sum, o) => sum + Number(o.extra_duration_min || 0), 0),
    [service?.questions, selectedOptionIds]
  );

  const addonPriceTotal = useMemo(() => {
    const opts = (service?.questions ?? []).flatMap((q) => q.options ?? []);
    return opts.filter((o) => selectedOptionIds.includes(o.id)).reduce((sum, o) => sum + Number(o.extra_price || 0), 0);
  }, [service?.questions, selectedOptionIds]);

  const selectedAddonDetails = useMemo(() => {
    const rows: Array<{
      questionTitle: string;
      label: string;
      extraMin: number;
      extraPrice: number;
      linked_service_type: string | null;
    }> = [];
    for (const q of service?.questions ?? []) {
      for (const opt of q.options ?? []) {
        if (selectedOptionIds.includes(opt.id)) {
          rows.push({
            questionTitle: q.title,
            label: opt.label,
            extraMin: Number(opt.extra_duration_min || 0),
            extraPrice: Number(opt.extra_price || 0),
            linked_service_type: opt.linked_service_type ?? null,
          });
        }
      }
    }
    return rows;
  }, [service?.questions, selectedOptionIds]);

  const depositPreview = useMemo(() => depositPreviewForService(service, selectedOptionIds), [service, selectedOptionIds]);

  const baseDurationMin = service ? Number(service.duration_minutes ?? 0) : 0;
  const listedPrice = service ? Number(service.price ?? 0) : 0;
  const estimatedTotalCost = listedPrice + addonPriceTotal;
  const durationMin = (service?.duration_minutes ?? 60) + extraDuration;
  const estimatedBalanceAtSalon = Math.max(0, estimatedTotalCost - depositPreview.depositTotal);

  useEffect(() => {
    if (!service || !slotDate || !startAt) {
      setVerifiedAvailableStaffIds(null);
      return;
    }

    let cancelled = false;
    setVerifyingAvailability(true);
    getAvailabilityPooled(id, slotDate, extraDuration)
      .then((payload) => {
        if (cancelled) return;
        const allSlots = Array.isArray(payload?.visible_slots)
          ? payload.visible_slots
          : Array.isArray(payload?.slots)
            ? payload.slots
            : [];
        const selectedStartMs = new Date(startAt).getTime();
        const matchingSlot = allSlots.find((slot) => {
          const slotStart = slot.start_at ?? slot.start_time;
          return slotStart && new Date(slotStart).getTime() === selectedStartMs;
        });
        const staffIds = Array.isArray(matchingSlot?.available_staff_ids)
          ? matchingSlot.available_staff_ids.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
          : [];
        setVerifiedAvailableStaffIds(staffIds);
        if (confirmStaff && !staffIds.includes(confirmStaff.id)) {
          setConfirmStaff(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setVerifiedAvailableStaffIds([]);
        setError(err instanceof Error ? err.message : "Unable to verify staff availability.");
      })
      .finally(() => {
        if (!cancelled) setVerifyingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [confirmStaff, extraDuration, id, service, slotDate, startAt]);

  const effectiveAvailableStaffIds = verifiedAvailableStaffIds ?? availableStaffIds;
  const eligibleStaff = useMemo(() => {
    if (effectiveAvailableStaffIds.length === 0) return [];
    const set = new Set(effectiveAvailableStaffIds);
    return staffs.filter((staff) => set.has(staff.id));
  }, [staffs, effectiveAvailableStaffIds]);

  const slotValid = Boolean(slotDate && startAt && endAt && effectiveAvailableStaffIds.length > 0);

  useEffect(() => {
    if (!confirmStaff && !cartAddSuccessOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [confirmStaff, cartAddSuccessOpen]);

  const draftDataUrlToFile = useCallback(async (dataUrl: string, name: string, mimeType?: string) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], name, { type: mimeType || blob.type || "image/jpeg" });
  }, []);

  const handleConfirmAdd = useCallback(async () => {
    if (!confirmStaff || !startAt) return;
    setAdding(true);
    setError(null);
    try {
      let updatedCart = await addCartItem({
        service_id: Number(id),
        staff_id: confirmStaff.id,
        start_at: startAt,
        selected_option_ids: selectedOptionIds,
        notes: remarksParam,
      });

      if (service?.allow_photo_upload) {
        const draftPhotos = loadBookingPhotoDraft(id).slice(0, 3);
        if (draftPhotos.length > 0) {
          const matchedItem = [...(updatedCart.items ?? [])]
            .filter((item) => item.service_id === Number(id) && item.staff_id === confirmStaff.id && item.start_at === startAt)
            .sort((a, b) => b.id - a.id)[0];

          if (matchedItem) {
            const files = await Promise.all(
              draftPhotos.map((photo) => draftDataUrlToFile(photo.data_url, photo.name, photo.type))
            );
            updatedCart = await uploadBookingCartItemPhotos(matchedItem.id, files);
            clearBookingPhotoDraft(id);
          }
        }
      }

      setConfirmStaff(null);
      const itemCount = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
      window.dispatchEvent(new CustomEvent("cartUpdated", { detail: itemCount }));
      setCartAddSuccessOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart (or upload service photos).");
    } finally {
      setAdding(false);
    }
  }, [confirmStaff, draftDataUrlToFile, id, remarksParam, selectedOptionIds, service?.allow_photo_upload, startAt]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 pb-24 sm:py-10">
      <BookingProgress step={4} backHref={slotsBackHref} />
      <div className="space-y-5 sm:space-y-6">
       
        <div className="hidden items-center justify-start sm:flex">
          <Link
            href={slotsBackHref}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-4 py-2 text-sm leading-none"
          >
            <i className="fa-solid fa-arrow-left shrink-0 text-[0.95em]" aria-hidden />
            <span>Back</span>
          </Link>
        </div>
        {error && !confirmStaff ? <p className="text-[var(--status-error)]">{error}</p> : null}

        {!service ? (
          <p>Loading service...</p>
        ) : verifyingAvailability ? (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-sm text-[var(--text-muted)]">
            Checking staff availability for your selected time…
          </div>
        ) : !slotValid ? (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-sm text-[var(--text-muted)]">
            <p className="font-medium text-[var(--foreground)]">Pick a time first</p>
            <p className="mt-2">Choose a date and time slot, then you can select a nail technician who is free for that time.</p>
            <Link href={slotsBackHref} className="mt-4 inline-flex rounded-full bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white">
              Go to date & time
            </Link>
          </div>
        ) : eligibleStaff.length === 0 ? (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">
            No nail technician is available for the time you selected.{" "}
            <Link href={slotsBackHref} className="font-semibold text-[var(--accent-strong)] underline">
              Choose another slot
            </Link>
            .
          </div>
        ) : (
          <section className="space-y-3 sm:space-y-4">
            {/* <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
              <h1 className="font-[var(--font-heading)] text-lg font-semibold sm:text-xl">Appointment details</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Review duration, deposit, listed prices, and add-ons before choosing your stylist.
              </p>

              <div className="mt-6 space-y-6 border-t border-[var(--card-border)] pt-6">
                // Your time — inside summary 
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Your time</p>
                  <p className="mt-2 font-[var(--font-heading)] text-2xl font-semibold tabular-nums sm:text-3xl">
                    {formatTime(startAt)} – {formatTime(endAt)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {new Date(slotDate).toLocaleDateString("en-MY", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {" · "}
                    {durationMin} min · {service.name}
                  </p>
                </div>

                // Main service 
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Main service</p>
                  <p className="mt-2 font-[var(--font-heading)] text-base font-semibold">{service.name}</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex flex-wrap justify-between gap-2 border-b border-dotted border-[var(--card-border)] pb-2">
                      <span className="text-[var(--text-muted)]">Base duration</span>
                      <span className="font-medium tabular-nums text-[var(--foreground)]">{baseDurationMin} min</span>
                    </li>
                    <li className="flex flex-wrap justify-between gap-2">
                      <span className="text-[var(--text-muted)]">Listed service price</span>
                      <span className="font-medium tabular-nums text-[var(--foreground)]">RM {listedPrice.toFixed(2)}</span>
                    </li>
                  </ul>
                </div>

               // Add-ons — same layout as add-ons booking summary 
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Add-ons</p>
                  {selectedAddonDetails.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {selectedAddonDetails.map((row, idx) => (
                        <li
                          key={`${row.questionTitle}-${row.label}-${idx}`}
                          className="rounded-xl border border-[var(--card-border)] bg-[var(--muted)]/30 px-4 py-3"
                        >
                          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{row.questionTitle}</p>
                          <p className="mt-1 font-[var(--font-heading)] font-semibold text-[var(--foreground)]">{row.label}</p>
                          <div className="mt-3 space-y-0 text-sm">
                            <div className="flex justify-between gap-3 border-b border-dotted border-[var(--card-border)] pb-2">
                              <span className="text-[var(--text-muted)]">Extra duration</span>
                              <span className="shrink-0 font-medium tabular-nums text-[var(--foreground)]">+{row.extraMin} min</span>
                            </div>
                            <div className="flex justify-between gap-3 pt-2">
                              <span className="text-[var(--text-muted)]">Add-on price</span>
                              <span className="shrink-0 font-medium tabular-nums text-[var(--foreground)]">+RM {row.extraPrice.toFixed(2)}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--text-muted)]">No add-ons selected.</p>
                  )}
                </div>

               // Payment overview 
                <div className="rounded-xl border-2 border-[var(--accent-strong)]/15 bg-[var(--muted)]/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">How payment usually works</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">You&apos;ll only pay a deposit now.</p>
                  <ul className="mt-4 space-y-3 text-sm">
                    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-dotted border-[var(--card-border)] pb-3">
                      <div>
                        <span className="font-medium text-[var(--foreground)]">Approx. total duration</span>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Listed service + selected add-ons</p>
                      </div>
                      <span className="font-semibold tabular-nums">{durationMin} min</span>
                    </li>
                    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-dotted border-[var(--card-border)] pb-3">
                      <div>
                        <span className="font-medium text-[var(--foreground)]">Deposit Required</span>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Charged at checkout to secure this booking</p>
                      </div>
                      <span className="font-semibold tabular-nums">RM {depositAmount.toFixed(2)}</span>
                    </li>
                    <li className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="font-medium text-[var(--foreground)]">Remaining</span>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Pay after your service at the salon</p>
                      </div>
                      <span className="text-lg font-semibold tabular-nums text-[var(--accent-strong)]">RM {estimatedBalanceAtSalon.toFixed(2)}</span>
                    </li>
                  </ul>
                  <p className="mt-4 border-t border-[var(--card-border)] pt-3 text-xs leading-relaxed text-[var(--text-muted)]">
                    <strong className="font-medium text-[var(--foreground)]">TOTAL (Pay Later)</strong> (menu: service + add-ons):{" "}
                    <span className="font-semibold tabular-nums text-[var(--accent-strong)]">RM {estimatedTotalCost.toFixed(2)}</span>
                    . The deposit is typically credited toward your final bill. Final amounts confirmed at checkout.
                  </p>
                </div>
              </div>
            </div> */}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {eligibleStaff.map((staff) => {
                const avatarSrc = (staff.avatar_url || staff.avatar_path) as string | undefined;
                const initial = (staff.name?.trim()?.[0] || "?").toUpperCase();
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => setConfirmStaff(staff)}
                    className="group flex w-full flex-row items-center gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-3 text-left shadow-sm transition hover:border-[var(--accent-strong)] hover:shadow md:flex-col md:items-stretch md:p-6"
                  >
                    {/* <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--muted)] ring-1 ring-[var(--card-border)] md:mx-auto md:mb-1 md:h-24 md:w-24 md:ring-0">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-base font-semibold text-[var(--text-muted)] md:text-2xl">
                          {initial}
                        </span>
                      )}
                    </div> */}
                    <div className="min-w-0 flex-1 md:flex-none md:text-center">
                      <p className="font-semibold leading-snug text-[var(--foreground)]">{staff.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--text-muted)] md:mt-1 md:line-clamp-none">
                        {staff.description || "Available nail technician"}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center justify-center self-center rounded-full bg-[var(--accent-strong)] px-3 py-2 text-xs font-semibold text-white md:mt-4 md:w-full md:px-4 md:py-2">
                      Select
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {confirmStaff && service && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--foreground)]/25 p-0 backdrop-blur-[6px] sm:items-center sm:p-4"
          role="presentation"
          onClick={() => !adding && setConfirmStaff(null)}
        >
          <div
            className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] shadow-[0_-8px_40px_-12px_rgba(60,36,50,0.2)] ring-1 ring-black/[0.04] sm:max-h-[min(92dvh,880px)] sm:rounded-3xl sm:shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 shrink-0 bg-gradient-to-r from-[var(--accent)] via-[var(--accent-strong)] to-[var(--accent-stronger)]" />
            <button
              type="button"
              onClick={() => !adding && setConfirmStaff(null)}
              disabled={adding}
              className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-40 sm:right-4 sm:top-5"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 pb-4 pt-7 [-webkit-overflow-scrolling:touch] sm:px-8 sm:pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Almost there</p>
              <h3 id="staff-confirm-title" className="font-[var(--font-heading)] pr-10 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
                Confirm your slot
              </h3>
              <p className="mt-2 text-base leading-relaxed text-[var(--text-muted)]">
                Review the details below, then add this appointment to your cart. You&apos;ll return to the booking start — open the cart icon when you&apos;re ready to pay.
              </p>

              <div className="mt-6 rounded-2xl bg-gradient-to-br from-[var(--muted)]/90 to-[var(--background-soft)]/50 p-5 ring-1 ring-[var(--card-border)]/80 sm:p-6">
                <div className="flex items-center justify-center gap-2.5 text-[var(--text-muted)]">
                  <i className="fa-regular fa-clock text-base" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Appointment details</span>
                </div>
                <div className="mt-4 w-full space-y-2.5 text-center">
                  <p className="text-base leading-snug text-[var(--foreground)]">
                    <span className="font-medium text-[var(--text-muted)]">Date: </span>
                    <span className="font-[var(--font-heading)] font-semibold tabular-nums">
                      {new Date(startAt).toLocaleDateString("en-MY", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        timeZone: TZ,
                      })}
                    </span>
                  </p>
                  <p className="text-base leading-snug text-[var(--foreground)]">
                    <span className="font-medium text-[var(--text-muted)]">Time: </span>
                    <span className="font-medium tabular-nums text-[var(--foreground)]">
                      {formatTime(startAt)} – {formatTime(endAt)}
                    </span>
                  </p>
                  <p className="text-sm tabular-nums leading-snug text-[var(--text-muted)] sm:text-base">
                    · {durationMin} min
                  </p>
                </div>
              </div>

              <ul className="mt-5 space-y-0 divide-y divide-[var(--card-border)] rounded-2xl border border-[var(--card-border)] bg-[var(--background)]/60 px-1">
                <li className="flex flex-col gap-2 px-4 py-4 text-base">
                  <span className="flex items-center gap-2 text-[var(--text-muted)]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)]/80 text-[var(--accent-strong)]">
                      <i className="fa-solid fa-spa text-xs" />
                    </span>
                    Service
                  </span>
                  <div className="flex min-w-0 flex-col items-start gap-2 pl-10 font-medium leading-snug text-[var(--foreground)]">
                    <span className="block w-full">{service.name}</span>
                    <ServiceTierBadge serviceType={service.service_type} />
                  </div>
                </li>
                <li className="flex flex-col gap-2 px-4 py-4 text-base">
                  <span className="flex items-center gap-2 text-[var(--text-muted)]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)]/80 text-[var(--accent-strong)]">
                      <i className="fa-solid fa-layer-group text-xs" />
                    </span>
                    <span className="text-xs font-semibold uppercase leading-tight tracking-wide">ADD ON</span>
                  </span>
                  <div className="flex min-w-0 flex-col gap-3 pl-10 font-medium leading-snug text-[var(--foreground)]">
                    {selectedAddonDetails.length > 0 ? (
                      selectedAddonDetails.map((row, idx) => (
                        <div key={`${row.label}-${idx}`} className="flex flex-col gap-1.5">
                          <span>{row.label}</span>
                          {row.linked_service_type ? (
                            <ServiceTierBadge serviceType={row.linked_service_type} />
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </div>
                </li>
                <li className="flex flex-col gap-2 px-4 py-4 text-base">
                  <span className="flex items-center gap-2 text-[var(--text-muted)]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)]/80 text-[var(--accent-strong)]">
                      <i className="fa-solid fa-user text-xs" />
                    </span>
                    Stylist
                  </span>
                  <p className="min-w-0 pl-10 font-medium leading-snug text-[var(--foreground)]">{confirmStaff.name}</p>
                </li>
                <li className="flex flex-col gap-2 px-4 py-4 text-base">
                  <span className="flex items-center gap-2 text-[var(--text-muted)]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)]/80 text-[var(--accent-strong)]">
                      <i className="fa-solid fa-receipt text-xs" />
                    </span>
                    Deposit Required
                  </span>
                  <p className="pl-10 text-lg font-semibold tabular-nums leading-snug text-[var(--foreground)]">
                    RM {depositPreview.depositTotal.toFixed(2)}
                  </p>
                  {/* <div className="ml-10 rounded-lg border border-[var(--card-border)] bg-[var(--muted)]/40 p-2.5 text-[11px] sm:ml-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Deposit breakdown</p>
                    <div className="mt-1 space-y-0.5">
                      <p className="flex justify-between gap-2">
                        <span className="text-[var(--text-muted)]">Main service deposit</span>
                        <span className="font-semibold tabular-nums text-[var(--foreground)]">RM {depositPreview.mainDepositApplied.toFixed(2)}</span>
                      </p>
                      <p className="flex justify-between gap-2">
                        <span className="text-[var(--text-muted)]">Add-on deposit</span>
                        <span className="font-semibold tabular-nums text-[var(--foreground)]">RM {depositPreview.addonDepositApplied.toFixed(2)}</span>
                      </p>
                    </div>
                  </div> */}
                </li>
                {/* <li className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm">
                  <span className="flex items-center gap-2 text-[var(--text-muted)]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--muted)]/80 text-[var(--accent-strong)]">
                      <i className="fa-solid fa-tag text-xs" />
                    </span>
                    Total (Pay Later)
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--accent-strong)]">RM {estimatedTotalCost.toFixed(2)}</span>
                </li> */}
              </ul>

              {error && confirmStaff ? <p className="mt-3 text-base text-[var(--status-error)]">{error}</p> : null}
            </div>

            <div className="shrink-0 border-t border-[var(--card-border)] bg-[var(--card)] px-6 pb-6 pt-4 sm:px-8">
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => !adding && setConfirmStaff(null)}
                  disabled={adding}
                  className="w-full rounded-full border-2 border-[var(--card-border)] bg-transparent py-3.5 text-base font-semibold text-[var(--foreground)] transition-all hover:border-[var(--accent)] hover:bg-[var(--muted)]/40 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdd}
                  disabled={adding}
                  className="w-full rounded-full bg-[var(--accent-strong)] py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-[var(--accent-stronger)] hover:shadow-lg disabled:opacity-70"
                >
                  {adding ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Adding…
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2">
                      <i className="fa-solid fa-cart-plus" />
                      Add to cart
                    </span>
                  )}
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {cartAddSuccessOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[var(--foreground)]/25 p-0 backdrop-blur-[6px] sm:items-center sm:p-4"
          role="presentation"
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-t-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] shadow-[0_-8px_40px_-12px_rgba(60,36,50,0.2)] ring-1 ring-black/[0.04] sm:rounded-3xl sm:shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-add-success-title"
          >
            <div className="h-1 bg-gradient-to-r from-[var(--accent)] via-[var(--accent-strong)] to-[var(--accent-stronger)]" />
            <div className="px-6 pb-6 pt-7 text-center sm:px-8 sm:pb-8 sm:pt-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--status-success-bg)] text-[var(--status-success)] ring-2 ring-[var(--status-success-border)]/40">
                <i className="fa-solid fa-check text-2xl" aria-hidden />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Add success</p>
              {/* <h3 id="cart-add-success-title" className="mt-1 font-[var(--font-heading)] text-xl font-semibold text-[var(--foreground)]">
                Added to your cart
              </h3> */}
              <p className="mt-2 text-base text-[var(--text-muted)]">
                Next we&apos;ll take you back to choose a category. Use the cart icon when you&apos;re ready to pay.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCartAddSuccessOpen(false);
                  router.push("/booking");
                }}
                className="mt-6 w-full rounded-full bg-[var(--accent-strong)] py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-[var(--accent-stronger)]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
