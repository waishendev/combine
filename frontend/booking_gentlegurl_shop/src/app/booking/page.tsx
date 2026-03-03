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
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search service"
        className="mt-4 w-full rounded-xl border border-neutral-300 px-4 py-2"
      />
      {loading ? <p className="mt-4">Loading services...</p> : null}
      {error ? <p className="mt-4 text-red-500">{error}</p> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {services.map((service) => (
          <Link key={service.id} href={`/booking/service/${service.id}`} className="rounded-2xl border border-neutral-200 p-5 shadow-sm">
            <h2 className="font-semibold">{service.name}</h2>
            <p className="text-sm text-neutral-500">{service.duration_minutes} min</p>
            <p className="text-sm text-neutral-500">Deposit RM {service.deposit_amount}</p>
            <p className="mt-2 text-lg font-semibold">RM {service.price}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
