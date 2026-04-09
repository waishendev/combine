"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { getBookingServiceDetail } from "@/lib/apiClient";
import { BookingSlot, Service, Staff } from "@/lib/types";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur";

type BulkAvailabilitySlot = BookingSlot & {
  staff_availability?: Array<{ staff_id: number; staff_name: string; is_available: boolean }>;
};

type BulkAvailabilityPayload = {
  success?: boolean;
  message?: string;
  data?: {
    time_slots?: BulkAvailabilitySlot[];
  };
};

type ServiceDetail = Service & { staffs?: Staff[] };

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

function SlotPageContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const serviceId = params.id;
  const selectedOptionIdsParam = searchParams.get("selected_option_ids") || "";
  const selectedOptionIds = useMemo(
    () => selectedOptionIdsParam.split(",").map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0),
    [selectedOptionIdsParam]
  );

  const [date, setDate] = useState(todayInTimezone());
  const [slots, setSlots] = useState<BulkAvailabilitySlot[]>([]);
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "morning" | "afternoon">("all");

  const extraDuration = useMemo(
    () => (service?.questions ?? []).flatMap((q) => q.options ?? []).filter((o) => selectedOptionIds.includes(o.id)).reduce((sum, o) => sum + Number(o.extra_duration_min || 0), 0),
    [service?.questions, selectedOptionIds]
  );

  const selectedAddons = useMemo(
    () => (service?.questions ?? []).flatMap((q) => q.options ?? []).filter((o) => selectedOptionIds.includes(o.id)),
    [service?.questions, selectedOptionIds]
  );

  const loadSlots = useCallback(async () => {
    if (!serviceId || !date) return;

    setLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams({
        service_id: String(serviceId),
        date,
      });
      if (extraDuration > 0) {
        qs.set("extra_duration_min", String(extraDuration));
      }

      const res = await fetch(`/api/proxy/booking/availability/bulk?${qs.toString()}`, { cache: "no-store" });
      const payload = await res.json().catch(() => null) as BulkAvailabilityPayload | null;
      const rows = Array.isArray(payload?.data?.time_slots) ? payload.data.time_slots : [];

      const validSlots = rows.filter((slot) => {
        const availability = slot.staff_availability ?? [];
        return availability.some((row) => row.is_available);
      });

      setSlots(validSlots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load available slots.");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [serviceId, date, extraDuration]);

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
    void loadSlots();
  }, [loadSlots]);

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
    const m: BulkAvailabilitySlot[] = [];
    const a: BulkAvailabilitySlot[] = [];
    filteredSlots.forEach((slot) => {
      const startAt = slot.start_at ?? slot.start_time;
      if (!startAt) return;
      const hour = new Date(startAt).getHours();
      if (hour < 12) m.push(slot);
      else a.push(slot);
    });
    return { morning: m, afternoon: a };
  }, [filteredSlots]);

  const durationMin = (service?.duration_minutes ?? 60) + extraDuration;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-28 sm:py-10 sm:pb-32">
      <BookingProgress step={4} />

      <div className="mb-6 sm:mb-8">
        <Link
          href={`/booking/service/${serviceId}?selected_option_ids=${selectedOptionIdsParam}`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-sm font-medium shadow-[var(--shadow)] transition-all hover:border-[var(--accent)] hover:shadow-md sm:px-5 sm:py-2.5"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          Back to add-ons
        </Link>
      </div>

      <div className="mb-8 text-center sm:mb-10">
        <h1 className="font-[var(--font-heading)] text-3xl font-medium tracking-tight sm:text-4xl">
          Select <em className="text-[var(--accent-strong)] not-italic">date & time</em>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
          {service?.name ?? "Service"} · {durationMin} min
        </p>
      </div>

      <section className="mb-8 rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Appointment Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex flex-wrap justify-center gap-2 border-t border-[var(--card-border)] pt-4">
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
          {selectedAddons.length > 0 ? (
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-4 py-3 text-xs text-[var(--text-muted)]">
              Add-ons selected: {selectedAddons.map((addon) => addon.label).join(", ")}
            </div>
          ) : null}
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
          <h2 className="mb-6 font-[var(--font-heading)] text-center text-lg font-semibold sm:text-xl">
            Available times
          </h2>

          {[{ label: "☀ Morning", items: morning }, { label: "☕ Afternoon", items: afternoon }].map((group) => (
            group.items.length > 0 ? (
              <div key={group.label} className="mb-8 last:mb-0">
                <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span className="shrink-0">{group.label}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-[var(--card-border)] to-transparent" />
                </div>
                <div className="flex flex-wrap justify-center gap-2.5 sm:justify-start">
                  {group.items.map((slot, idx) => {
                    const startAt = slot.start_at ?? slot.start_time;
                    const endAt = slot.end_at ?? slot.end_time;
                    if (!startAt || !endAt) return null;
                    const availableStaffCount = (slot.staff_availability ?? []).filter((row) => row.is_available).length;
                    const href = `/booking/service/${serviceId}/staff?selected_option_ids=${selectedOptionIdsParam}&date=${encodeURIComponent(date)}&start_at=${encodeURIComponent(startAt)}&end_at=${encodeURIComponent(endAt)}`;

                    return (
                      <Link
                        key={startAt + idx}
                        href={href}
                        className="min-w-[132px] rounded-2xl border border-[var(--card-border)] bg-[var(--background)] px-4 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent-strong)] hover:shadow-md"
                      >
                        <div className="font-[var(--font-heading)] font-semibold">
                          {formatTime(startAt)} — {formatTime(endAt)}
                        </div>
                        <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{durationMin} min</div>
                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                          {availableStaffCount} stylist{availableStaffCount === 1 ? "" : "s"} available
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null
          ))}
        </section>
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
