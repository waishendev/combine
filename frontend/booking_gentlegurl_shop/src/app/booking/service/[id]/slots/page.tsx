"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { addCartItem, getAvailability, getBookingServiceDetail } from "@/lib/apiClient";
import { BookingSlot, Service, Staff } from "@/lib/types";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur";

function todayInTimezone() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

type AvailabilityPayload = {
  success?: boolean;
  message?: string;
  /** Some endpoints nest under `data`; others return these at the root */
  date?: string;
  slots?: BookingSlot[];
  duration_min?: number;
  data?: {
    date?: string;
    slots?: BookingSlot[];
    duration_min?: number;
  };
};

type ServiceDetail = Service & { staffs?: Staff[] };

function SlotPageContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const serviceId = params.id;
  const staffId = searchParams.get("staff_id") || "";

  const [date, setDate] = useState(todayInTimezone());
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "morning" | "afternoon">("all");
  const [confirmModal, setConfirmModal] = useState<BookingSlot | null>(null);
  const [adding, setAdding] = useState(false);

  const canLoad = Boolean(serviceId && staffId && date);
  const selectedStaff = useMemo(
    () => service?.staffs?.find((s) => String(s.id) === staffId),
    [service, staffId]
  );

  const loadSlots = useCallback(async () => {
    if (!canLoad) return;

    setLoading(true);
    setError(null);

    try {
      const res = await getAvailability(serviceId, staffId, date);
      const payload = (res as AvailabilityPayload)?.data ?? (res as AvailabilityPayload);
      const slotsArr = Array.isArray(payload?.slots) ? payload.slots : [];

      if ((res as AvailabilityPayload).success === false) {
        setError((res as AvailabilityPayload).message || "Unable to load available slots.");
        setSlots([]);
        return;
      }

      setSlots(slotsArr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load available slots.");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [canLoad, serviceId, staffId, date]);

  useEffect(() => {
    const run = async () => {
      try {
        const detail = await getBookingServiceDetail(serviceId);
        setService(detail as ServiceDetail);
      } catch {
        setService(null);
      }
    };
    run();
  }, [serviceId]);

  useEffect(() => {
    if (canLoad) loadSlots();
  }, [canLoad, loadSlots]);

  useEffect(() => {
    const d = new Date(date);
    setCalMonth((m) => {
      if (m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth()) return m;
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });
  }, [date]);

  useEffect(() => {
    if (!confirmModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [confirmModal]);

  const filteredSlots = useMemo(() => {
    if (timeFilter === "all") return slots;
    return slots.filter((slot) => {
      const startAt = slot.start_at ?? slot.start_time;
      if (!startAt) return false;
      const hour = new Date(startAt).getHours();
      if (timeFilter === "morning") return hour < 12;
      return hour >= 12;
    });
  }, [slots, timeFilter]);

  const { morning, afternoon } = useMemo(() => {
    const m: BookingSlot[] = [];
    const a: BookingSlot[] = [];
    filteredSlots.forEach((slot) => {
      const startAt = slot.start_at ?? slot.start_time;
      if (!startAt) return;
      const hour = new Date(startAt).getHours();
      if (hour < 12) m.push(slot);
      else a.push(slot);
    });
    return { morning: m, afternoon: a };
  }, [filteredSlots]);

  const [calMonth, setCalMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [showCalendar, setShowCalendar] = useState(false);

  const calendarGrid = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const grid: { date: string; day: number; isCurrentMonth: boolean; isPast: boolean }[] = [];

    for (let i = 0; i < firstDay; i++) {
      const prevDate = new Date(year, month, -firstDay + i + 1);
      const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(prevDate.getDate()).padStart(2, "0")}`;
      grid.push({ date: dateStr, day: prevDate.getDate(), isCurrentMonth: false, isPast: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      grid.push({ date: dateStr, day: d, isCurrentMonth: true, isPast: thisDate < today });
    }
    const total = grid.length;
    const remaining = Math.ceil(total / 7) * 7 - total;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month, daysInMonth + i);
      const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
      grid.push({ date: dateStr, day: nextDate.getDate(), isCurrentMonth: false, isPast: false });
    }
    return grid;
  }, [calMonth]);

  const dateStrip = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const arr: { date: string; day: string; num: number; month: string }[] = [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      arr.push({
        date: dateStr,
        day: days[d.getDay()],
        num: d.getDate(),
        month: months[d.getMonth()],
      });
    }
    return arr;
  }, []);

  const prevMonth = () => {
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };
  const today = new Date();
  const canPrevMonth = calMonth.getMonth() > today.getMonth() || calMonth.getFullYear() > today.getFullYear();

  const handleSlotClick = (slot: BookingSlot) => {
    setConfirmModal(slot);
  };

  const handleConfirmAdd = async () => {
    if (!confirmModal) return;

    const slotStartAt = confirmModal.start_at ?? confirmModal.start_time;
    if (!slotStartAt) return;

    setAdding(true);
    try {
      const updatedCart = await addCartItem({
        service_id: Number(serviceId),
        staff_id: Number(staffId),
        start_at: slotStartAt,
      });
      setConfirmModal(null);
      const itemCount = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
      window.dispatchEvent(new CustomEvent("cartUpdated", { detail: itemCount }));
      window.dispatchEvent(new CustomEvent("openCart"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart");
    } finally {
      setAdding(false);
    }
  };

  const durationMin = service?.duration_minutes ?? 60;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-28 sm:py-10 sm:pb-32">
      <BookingProgress step={3} />

      <div className="mb-6 sm:mb-8">
        <Link
          href={`/booking/service/${serviceId}`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-sm font-medium shadow-[var(--shadow)] transition-all hover:border-[var(--accent)] hover:shadow-md sm:px-5 sm:py-2.5"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          Back to stylist
        </Link>
      </div>

      <div className="mb-8 text-center sm:mb-10">
        <h1 className="font-[var(--font-heading)] text-3xl font-medium tracking-tight sm:text-4xl">
          Select <em className="text-[var(--accent-strong)] not-italic">date & time</em>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
          {service?.name ?? "Service"} · {durationMin} min
          {selectedStaff ? ` · ${selectedStaff.name}` : ""}
        </p>
      </div>

      {/* Date picker: strip + calendar toggle */}
      <section className="mb-8 rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-3 sm:justify-between sm:gap-4">
          <span className="font-[var(--font-heading)] text-center text-base font-semibold sm:text-left sm:text-lg">
            {calMonth.toLocaleDateString("en-MY", { month: "short", year: "numeric" })}
          </span>
          <button
            type="button"
            onClick={() => setShowCalendar((s) => !s)}
            className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all ${
              showCalendar
                ? "bg-[var(--accent-strong)] text-white shadow-sm"
                : "border border-[var(--card-border)] bg-[var(--background)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            }`}
          >
            <i className="fa-regular fa-calendar mr-2" />
            Calendar
          </button>
        </div>

        {showCalendar ? (
          <div className="mx-auto max-w-[340px] rounded-2xl border border-[var(--card-border)] bg-[var(--background)]/80 p-4">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                disabled={!canPrevMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--card-border)] transition-colors disabled:opacity-30 disabled:pointer-events-none hover:border-[var(--accent)]"
              >
                <i className="fa-solid fa-chevron-left text-xs" />
              </button>
              <span className="font-[var(--font-heading)] font-semibold">
                {calMonth.toLocaleDateString("en-MY", { month: "long", year: "numeric" })}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--card-border)] transition-colors hover:border-[var(--accent)]"
              >
                <i className="fa-solid fa-chevron-right text-xs" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((dow) => (
                <div key={dow} className="py-1 text-[10px] font-medium uppercase text-[var(--text-muted)]">
                  {dow}
                </div>
              ))}
              {calendarGrid.map((cell) => (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => {
                    if (cell.isPast) return;
                    setDate(cell.date);
                  }}
                  disabled={cell.isPast}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-all ${
                    date === cell.date
                      ? "bg-[var(--accent-strong)] text-white"
                      : cell.isPast
                        ? "cursor-not-allowed text-[var(--text-muted)] opacity-40"
                        : cell.isCurrentMonth
                          ? "hover:bg-[var(--muted)]"
                          : "text-[var(--text-muted)] opacity-50 hover:opacity-70"
                  }`}
                >
                  {cell.day}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin] sm:flex-wrap sm:justify-center sm:overflow-visible">
            {dateStrip.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setDate(d.date)}
                className={`shrink-0 snap-center rounded-2xl border px-3 py-3 text-center shadow-sm transition-all sm:min-w-[76px] sm:px-4 ${
                  date === d.date
                    ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white shadow-md ring-2 ring-[var(--accent)]/30"
                    : "border-[var(--card-border)] bg-[var(--background)] hover:-translate-y-0.5 hover:border-[var(--accent)]"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{d.day}</div>
                <div className="font-[var(--font-heading)] text-xl font-semibold leading-tight">{d.num}</div>
                <div className="text-[10px] opacity-70">{d.month}</div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2 border-t border-[var(--card-border)] pt-6">
          {(["all", "morning", "afternoon"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTimeFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all ${
                timeFilter === f
                  ? "bg-[var(--accent-strong)] text-white shadow-sm"
                  : "border border-[var(--card-border)] bg-[var(--background)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
              }`}
            >
              {f === "all" ? "All" : f === "morning" ? "☀ Morning" : "☕ Afternoon"}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-4 text-center text-[var(--status-error)]">
          {error}
        </div>
      ) : slots.length === 0 ? (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center text-[var(--text-muted)] shadow-sm">
          No slots available for selected date. Try another date.
        </div>
      ) : (
        <section className="rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] sm:p-8">
          <div>
            <h2 className="mb-6 font-[var(--font-heading)] text-center text-lg font-semibold sm:text-xl">
              Available times
            </h2>

            {timeFilter !== "afternoon" && morning.length > 0 && (
              <div className="mb-8">
                <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span className="shrink-0">☀ Morning</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-[var(--card-border)] to-transparent" />
                </div>
                <div className="flex flex-wrap justify-center gap-2.5 sm:justify-start">
                  {morning.map((slot, idx) => {
                    const startAt = slot.start_at ?? slot.start_time;
                    const endAt = slot.end_at ?? slot.end_time;
                    if (!startAt || !endAt) return null;
                    return (
                      <button
                        key={startAt + idx}
                        type="button"
                        onClick={() => handleSlotClick(slot)}
                        className="min-w-[108px] rounded-2xl border border-[var(--card-border)] bg-[var(--background)] px-4 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent-strong)] hover:shadow-md"
                      >
                        <div className="font-[var(--font-heading)] font-semibold">
                          {formatTime(startAt)} — {formatTime(endAt)}
                        </div>
                        <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                          {durationMin} min
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {timeFilter !== "morning" && afternoon.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span className="shrink-0">☕ Afternoon</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-[var(--card-border)] to-transparent" />
                </div>
                <div className="flex flex-wrap justify-center gap-2.5 sm:justify-start">
                  {afternoon.map((slot, idx) => {
                    const startAt = slot.start_at ?? slot.start_time;
                    const endAt = slot.end_at ?? slot.end_time;
                    if (!startAt || !endAt) return null;
                    return (
                      <button
                        key={startAt + idx}
                        type="button"
                        onClick={() => handleSlotClick(slot)}
                        className="min-w-[108px] rounded-2xl border border-[var(--card-border)] bg-[var(--background)] px-4 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent-strong)] hover:shadow-md"
                      >
                        <div className="font-[var(--font-heading)] font-semibold">
                          {formatTime(startAt)} — {formatTime(endAt)}
                        </div>
                        <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                          {durationMin} min
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--foreground)]/25 p-0 backdrop-blur-[6px] sm:items-center sm:p-4"
          role="presentation"
          onClick={() => !adding && setConfirmModal(null)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-t-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] shadow-[0_-8px_40px_-12px_rgba(60,36,50,0.2)] ring-1 ring-black/[0.04] sm:rounded-3xl sm:shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="slot-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-gradient-to-r from-[var(--accent)] via-[var(--accent-strong)] to-[var(--accent-stronger)]" />
            <button
              type="button"
              onClick={() => !adding && setConfirmModal(null)}
              disabled={adding}
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-40 sm:right-4 sm:top-5"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>

            <div className="px-6 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                Almost there
              </p>
              <h3
                id="slot-confirm-title"
                className="font-[var(--font-heading)] pr-10 text-2xl font-semibold tracking-tight text-[var(--foreground)]"
              >
                Confirm your slot
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                Review the details below, then add this appointment to your cart.
              </p>

              <div className="mt-6 rounded-2xl bg-gradient-to-br from-[var(--muted)]/90 to-[var(--background-soft)]/50 p-5 ring-1 ring-[var(--card-border)]/80">
                <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
                  <i className="fa-regular fa-clock text-sm" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Your time</span>
                </div>
                <p className="mt-2 text-center font-[var(--font-heading)] text-2xl font-semibold tabular-nums text-[var(--foreground)] sm:text-[1.65rem]">
                  {formatTime(confirmModal.start_at ?? confirmModal.start_time ?? "")}
                  <span className="mx-2 font-normal text-[var(--text-muted)]">–</span>
                  {formatTime(confirmModal.end_at ?? confirmModal.end_time ?? "")}
                </p>
                <p className="mt-1 text-center text-xs text-[var(--text-muted)]">
                  {new Date(date).toLocaleDateString("en-MY", {
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
                  <span className="text-right font-medium leading-snug text-[var(--foreground)]">
                    {service?.name ?? "—"}
                  </span>
                </li>
                <li className="flex items-start justify-between gap-4 px-4 py-3.5 text-sm">
                  <span className="flex shrink-0 items-center gap-2 text-[var(--text-muted)]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--muted)]/80 text-[var(--accent-strong)]">
                      <i className="fa-solid fa-user text-xs" />
                    </span>
                    Stylist
                  </span>
                  <span className="text-right font-medium text-[var(--foreground)]">{selectedStaff?.name ?? "—"}</span>
                </li>
                {service && (
                  <li className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm">
                    <span className="flex items-center gap-2 text-[var(--text-muted)]">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--muted)]/80 text-[var(--accent-strong)]">
                        <i className="fa-solid fa-receipt text-xs" />
                      </span>
                      Deposit
                    </span>
                    <span className="font-semibold tabular-nums text-[var(--foreground)]">RM {service.deposit_amount}</span>
                  </li>
                )}
              </ul>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => !adding && setConfirmModal(null)}
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
    </main>
  );
}

export default function SlotPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex max-w-5xl justify-center px-4 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </main>
      }
    >
      <SlotPageContent />
    </Suspense>
  );
}
