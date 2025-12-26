"use client";

import Image from "next/image";
import { useRef } from "react";

type ServiceItem = {
  title: string;
  description: string;
};

type PricingItem = {
  label: string;
  price: string;
};

type FAQItem = {
  question: string;
  answer: string;
};

type ServicesPageLayoutProps = {
  title: string;
  subtitle: string;
  services: ServiceItem[];
  pricing: PricingItem[];
  faqs: FAQItem[];
  notes: string[];
  heroImage?: string;
};

export function ServicesPageLayout({ title, subtitle, services, pricing, faqs, notes, heroImage }: ServicesPageLayoutProps) {
  const pricingRef = useRef<HTMLDivElement | null>(null);

  const handleBook = () => {
    console.log("book");
    pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="bg-gradient-to-b from-transparent via-white/60 to-transparent pb-16">
      <div className="mx-auto max-w-6xl space-y-12 px-4 pt-10 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_22px_70px_-40px_rgba(17,24,39,0.45)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(231,162,186,0.18),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(247,223,233,0.35),transparent_30%)]" />
          <div className="relative grid gap-10 p-8 sm:p-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--background-soft)] px-3 py-1 text-xs font-semibold tracking-[0.2em] text-[var(--accent-strong)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent-strong)]" />
                GENTLE CARE
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] sm:text-4xl">{title}</h1>
                <p className="text-base leading-relaxed text-[var(--foreground)]/80 sm:text-lg">{subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleBook}
                  className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white shadow-md transition hover:bg-[var(--accent-strong)]"
                >
                  Book an Appointment
                </button>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="relative h-64 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--muted)] bg-[var(--background-soft)] shadow-[0_16px_40px_-28px_rgba(17,24,39,0.6)]">
                <Image
                  src={heroImage || "/images/slideshow_placeholder.jpg"}
                  alt={`${title} hero visual`}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 420px, (min-width: 640px) 520px, 100vw"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Services</p>
              <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">What&apos;s Included</h2>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--muted)]/80 to-transparent sm:ml-6" />
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((item) => (
              <div
                key={item.title}
                className="h-full rounded-2xl border border-[var(--muted)] bg-white/80 p-5 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] transition hover:-translate-y-1 hover:shadow-[0_22px_50px_-32px_rgba(17,24,39,0.45)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{item.title}</h3>
                  <span className="rounded-full bg-[var(--background-soft)] px-3 py-1 text-xs font-medium text-[var(--foreground)]/70">Included</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]/70">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="space-y-6" ref={pricingRef}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Pricing</p>
              <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">Transparent rates</h2>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--accent-strong)]/35 to-transparent sm:ml-6" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--muted)] bg-white/80 shadow-[0_22px_70px_-40px_rgba(17,24,39,0.45)]">
            <div className="divide-y divide-[var(--muted)]">
              {pricing.map((item) => (
                <div key={item.label} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-[var(--foreground)]">{item.label}</p>
                    <p className="text-sm text-[var(--foreground)]/70">Beautiful results, no hidden fees.</p>
                  </div>
                  <p className="rounded-full bg-[var(--background-soft)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                    {item.price}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">FAQ</p>
              <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">You might be wondering</h2>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--accent-strong)]/45 to-transparent sm:ml-6" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {faqs.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-[var(--muted)] bg-white/80 p-5 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] transition hover:-translate-y-1"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--foreground)]">
                  {item.question}
                  <span className="rounded-full bg-[var(--background-soft)] px-3 py-1 text-xs text-[var(--foreground)]/70 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]/70">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Policy / Notes */}
        <section className="space-y-4 rounded-2xl border border-[var(--muted)] bg-white/80 p-6 shadow-[0_22px_70px_-40px_rgba(17,24,39,0.45)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Notes</p>
              <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">Policy &amp; care</h2>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--muted)]/70 to-transparent sm:ml-6" />
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {notes.map((note) => (
              <li key={note} className="flex items-center gap-3 rounded-xl bg-[var(--background-soft)]/70 p-4 text-sm text-[var(--foreground)]/80">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)]/70 text-white">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
