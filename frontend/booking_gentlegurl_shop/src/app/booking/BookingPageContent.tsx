"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getBookingLandingPage, getBookingServiceCategories, getBookingServices } from "@/lib/apiClient";
import type { BookingLandingPage, BookingServiceCategory, Service } from "@/lib/types";
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
  const [landing, setLanding] = useState<BookingLandingPage | null>(null);
  const [landingLoading, setLandingLoading] = useState(false);
  const [landingError, setLandingError] = useState<string | null>(null);

  const selectedCategory = useMemo((): BookingServiceCategory | null => {
    if (!categoryIdParam || categories.length === 0) return null;
    const cid = Number.parseInt(categoryIdParam, 10);
    if (!Number.isFinite(cid)) return null;
    return categories.find((c) => c.id === cid) ?? null;
  }, [categoryIdParam, categories]);

  useEffect(() => {
    if (selectedCategory) return;
    const run = async () => {
      setLandingLoading(true);
      setLandingError(null);
      try {
        const page = await getBookingLandingPage();
        setLanding(page);
      } catch (err) {
        setLandingError(err instanceof Error ? err.message : "Unable to load booking landing page");
      } finally {
        setLandingLoading(false);
      }
    };
    run();
  }, [selectedCategory]);

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

  const landingSections = landing?.sections;
  const showLanding = !selectedCategory && Boolean(landingSections);

  const renderHeading = (heading?: { label?: string; title?: string; align?: "left" | "center" | "right" }) => {
    if (!heading) return null;
    const align =
      heading.align === "center" ? "text-center" : heading.align === "right" ? "text-right" : "text-left";
    return (
      <div className={`space-y-1 ${align}`}>
        {heading.label ? (
          <p className="text-xs font-semibold tracking-widest text-[var(--text-muted)] uppercase">{heading.label}</p>
        ) : null}
        {heading.title ? (
          <h2 className="font-[var(--font-heading)] text-2xl font-medium sm:text-3xl">{heading.title}</h2>
        ) : null}
      </div>
    );
  };

  const renderGalleryGrid = (items: { src: string; caption?: string }[]) => {
    if (!items?.length) return null;
    return (
      <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="group overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="aspect-[3/4] bg-gray-100">
              {item.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.src} alt={item.caption || ""} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-400">No image</div>
              )}
            </div>
            {item.caption ? (
              <div className="p-3 text-sm">
                <p className="line-clamp-2 text-[var(--text-muted)]">{item.caption}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

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

      {showLanding ? (
        <section className="mt-10 space-y-10">
          {/* Hero */}
          {landingSections?.hero?.is_active ? (
            <div className="overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card)] shadow-sm">
              <div className="p-6 sm:p-10">
                {landingSections.hero.label ? (
                  <p className="text-xs font-semibold tracking-widest text-[var(--text-muted)] uppercase">
                    {landingSections.hero.label}
                  </p>
                ) : null}
                {landingSections.hero.title ? (
                  <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-medium sm:text-4xl">
                    {landingSections.hero.title}
                  </h2>
                ) : null}
                {landingSections.hero.subtitle ? (
                  <p className="mt-3 max-w-2xl text-sm text-[var(--text-muted)] sm:text-base">
                    {landingSections.hero.subtitle}
                  </p>
                ) : null}
                {landingSections.hero.cta_label && landingSections.hero.cta_link ? (
                  <div className="mt-6">
                    <Link
                      href={landingSections.hero.cta_link}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
                    >
                      {landingSections.hero.cta_label}
                      <i className="fa-solid fa-arrow-right text-xs" />
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Gallery */}
          {landingSections?.gallery?.is_active ? (
            <div>
              {renderHeading(landingSections.gallery.heading)}
              {renderGalleryGrid(landingSections.gallery.items || [])}
            </div>
          ) : null}

          {/* Service Menu */}
          {landingSections?.service_menu?.is_active ? (
            <div>
              {renderHeading(landingSections.service_menu.heading)}
              {renderGalleryGrid(landingSections.service_menu.items || [])}
            </div>
          ) : null}

          {/* FAQ */}
          {landingSections?.faqs?.is_active ? (
            <div>
              {renderHeading(landingSections.faqs.heading)}
              <div className="mt-6 space-y-3">
                {(landingSections.faqs.items || []).map((item, idx) => (
                  <details
                    key={idx}
                    className="group rounded-2xl border border-[var(--card-border)] bg-[var(--card)] px-5 py-4 shadow-sm"
                  >
                    <summary className="cursor-pointer list-none font-medium">
                      <div className="flex items-center justify-between gap-3">
                        <span>{item.question}</span>
                        <i className="fa-solid fa-chevron-down text-xs text-[var(--text-muted)] transition-transform group-open:rotate-180" />
                      </div>
                    </summary>
                    <p className="mt-3 whitespace-pre-line text-sm text-[var(--text-muted)]">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          ) : null}

          {/* Notes */}
          {landingSections?.notes?.is_active ? (
            <div>
              {renderHeading(landingSections.notes.heading)}
              <ul className="mt-6 space-y-2 text-sm text-[var(--text-muted)]">
                {(landingSections.notes.items || []).map((note, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--text-muted)]" />
                    <span className="whitespace-pre-line">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

        </section>
      ) : (
        <>
          {landingLoading ? <p className="mt-6 text-sm text-[var(--text-muted)]">Loading landing page…</p> : null}
          {landingError ? <p className="mt-6 text-sm text-[var(--status-error)]">{landingError}</p> : null}
        </>
      )}

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
        <div className="mt-12 grid gap-4 md:grid-cols-3">
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
