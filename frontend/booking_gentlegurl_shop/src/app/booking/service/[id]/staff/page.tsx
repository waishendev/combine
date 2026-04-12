"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { addCartItem, getBookingServiceDetail } from "@/lib/apiClient";
import { Service, Staff } from "@/lib/types";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur";

type ServiceDetail = Service & { staffs?: Staff[] };
type StaffAvailabilityRow = { staff_id: number; staff_name: string; is_available: boolean };

type BulkAvailabilityPayload = {
  data?: {
    time_slots?: Array<{
      start_at?: string;
      end_at?: string;
      staff_availability?: StaffAvailabilityRow[];
    }>;
  };
};

export default function ServiceStaffPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const selectedOptionIds = searchParams.get("selected_option_ids") || "";
  const date = searchParams.get("date") || "";
  const startAt = searchParams.get("start_at") || "";
  const endAt = searchParams.get("end_at") || "";

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableStaffIds, setAvailableStaffIds] = useState<number[]>([]);
  const [addingStaffId, setAddingStaffId] = useState<number | null>(null);

  const selectedOptionIdRows = useMemo(
    () => selectedOptionIds.split(",").map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0),
    [selectedOptionIds]
  );

  const selectedAddons = useMemo(
    () => (service?.questions ?? []).flatMap((q) => q.options ?? []).filter((o) => selectedOptionIdRows.includes(o.id)),
    [service?.questions, selectedOptionIdRows]
  );

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

  useEffect(() => {
    const loadAvailability = async () => {
      if (!id || !date || !startAt) {
        setAvailableStaffIds([]);
        return;
      }

      const extraDuration = (service?.questions ?? [])
        .flatMap((q) => q.options ?? [])
        .filter((o) => selectedOptionIdRows.includes(o.id))
        .reduce((sum, o) => sum + Number(o.extra_duration_min || 0), 0);

      const qs = new URLSearchParams({
        service_id: String(id),
        date,
      });
      if (extraDuration > 0) {
        qs.set("extra_duration_min", String(extraDuration));
      }

      try {
        const res = await fetch(`/api/proxy/booking/availability/bulk?${qs.toString()}`, { cache: "no-store" });
        const payload = await res.json().catch(() => null) as BulkAvailabilityPayload | null;
        const slots = Array.isArray(payload?.data?.time_slots) ? payload.data.time_slots : [];
        const exactSlot = slots.find((slot) => (slot.start_at ?? "") === startAt);
        const staffIds = (exactSlot?.staff_availability ?? [])
          .filter((row) => row.is_available)
          .map((row) => row.staff_id);

        setAvailableStaffIds(staffIds);
      } catch {
        setAvailableStaffIds([]);
      }
    };

    void loadAvailability();
  }, [id, date, startAt, service?.questions, selectedOptionIdRows]);

  const staffs = useMemo(
    () => (service?.staffs ?? []).filter((staff) => availableStaffIds.includes(staff.id)),
    [service?.staffs, availableStaffIds]
  );

  const handleSelectStaff = async (staff: Staff) => {
    if (!startAt) return;
    setAddingStaffId(staff.id);
    setError(null);
    try {
      const updatedCart = await addCartItem({
        service_id: Number(id),
        staff_id: Number(staff.id),
        start_at: startAt,
        selected_option_ids: selectedOptionIdRows,
      });
      const itemCount = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
      window.dispatchEvent(new CustomEvent("cartUpdated", { detail: itemCount }));
      window.dispatchEvent(new CustomEvent("openCart"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart");
    } finally {
      setAddingStaffId(null);
    }
  };

  const slotLabel = startAt
    ? `${new Date(startAt).toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${new Date(startAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}${endAt ? ` - ${new Date(endAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}` : ""}`
    : "No time selected";

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 pb-24">
      <BookingProgress step={5} />
      <div className="space-y-6">
        <Link href={`/booking/service/${id}/slots?selected_option_ids=${selectedOptionIds}`} className="inline-flex rounded-full border border-[var(--card-border)] px-4 py-2 text-sm">Back to date & time</Link>

        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm">
          <h1 className="text-3xl font-semibold">Choose a stylist</h1>
          <p className="mt-2 text-[var(--text-muted)]"><span className="font-semibold text-[var(--foreground)]">Service:</span> {service?.name ?? "-"}</p>
          <p className="mt-1 text-[var(--text-muted)]"><span className="font-semibold text-[var(--foreground)]">Add-ons:</span> {selectedAddons.length ? selectedAddons.map((addon) => addon.label).join(", ") : "None"}</p>
          <p className="mt-1 text-[var(--text-muted)]"><span className="font-semibold text-[var(--foreground)]">Date & Time:</span> {slotLabel}</p>
        </section>

        {error ? <p className="text-[var(--status-error)]">{error}</p> : null}
        {!service ? <p>Loading service...</p> : null}

        {service && staffs.length === 0 ? (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">No stylists are available for the selected time. Please go back and pick another slot.</div>
        ) : null}

        {staffs.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {staffs.map((staff) => (
              <div key={staff.id} className="group rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center shadow-sm">
                <p className="font-semibold text-[var(--foreground)]">{staff.name}</p>
                <p className="text-sm text-[var(--text-muted)]">{staff.position || 'Staff'}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{staff.description || 'Available stylist'}</p>
                <button
                  type="button"
                  disabled={addingStaffId === staff.id}
                  onClick={() => void handleSelectStaff(staff)}
                  className="mt-5 inline-flex rounded-full bg-[var(--accent-strong)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {addingStaffId === staff.id ? "Adding..." : "Select"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
