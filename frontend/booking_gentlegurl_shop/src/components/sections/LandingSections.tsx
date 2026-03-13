import Link from "next/link";
import { Service } from "@/lib/types";

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[78vh] w-full max-w-7xl flex-col items-center justify-center overflow-hidden px-4 pt-28 pb-16 text-center md:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(196,149,106,0.12),transparent_62%)]" />
      <p className="relative text-xs font-medium uppercase tracking-[0.35em] text-amber-700">Gentlegurl Salon Experience</p>
      <h1 className="relative mt-6 max-w-4xl text-5xl font-normal leading-[1.06] text-neutral-900 md:text-7xl">
        Timeless Beauty, <span className="italic text-amber-700">Thoughtfully Booked</span>
      </h1>
      <p className="relative mx-auto mt-6 max-w-2xl text-sm leading-7 text-neutral-600 md:text-base">
        Discover signature hair and spa rituals, choose your preferred stylist, and reserve your ideal time slot in minutes.
      </p>
      <div className="relative mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/booking"
          className="rounded-full bg-neutral-900 px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-amber-700"
        >
          Reserve Now
        </Link>
        <Link
          href="#services"
          className="rounded-full border border-neutral-900 px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
        >
          View Services
        </Link>
      </div>
    </section>
  );
}

export function ServicesPreview({ services }: { services: Service[] }) {
  return (
    <section id="services" className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8">
      <p className="text-center text-xs font-medium uppercase tracking-[0.35em] text-amber-700">Our Services</p>
      <h2 className="mt-4 text-center text-4xl font-normal text-neutral-900 md:text-5xl">Choose Your Ritual</h2>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.slice(0, 6).map((service, index) => (
          <article
            key={service.id}
            className="rounded-3xl border border-[#e8dfd4] bg-[#fdfbf8] p-6 shadow-[0_8px_24px_rgba(44,40,37,0.06)] transition hover:-translate-y-0.5"
          >
            <p className="text-4xl font-light text-[#d4c8b8]">{(index + 1).toString().padStart(2, "0")}</p>
            <h3 className="mt-3 text-2xl font-medium text-neutral-900">{service.name}</h3>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-neutral-500">{service.duration_minutes} min</p>
            <p className="mt-4 line-clamp-2 text-sm text-neutral-600">
              {service.description || "A curated treatment tailored to your look and comfort."}
            </p>
            <div className="mt-6 flex items-center justify-between border-t border-[#e8dfd4] pt-4">
              <div>
                <p className="text-sm text-neutral-500">Deposit RM {service.deposit_amount}</p>
                <p className="text-2xl font-medium text-amber-700">RM {service.price}</p>
              </div>
              <Link
                href="/booking"
                className="rounded-full bg-neutral-900 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-amber-700"
              >
                Book
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function StaticSections() {
  return (
    <>
      <section className="border-y border-[#e8dfd4] bg-[#fdfbf8] py-16">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 md:grid-cols-3 md:px-8">
          {[
            ["Elegant Ambience", "Relax in a warm, calm atmosphere curated for comfort."],
            ["Professional Team", "Skilled stylists focused on precision and consistency."],
            ["Seamless Booking", "Pick service, staff, and time instantly with clear pricing."],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-3xl border border-[#e8dfd4] bg-white p-6">
              <p className="text-lg font-medium text-neutral-900">{title}</p>
              <p className="mt-3 text-sm leading-7 text-neutral-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 text-center md:px-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Ready to Glow?</p>
        <h2 className="mt-4 text-4xl font-normal text-neutral-900 md:text-5xl">Reserve Your Appointment Today</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-neutral-600 md:text-base">
          Complete your booking in just a few steps with real-time availability.
        </p>
        <Link
          href="/booking"
          className="mt-8 inline-flex rounded-full bg-neutral-900 px-8 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-amber-700"
        >
          Start Booking
        </Link>
      </section>
    </>
  );
}
