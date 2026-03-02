"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { getBookingCart, getBookingServices } from "@/lib/apiClient";
import { Service } from "@/lib/types";

export default function BookingPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [serviceData, cartData] = await Promise.all([getBookingServices(search), getBookingCart()]);
        setServices(serviceData);
        setCartCount(cartData.items?.length ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load booking data");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [search]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24">
      <BookingProgress step={1} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Choose your service</h1>
          <p className="mt-2 text-sm text-neutral-600">Start your booking by selecting a service, then pick staff and time slot.</p>
        </div>
        {cartCount > 0 ? (
          <Link href="/booking/cart" className="rounded-full border border-black px-4 py-2 text-sm font-medium">
            View Cart ({cartCount})
          </Link>
        ) : null}
      </div>
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
          <article key={service.id} className="rounded-2xl border border-neutral-200 p-5 shadow-sm">
            <h2 className="font-semibold">{service.name}</h2>
            <p className="mt-1 text-sm text-neutral-500">{service.duration_minutes} min</p>
            <p className="text-sm text-neutral-500">Deposit RM {service.deposit_amount}</p>
            <p className="mt-2 text-lg font-semibold">RM {service.price}</p>
            <Link href={`/booking/service/${service.id}`} className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-sm text-white">
              Book
            </Link>
          </article>
        ))}
      </div>

      {cartCount > 0 ? (
        <div className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-700">You have {cartCount} item{cartCount > 1 ? "s" : ""} in cart</p>
            <Link href="/booking/cart" className="rounded-full bg-black px-4 py-2 text-sm text-white">
              View Cart
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
