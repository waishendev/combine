"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { getBookingServiceDetail } from "@/lib/apiClient";
import { Service, Staff } from "@/lib/types";

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [service, setService] = useState<(Service & { staff?: Staff[] }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const data = await getBookingServiceDetail(id);
        setService(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load service");
      }
    };
    run();
  }, [id]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <BookingProgress step={2} />
      {error ? <p className="text-red-500">{error}</p> : null}
      {!service ? <p>Loading service...</p> : (
        <>
          <h1 className="text-3xl font-semibold">{service.name}</h1>
          <p className="mt-2 text-neutral-600">{service.description}</p>
          <p className="mt-4 text-sm text-neutral-500">Duration {service.duration_minutes} min • Deposit RM {service.deposit_amount}</p>

          <h2 className="mt-8 text-xl font-semibold">Choose a stylist</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {service.staff?.map((staff) => (
              <Link
                key={staff.id}
                href={`/booking/service/${id}/slots?staff_id=${staff.id}`}
                className="rounded-2xl border border-neutral-200 p-5"
              >
                <p className="font-semibold">{staff.name}</p>
                <p className="mt-1 text-sm text-neutral-500">{staff.bio || "Experienced stylist"}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
