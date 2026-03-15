import Link from "next/link";
import { Service } from "@/lib/types";
import { SectionTitle } from "./SectionTitle";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 text-center">
      <p className="text-sm uppercase tracking-[0.25em] text-[var(--text-muted)]">Premium Salon Booking</p>
      <h1 className="mt-4 text-5xl font-semibold tracking-tight text-[var(--foreground)]">Beauty appointments, made effortless.</h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-muted)]">Discover signature services, reserve your slot instantly, and arrive confident with our trusted professional team.</p>
      <Link href="/booking" className="mt-8 inline-flex rounded-full bg-[var(--accent-strong)] px-8 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-stronger)] transition-colors">Book Appointment</Link>
    </section>
  );
}

export function ServicesPreview({ services }: { services: Service[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <SectionTitle title="Popular services" subtitle="Transparent pricing, clear durations, and deposit requirements before you confirm." />
      <div className="grid gap-4 md:grid-cols-3">
        {services.slice(0, 6).map((service) => (
          <div key={service.id} className="rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
            <h3 className="text-lg font-semibold">{service.name}</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{service.duration_minutes} min</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Deposit RM {service.deposit_amount}</p>
            <p className="mt-3 text-xl font-semibold">RM {service.price}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StaticSections() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionTitle title="Gallery" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="aspect-square rounded-2xl bg-[var(--muted)]" />
          ))}
        </div>
      </section>

      <section className="bg-[var(--background-soft)] py-16">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Trusted by clients" />
          <div className="grid gap-4 md:grid-cols-3">
            {["Consistently perfect every visit.", "Booking is smooth and reliable.", "Loved the ambience and team."].map((quote) => (
              <div key={quote} className="rounded-3xl bg-[var(--card)] p-6 shadow-sm">
                <p className="text-[var(--foreground)]">"{quote}"</p>
                <p className="mt-4 text-sm font-semibold">Verified Customer</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionTitle title="FAQ" />
        <div className="space-y-3">
          {[
            ["How long is the slot held?", "15 minutes after hold confirmation before payment."],
            ["Can I reschedule?", "Yes, subject to availability and policy."],
            ["Do you accept walk-ins?", "Limited walk-ins available; booking is recommended."],
          ].map(([q, a]) => (
            <details key={q} className="rounded-2xl border border-[var(--card-border)] p-4">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
