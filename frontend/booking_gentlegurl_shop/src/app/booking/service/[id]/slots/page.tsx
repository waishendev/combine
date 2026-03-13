"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { addCartItem, getAvailability } from "@/lib/apiClient";
import { BookingSlot } from "@/lib/types";

function todayInTimezone() {
  return new Date().toISOString().slice(0, 10);
}

type AvailabilityPayload = {
  success?: boolean;
  message?: string;
  data?: {
    slots?: BookingSlot[];
  };
};

export default function SlotPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const serviceId = params.id;
  const staffId = searchParams.get("staff_id") || "";

  const [date, setDate] = useState(todayInTimezone());
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canLoad = useMemo(() => Boolean(serviceId && staffId && date), [serviceId, staffId, date]);

  const loadSlots = async () => {
    if (!canLoad) return;

    setLoading(true);
    setError(null);

    try {
      const res = await getAvailability(serviceId, staffId, date);
      const payload = (res.data ?? res) as AvailabilityPayload["data"];
      const slotsArr = Array.isArray(payload?.slots) ? payload.slots : [];

      if (res.success === false) {
        setError(res.message || "Unable to load available slots.");
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
  };

  const reserveSlot = async (slot: BookingSlot) => {
    const slotStartAt = slot.start_at ?? slot.start_time;
    if (!slotStartAt) return;

    const cart = await addCartItem({
      service_id: Number(serviceId),
      staff_id: Number(staffId),
      start_at: slotStartAt,
    });

    setCartMessage(`Slot added to cart. Current deposit RM ${cart.deposit_total}`);
    window.dispatchEvent(new CustomEvent("booking-cart:open"));
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <BookingProgress step={3} />
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold">Pick a date & slot</h1>
        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-700">TEST</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border px-4 py-2" />
        <button onClick={loadSlots} className="rounded-full bg-black px-5 py-2 text-white">Find slots</button>
      </div>
      {loading ? <p className="mt-4">Loading availability...</p> : null}
      {error ? <p className="mt-4 text-red-600">{error}</p> : null}
      {cartMessage ? <p className="mt-4 text-green-700">{cartMessage}</p> : null}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {Array.isArray(slots) && slots.length > 0 ? (
          slots.map((slot, idx) => {
            const startAt = slot.start_at ?? slot.start_time;
            const endAt = slot.end_at ?? slot.end_time;
            if (!startAt || !endAt) return null;

            return (
              <button key={startAt + idx} onClick={() => reserveSlot(slot)} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-black hover:shadow">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">TEST Slot</p>
                <p className="mt-1 font-medium">{new Date(startAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur" })}</p>
                <p className="text-sm text-neutral-500">to {new Date(endAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur" })}</p>
              </button>
            );
          })
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 md:col-span-3">
            No slots available for selected date
          </div>
        )}
      </div>
    </main>
  );
}
