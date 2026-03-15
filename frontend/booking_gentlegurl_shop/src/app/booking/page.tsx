"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBookingServices, getServicePackages } from "@/lib/apiClient";
import { Service, ServicePackage } from "@/lib/types";
import { BookingProgress } from "@/components/booking/BookingProgress";

export default function BookingPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<ServicePackage[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [serviceData, packageData] = await Promise.all([
          getBookingServices(search),
          getServicePackages().catch(() => []),
        ]);
        setServices(serviceData);
        setPackages(packageData.filter((pkg) => pkg.is_active !== false));
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
        className="mt-4 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2"
      />
      {loading ? <p className="mt-4">Loading services...</p> : null}
      {error ? <p className="mt-4 text-[var(--status-error)]">{error}</p> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {services.map((service) => (
          <Link key={service.id} href={`/booking/service/${service.id}`} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm transition hover:border-[var(--accent)] hover:shadow">
            <h2 className="font-semibold">{service.name}</h2>
            <p className="text-sm text-[var(--text-muted)]">{service.duration_minutes} min</p>
            <p className="text-sm text-[var(--text-muted)]">Deposit RM {service.deposit_amount}</p>
            <p className="mt-2 text-lg font-semibold">RM {service.price}</p>
          </Link>
        ))}
      </div>

      <section id="packages" className="mt-10">
        <h2 className="text-2xl font-semibold">Service Packages</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">You can buy these package plans at POS/CRM counter, then claim sessions in booking cart.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {packages.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No active package currently.</p>
          ) : (
            packages.map((pkg) => (
              <article key={pkg.id} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
                <h3 className="font-semibold">{pkg.name}</h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{pkg.description || "Service membership package"}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">Sessions: {pkg.total_sessions} • Valid: {pkg.valid_days ?? "-"} days</p>
                <p className="mt-2 text-lg font-semibold">RM {pkg.selling_price}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
