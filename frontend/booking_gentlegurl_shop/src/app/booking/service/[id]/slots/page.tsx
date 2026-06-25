"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { getAvailabilityPooled, getBookingMaxAdvanceDays, getBookingServiceDetail, getBookingSlotsHelpNoteSettings } from "@/lib/apiClient";
import { BookingSlot, Service, Staff } from "@/lib/types";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur";
const QUICK_DATE_STRIP_DAYS = 7;

function getTzParts(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));

  const read = (type: "year" | "month" | "day" | "hour" | "minute") => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function dateInTimezone(value: Date | string) {
  const { year, month, day } = getTzParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function minutesInTimezone(value: Date | string) {
  const { hour, minute } = getTzParts(value);
  return hour * 60 + minute;
}

function todayInTimezone() {
  return dateInTimezone(new Date());
}

function dateStringFromLocalDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function parseDateString(date: string) {
  const [year, month, day] = date.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
}

function addDaysToLocalDate(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function addDaysToDateString(date: string, days: number) {
  return dateStringFromLocalDate(addDaysToLocalDate(parseDateString(date), days));
}

function maxLocalDate(a: Date, b: Date) {
  return a > b ? a : b;
}

function minLocalDate(a: Date, b: Date) {
  return a < b ? a : b;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

type ServiceDetail = Service & { staffs?: Staff[] };

function SlotPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceId = params.id;
  const selectedOptionIdsParam = searchParams.get("selected_option_ids") || "";
  const categoryId = searchParams.get("category_id");
  const remarksParam = searchParams.get("remarks") || "";
  const selectedOptionIds = useMemo(
    () => selectedOptionIdsParam.split(",").map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0),
    [selectedOptionIdsParam]
  );

  const [date, setDate] = useState(todayInTimezone());
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "morning" | "afternoon">("all");
  const [slotsHelpNote, setSlotsHelpNote] = useState({ enabled: false, text: "" });
  const [maxAdvanceDays, setMaxAdvanceDays] = useState<number | null>(null);
  const extraDuration = useMemo(
    () => (service?.questions ?? []).flatMap((q) => q.options ?? []).filter((o) => selectedOptionIds.includes(o.id)).reduce((sum, o) => sum + Number(o.extra_duration_min || 0), 0),
    [service?.questions, selectedOptionIds]
  );
  const canLoad = Boolean(serviceId && date && service);

  const loadSlots = useCallback(async () => {
    if (!canLoad) return;

    setLoading(true);
    setError(null);

    try {
      const payload = await getAvailabilityPooled(serviceId, date, extraDuration);
      const visibleSlots = Array.isArray(payload?.visible_slots)
        ? payload.visible_slots
        : Array.isArray(payload?.slots)
          ? payload.slots
          : [];

      setSlots(visibleSlots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load available slots.");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [canLoad, serviceId, date, extraDuration]);

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
    const run = async () => {
      try {
        const [setting, advanceDays] = await Promise.all([
          getBookingSlotsHelpNoteSettings(),
          getBookingMaxAdvanceDays(),
        ]);
        setSlotsHelpNote({
          enabled: setting.booking_slots_help_note_enabled,
          text: setting.booking_slots_help_note_text,
        });
        setMaxAdvanceDays(advanceDays);
      } catch {
        setSlotsHelpNote({ enabled: false, text: "" });
        setMaxAdvanceDays(365);
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (canLoad) loadSlots();
  }, [canLoad, loadSlots]);

  useEffect(() => {
    const d = parseDateString(date);
    setCalMonth((m) => {
      if (m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth()) return m;
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });
  }, [date]);

  const filteredSlots = useMemo(() => {
    const today = todayInTimezone();
    const nowMinutes = minutesInTimezone(new Date());
    const upcomingOnly = slots.filter((slot) => {
      const startAt = slot.start_at ?? slot.start_time;
      if (!startAt) return false;
      if (date !== today) return true;
      return minutesInTimezone(startAt) > nowMinutes;
    });

    if (timeFilter === "all") return upcomingOnly;
    return upcomingOnly.filter((slot) => {
      const startAt = slot.start_at ?? slot.start_time;
      if (!startAt) return false;
      const hour = getTzParts(startAt).hour;
      if (timeFilter === "morning") return hour < 12;
      return hour >= 12;
    });
  }, [date, slots, timeFilter]);

  const { morning, afternoon } = useMemo(() => {
    const m: BookingSlot[] = [];
    const a: BookingSlot[] = [];
    filteredSlots.forEach((slot) => {
      const startAt = slot.start_at ?? slot.start_time;
      if (!startAt) return;
      const hour = getTzParts(startAt).hour;
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

  const effectiveMaxAdvanceDays = maxAdvanceDays ?? 0;
  const maxSelectableDate = useMemo(() => addDaysToDateString(todayInTimezone(), effectiveMaxAdvanceDays), [effectiveMaxAdvanceDays]);

  const calendarGrid = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const grid: { date: string; day: number; isCurrentMonth: boolean; isDisabled: boolean }[] = [];

    for (let i = 0; i < firstDay; i++) {
      const prevDate = new Date(year, month, -firstDay + i + 1);
      const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(prevDate.getDate()).padStart(2, "0")}`;
      grid.push({ date: dateStr, day: prevDate.getDate(), isCurrentMonth: false, isDisabled: dateStr < todayInTimezone() || dateStr > maxSelectableDate });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      grid.push({ date: dateStr, day: d, isCurrentMonth: true, isDisabled: thisDate < today || dateStr > maxSelectableDate });
    }
    const total = grid.length;
    const remaining = Math.ceil(total / 7) * 7 - total;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month, daysInMonth + i);
      const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
      grid.push({ date: dateStr, day: nextDate.getDate(), isCurrentMonth: false, isDisabled: dateStr > maxSelectableDate });
    }
    return grid;
  }, [calMonth, maxSelectableDate]);

  const dateStrip = useMemo(() => {
    const selected = parseDateString(date);
    const today = parseDateString(todayInTimezone());
    const maxDate = parseDateString(maxSelectableDate);
    const monthStart = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    const monthEnd = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0);
    const minAllowedDate = maxLocalDate(today, monthStart);
    const maxAllowedDate = minLocalDate(maxDate, monthEnd);
    const selectedInActiveMonth = selected.getFullYear() === calMonth.getFullYear() && selected.getMonth() === calMonth.getMonth();
    const anchorDate = selectedInActiveMonth ? minLocalDate(maxLocalDate(selected, minAllowedDate), maxAllowedDate) : minAllowedDate;
    const daysBeforeAnchor = Math.floor((QUICK_DATE_STRIP_DAYS - 1) / 2);
    let stripStart = addDaysToLocalDate(anchorDate, -daysBeforeAnchor);
    let stripEnd = addDaysToLocalDate(stripStart, QUICK_DATE_STRIP_DAYS - 1);

    if (stripStart < minAllowedDate) {
      stripStart = minAllowedDate;
      stripEnd = addDaysToLocalDate(stripStart, QUICK_DATE_STRIP_DAYS - 1);
    }
    if (stripEnd > maxAllowedDate) {
      stripEnd = maxAllowedDate;
      stripStart = maxLocalDate(minAllowedDate, addDaysToLocalDate(stripEnd, -(QUICK_DATE_STRIP_DAYS - 1)));
    }

    const arr: { date: string; day: string; num: number; month: string }[] = [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let d = new Date(stripStart); d <= stripEnd; d = addDaysToLocalDate(d, 1)) {
      const dateStr = dateStringFromLocalDate(d);
      arr.push({
        date: dateStr,
        day: days[d.getDay()],
        num: d.getDate(),
        month: months[d.getMonth()],
      });
    }
    return arr;
  }, [calMonth, date, maxSelectableDate]);

  const prevMonth = () => {
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };
  const today = new Date();
  const canPrevMonth = calMonth.getMonth() > today.getMonth() || calMonth.getFullYear() > today.getFullYear();
  const nextMonthStart = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
  const canNextMonth = dateStringFromLocalDate(nextMonthStart) <= maxSelectableDate;

  const handleSlotClick = (slot: BookingSlot) => {
    const start = slot.start_at ?? slot.start_time;
    const end = slot.end_at ?? slot.end_time;
    if (!start || !end) return;
    const qs = new URLSearchParams();
    qs.set("date", date);
    qs.set("start_at", start);
    qs.set("end_at", end);
    if (slot.available_staff_ids?.length) {
      qs.set("available_staff_ids", slot.available_staff_ids.join(","));
    }
    if (selectedOptionIdsParam) qs.set("selected_option_ids", selectedOptionIdsParam);
    if (categoryId) qs.set("category_id", categoryId);
    if (remarksParam) qs.set("remarks", remarksParam);
    router.push(`/booking/service/${serviceId}/staff?${qs.toString()}`);
  };

  const extraDurationMin = extraDuration;
  const durationMin = (service?.duration_minutes ?? 60) + extraDurationMin;

  const addonsBackQs = new URLSearchParams();
  if (selectedOptionIdsParam) addonsBackQs.set("selected_option_ids", selectedOptionIdsParam);
  if (categoryId) addonsBackQs.set("category_id", categoryId);
  if (remarksParam) addonsBackQs.set("remarks", remarksParam);
  const addonsBackHref = `/booking/service/${serviceId}${addonsBackQs.toString() ? `?${addonsBackQs.toString()}` : ""}`;
  const shouldShowSlotsHelpNote = slotsHelpNote.enabled && slotsHelpNote.text.trim().length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:py-10 sm:pb-32">
      <BookingProgress step={3} backHref={addonsBackHref} />

      <div className="mt-4 sm:mt-6">
        {/* Desktop: Back + title on same row */}
        <div className="hidden sm:relative sm:flex sm:items-center sm:justify-center">
          <Link
            href={addonsBackHref}
            className="absolute left-0 inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-sm font-medium shadow-[var(--shadow)] transition-all hover:border-[var(--accent)] hover:shadow-md"
          >
            <i className="fa-solid fa-arrow-left text-xs" />
            Back
          </Link>
          <h1 className="px-16 text-center font-[var(--font-heading)] text-lg font-semibold leading-snug sm:text-xl">
            Estimated Duration
          </h1>
        </div>

        {/* Mobile: keep just title here (Back is in stepper) */}
        <h1 className="text-center font-[var(--font-heading)] text-lg font-semibold leading-snug sm:hidden">
          Estimated Duration
        </h1>

        <p className="mt-3 text-center text-lg text-[var(--text-muted)]">
          <span className="font-semibold tabular-nums text-[var(--foreground)]">{durationMin} min</span>
        </p>
      </div>

      {/* Date picker: strip + calendar toggle */}
      <section className="mt-6 mb-7 rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-[var(--shadow)] sm:mt-8 sm:mb-8 sm:p-6">
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
                disabled={!canNextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--card-border)] transition-colors disabled:pointer-events-none disabled:opacity-30 hover:border-[var(--accent)]"
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
                    if (cell.isDisabled) return;
                    setDate(cell.date);
                  }}
                  disabled={cell.isDisabled}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-all ${
                    date === cell.date
                      ? "bg-[var(--accent-strong)] text-white"
                      : cell.isDisabled
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
                className={`shrink-0 snap-center rounded-2xl border px-3 py-2 text-center shadow-sm transition-all sm:min-w-[76px] sm:px-4 sm:py-3 ${
                  date === d.date
                    ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white shadow-md ring-2 ring-[var(--accent)]/30"
                    : "border-[var(--card-border)] bg-[var(--background)] hover:-translate-y-0.5 hover:border-[var(--accent)]"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{d.day}</div>
                <div className="font-[var(--font-heading)] text-base font-semibold leading-tight sm:text-xl">{d.num}</div>
                <div className="hidden text-[10px] opacity-70 sm:block">{d.month}</div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-center border-t border-[var(--card-border)] pt-5">
          <div className="inline-flex rounded-full border border-[var(--card-border)] bg-[var(--background)] p-1 shadow-sm">
            {(["all", "morning", "afternoon"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTimeFilter(f)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-all sm:px-4 sm:py-2 sm:text-xs ${
                  timeFilter === f
                    ? "bg-[var(--accent-strong)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {f === "all" ? "All" : f === "morning" ? "☀ Morning" : "☕ Afternoon"}
              </button>
            ))}
          </div>
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
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--muted)]/40 text-[var(--text-muted)]">
            <i className="fa-regular fa-calendar-xmark text-lg" aria-hidden />
          </div>
          <p className="mt-3 font-[var(--font-heading)] text-base font-semibold text-[var(--foreground)]">
            No slots for this date
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Try another date or switch to Morning / Afternoon.
          </p>
        </div>
      ) : (
        <section className="rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] sm:p-8">
          <div>
            <h2 className="mb-6 font-[var(--font-heading)] text-center text-lg font-semibold sm:text-md">              
              Available times
            </h2>

            {timeFilter !== "afternoon" && morning.length > 0 && (
              <div className="mb-8">
                <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span className="shrink-0">☀ Morning</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-[var(--card-border)] to-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:justify-start">
                  {morning.map((slot, idx) => {
                    const startAt = slot.start_at ?? slot.start_time;
                    const endAt = slot.end_at ?? slot.end_time;
                    if (!startAt || !endAt) return null;
                    return (
                      <button
                        key={startAt + idx}
                        type="button"
                        onClick={() => handleSlotClick(slot)}
                        className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--background)] px-2 py-2.5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent-strong)] hover:shadow-md sm:w-auto sm:min-w-[100px] sm:px-3 sm:py-3"
                      >
                        <div className="whitespace-nowrap font-[var(--font-heading)] text-[11px] font-semibold tabular-nums tracking-tight leading-none sm:text-xs">
                          {formatTime(startAt)} — {formatTime(endAt)}
                        </div>
                        {/* {slot.slot_kind === "fallback" && (
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                            Fallback
                          </div>
                        )} */}
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
                <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:justify-start">
                  {afternoon.map((slot, idx) => {
                    const startAt = slot.start_at ?? slot.start_time;
                    const endAt = slot.end_at ?? slot.end_time;
                    if (!startAt || !endAt) return null;
                    return (
                      <button
                        key={startAt + idx}
                        type="button"
                        onClick={() => handleSlotClick(slot)}
                        className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--background)] px-2 py-2.5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent-strong)] hover:shadow-md sm:w-auto sm:min-w-[100px] sm:px-3 sm:py-3"
                      >
                        <div className="whitespace-nowrap font-[var(--font-heading)] text-[11px] font-semibold tabular-nums tracking-tight leading-none sm:text-xs">
                          {formatTime(startAt)} — {formatTime(endAt)}
                        </div>
                        {/* {slot.slot_kind === "fallback" && (
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                            Fallback
                          </div>
                        )} */}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {shouldShowSlotsHelpNote ? (
        <aside className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm leading-relaxed text-[var(--text-muted)] shadow-[var(--shadow)] sm:p-6">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent-strong)]">
              <i className="fa-regular fa-message text-sm" />
            </span>
            <p>{slotsHelpNote.text}</p>
          </div>
        </aside>
      ) : null}

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
