"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { getBookingServiceDetail, getMe, getServicePackageAvailableFor } from "@/lib/apiClient";
import { Service, Staff } from "@/lib/types";

type ServiceDetail = Service & { staffs?: Staff[] };

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [packageHint, setPackageHint] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const detail = await getBookingServiceDetail(id);
        setService(detail as ServiceDetail);

        try {
          const me = await getMe();
          const available = await getServicePackageAvailableFor(me.id, Number(id));
          const totalRemaining = available.reduce((sum, row) => sum + Number(row.remaining_qty || 0), 0);
          if (totalRemaining > 0) {
            setPackageHint(`You have ${totalRemaining} package session(s) remaining for this service.`);
          }
        } catch {
          setPackageHint(null);
        }
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

        {error ? <p className="text-[var(--status-error)]">{error}</p> : null}

        {packageHint ? (
          <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[var(--status-success)]">
            {packageHint}
          </div>
        ) : null}

        {!service ? (
          <p>Loading service...</p>
        ) : (
          <section className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold">{service.name}</h1>
              <p className="text-[var(--text-muted)]">{service.description || "Select your preferred stylist to continue."}</p>
              <p className="text-sm text-[var(--text-muted)]">
                Duration {service.duration_minutes} min • Deposit RM {service.deposit_amount}
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Choose a stylist</h2>

              {staffs.length === 0 ? (
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">
                  No stylists available for this service.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {staffs.map((staff) => (
                    <Link
                      key={staff.id}
                      href={`/booking/service/${id}/slots?staff_id=${staff.id}`}
                      className="group rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm transition hover:border-[var(--accent-strong)] hover:shadow"
                    >
                      <div className="flex items-start gap-3">
                        {(staff.avatar_url || staff.avatar_path || staff.avatar) ? (
                          <img src={(staff.avatar_url || staff.avatar_path || staff.avatar) as string} alt={staff.name} className="h-14 w-14 rounded-full object-cover" />
                        ) : (
                          <div className="h-14 w-14 rounded-full bg-gray-200" />
                        )}
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{staff.name}</p>
                          <p className="text-sm text-[var(--text-muted)]">{staff.position || 'Staff'}</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">{staff.description || 'Available stylist'}</p>
                        </div>
                      </div>
                      <span className="mt-4 inline-flex rounded-full bg-[var(--accent-strong)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-stronger)] transition-colors">Select</span>
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
