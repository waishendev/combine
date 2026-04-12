"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { getBookingServiceDetail } from "@/lib/apiClient";
import { Service } from "@/lib/types";

export default function ServiceAddonsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        const detail = await getBookingServiceDetail(id);
        setService(detail as Service);
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

  const totalAddonDuration = selectedOptions.reduce((sum, o) => sum + Number(o.extra_duration_min || 0), 0);
  const totalAddonPrice = selectedOptions.reduce((sum, o) => sum + Number(o.extra_price || 0), 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 pb-24">
      <BookingProgress step={3} />

      <div className="mt-6 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/booking" className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm">Back</Link>
          <button
            type="button"
            onClick={() => router.push(`/booking/service/${id}/slots?selected_option_ids=${selectedOptionIds.join(",")}`)}
            className="rounded-full bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white"
          >
            Continue to Date & Time
          </button>
        </div>

        {error ? <p className="text-[var(--status-error)]">{error}</p> : null}

        {!service ? (
          <p>Loading service...</p>
        ) : (
          <>
            <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <h1 className="text-2xl font-semibold">{service.name}</h1>
              <p className="mt-2 text-[var(--text-muted)]">{service.description || "Select add-ons for this service."}</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Duration {service.duration_minutes} min • Deposit RM {service.deposit_amount}
              </p>
            </section>

            <section className="space-y-4">
              {(service.questions ?? []).length === 0 ? (
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">
                  No add-ons available for this service.
                </div>
              ) : (
                (service.questions ?? []).map((q) => (
                  <div key={q.id} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
                    <p className="font-semibold">{q.title} {q.is_required ? "*" : ""}</p>
                    {q.description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{q.description}</p> : null}
                    <div className="mt-3 space-y-2">
                      {q.options.map((opt) => {
                        const checked = selectedOptionIds.includes(opt.id);
                        return (
                          <label key={opt.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] px-3 py-2 text-sm">
                            <span className="flex items-center gap-2">
                              <input
                                type={q.question_type === "single_choice" ? "radio" : "checkbox"}
                                name={`q-${q.id}`}
                                checked={checked}
                                onChange={() =>
                                  setSelectedOptionIds((prev) => {
                                    if (q.question_type === "single_choice") {
                                      const withoutQuestion = prev.filter((id) => !q.options.some((o) => o.id === id));
                                      return checked ? withoutQuestion : [...withoutQuestion, opt.id];
                                    }
                                    return checked ? prev.filter((id) => id !== opt.id) : [...prev, opt.id];
                                  })
                                }
                              />
                              {opt.label}
                            </span>
                            <span className="text-[var(--text-muted)]">+{opt.extra_duration_min} mins {opt.extra_price > 0 ? `• +RM${opt.extra_price}` : ""}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <h2 className="font-semibold">Selected add-ons summary</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">Extra duration: +{totalAddonDuration} mins</p>
              <p className="text-sm text-[var(--text-muted)]">Extra price: +RM{totalAddonPrice.toFixed(2)}</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
