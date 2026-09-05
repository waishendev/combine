"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getBookingServiceCategories, getBookingServices, getPublicBookingStoreLocations } from "@/lib/apiClient";
import { BookingServiceCategory, PublicBookingStoreLocation, Service } from "@/lib/types";
import { BookingProgress } from "@/components/booking/BookingProgress";

export default function BookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryIdParam = searchParams.get("category_id");
  const storeLocationIdParam = searchParams.get("store_location_id");
  const branchModeParam = searchParams.get("branch_mode");
  const [storeLocations, setStoreLocations] = useState<PublicBookingStoreLocation[]>([]);
  const [categories, setCategories] = useState<BookingServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [pendingBranch, setPendingBranch] = useState<PublicBookingStoreLocation | null>(null);

  const selectedStoreLocation = useMemo(() => {
    const id = Number(storeLocationIdParam);
    return Number.isInteger(id) && id > 0 ? storeLocations.find((location) => location.id === id) ?? null : null;
  }, [storeLocationIdParam, storeLocations]);
  const branchSelectionRequired = storeLocations.length > 1;
  const invalidSelectedBranch = locationsLoaded && Boolean(storeLocationIdParam) && !selectedStoreLocation;
  const autoSelectingSingleBranch = locationsLoaded && storeLocations.length === 1 && !storeLocationIdParam;

  useEffect(() => {
    if (!locationsLoaded || storeLocations.length !== 1 || storeLocationIdParam) return;
    const params = new URLSearchParams();
    params.set("store_location_id", String(storeLocations[0].id));
    params.set("branch_mode", "single");
    router.replace(`/booking?${params.toString()}`);
  }, [locationsLoaded, router, storeLocationIdParam, storeLocations]);

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
        const locations = await getPublicBookingStoreLocations();
        setStoreLocations(locations);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load booking Branches");
      } finally {
        setLocationsLoaded(true);
        setLoading(false);
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (!selectedStoreLocation) return;
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
  }, [selectedStoreLocation]);

  useEffect(() => {
    if (!selectedCategory || !selectedStoreLocation) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const serviceData = await getBookingServices(search, selectedCategory.id, selectedStoreLocation?.id);
        setServices(serviceData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load services");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [search, selectedCategory, selectedStoreLocation]);

  const branchAddress = (location: PublicBookingStoreLocation) =>
    [location.address_line1, location.address_line2, location.postcode, location.city, location.state]
      .filter(Boolean)
      .join(", ");

  const closeBranchPicker = () => {
    setBranchPickerOpen(false);
    setPendingBranch(null);
  };

  const applyBranchChange = (location: PublicBookingStoreLocation) => {
    setSearch("");
    setServices([]);
    setCategories([]);
    closeBranchPicker();
    router.replace(`/booking?store_location_id=${location.id}&branch_mode=multi`);
  };

  const requestBranchChange = (location: PublicBookingStoreLocation) => {
    if (location.id === selectedStoreLocation?.id) {
      closeBranchPicker();
      return;
    }
    // Mid-flow: category/service choices are branch-scoped — clear them with an explicit confirm.
    if (selectedCategory) {
      setPendingBranch(location);
      return;
    }
    applyBranchChange(location);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      {!locationsLoaded || storeLocations.length > 0 ? (
        <BookingProgress
          step={branchSelectionRequired ? (selectedStoreLocation ? 2 : 1) : 1}
          branchStepRequired={branchSelectionRequired}
          loading={!locationsLoaded || autoSelectingSingleBranch}
          backHref={selectedCategory ? `/booking?store_location_id=${selectedStoreLocation?.id}&branch_mode=${branchModeParam ?? (branchSelectionRequired ? "multi" : "single")}` : branchSelectionRequired && selectedStoreLocation ? "/booking" : undefined}
        />
      ) : null}

      {autoSelectingSingleBranch ? (
        <p className="py-10 text-center text-sm text-[var(--text-muted)]" aria-live="polite">Preparing your booking…</p>
      ) : invalidSelectedBranch ? (
        <section className="mx-auto max-w-xl rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center shadow-sm" aria-live="polite">
          <h1 className="font-[var(--font-heading)] text-xl font-semibold">This booking Branch is no longer available</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Your previous selections were not moved to another Branch. Restart to refresh the available locations.</p>
          <button type="button" onClick={() => router.replace("/booking")} className="mt-5 rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-semibold text-white">Restart booking</button>
        </section>
      ) : !selectedStoreLocation ? (
        <section aria-labelledby="choose-branch-heading">
          <div className="text-center">
            <h1 id="choose-branch-heading" className="font-[var(--font-heading)] text-2xl font-semibold sm:text-3xl">Choose Branch</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Select where your appointment will take place.</p>
          </div>
          {locationsLoaded && storeLocations.length === 0 ? (
            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center shadow-sm">
              <p className="font-semibold">Online booking is currently unavailable.</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">Please contact us for assistance or try again later.</p>
            </div>
          ) : storeLocations.length > 1 ? (
            <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2">
              {storeLocations.map((location) => {
                const imageUrl = location.images?.find((image) => image.image_url)?.image_url;
                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => router.replace(`/booking?store_location_id=${location.id}&branch_mode=multi`)}
                    className="group overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg"
                  >
                    {imageUrl ? (
                      <div className="relative aspect-[16/7] w-full overflow-hidden bg-gray-100">
                        <Image src={imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover transition duration-300 group-hover:scale-[1.02]" />
                      </div>
                    ) : null}
                    <div className="p-5">
                      <h2 className="font-[var(--font-heading)] text-lg font-semibold">{location.name}</h2>
                      {branchAddress(location) ? <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{branchAddress(location)}</p> : null}
                      {location.phone ? <p className="mt-2 text-sm text-[var(--text-muted)]"><i className="fa-solid fa-phone mr-2" aria-hidden />{location.phone}</p> : null}
                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)]">Choose this Branch <i className="fa-solid fa-arrow-right text-xs" aria-hidden /></span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : branchSelectionRequired ? (
        <div className="mb-4 sm:mb-6">
          <button
            type="button"
            onClick={() => {
              setPendingBranch(null);
              setBranchPickerOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3.5 py-2.5 text-left shadow-sm transition hover:border-[var(--accent)] sm:px-4"
            aria-label={`Booking at ${selectedStoreLocation.name}. Change Branch`}
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--accent-strong)]">
              <i className="fa-solid fa-location-dot text-sm" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight text-[var(--foreground)]">
                {selectedStoreLocation.name}
              </span>
              <span className="block text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">
                Tap to change Branch
              </span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-[var(--accent-strong)]">
              Change
              <i className="fa-solid fa-chevron-right ml-1 text-[10px]" aria-hidden />
            </span>
          </button>
        </div>
      ) : null}

      {branchPickerOpen && branchSelectionRequired ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0 backdrop-blur-sm sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-branch-heading"
          onClick={closeBranchPicker}
        >
          <div
            className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-2xl sm:rounded-3xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            {pendingBranch ? (
              <>
                <h2 id="change-branch-heading" className="font-[var(--font-heading)] text-xl font-semibold">
                  Switch to {pendingBranch.name}?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  Your current category selections will be cleared.
                </p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setPendingBranch(null)}
                    className="rounded-full border border-[var(--card-border)] px-4 py-2.5 text-sm font-semibold"
                  >
                    Keep current Branch
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBranchChange(pendingBranch)}
                    className="rounded-full bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Switch & start over
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="change-branch-heading" className="font-[var(--font-heading)] text-xl font-semibold">Change Branch</h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">Pick where this appointment should take place.</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeBranchPicker}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--card-border)] text-[var(--text-muted)]"
                    aria-label="Close"
                  >
                    <i className="fa-solid fa-xmark" aria-hidden />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {storeLocations.map((location) => {
                    const isCurrent = location.id === selectedStoreLocation?.id;
                    return (
                      <button
                        key={location.id}
                        type="button"
                        onClick={() => requestBranchChange(location)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                          isCurrent
                            ? "border-[var(--accent)] bg-[var(--muted)]"
                            : "border-[var(--card-border)] hover:border-[var(--accent)] hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold">{location.name}</p>
                            {branchAddress(location) ? (
                              <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{branchAddress(location)}</p>
                            ) : null}
                          </div>
                          {isCurrent ? (
                            <span className="shrink-0 rounded-full bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                              Current
                            </span>
                          ) : (
                            <span className="shrink-0 text-sm font-semibold text-[var(--accent-strong)]">Select</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {selectedStoreLocation && selectedCategory ? (
        <>
          <div className="mt-4 sm:mt-6">
            {/* Desktop: Back + title on same row */}
            <div className="hidden sm:relative sm:flex sm:items-center sm:justify-center">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setServices([]);
                  router.replace(`/booking?store_location_id=${selectedStoreLocation.id}&branch_mode=${branchSelectionRequired ? "multi" : "single"}`);
                }}
                className="absolute left-0 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-sm shadow-sm"
              >
                <i className="fa-solid fa-arrow-left" /> Back
              </button>
              <div className="min-w-0 max-w-full px-16 text-center">
                <h1 className="break-words font-[var(--font-heading)] text-lg font-semibold leading-snug sm:text-xl">
                  {selectedCategory.name}
                </h1>
                {selectedCategory.cn_name ? (
                  <p className="mt-1 break-words text-sm leading-snug text-[var(--text-muted)]">{selectedCategory.cn_name}</p>
                ) : null}
              </div>
            </div>

            {/* Mobile: keep just title here (Back is in stepper) */}
            <div className="min-w-0 text-center sm:hidden">
              <h1 className="break-words font-[var(--font-heading)] text-lg font-semibold leading-snug">
                {selectedCategory.name}
              </h1>
              {selectedCategory.cn_name ? (
                <p className="mt-1 break-words text-sm leading-snug text-[var(--text-muted)]">{selectedCategory.cn_name}</p>
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

      {selectedStoreLocation && !selectedCategory ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                router.replace(`/booking?store_location_id=${selectedStoreLocation.id}&branch_mode=${branchSelectionRequired ? "multi" : "single"}&category_id=${category.id}`);
              }}
              className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg"
            >
              {/* Same wide crop as service cards / add-ons on the booking shop (1080×680). */}
              <div className="relative aspect-[1080/680] w-full shrink-0 overflow-hidden bg-gray-100">
                {(category.image_url || category.image_path) ? (
                  <Image
                    src={(category.image_url || category.image_path) as string}
                    alt={category.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    loading="lazy"
                    className="object-cover object-center"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">No image</div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
                <h2 className="break-words font-[var(--font-heading)] text-[15px] font-semibold leading-snug sm:text-base">
                  {category.name}
                </h2>
                {category.cn_name ? (
                  <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)] sm:text-[13px]">{category.cn_name}</p>
                ) : null}
                {category.description ? (
                  <p className="mt-1 break-words text-[13px] leading-snug text-[var(--text-muted)] sm:text-sm">
                    {category.description}
                  </p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : selectedStoreLocation && selectedCategory ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/booking/service/${service.id}?store_location_id=${selectedStoreLocation.id}&branch_mode=${branchSelectionRequired ? "multi" : "single"}&category_id=${selectedCategory.id}`}
              className="group relative flex h-full flex-col gap-0 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg"
            >
              <div className="relative w-full shrink-0 overflow-hidden bg-gray-100 aspect-[1080/680]">
                {(service.image_url || service.image_path) ? (
                  <Image
                    src={(service.image_url || service.image_path) as string}
                    alt={service.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    loading="lazy"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">No image</div>
                )}
              </div>
              <div className="relative flex min-w-0 flex-1 flex-col p-3 sm:p-4">
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
      ) : null}
    </main>
  );
}
