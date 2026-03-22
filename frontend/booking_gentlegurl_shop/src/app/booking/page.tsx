"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBookingServices } from "@/lib/apiClient";
import { Service } from "@/lib/types";
import { BookingProgress } from "@/components/booking/BookingProgress";

export default function BookingPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const serviceData = await getBookingServices(search);
        setServices(serviceData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load services");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [search]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <BookingProgress step={1} />
      <div className="text-center space-y-2">
        <h1 className="font-[var(--font-heading)] text-3xl font-medium sm:text-4xl">
          Choose your <em className="text-[var(--accent-strong)]">experience</em>
        </h1>
        <p className="text-sm text-[var(--text-muted)]">Select a service to begin your booking</p>

        <div className="relative mx-auto mt-5 w-full max-w-md">
          <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services..."
            className="w-full rounded-full border border-[var(--card-border)] bg-[var(--card)] px-12 py-3 text-sm shadow-sm outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </div>
      </div>

      {loading ? <p className="mt-4">Loading services...</p> : null}
      {error ? <p className="mt-4 text-[var(--status-error)]">{error}</p> : null}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {services.map((service) => (
          <Link
            key={service.id}
            href={`/booking/service/${service.id}`}
            className="group relative overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[var(--accent)] to-amber-200 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            <div className="aspect-[4/3] bg-gray-100">
              {(service.image_url || service.image_path) ? (
                <img src={(service.image_url || service.image_path) as string} alt={service.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-400">No image</div>
              )}
            </div>
            <div className="relative p-4">

              <div className="flex items-center justify-between">
                <h2 className="font-[var(--font-heading)] font-semibold">{service.name}</h2>
                <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium capitalize text-[var(--accent-strong)]">
                  {service.service_type}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
                {service.description || "Professional treatment service."}
              </p>
              <div className="mt-3 flex items-center gap-2 border-t border-[var(--card-border)] pt-3">
                <span className="text-xs text-[var(--text-muted)]">{service.duration_minutes} min</span>
                <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">
                  Deposit RM {service.deposit_amount}
                </span>
                <span className="ml-auto font-[var(--font-heading)] text-lg font-semibold">RM {service.price}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
