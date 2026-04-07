"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { getBookingServiceDetail } from "@/lib/apiClient";
import { Service, Staff } from "@/lib/types";

type ServiceDetail = Service & { staffs?: Staff[] };

export default function ServiceStaffPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const selectedOptionIds = searchParams.get("selected_option_ids") || "";
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const staffs = service?.staffs ?? [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 pb-24">
      <BookingProgress step={4} />
      <div className="space-y-6">
        <Link href={`/booking/service/${id}`} className="inline-flex rounded-full border border-[var(--card-border)] px-4 py-2 text-sm">Back to add-ons</Link>
        {error ? <p className="text-[var(--status-error)]">{error}</p> : null}
        {!service ? <p>Loading service...</p> : (
          <section className="space-y-4">
            <h1 className="text-3xl font-semibold">Choose a stylist</h1>
            <p className="text-[var(--text-muted)]">{service.name}</p>
            {staffs.length === 0 ? (
              <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">This service is temporarily unavailable because no eligible staff is assigned.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {staffs.map((staff) => (
                  <Link
                    key={staff.id}
                    href={`/booking/service/${id}/slots?staff_id=${staff.id}&selected_option_ids=${selectedOptionIds}`}
                    className="group rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center shadow-sm transition hover:border-[var(--accent-strong)] hover:shadow"
                  >
                    <p className="font-semibold text-[var(--foreground)]">{staff.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">{staff.position || 'Staff'}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{staff.description || 'Available stylist'}</p>
                    <span className="mt-5 inline-flex rounded-full bg-[var(--accent-strong)] px-4 py-2 text-xs font-semibold text-white">Select</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
