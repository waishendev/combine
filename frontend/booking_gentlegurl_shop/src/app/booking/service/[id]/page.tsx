"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { getBookingServiceDetail, getMe, getServicePackageAvailableFor } from "@/lib/apiClient";
import { Service, Staff } from "@/lib/types";

type ServiceDetail = Service & { staffs?: Staff[] };

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [packageHint, setPackageHint] = useState<string | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        const detail = await getBookingServiceDetail(id);
        setService(detail as ServiceDetail);

        try {
          const me = await getMe();
          const meAny = me as unknown as { id?: number; profile?: { id?: number } }
          const meId = meAny.id ?? meAny.profile?.id;
          if (!meId) {
            setPackageHint(null);
            return;
          }

          const available = await getServicePackageAvailableFor(meId, Number(id));
          const totalRemaining = available.reduce((sum, row) => sum + Number(row.remaining_qty || 0), 0);
          if (totalRemaining > 0) {
            setPackageHint(`You have ${totalRemaining} package session(s) remaining for this service.`);
          }
        } catch {
          setPackageHint(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load service");
      }
    };

    run();
  }, [id]);

  const staffs = service?.staffs ?? [];
  const questions = service?.questions ?? [];
  const totalAddonDuration = questions.flatMap((q) => q.options).filter((o) => selectedOptionIds.includes(o.id)).reduce((sum, o) => sum + Number(o.extra_duration_min || 0), 0);
  const totalAddonPrice = questions.flatMap((q) => q.options).filter((o) => selectedOptionIds.includes(o.id)).reduce((sum, o) => sum + Number(o.extra_price || 0), 0);

  const getInitials = (name?: string) => {
    const safe = (name || '').trim()
    if (!safe) return '?'
    const parts = safe.split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? '?'
    const second = (parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1]) ?? ''
    return (first + second).toUpperCase()
  }

  const getAvatarBg = (name?: string) => {
    const initials = getInitials(name)
    const seed = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)
    const options = [
      'bg-rose-200 text-rose-800',
      'bg-indigo-200 text-indigo-800',
      'bg-amber-200 text-amber-800',
      'bg-emerald-200 text-emerald-800',
      'bg-sky-200 text-sky-800',
      'bg-fuchsia-200 text-fuchsia-800',
      'bg-lime-200 text-lime-800',
      'bg-cyan-200 text-cyan-800',
    ]
    return options[seed % options.length]
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 pb-24">
      <div className="space-y-6">
        <BookingProgress step={3} />

        <div>
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-5 py-2.5 text-sm font-medium shadow-sm transition-all hover:border-[var(--accent)] hover:shadow"
          >
            <i className="fa-solid fa-arrow-left text-xs" />
            Back to services
          </Link>
        </div>

        {error ? <p className="text-[var(--status-error)]">{error}</p> : null}

        {packageHint ? (
          <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[var(--status-success)]">
            {packageHint}
          </div>
        ) : null}

        {!service ? (
          <p>Loading service...</p>
        ) : (
          <section className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold">{service.name}</h1>
              <p className="text-[var(--text-muted)]">{service.description || "Select your preferred stylist to continue."}</p>
              <p className="text-sm text-[var(--text-muted)]">
                Duration {service.duration_minutes + totalAddonDuration} min • Deposit RM {service.deposit_amount}
              </p>
            </div>
            {questions.length > 0 ? (
              <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 space-y-4">
                <h2 className="text-lg font-semibold">Questions / Add-ons</h2>
                {questions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <p className="font-medium">{q.title} {q.is_required ? "*" : ""}</p>
                    {q.options.map((opt) => {
                      const checked = selectedOptionIds.includes(opt.id);
                      return (
                        <label key={opt.id} className="flex items-center justify-between text-sm gap-3">
                          <span className="flex items-center gap-2">
                            <input
                              type={q.question_type === "single_choice" ? "radio" : "checkbox"}
                              name={`q-${q.id}`}
                              checked={checked}
                              onChange={() => setSelectedOptionIds((prev) => {
                                if (q.question_type === "single_choice") {
                                  const withoutQuestion = prev.filter((id) => !q.options.some((o) => o.id === id));
                                  return checked ? withoutQuestion : [...withoutQuestion, opt.id];
                                }
                                return checked ? prev.filter((id) => id !== opt.id) : [...prev, opt.id];
                              })}
                            />
                            {opt.label}
                          </span>
                          <span className="text-[var(--text-muted)]">+{opt.extra_duration_min} mins {opt.extra_price > 0 ? `• +RM${opt.extra_price}` : ""}</span>
                        </label>
                      );
                    })}
                  </div>
                ))}
                <p className="text-sm text-[var(--text-muted)]">Add-ons: +{totalAddonDuration} mins • +RM{totalAddonPrice.toFixed(2)}</p>
              </div>
            ) : null}

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Choose a stylist</h2>

              {staffs.length === 0 ? (
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">
                  This service is temporarily unavailable because no eligible staff is assigned.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {staffs.map((staff) => (
                    <Link
                      key={staff.id}
                      href={`/booking/service/${id}/slots?staff_id=${staff.id}&selected_option_ids=${selectedOptionIds.join(",")}`}
                      className="group rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center shadow-sm transition hover:border-[var(--accent-strong)] hover:shadow"
                    >
                      <div className="flex flex-col items-center gap-3">
                        {(staff.avatar_url || staff.avatar_path || staff.avatar) ? (
                          <img
                            src={(staff.avatar_url || staff.avatar_path || staff.avatar) as string}
                            alt={staff.name}
                            className="h-16 w-16 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className={`flex h-16 w-16 items-center justify-center rounded-full ${getAvatarBg(staff.name)}`}
                            aria-hidden="true"
                          >
                            <span className="text-sm font-semibold">{getInitials(staff.name)}</span>
                          </div>
                        )}

                        <div className="w-full">
                          <p className="font-semibold text-[var(--foreground)]">{staff.name}</p>
                          <p className="text-sm text-[var(--text-muted)]">{staff.position || 'Staff'}</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">{staff.description || 'Available stylist'}</p>
                        </div>
                      </div>
                      <span className="mt-5 inline-flex rounded-full bg-[var(--accent-strong)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-stronger)] transition-colors group-hover:translate-y-[-1px]">
                        Select
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
