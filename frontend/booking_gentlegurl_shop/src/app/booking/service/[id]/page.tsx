"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { getBookingServiceDetail } from "@/lib/apiClient";
import { Service, Staff } from "@/lib/types";

type ServiceDetail = Service & { staffs?: Staff[] };

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const detail = await getBookingServiceDetail(id);
        console.log("[Booking Service Detail]", detail);
        setService(detail as ServiceDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load service");
      }
    };

    run();
  }, [id]);

  const staffs = service?.staffs ?? [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 pb-24">
      <div className="space-y-6">
        <BookingProgress step={2} />

        {error ? <p className="text-red-500">{error}</p> : null}

        {!service ? (
          <p>Loading service...</p>
        ) : (
          <section className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold">{service.name}</h1>
              <p className="text-neutral-600">{service.description || "Select your preferred stylist to continue."}</p>
              <p className="text-sm text-neutral-500">
                Duration {service.duration_minutes} min • Deposit RM {service.deposit_amount}
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Choose a stylist</h2>

              {staffs.length === 0 ? (
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
                  No stylists available for this service.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {staffs.map((staff) => (
                    <Link
                      key={staff.id}
                      href={`/booking/service/${id}/slots?staff_id=${staff.id}`}
                      className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-black hover:shadow"
                    >
                      <p className="font-semibold text-neutral-900">{staff.name}</p>
                      <p className="mt-1 text-sm text-neutral-500">Available stylist</p>
                      <span className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-xs font-semibold text-white">
                        Select
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
