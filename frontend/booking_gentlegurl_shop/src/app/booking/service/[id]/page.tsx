"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { ServiceTierBadge } from "@/components/booking/ServiceTierBadge";
import { getBookingServiceDepositNote, getBookingServiceDetail } from "@/lib/apiClient";
import { depositPreviewForService } from "@/lib/bookingDepositPreview";
import { BookingServiceQuestion, BookingServiceQuestionOption, Service } from "@/lib/types";

export default function ServiceAddonsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("category_id");
  const id = params.id;
  const backHref = categoryId ? `/booking?category_id=${encodeURIComponent(categoryId)}` : "/booking";
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [depositNote, setDepositNote] = useState<string | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        const [detail, note] = await Promise.all([getBookingServiceDetail(id), getBookingServiceDepositNote()]);
        setService(detail as Service);
        setDepositNote(note);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load service");
      }
    };

    run();
  }, [id]);

  const selectedOptions = useMemo(
    () => (service?.questions ?? []).flatMap((q) => q.options).filter((o) => selectedOptionIds.includes(o.id)),
    [service?.questions, selectedOptionIds]
  );

  const selectedAddonLines = useMemo(() => {
    const rows: Array<{
      questionId: number;
      questionTitle: string;
      option: BookingServiceQuestionOption;
    }> = [];
    for (const q of service?.questions ?? []) {
      for (const opt of q.options) {
        if (selectedOptionIds.includes(opt.id)) {
          rows.push({ questionId: q.id, questionTitle: q.title, option: opt });
        }
      }
    }
    return rows;
  }, [service?.questions, selectedOptionIds]);

  const totalAddonDuration = selectedOptions.reduce((sum, o) => sum + Number(o.extra_duration_min || 0), 0);
  const totalAddonPrice = selectedOptions.reduce((sum, o) => sum + Number(o.extra_price || 0), 0);
  const baseDurationMin = service ? Number(service.duration_minutes || 0) : 0;
  const estimatedTotalMinutes = baseDurationMin + totalAddonDuration;
  const isRangePrice = service?.price_mode === 'range' && service.price_range_min != null && service.price_range_max != null;
  const listedServicePrice = service ? Number(service.price ?? 0) : 0;
  const listedPriceRangeMin = service ? Number(service.price_range_min ?? 0) : 0;
  const listedPriceRangeMax = service ? Number(service.price_range_max ?? 0) : 0;
  const estimatedTotalCost = listedServicePrice + totalAddonPrice;
  const depositPreview = useMemo(() => depositPreviewForService(service, selectedOptionIds), [service, selectedOptionIds]);
  /** Typical salon model: deposit is credited toward the appointment; balance due after service. */
  const estimatedBalanceAtSalon = Math.max(0, estimatedTotalCost - depositPreview.depositTotal);

  const goToStylist = useCallback(() => {
    const qs = new URLSearchParams();
    if (selectedOptionIds.length) qs.set("selected_option_ids", selectedOptionIds.join(","));
    if (categoryId) qs.set("category_id", categoryId);
    const q = qs.toString();
    router.push(`/booking/service/${id}/slots${q ? `?${q}` : ""}`);
  }, [categoryId, id, router, selectedOptionIds]);

  const toggleOption = useCallback((q: BookingServiceQuestion, opt: BookingServiceQuestionOption) => {
    setSelectedOptionIds((prev) => {
      const checked = prev.includes(opt.id);
      if (q.question_type === "single_choice") {
        const withoutQuestion = prev.filter((id) => !q.options.some((o) => o.id === id));
        return checked ? withoutQuestion : [...withoutQuestion, opt.id];
      }
      return checked ? prev.filter((id) => id !== opt.id) : [...prev, opt.id];
    });
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 pb-24">
      <BookingProgress step={3} loading={!service} />

      <div className="mt-6 space-y-6">
        <div className="flex items-center justify-start">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-4 py-2 text-sm leading-none"
          >
            <i className="fa-solid fa-arrow-left shrink-0 text-[0.95em]" aria-hidden />
            <span>Back</span>
          </Link>
        </div>

        {error ? <p className="text-[var(--status-error)]">{error}</p> : null}

        {!service ? (
          <p>Loading service...</p>
        ) : (
          <>
            {/* <section className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-sm">
              {(service.image_url || service.image_path) ? (
                <div className="aspect-[4/3] max-h-56 w-full bg-gray-100">
                  <img
                    src={(service.image_url || service.image_path) as string}
                    alt={service.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="font-[var(--font-heading)] text-2xl font-semibold">{service.name}</h1>
                  <span className="shrink-0 rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium capitalize text-[var(--accent-strong)]">
                    {service.service_type}
                  </span>
                </div>
                <p className="mt-2 text-[var(--text-muted)]">{service.description || "Select add-ons for this service."}</p>
                <ul className="mt-3 space-y-1 text-sm text-[var(--text-muted)]">
                  <li>• Duration: {service.duration_minutes} min</li>
                  <li>
                    • Deposit: RM {depositAmount.toFixed(2)}{" "}
                    <span className="text-[11px] text-[var(--text-muted)]">(holds your slot; usually applied to your bill)</span>
                  </li>
                  <li>• Listed service price: RM {listedServicePrice.toFixed(2)}</li>
                </ul>
              </div>
            </section> */}

            <section className="space-y-4">
              {(service.questions ?? []).length === 0 ? (
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">
                  No add-ons available for this service.
                </div>
              ) : (
                (service.questions ?? []).map((q) => (
                  <div key={q.id} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
                    <p className="font-[var(--font-heading)] font-semibold">
                      {q.title} {q.is_required ? "*" : ""}
                    </p>
                    {q.description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{q.description}</p> : null}
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      {q.options.map((opt) => {
                        const checked = selectedOptionIds.includes(opt.id);
                        const imgSrc = (opt.image_url || opt.image_path) as string | undefined;
                        const addonDesc =
                          (opt.linked_description && String(opt.linked_description).trim()) ||
                          "Professional treatment service.";
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => toggleOption(q, opt)}
                            aria-pressed={checked}
                            className={[
                              "group relative w-full overflow-hidden rounded-2xl text-left transition-all duration-300",
                              "border-2 bg-[var(--card)] shadow-sm",
                              checked
                                ? "border-[var(--accent-strong)] shadow-md ring-2 ring-[var(--accent)]/25"
                                : "border-[var(--card-border)] hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg",
                            ].join(" ")}
                          >
                            <div className="aspect-[4/3] bg-gray-100">
                              {imgSrc ? (
                                <img src={imgSrc} alt={opt.label} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">No image</div>
                              )}
                            </div>
                            <div className="relative p-4">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-[var(--font-heading)] font-semibold leading-snug">{opt.label}</h3>
                                {opt.linked_service_type ? (
                                  <span className="shrink-0 rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium capitalize text-[var(--accent-strong)]">
                                    {opt.linked_service_type}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{addonDesc}</p>
                              <div className="mt-3 space-y-0 border-t border-[var(--card-border)] pt-3 text-sm">
                                <div className="flex justify-between gap-3 border-b border-dotted border-[var(--card-border)] pb-2">
                                  <span className="text-[var(--text-muted)]">Extra duration</span>
                                  <span className="shrink-0 font-medium tabular-nums text-[var(--foreground)]">+{opt.extra_duration_min} min</span>
                                </div>
                                <div className="flex justify-between gap-3 pt-2">
                                  <span className="text-[var(--text-muted)]">Add-on price</span>
                                  <span className="shrink-0 font-medium tabular-nums text-[var(--foreground)]">+RM {Number(opt.extra_price).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
              <h2 className="font-[var(--font-heading)] text-lg font-semibold">Booking Summary</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Review duration, deposit, listed prices, and add-ons before choosing your stylist.
              </p>

              <div className="mt-5 space-y-5 border-t border-[var(--card-border)] pt-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Main service</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="font-[var(--font-heading)] text-base font-semibold">{service.name}</p>
                    <ServiceTierBadge serviceType={service.service_type} />
                  </div>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex flex-wrap justify-between gap-2 border-b border-[var(--card-border)] border-dotted pb-2">
                      <span className="text-[var(--text-muted)]">Base duration</span>
                      <span className="font-medium tabular-nums text-[var(--foreground)]">{baseDurationMin} min</span>
                    </li>
                 
                    <li className="flex flex-wrap justify-between gap-2">
                      <span className="text-[var(--text-muted)]">Listed service price</span>
                      <span className="font-medium tabular-nums text-[var(--foreground)]">
                        {isRangePrice
                          ? `RM ${listedPriceRangeMin.toFixed(2)} - ${listedPriceRangeMax.toFixed(2)}`
                          : `RM ${listedServicePrice.toFixed(2)}`}
                      </span>
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Add-ons</p>
                  {selectedAddonLines.length === 0 ? (
                    <p className="mt-2 text-sm italic text-[var(--text-muted)]">
                      No add-ons selected. Choose cards above if you want extra time and charges, or continue without add-ons when allowed.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {selectedAddonLines.map(({ questionId, questionTitle, option: opt }) => (
                        <li
                          key={`${questionId}-${opt.id}`}
                          className="rounded-xl border border-[var(--card-border)] bg-[var(--muted)]/30 px-4 py-3 text-sm"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{questionTitle}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="font-[var(--font-heading)] font-semibold">{opt.label}</p>
                            {opt.linked_service_type ? <ServiceTierBadge serviceType={opt.linked_service_type} /> : null}
                          </div>
                          <div className="mt-3 space-y-0 text-sm">
                            <div className="flex justify-between gap-3 border-b border-dotted border-[var(--card-border)] pb-2">
                              <span className="text-[var(--text-muted)]">Extra duration</span>
                              <span className="shrink-0 font-medium tabular-nums text-[var(--foreground)]">+{opt.extra_duration_min} min</span>
                            </div>
                            <div className="flex justify-between gap-3 pt-2">
                              <span className="text-[var(--text-muted)]">Add-on price</span>
                              <span className="shrink-0 font-medium tabular-nums text-[var(--foreground)]">+RM {Number(opt.extra_price).toFixed(2)}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* <div className="rounded-xl border border-[var(--card-border)] bg-[var(--muted)]/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Time &amp; menu total</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex flex-wrap justify-between gap-2">
                      <span className="text-[var(--text-muted)]">Extra time from add-ons</span>
                      <span className="font-medium tabular-nums">+{totalAddonDuration} min</span>
                    </li>
                    <li className="flex flex-wrap justify-between gap-2">
                      <span className="text-[var(--text-muted)]">Extra charges from add-ons</span>
                      <span className="font-medium tabular-nums">+RM {totalAddonPrice.toFixed(2)}</span>
                    </li>
                    <li className="flex flex-wrap justify-between gap-2 border-t border-[var(--card-border)] pt-2">
                      <span className="text-[var(--text-muted)]">Approx. total duration</span>
                      <span className="font-medium tabular-nums">{estimatedTotalMinutes} min</span>
                    </li>
                    <li className="flex flex-wrap justify-between gap-2 border-t border-[var(--card-border)] pt-2 font-medium">
                      <span className="text-[var(--text-muted)]">Appointment total (listed + add-ons)</span>
                      <span className="tabular-nums text-[var(--foreground)]">RM {estimatedTotalCost.toFixed(2)}</span>
                    </li>
                  </ul>
                </div> */}

                <div className="rounded-xl border-2 border-[var(--accent-strong)]/20 bg-[var(--card)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">How payment usually works</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    You’ll only pay a deposit now.
                  </p>
                  <ul className="mt-4 space-y-3 text-sm">
                    <li className="flex flex-wrap items-start justify-between gap-2 border-t border-b border-dotted border-[var(--card-border)] py-3">
                      <div>
                        <span className="font-medium text-[var(--foreground)]">Approx. total duration</span>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Listed service + selected add-ons</p>
                      </div>
                      <div className="text-right">
                        <span className="block font-semibold tabular-nums">{estimatedTotalMinutes} min</span>
                      </div>
                    </li>
                    <li className="flex flex-col gap-3 border-b border-[var(--card-border)] border-dotted pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="font-medium text-[var(--foreground)]">Deposit required</span>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Charged at checkout to secure this booking (same rules as cart)</p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">RM {depositPreview.depositTotal.toFixed(2)}</span>
                      </div>
                      {/* <div className="rounded-lg border border-[var(--card-border)] bg-[var(--muted)]/40 p-3 text-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Deposit breakdown</p>
                        <div className="mt-2 space-y-1 text-[13px]">
                          <p className="flex justify-between gap-2">
                            <span className="text-[var(--text-muted)]">Main service deposit</span>
                            <span className="font-semibold tabular-nums text-[var(--foreground)]">RM {depositPreview.mainDepositApplied.toFixed(2)}</span>
                          </p>
                          <p className="flex justify-between gap-2">
                            <span className="text-[var(--text-muted)]">Add-on deposit</span>
                            <span className="font-semibold tabular-nums text-[var(--foreground)]">RM {depositPreview.addonDepositApplied.toFixed(2)}</span>
                          </p>
                        </div>
                      </div> */}
                    </li>
                    {/* <li className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                      <span className="font-medium text-[var(--foreground)]">Remaining</span>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        Pay after your service at the salon
                      </p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {depositCoversFullMenu
                            ? "Deposit meets or exceeds this menu total—confirm at desk if anything is left to settle."
                            : "Estimated balance after your deposit is applied to this appointment total."}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="block text-lg font-semibold tabular-nums text-[var(--accent-strong)]">
                          RM {estimatedBalanceAtSalon.toFixed(2)}
                        </span>
                        <span className="mt-1 inline-block rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                          Est. balance
                        </span>
                      </div>
                    </li> */}
                  </ul>
                  {depositNote ? (
                    <p className="mt-4 border-t border-[var(--card-border)] pt-3 text-xs leading-relaxed text-[var(--text-muted)]">{depositNote}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 border-t border-[var(--card-border)] pt-6">
                <button
                  type="button"
                  onClick={goToStylist}
                  className="w-full rounded-full bg-[var(--accent-strong)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 sm:text-base"
                >
                  Choose date & time
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
