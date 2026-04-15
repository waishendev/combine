"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { ServiceTierBadge } from "@/components/booking/ServiceTierBadge";
import { addCartItem, getBookingServiceDetail } from "@/lib/apiClient";
import { depositPreviewForService } from "@/lib/bookingDepositPreview";
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
  const slotsBackHref = `/booking/service/${id}/slots${slotsBackQs.toString() ? `?${slotsBackQs.toString()}` : ""}`;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const eligibleStaff = useMemo(() => {
    if (availableStaffIds.length === 0) return [];
    const set = new Set(availableStaffIds);
    return staffs.filter((s) => set.has(s.id));
  }, [staffs, availableStaffIds]);

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

  const slotValid = Boolean(slotDate && startAt && endAt && availableStaffIds.length > 0);

  useEffect(() => {
    if (!confirmStaff && !cartAddSuccessOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [confirmStaff, cartAddSuccessOpen]);

  const handleConfirmAdd = useCallback(async () => {
    if (!confirmStaff || !startAt) return;
    setAdding(true);
    setError(null);
    try {
      const updatedCart = await addCartItem({
        service_id: Number(id),
        staff_id: confirmStaff.id,
        start_at: startAt,
        selected_option_ids: selectedOptionIds,
      });
      setConfirmStaff(null);
      const itemCount = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
      window.dispatchEvent(new CustomEvent("cartUpdated", { detail: itemCount }));
      setCartAddSuccessOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart");
    } finally {
      setAdding(false);
    }
  }, [confirmStaff, id, router, selectedOptionIds, startAt]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 pb-24">
      <BookingProgress step={5} />
      <div className="space-y-6">
       
        <div className="flex items-center justify-start">
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
        ) : !slotValid ? (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-sm text-[var(--text-muted)]">
            <p className="font-medium text-[var(--foreground)]">Pick a time first</p>
            <p className="mt-2">Choose a date and time slot, then you can select a stylist who is free for that time.</p>
            <Link href={slotsBackHref} className="mt-4 inline-flex rounded-full bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white">
              Go to date & time
            </Link>
          </div>
        ) : eligibleStaff.length === 0 ? (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">
            No stylist is available for the time you selected.{" "}
            <Link href={slotsBackHref} className="font-semibold text-[var(--accent-strong)] underline">
              Choose another slot
            </Link>
            .
          </div>
        ) : (
          <section className="space-y-4">
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

            <h2 className="text-xl font-semibold">Choose a stylist</h2>
            <p className="text-sm text-[var(--text-muted)]">Only team members who are free for this slot are shown.</p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {eligibleStaff.map((staff) => (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => setConfirmStaff(staff)}
                  className="group rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center shadow-sm transition hover:border-[var(--accent-strong)] hover:shadow"
                >
                  <p className="font-semibold text-[var(--foreground)]">{staff.name}</p>
                  <p className="text-sm text-[var(--text-muted)]">{staff.position || "Staff"}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{staff.description || "Available stylist"}</p>
                  <span className="mt-5 inline-flex rounded-full bg-[var(--accent-strong)] px-4 py-2 text-xs font-semibold text-white">
                    Select
                  </span>
                </button>
              ))}
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
            className="relative w-full max-w-md overflow-hidden rounded-t-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] shadow-[0_-8px_40px_-12px_rgba(60,36,50,0.2)] ring-1 ring-black/[0.04] sm:rounded-3xl sm:shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-gradient-to-r from-[var(--accent)] via-[var(--accent-strong)] to-[var(--accent-stronger)]" />
            <button
              type="button"
              onClick={() => !adding && setConfirmStaff(null)}
              disabled={adding}
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-40 sm:right-4 sm:top-5"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>

            <div className="px-6 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Almost there</p>
              <h3 id="staff-confirm-title" className="font-[var(--font-heading)] pr-10 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                Confirm your slot
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                Review the details below, then add this appointment to your cart. You&apos;ll return to the booking start — open the cart icon when you&apos;re ready to pay.
              </p>

              <div className="mt-6 rounded-2xl bg-gradient-to-br from-[var(--muted)]/90 to-[var(--background-soft)]/50 p-5 ring-1 ring-[var(--card-border)]/80">
                <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
                  <i className="fa-regular fa-clock text-sm" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Your time</span>
                </div>
                <p className="mt-2 text-center font-[var(--font-heading)] text-2xl font-semibold tabular-nums text-[var(--foreground)] sm:text-[1.65rem]">
                  {formatTime(startAt)}
                  <span className="mx-2 font-normal text-[var(--text-muted)]">–</span>
                  {formatTime(endAt)}
                </p>
                <p className="mt-1 text-center text-xs text-[var(--text-muted)]">
                  {new Date(slotDate).toLocaleDateString("en-MY", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {" · "}
                  {durationMin} min
                </p>
              </div>

              <ul className="mt-5 space-y-0 divide-y divide-[var(--card-border)] rounded-2xl border border-[var(--card-border)] bg-[var(--background)]/60 px-1">
                <li className="flex items-start justify-between gap-4 px-4 py-3.5 text-sm">
                  <span className="flex shrink-0 items-center gap-2 text-[var(--text-muted)]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--muted)]/80 text-[var(--accent-strong)]">
                      <i className="fa-solid fa-spa text-xs" />
                    </span>
                    Service
                  </span>
                  <span className="flex max-w-[70%] flex-wrap items-center justify-end gap-2 text-right font-medium leading-snug text-[var(--foreground)]">
                    {service.name}
                    <ServiceTierBadge serviceType={service.service_type} />
                  </span>
                </li>
                <li className="flex items-start justify-between gap-4 px-4 py-3.5 text-sm">
                  <span className="flex shrink-0 items-start gap-2 text-[var(--text-muted)]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)]/80 text-[var(--accent-strong)]">
                      <i className="fa-solid fa-layer-group text-xs" />
                    </span>
                    <span className="max-w-[4.5rem] pt-1 text-[10px] font-semibold uppercase leading-tight tracking-wide">ADD ON</span>
                  </span>
                  <div className="flex max-w-[65%] flex-col items-end gap-2 text-right font-medium leading-snug text-[var(--foreground)]">
                    {selectedAddonDetails.length > 0 ? (
                      selectedAddonDetails.map((row, idx) => (
                        <span key={`${row.label}-${idx}`} className="inline-flex flex-wrap items-center justify-end gap-2">
                          {row.label}
                          {row.linked_service_type ? <ServiceTierBadge serviceType={row.linked_service_type} /> : null}
                        </span>
                      ))
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </div>
                </li>
                <li className="flex items-start justify-between gap-4 px-4 py-3.5 text-sm">
                  <span className="flex shrink-0 items-center gap-2 text-[var(--text-muted)]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--muted)]/80 text-[var(--accent-strong)]">
                      <i className="fa-solid fa-user text-xs" />
                    </span>
                    Stylist
                  </span>
                  <span className="text-right font-medium text-[var(--foreground)]">{confirmStaff.name}</span>
                </li>
                <li className="flex flex-col gap-2 px-4 py-3.5 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-2 text-[var(--text-muted)]">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)]/80 text-[var(--accent-strong)]">
                        <i className="fa-solid fa-receipt text-xs" />
                      </span>
                      Deposit Required
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--foreground)]">
                      RM {depositPreview.depositTotal.toFixed(2)}
                    </span>
                  </div>
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

              {error && confirmStaff ? <p className="mt-3 text-sm text-[var(--status-error)]">{error}</p> : null}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => !adding && setConfirmStaff(null)}
                  disabled={adding}
                  className="w-full rounded-full border-2 border-[var(--card-border)] bg-transparent py-3.5 text-sm font-semibold text-[var(--foreground)] transition-all hover:border-[var(--accent)] hover:bg-[var(--muted)]/40 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdd}
                  disabled={adding}
                  className="w-full rounded-full bg-[var(--accent-strong)] py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--accent-stronger)] hover:shadow-lg disabled:opacity-70"
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
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Add success</p>
              {/* <h3 id="cart-add-success-title" className="mt-1 font-[var(--font-heading)] text-xl font-semibold text-[var(--foreground)]">
                Added to your cart
              </h3> */}
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Next we&apos;ll take you back to choose a category. Use the cart icon when you&apos;re ready to pay.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCartAddSuccessOpen(false);
                  router.push("/booking");
                }}
                className="mt-6 w-full rounded-full bg-[var(--accent-strong)] py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--accent-stronger)]"
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
