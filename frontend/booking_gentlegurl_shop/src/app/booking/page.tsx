"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { getBookingCart, getBookingServices } from "@/lib/apiClient";
import { BOOKING_CART_CHANGED_EVENT, emitOpenBookingCartDrawer } from "@/lib/bookingCartEvents";
import { Service } from "@/lib/types";

export default function BookingPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
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

  useEffect(() => {
    loadData();
  }, [search]);

  useEffect(() => {
    const refreshCart = async () => {
      const cartData = await getBookingCart();
      setCartCount(cartData.items?.length ?? 0);
    };
    window.addEventListener(BOOKING_CART_CHANGED_EVENT, refreshCart);
    return () => window.removeEventListener(BOOKING_CART_CHANGED_EVENT, refreshCart);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 pb-24">
      <BookingProgress step={1} />
      <h1 className="text-3xl font-semibold">Choose your service</h1>
      <p className="mt-2 text-sm text-neutral-600">Search and select a service to continue with staff and slot selection.</p>

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
          <article key={service.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{service.name}</h2>
            <p className="mt-1 text-sm text-neutral-500">{service.duration_minutes} min</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{service.service_type}</p>
            <p className="mt-1 text-sm text-neutral-600">
              {service.service_type === "premium" ? "Deposit applies" : "No extra deposit if Premium exists"}
            </p>
            <Link href={`/booking/service/${service.id}`} className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-sm text-white">
              Select
            </Link>
          </article>
        ))}
      </div>

      {cartCount > 0 ? (
        <div className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-700">View Cart ({cartCount})</p>
            <button onClick={emitOpenBookingCartDrawer} className="rounded-full bg-black px-4 py-2 text-sm text-white">
              Open Cart
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
