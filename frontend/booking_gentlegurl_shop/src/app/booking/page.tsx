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
        const data = await getBookingServices(search);
        setServices(data);
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
      <h1 className="text-3xl font-semibold">Choose your service</h1>
      <p className="mt-2 text-sm text-neutral-600">Select a service to begin your booking.</p>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search service"
        className="mt-4 w-full rounded-xl border border-neutral-300 px-4 py-2"
      />
      {loading ? <p className="mt-4">Loading services...</p> : null}
      {error ? <p className="mt-4 text-red-500">{error}</p> : null}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <article
            key={service.id}
            className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-md transition-shadow hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">{service.name}</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  service.service_type === "premium"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-neutral-200 text-neutral-700"
                }`}
              >
                {service.service_type}
              </span>
            </div>

            <p className="mt-3 text-sm text-neutral-600">Duration: {service.duration_minutes} min</p>
            <p className="mt-1 text-sm text-neutral-600">
              {service.service_type === "premium"
                ? "Deposit required"
                : "No additional deposit if Premium selected"}
            </p>

            <div className="mt-5 border-t border-neutral-100 pt-4">
              <Link
                href={`/booking/service/${service.id}`}
                className="inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white"
              >
                Select Service
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
