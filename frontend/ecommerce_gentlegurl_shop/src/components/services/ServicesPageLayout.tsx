"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

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
  heroSlides?: { src: string; alt: string }[];
  galleryImages?: { src: string; alt: string; caption?: string }[];
  whatsappPhone?: string | null;
  whatsappEnabled?: boolean;
  whatsappDefaultMessage?: string | null;
};

export function ServicesPageLayout({
  title,
  subtitle,
  services,
  pricing,
  faqs,
  notes,
  heroImage,
  heroSlides,
  galleryImages,
  whatsappPhone,
  whatsappEnabled = true,
  whatsappDefaultMessage,
}: ServicesPageLayoutProps) {
  const pricingRef = useRef<HTMLDivElement | null>(null);
  const slideContainerRef = useRef<HTMLDivElement | null>(null);
  const slides =
    heroSlides && heroSlides.length > 0
      ? heroSlides
      : [
          {
            src: heroImage || "/images/slideshow_placeholder.jpg",
            alt: `${title} hero visual`,
          },
        ];
  const [activeSlide, setActiveSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  useEffect(() => {
    setActiveSlide(0);
  }, [title, slides.length]);

  const getWhatsAppUrl = () => {
    if (!whatsappEnabled || !whatsappPhone) return "#";
    const sanitizedPhone = whatsappPhone.replace(/[^\d]/g, "");
    const message = whatsappDefaultMessage ?? `Hi! I would like to book an appointment for ${title}.`;
    return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`;
  };

  const showBookButton = whatsappEnabled && whatsappPhone;

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }
    if (isRightSwipe) {
      setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setDragStart(e.clientX);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragStart !== null) {
      e.preventDefault();
      setIsDragging(true);
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (dragStart === null) return;
    const distance = dragStart - e.clientX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }
    if (isRightSwipe) {
      setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }

    setDragStart(null);
    setIsDragging(false);
  };

  return (
    <main className="bg-gradient-to-b from-transparent via-white/60 to-transparent pb-16">
      <div className="mx-auto max-w-6xl space-y-12 px-4 pt-10 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card)]/80 shadow-[0_22px_70px_-40px_rgba(17,24,39,0.45)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(231,162,186,0.18),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(247,223,233,0.35),transparent_30%)]" />
          <div className="relative grid gap-10 p-8 sm:p-10 lg:grid-cols-2 lg:items-center">
            <div className="order-2 space-y-6 lg:order-1">
          
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] sm:text-4xl">{title}</h1>
                <p className="text-base leading-relaxed text-[var(--foreground)]/80 sm:text-lg">{subtitle}</p>
              </div>
              {showBookButton && (
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={getWhatsAppUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white shadow-md transition hover:bg-[var(--accent-strong)]"
                  >
                    Book an Appointment
                  </a>
                </div>
              )}
            </div>

            <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
              <div
                ref={slideContainerRef}
                className="relative h-70 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--background-soft)] shadow-[0_16px_40px_-28px_rgba(17,24,39,0.6)] cursor-grab active:cursor-grabbing"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              >
                {slides.map((slide, index) => (
                  <div
                    key={`${slide.src}-${slide.alt}`}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      index === activeSlide ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <Image
                      src={slide.src}
                      alt={slide.alt}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 420px, (min-width: 640px) 520px, 100vw"
                      priority={index === activeSlide}
                      draggable={false}
                    />
                  </div>
                ))}
                {slides.length > 1 && (
                  <div className="absolute inset-x-0 bottom-3 flex items-center justify-center">
                    <div className="flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-sm">
                      {slides.map((slide, index) => (
                        <button
                          key={`${slide.src}-dot`}
                          type="button"
                          onClick={() => setActiveSlide(index)}
                          className={`h-2 w-2 rounded-full transition ${
                            index === activeSlide ? "bg-white" : "bg-white/50"
                          }`}
                          aria-label={`Go to slide ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
{/* 
        {galleryImages && galleryImages.length > 0 && (
          <section className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Price List</p>
                <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">Photo menu</h2>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--muted)]/80 to-transparent sm:ml-6" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {galleryImages.map((image) => (
                <div
                  key={image.alt}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-4 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)]"
                >
                  <div className="relative h-80 w-full overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--background-soft)]">
                    <Image src={image.src} alt={image.alt} fill className="object-cover" sizes="(min-width: 1024px) 320px, 100vw" />
                  </div>
                  {image.caption && <p className="mt-3 text-sm text-[var(--foreground)]/70">{image.caption}</p>}
                </div>
              ))}
            </div>
          </section>
        )} */}

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
                className="h-full rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-5 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] transition hover:-translate-y-1 hover:shadow-[0_22px_50px_-32px_rgba(17,24,39,0.45)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{item.title}</h3>
                  <span className="rounded-full bg-[var(--badge-background)] px-3 py-1 text-xs font-medium text-[var(--foreground)]/70">Included</span>
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

          <div className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 shadow-[0_22px_70px_-40px_rgba(17,24,39,0.45)]">
            <div className="divide-y divide-[var(--muted)] max-h-[500px] overflow-y-auto">
              {pricing.map((item) => (
                <div key={item.label} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-[var(--foreground)]">{item.label}</p>
                    <p className="text-sm text-[var(--foreground)]/70">Beautiful results, no hidden fees.</p>
                  </div>
                  <p className="w-fit rounded-full bg-[var(--badge-background)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
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

          <div className="grid gap-4 sm:grid-cols-2 items-start">
            {faqs.map((item, index) => {
              const faqId = `faq-${index}`;
              const isOpen = openFaqId === faqId;
              // Check if answer contains bullet points (• or -)
              const hasBulletPoints = item.answer.includes("•") || item.answer.includes("-");
              // Split answer into lines if it contains bullet points
              // Split by • first, then by newlines, then filter empty strings
              const answerLines = hasBulletPoints
                ? item.answer
                    .split(/•/)
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0)
                : item.answer.includes("\n")
                  ? item.answer
                      .split("\n")
                      .map((line) => line.trim())
                      .filter((line) => line.length > 0)
                  : [item.answer];

              return (
                <div
                  key={faqId}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-5 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] transition hover:-translate-y-1"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? null : faqId)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 text-left text-sm font-semibold text-[var(--foreground)]"
                  >
                    <span>{item.question}</span>
                    <span
                      className={`rounded-full bg-[var(--badge-background)] px-3 py-1 text-xs text-[var(--foreground)]/70 transition ${
                        isOpen ? "rotate-45" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div className="mt-3 text-sm leading-relaxed text-[var(--foreground)]/70">
                      {hasBulletPoints && answerLines.length > 1 ? (
                        <ul className="space-y-2">
                          {answerLines.map((line, lineIndex) => (
                            <li key={lineIndex} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]/70" />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>{item.answer}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Policy / Notes */}
        <section className="space-y-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_22px_70px_-40px_rgba(17,24,39,0.45)]">
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
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/70 text-white">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
