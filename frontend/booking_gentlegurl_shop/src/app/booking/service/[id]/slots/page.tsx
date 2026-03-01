"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { createHold, getAvailability } from "@/lib/apiClient";
import { BookingSlot } from "@/lib/types";

function todayInTimezone() {
  return new Date().toISOString().slice(0, 10);
}

export default function SlotPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const serviceId = params.id;
  const staffId = searchParams.get("staff_id") || "";

  const [date, setDate] = useState(todayInTimezone());
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [holdMessage, setHoldMessage] = useState<string | null>(null);

  const canLoad = useMemo(() => Boolean(serviceId && staffId && date), [serviceId, staffId, date]);

  const loadSlots = async () => {
    if (!canLoad) return;
    setLoading(true);
    try {
      const data = await getAvailability(serviceId, staffId, date);
      setSlots(data);
    } finally {
      setLoading(false);
    }
  };

  const reserveSlot = async (slot: BookingSlot) => {
    const hold = await createHold({
      service_id: Number(serviceId),
      staff_id: Number(staffId),
      start_at: slot.start_time,
    });

    setHoldMessage(`Slot reserved 15 minutes. Expires at ${new Date(hold.hold_expires_at).toLocaleTimeString("en-MY", { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur" })}`);
    router.push(`/booking/checkout?booking_id=${hold.booking_id}&expires_at=${encodeURIComponent(hold.hold_expires_at)}`);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <BookingProgress step={3} />
      <h1 className="text-3xl font-semibold">Pick a date & slot</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border px-4 py-2" />
        <button onClick={loadSlots} className="rounded-full bg-black px-5 py-2 text-white">Find slots</button>
      </div>
      {loading ? <p className="mt-4">Loading availability...</p> : null}
      {holdMessage ? <p className="mt-4 text-green-700">{holdMessage}</p> : null}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {slots.map((slot) => (
          <button key={slot.start_time} onClick={() => reserveSlot(slot)} className="rounded-xl border border-neutral-200 px-4 py-3 text-left">
            <p className="font-medium">{new Date(slot.start_time).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur" })}</p>
            <p className="text-sm text-neutral-500">to {new Date(slot.end_time).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur" })}</p>
          </button>
        ))}
      </div>
    </main>
  );
}
