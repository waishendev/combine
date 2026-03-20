"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  data?: {
    date?: string;
    slots?: BookingSlot[];
    duration_min?: number;
  };
};

type ServiceDetail = Service & { staffs?: Staff[] };

export default function SlotPage() {
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
    <main className="mx-auto max-w-4xl px-4 py-10 pb-24">
      <BookingProgress step={3} />

      <div className="mb-8 text-center">
        <h1 className="font-[var(--font-heading)] text-3xl font-medium tracking-tight sm:text-4xl">
          Select <em className="text-[var(--accent-strong)]">date & time</em>
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          {service?.name ?? "Service"} · {durationMin} min
          {selectedStaff ? ` with ${selectedStaff.name}` : ""}
        </p>
      </div>

      {/* Date picker: strip + calendar toggle */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-center gap-3">
          <span className="font-[var(--font-heading)] min-w-[120px] text-center text-lg font-semibold">
            {calMonth.toLocaleDateString("en-MY", { month: "short", year: "numeric" })}
          </span>
          <button
            type="button"
            onClick={() => setShowCalendar((s) => !s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              showCalendar ? "bg-[var(--accent-strong)] text-white" : "border border-[var(--card-border)] hover:border-[var(--accent)]"
            }`}
          >
            <i className="fa-regular fa-calendar mr-1.5" />
            Calendar
          </button>
        </div>

        {showCalendar ? (
          <div className="mx-auto mb-4 max-w-[340px] rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm">
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
          <div className="flex flex-wrap justify-center gap-2">
            {dateStrip.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setDate(d.date)}
                className={`min-w-[72px] rounded-xl border px-4 py-3 text-center shadow-sm transition-all ${
                  date === d.date
                    ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white"
                    : "border-[var(--card-border)] bg-[var(--card)] hover:-translate-y-0.5 hover:border-[var(--accent)]"
                }`}
              >
                <div className="text-[10px] font-medium uppercase tracking-wider opacity-80">{d.day}</div>
                <div className="font-[var(--font-heading)] text-xl font-semibold">{d.num}</div>
                <div className="text-[10px] opacity-70">{d.month}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Time filter */}
      <div className="mb-6 flex justify-center gap-2">
        {(["all", "morning", "afternoon"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setTimeFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all ${
              timeFilter === f
                ? "bg-[var(--accent-strong)] text-white"
                : "border border-[var(--card-border)] bg-[var(--card)] text-[var(--text-muted)] hover:border-[var(--accent)]"
            }`}
          >
            {f === "all" ? "All" : f === "morning" ? "☀ Morning" : "☕ Afternoon"}
          </button>
        ))}
      </div>

      <div className="my-6 h-px bg-[var(--card-border)]" />

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
        <div className="space-y-8">
          <div>
            <h2 className="mb-4 font-[var(--font-heading)] text-lg font-semibold text-center">
              Available times
            </h2>

            {timeFilter !== "afternoon" && morning.length > 0 && (
              <div className="mb-6">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  <span>☀ Morning</span>
                  <span className="h-px flex-1 bg-[var(--card-border)]" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {morning.map((slot, idx) => {
                    const startAt = slot.start_at ?? slot.start_time;
                    const endAt = slot.end_at ?? slot.end_time;
                    if (!startAt || !endAt) return null;
                    return (
                      <button
                        key={startAt + idx}
                        onClick={() => handleSlotClick(slot)}
                        className="min-w-[110px] rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow"
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
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  <span>☕ Afternoon</span>
                  <span className="h-px flex-1 bg-[var(--card-border)]" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {afternoon.map((slot, idx) => {
                    const startAt = slot.start_at ?? slot.start_time;
                    const endAt = slot.end_at ?? slot.end_time;
                    if (!startAt || !endAt) return null;
                    return (
                      <button
                        key={startAt + idx}
                        onClick={() => handleSlotClick(slot)}
                        className="min-w-[110px] rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow"
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
        </div>
      )}

      <div className="mt-10 flex justify-center gap-3">
        <Link
          href={`/booking/service/${serviceId}`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-6 py-3 text-sm font-medium transition-all hover:border-[var(--accent)]"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          Back
        </Link>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !adding && setConfirmModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-[var(--font-heading)] text-xl font-semibold">Confirm booking</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Add this slot to your cart?
            </p>
            <div className="mt-4 rounded-xl border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Service</span>
                <span className="font-medium">{service?.name ?? "—"}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Staff</span>
                <span className="font-medium">{selectedStaff?.name ?? "—"}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Date</span>
                <span className="font-medium">
                  {new Date(date).toLocaleDateString("en-MY", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Time</span>
                <span className="font-medium">
                  {formatTime(confirmModal.start_at ?? confirmModal.start_time ?? "")} —{" "}
                  {formatTime(confirmModal.end_at ?? confirmModal.end_time ?? "")}
                </span>
              </div>
              {service && (
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Deposit</span>
                  <span className="font-medium">RM {service.deposit_amount}</span>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => !adding && setConfirmModal(null)}
                disabled={adding}
                className="flex-1 rounded-full border border-[var(--card-border)] py-3 text-sm font-medium transition-all hover:border-[var(--accent)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdd}
                disabled={adding}
                className="flex-1 rounded-full bg-[var(--accent-strong)] py-3 text-sm font-medium text-white transition-all hover:bg-[var(--accent-stronger)] disabled:opacity-70"
              >
                {adding ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Adding...
                  </span>
                ) : (
                  <>
                    <i className="fa-solid fa-cart-plus mr-2" />
                    Add to Cart
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
