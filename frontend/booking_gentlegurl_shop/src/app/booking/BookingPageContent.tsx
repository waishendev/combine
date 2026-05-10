"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getBookingServiceCategories, getBookingServices } from "@/lib/apiClient";
import { BookingServiceCategory, Service } from "@/lib/types";
import { BookingProgress } from "@/components/booking/BookingProgress";

export default function BookingPageContent() {
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <BookingProgress
        step={1}
        loading={loading && categories.length === 0}
        backHref={selectedCategory ? "/booking" : undefined}
      />

      {selectedCategory ? (
        <>
          <div className="mt-4 sm:mt-6">
            {/* Desktop: Back + title on same row */}
            <div className="hidden sm:relative sm:flex sm:items-center sm:justify-center">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setServices([]);
                  router.replace("/booking");
                }}
                className="absolute left-0 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-sm shadow-sm"
              >
                <i className="fa-solid fa-arrow-left" /> Back
              </button>
              <div className="px-16 text-center">
                <h1 className="font-[var(--font-heading)] text-lg font-semibold leading-snug sm:text-xl">
                  {selectedCategory.name}
                </h1>
                {selectedCategory.cn_name ? (
                  <p className="mt-1 text-sm leading-snug text-[var(--text-muted)]">{selectedCategory.cn_name}</p>
                ) : null}
              </div>
            </div>

            {/* Mobile: keep just title here (Back is in stepper) */}
            <div className="text-center sm:hidden">
              <h1 className="font-[var(--font-heading)] text-lg font-semibold leading-snug">
                {selectedCategory.name}
              </h1>
              {selectedCategory.cn_name ? (
                <p className="mt-1 text-sm leading-snug text-[var(--text-muted)]">{selectedCategory.cn_name}</p>
              ) : null}
            </div>

            <div className="relative mx-auto mt-4 w-full max-w-md text-center">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-full border border-[var(--card-border)] bg-[var(--card)] py-2 pl-10 pr-4 text-sm shadow-sm outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
            </div>
          </div>
        </>
      ) : null}

      {loading ? <p className="mt-4">Loading...</p> : null}
      {error ? <p className="mt-4 text-[var(--status-error)]">{error}</p> : null}

      {!selectedCategory ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                router.replace(`/booking?category_id=${category.id}`);
              }}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg"
            >
              <div className="aspect-[4/3] shrink-0 bg-gray-100">
                {(category.image_url || category.image_path) ? (
                  <img src={(category.image_url || category.image_path) as string} alt={category.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-400">No image</div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <h2 className="line-clamp-2 font-[var(--font-heading)] text-[15px] font-semibold leading-snug sm:text-base">
                  {category.name}
                </h2>
                {category.cn_name ? (
                  <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-[var(--text-muted)] sm:text-[13px]">{category.cn_name}</p>
                ) : null}
                {category.description ? (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--text-muted)] sm:text-sm">
                    {category.description}
                  </p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/booking/service/${service.id}?category_id=${selectedCategory.id}`}
              className="group relative flex h-full flex-row gap-3 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg sm:flex-col sm:gap-0 sm:p-0"
            >
              <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none">
                {(service.image_url || service.image_path) ? (
                  <img src={(service.image_url || service.image_path) as string} alt={service.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">No image</div>
                )}
              </div>
              <div className="relative flex min-w-0 flex-1 flex-col sm:flex-1 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-[var(--font-heading)] text-[15px] font-semibold leading-snug sm:line-clamp-2 sm:text-base">
                      {service.name}
                    </h2>
                    {service.cn_name ? (
                      <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)] sm:line-clamp-1 sm:text-[13px]">
                        {service.cn_name}
                      </p>
                    ) : null}
                  </div>
                  <span className="hidden shrink-0 rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium capitalize text-[var(--accent-strong)] sm:inline-flex">
                    {service.service_type}
                  </span>
                </div>
                <p className="mt-1 break-words text-[13px] leading-snug text-[var(--text-muted)] sm:line-clamp-2 sm:text-sm">
                  {service.description || "Professional treatment service."}
                </p>
                <div className="mt-2 border-t border-[var(--card-border)] pt-3 sm:mt-2">
                  {/* Mobile: plain lines, wrap freely — duration / price / tier */}
                  <div className="flex flex-col gap-1.5 text-[13px] leading-snug sm:hidden">
                    <span className="tabular-nums text-[var(--foreground)]">{service.duration_minutes} min</span>
                    <span className="font-semibold tabular-nums text-[var(--foreground)]">
                      {service.price_mode === "range" && service.price_range_min != null && service.price_range_max != null
                        ? `RM ${Number(service.price_range_min).toFixed(0)}–${Number(service.price_range_max).toFixed(0)}`
                        : `RM ${Number(service.price).toFixed(0)}`}
                    </span>
                    <span className="break-words capitalize text-[var(--text-muted)]">{service.service_type}</span>
                  </div>

                  <div className="hidden space-y-1 text-sm sm:block">
                    <p className="flex justify-between gap-2">
                      <span className="text-[var(--text-muted)]">Duration</span>
                      <span className="font-medium tabular-nums">{service.duration_minutes} min</span>
                    </p>
                    <p className="flex justify-between gap-2">
                      <span className="text-[var(--text-muted)]">Price</span>
                      <span className="font-medium tabular-nums">
                        {service.price_mode === "range" && service.price_range_min != null && service.price_range_max != null
                          ? `RM ${Number(service.price_range_min).toFixed(2)} - ${Number(service.price_range_max).toFixed(2)}`
                          : `RM ${Number(service.price).toFixed(2)}`}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
