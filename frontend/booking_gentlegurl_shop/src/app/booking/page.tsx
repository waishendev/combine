"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getBookingServiceCategories, getBookingServices } from "@/lib/apiClient";
import { BookingServiceCategory, Service } from "@/lib/types";
import { BookingProgress } from "@/components/booking/BookingProgress";

export default function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryIdParam = searchParams.get("category_id");
  const [categories, setCategories] = useState<BookingServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = useMemo((): BookingServiceCategory | null => {
    if (!categoryIdParam || categories.length === 0) return null;
    const cid = Number.parseInt(categoryIdParam, 10);
    if (!Number.isFinite(cid)) return null;
    return categories.find((c) => c.id === cid) ?? null;
  }, [categoryIdParam, categories]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const categoryData = await getBookingServiceCategories();
        setCategories(categoryData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load categories");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const serviceData = await getBookingServices(search, selectedCategory.id);
        setServices(serviceData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load services");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [search, selectedCategory]);

  const title = useMemo(() => {
    if (!selectedCategory) return "Choose your service category";
    return `Services in ${selectedCategory.name}`;
  }, [selectedCategory]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <BookingProgress step={selectedCategory ? 2 : 1} loading={loading && categories.length === 0} />
      <div className="text-center space-y-2">
        <h1 className="font-[var(--font-heading)] text-3xl font-medium sm:text-4xl">{title}</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {!selectedCategory ? "Select a category to continue" : "Select a service to begin your booking"}
        </p>

        {selectedCategory ? (
          <div className="relative mx-auto mt-5 w-full max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services..."
              className="w-full rounded-full border border-[var(--card-border)] bg-[var(--card)] px-12 py-3 text-sm shadow-sm outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>
        ) : null}
      </div>

      {selectedCategory ? (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setServices([]);
            router.replace("/booking");
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-4 py-2 text-sm"
        >
          <i className="fa-solid fa-arrow-left" /> Back to categories
        </button>
      ) : null}

      {loading ? <p className="mt-4">Loading...</p> : null}
      {error ? <p className="mt-4 text-[var(--status-error)]">{error}</p> : null}

      {!selectedCategory ? (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                router.replace(`/booking?category_id=${category.id}`);
              }}
              className="text-left group relative overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg"
            >
              <div className="aspect-[4/3] bg-gray-100">
                {(category.image_url || category.image_path) ? (
                  <img src={(category.image_url || category.image_path) as string} alt={category.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-400">No image</div>
                )}
              </div>
              <div className="p-4">
                <h2 className="font-[var(--font-heading)] font-semibold">{category.name}</h2>
                {category.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{category.description}</p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/booking/service/${service.id}?category_id=${selectedCategory.id}`}
              className="group relative overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg"
            >
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
                <div className="mt-3 space-y-1 border-t border-[var(--card-border)] pt-3 text-sm">
                  <p className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Duration</span>
                    <span className="font-medium tabular-nums">{service.duration_minutes} min</span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Price</span>
                    <span className="font-medium tabular-nums">RM {Number(service.price).toFixed(2)}</span>
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
