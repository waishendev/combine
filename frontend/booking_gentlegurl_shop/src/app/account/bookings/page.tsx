"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyBookings } from "@/lib/apiClient";
import { BookingRecord } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

export default function MyBookingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/account/bookings");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      setLoading(true);
      try {
        const data = await getMyBookings();
        setBookings(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to fetch bookings");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold">My Bookings</h1>
      {loading ? <p className="mt-4">Loading bookings...</p> : null}
      {error ? <p className="mt-4 text-red-500">{error}</p> : null}
      <div className="mt-6 space-y-3">
        {bookings.map((booking) => (
          <div key={booking.id} className="rounded-2xl border border-neutral-200 p-5">
            <p className="font-semibold">{booking.service_name}</p>
            <p className="text-sm text-neutral-600">{booking.staff_name || "Any staff"}</p>
            <p className="text-sm text-neutral-600">{new Date(booking.starts_at).toLocaleString("en-MY", { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur" })}</p>
            <p className="mt-1 text-sm">Status: {booking.status}</p>
            {booking.package_claim_status === 'reserved' ? (
              <p className="mt-1 text-sm text-amber-700">Package Applied (Reserved) — will be consumed when booking is completed.</p>
            ) : booking.package_claim_status === 'consumed' ? (
              <p className="mt-1 text-sm text-emerald-700">Consumed from package.</p>
            ) : booking.package_claim_status === 'released' ? (
              <p className="mt-1 text-sm text-slate-600">Package reservation released.</p>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}
