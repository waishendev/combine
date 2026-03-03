"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBookingServices } from "@/lib/apiClient";
import { Service } from "@/lib/types";

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    getBookingServices().then(setServices).catch(() => setServices([]));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">All Services</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {services.map((service) => (
          <Link key={service.id} href={`/booking/service/${service.id}`} className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="font-semibold">{service.name}</h2>
            <p className="mt-1 text-sm text-neutral-600">{service.duration_minutes} min</p>
            <p className="mt-1 text-sm text-neutral-600">Deposit RM {service.deposit_amount}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
