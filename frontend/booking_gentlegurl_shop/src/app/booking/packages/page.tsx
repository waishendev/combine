"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getServicePackages } from "@/lib/apiClient";
import { ServicePackage } from "@/lib/types";

export default function BookingPackagesPage() {
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await getServicePackages();
        setPackages(rows.filter((pkg) => pkg.is_active !== false));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load service packages");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-4 text-sm">
        <Link href="/booking" className="text-neutral-500 hover:text-black">Booking</Link>
        <span className="mx-2 text-neutral-400">/</span>
        <span className="font-semibold">Packages</span>
      </div>

      <h1 className="text-3xl font-semibold">Service Packages</h1>
      <p className="mt-2 text-neutral-600">Choose package plan and ask counter staff to purchase under your account.</p>

      {loading ? <p className="mt-4">Loading packages...</p> : null}
      {error ? <p className="mt-4 text-red-500">{error}</p> : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {packages.map((pkg) => (
          <article key={pkg.id} className="rounded-2xl border border-neutral-200 p-5 shadow-sm">
            <h2 className="font-semibold">{pkg.name}</h2>
            <p className="mt-1 text-sm text-neutral-600">{pkg.description || "Service package"}</p>
            <p className="mt-2 text-sm text-neutral-500">Sessions: {pkg.total_sessions} • Valid: {pkg.valid_days ?? "-"} days</p>
            <p className="mt-2 text-lg font-semibold">RM {pkg.selling_price}</p>
            <p className="mt-2 text-xs text-neutral-500">After purchase, you can claim sessions in booking cart / POS.</p>
          </article>
        ))}
      </div>
    </main>
  );
}
