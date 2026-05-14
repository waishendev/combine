"use client";

import Link from "next/link";
import Image from "next/image";
import { Service } from "@/lib/types";
import { SectionTitle } from "./SectionTitle";
import { useEffect, useState } from "react";
import type {
  LandingSections,
  LandingGalleryItem,
  LandingNailAcademyItem,
  LandingVisitStudio,
  LandingVisitStudioHoursRow,
} from "@/lib/types";
import Slider, { justBreathe } from "@/components/home/Slider";
import type { BookingHomepageSlider } from "@/lib/getBookingHomepageSliders";
import { HERO_DECOR_LAYERS } from "@/components/sections/heroDecorLayers";
import { HeroViewportRichText } from "@/components/sections/heroRichText";

type HeroProps = {
  hero: LandingSections["hero"];
  /** Sliders render first; headline + copy stay together below. */
  sliders?: BookingHomepageSlider[];
};

export function Hero({ hero, sliders }: HeroProps) {
  if (!hero.is_active) return null;

  const hasSliders = sliders && sliders.length > 0;
  const title2 = hero.title_2?.trim();
  const subtitle2 = hero.subtitle_2?.trim();
  const heroFont = justBreathe.className;
  const showDecors = hero.decorations_enabled !== false;

  const labelText = hero.label?.trim() ?? "";
  const primaryTitle = hero.title?.trim();
  const smallEyebrow = primaryTitle && labelText ? labelText : "";
  const useLabelAsHeadline = !primaryTitle && Boolean(labelText);
  const mainHeading =
    primaryTitle ||
    (useLabelAsHeadline ? labelText : "") ||
    (!primaryTitle && !labelText && title2 ? title2 : "");
  const subHeading = primaryTitle && title2 ? title2 : null;

  const titleHeadingClass = `${heroFont} max-w-[22rem] text-2xl font-semibold leading-snug tracking-tight text-[var(--hero-label)] sm:max-w-2xl sm:text-3xl md:text-[2rem] md:leading-tight`;

  return (
    <section className="w-full text-center">
      {hasSliders ? (
        <div className="w-full">
          <Slider items={sliders} />
        </div>
      ) : null}

      <div
        className={`relative isolate mx-auto w-full max-w-xl px-6 py-8 sm:max-w-2xl sm:px-8 ${
          hasSliders ? "mt-5 sm:mt-7" : "mt-2 sm:mt-4"
        }`}
      >
        {showDecors
          ? HERO_DECOR_LAYERS.map((layer, idx) => (
              <div
                key={`${layer.src}-${idx}`}
                className={`pointer-events-none absolute z-0 select-none ${layer.className}`}
                aria-hidden
              >
                <Image
                  src={layer.src}
                  alt=""
                  width={200}
                  height={200}
                  sizes="(max-width: 640px) 30vw, 170px"
                  className="h-auto w-full drop-shadow-[0_4px_12px_rgba(60,36,50,0.12)]"
                />
              </div>
            ))
          : null}

        <div className="relative z-10 flex flex-col items-center gap-2.5 sm:gap-3.5">
          {smallEyebrow ? (
            <p
              className={`${heroFont} text-[0.65rem] font-medium uppercase tracking-[0.28em] text-[var(--hero-label)]/90 sm:text-xs sm:tracking-[0.25em]`}
            >
              {smallEyebrow}
            </p>
          ) : null}

          {mainHeading ? <h1 className={titleHeadingClass}>{mainHeading}</h1> : null}

          {hero.subtitle?.trim() ? (
            <HeroViewportRichText
              raw={hero.subtitle.trim()}
              className={`${heroFont} max-w-[22rem] text-sm leading-relaxed text-[var(--hero-label)]  sm:max-w-xl sm:text-base md:text-lg`}
            />
          ) : null}

          {subHeading ? <h2 className={titleHeadingClass}>{subHeading}</h2> : null}

          {subtitle2 ? (
            <HeroViewportRichText
              raw={subtitle2}
              className={`${heroFont} max-w-[22rem] text-sm leading-relaxed text-[var(--hero-label)]  sm:max-w-xl sm:text-base md:text-lg`}
            />
          ) : null}

          <Link
            href={hero.cta_link || "/booking"}
            className={`${heroFont} mt-2 inline-flex max-w-[calc(100%-0.5rem)] items-center justify-center self-center rounded-full bg-[var(--hero-cta-bg)] px-5 py-2 text-sm font-semibold leading-snug tracking-tight text-[var(--hero-cta-text)] shadow-sm transition-colors hover:bg-[var(--hero-cta-bg-hover)] sm:mt-3 sm:max-w-none sm:px-8 sm:py-2.5 sm:text-base sm:tracking-wide md:px-10 md:py-3 md:text-lg`}
          >
            {hero.cta_label}
          </Link>
        </div>
      </div>
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

export function DynamicSections({ sections }: { sections: LandingSections }) {
  const galleryItems = sections.gallery?.items ?? [];
  const menuItems = sections.service_menu?.items ?? [];
  const artistItems = sections.our_artists?.items ?? [];

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxSource, setLightboxSource] = useState<"gallery" | "menu">("gallery");
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const openLightbox = (idx: number, source: "gallery" | "menu") => {
    setLightboxSource(source);
    setLightboxIndex(idx);
  };

  const activeLightboxImages: LandingGalleryItem[] =
    lightboxSource === "gallery" ? galleryItems : menuItems;

  const getTextAlignClass = (align: "left" | "center" | "right" | undefined) => {
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return "text-left";
  };

  const getItemsAlignClass = (align: "left" | "center" | "right" | undefined) => {
    if (align === "center") return "items-center";
    if (align === "right") return "items-end";
    return "items-start";
  };

  const renderSectionHeading = (
    heading: { label: string; title: string; align?: "left" | "center" | "right" },
    tone: "accent" | "muted" = "accent",
  ) => {
    const alignClass = getTextAlignClass(heading.align);
    const itemsAlignClass = getItemsAlignClass(heading.align);
    const dividerClass =
      tone === "accent"
        ? "bg-gradient-to-r from-transparent via-[var(--accent-strong)]/45 to-transparent"
        : "bg-gradient-to-r from-transparent via-[var(--muted)]/80 to-transparent";

    return (
      <div className={`flex flex-col gap-2 ${alignClass} ${itemsAlignClass}`}>
        <p
          className={`text-xs font-semibold uppercase tracking-[0.2em] ${
            tone === "accent" ? "text-[var(--accent-strong)]" : "text-[var(--accent)]"
          }`}
        >
          {heading.label}
        </p>
        <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">{heading.title}</h2>
        <div className={`h-px w-full ${dividerClass}`} />
      </div>
    );
  };

  const renderImageGrid = (
    items: LandingGalleryItem[],
    source: "gallery" | "menu",
    keyPrefix: string,
  ) => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((image, idx) => (
        <button
          key={`${keyPrefix}-${idx}`}
          type="button"
          onClick={() => openLightbox(idx, source)}
          className="group flex w-full cursor-zoom-in flex-col gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-3 text-left shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] transition hover:-translate-y-1 hover:shadow-[0_22px_50px_-32px_rgba(17,24,39,0.45)]"
          aria-label="Open image zoom"
        >
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--background-soft)]">
            <Image
              src={image.src || "/images/dummy.webp"}
              alt={image.caption || `Image ${idx + 1}`}
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
              sizes="(min-width: 1280px) 240px, (min-width: 768px) 220px, 50vw"
              priority={idx < 4}
            />
          </div>
          <p className="text-sm text-[var(--foreground)]/70 text-center">{image.caption}</p>
        </button>
      ))}
    </div>
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex]);

  const faqItems = sections.faqs?.items ?? [];
  const noteItems = sections.notes?.items ?? [];
  const visitStudio = sections.visit_studio;
  const visitHoursRows = normalizeVisitStudioHours(visitStudio?.opening_hours);
  const visitFooterLines = visitStudio ? getVisitStudioFooterLines(visitStudio) : [];
  const visitStudioHasContent =
    visitStudio &&
    (visitStudio.studio_name?.trim() ||
      visitStudio.address?.trim() ||
      visitHoursRows.length > 0 ||
      visitStudio.google_maps_url?.trim() ||
      visitStudio.waze_url?.trim() ||
      visitStudio.whatsapp_url?.trim() ||
      visitFooterLines.length > 0);
  const nailAcademy = sections.nail_academy;
  const nailItems: LandingNailAcademyItem[] = (nailAcademy?.items ?? []).map((raw) => ({
    src: raw.src ?? "",
    duration_badge: raw.duration_badge ?? "",
    title: raw.title ?? "",
    target_audience: raw.target_audience ?? "",
    curriculum: normalizeCurriculumLines(raw.curriculum),
    details_link: raw.details_link ?? "",
    details_label: raw.details_label ?? "CLICK FOR MORE DETAILS →",
    text_align: raw.text_align === "center" || raw.text_align === "right" ? raw.text_align : "left",
  }));

  return (
    <div className="space-y-12 py-10 pb-16">
      {/* Gallery Section */}
      {sections.gallery?.is_active && galleryItems.length > 0 && (
        <section className="space-y-6">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {sections.gallery.heading?.label ?? "GALLERY"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {sections.gallery.heading?.title ?? "Click to view services and pricing"}
            </h2>
          </div>
          {renderImageGrid(galleryItems, "gallery", "gallery")}
        </section>
      )}

      {/* Service Menu Section */}
      {sections.service_menu?.is_active && menuItems.length > 0 && (
        <section className="space-y-6">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {sections.service_menu.heading?.label ?? "Service Menu"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {sections.service_menu.heading?.title ?? "Click to view services and pricing"}
            </h2>
          </div>
          {renderImageGrid(menuItems, "menu", "menu")}
        </section>
      )}

      {sections.our_artists?.is_active && artistItems.length > 0 && (
        <section className="space-y-6">
          <div className={`mb-8 ${getTextAlignClass(sections.our_artists.heading?.align)}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {sections.our_artists.heading?.label ?? "Our Artists"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {sections.our_artists.heading?.title ?? "Meet our creative professionals"}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {artistItems.map((artist, idx) => (
              <div key={`artist-${idx}`} className="group flex flex-col gap-3">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--background-soft)]">
                  <Image src={artist.src || "/images/dummy.webp"} alt={artist.caption || `Artist ${idx + 1}`} fill className="object-cover" sizes="(min-width: 1280px) 240px, (min-width: 768px) 220px, 50vw" />
                </div>
                <p className={`text-xs text-[var(--foreground)]/60 ${getTextAlignClass(artist.text_align)}`}>{artist.caption}</p>
                {artist.link_url ? (
                  <Link href={artist.link_url} className={`text-sm font-medium text-[var(--accent-strong)] hover:underline ${getTextAlignClass(artist.text_align)}`}>
                    {artist.text || ""}
                  </Link>
                ) : (
                  <p className={`text-sm text-[var(--foreground)]/80 ${getTextAlignClass(artist.text_align)}`}>{artist.text || ""}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {nailAcademy?.is_active && nailItems.length > 0 && (
        <section className="space-y-8">
          <div className={`space-y-2 ${getTextAlignClass(nailAcademy.heading?.align)}`}>
            <h2 className="font-serif text-3xl font-normal tracking-tight text-[var(--foreground)] sm:text-4xl md:text-[2.75rem]">
              {nailAcademy.heading?.title ?? "Nail Academy"}
            </h2>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--text-muted)] sm:text-xs">
              {nailAcademy.heading?.label ?? "EXCELLENCE IN JAPANESE NAIL ART EDUCATION"}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {nailItems.map((course, idx) => (
              <article
                key={`nail-academy-${idx}`}
                className="flex flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-[0_16px_40px_-32px_rgba(17,24,39,0.45)]"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-[var(--background-soft)]">
                  <Image
                    src={course.src || "/images/dummy.webp"}
                    alt={course.title || `Course ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 33vw, 100vw"
                  />
                  {course.duration_badge ? (
                    <span className="absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-[11px] font-medium tracking-wide text-white">
                      {course.duration_badge}
                    </span>
                  ) : null}
                </div>

                <div className={`flex flex-1 flex-col gap-4 p-5 pt-6 ${getTextAlignClass(course.text_align)}`}>
                  <h3 className="font-serif text-xl font-semibold leading-snug text-[var(--foreground)]">{course.title}</h3>

                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      {nailAcademy.target_label ?? "面向对象"}
                    </p>
                    <p className="text-sm leading-relaxed text-[var(--foreground)]/85">{course.target_audience}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      {nailAcademy.curriculum_label ?? "教学核心"}
                    </p>
                    <ul className="space-y-2 text-sm leading-relaxed text-[var(--foreground)]/80">
                      {course.curriculum.map((line, lineIdx) => (
                        <li key={lineIdx} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto border-t border-[var(--card-border)] pt-4">
                    {course.details_link ? (
                      <Link
                        href={course.details_link}
                        className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--foreground)] underline-offset-4 hover:underline"
                      >
                        {course.details_label || "CLICK FOR MORE DETAILS →"}
                      </Link>
                    ) : (
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--foreground)]/50">
                        {course.details_label || "CLICK FOR MORE DETAILS →"}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && activeLightboxImages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl">
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black/80"
              aria-label="Close image preview"
            >
              <span aria-hidden>✕</span>
            </button>
            {activeLightboxImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      prev === null ? prev : (prev - 1 + activeLightboxImages.length) % activeLightboxImages.length,
                    )
                  }
                  className="absolute left-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md bg-black/65 text-white transition hover:bg-black/80"
                  aria-label="Previous image"
                >
                  <i className="fa-solid fa-chevron-left" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      prev === null ? prev : (prev + 1) % activeLightboxImages.length,
                    )
                  }
                  className="absolute right-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md bg-black/65 text-white transition hover:bg-black/80"
                  aria-label="Next image"
                >
                  <i className="fa-solid fa-chevron-right" aria-hidden />
                </button>
              </>
            )}

            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-2xl">
              {activeLightboxImages.map((image, index) => (
                <div
                  key={`lightbox-${index}`}
                  className={`absolute inset-0 transition-all duration-500 ease-out will-change-transform ${
                    index === lightboxIndex
                      ? "translate-x-0 opacity-100"
                      : "pointer-events-none translate-x-6 opacity-0"
                  }`}
                  aria-hidden={index !== lightboxIndex}
                >
                  <Image
                    src={image.src || "/images/dummy.webp"}
                    alt={image.caption || `Image ${index + 1}`}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority={index === lightboxIndex}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FAQ Section */}
      {sections.faqs?.is_active && faqItems.length > 0 && (
        <section className="space-y-6">
          {renderSectionHeading(sections.faqs.heading ?? { label: "FAQ", title: "You might be wondering", align: "left" }, "accent")}

          <div className="grid gap-4 sm:grid-cols-2 items-start">
            {faqItems.map((item, index) => {
              const faqId = `faq-${index}`;
              const isOpen = openFaqId === faqId;
              const hasBulletPoints = item.answer.includes("•") || item.answer.includes("-");
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
      )}

      {/* Policy / Notes */}
      {sections.notes?.is_active && noteItems.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_22px_70px_-40px_rgba(17,24,39,0.45)]">
          {renderSectionHeading(sections.notes.heading ?? { label: "Notes", title: "Policy & care", align: "left" }, "muted")}

          <ul className="grid gap-3 sm:grid-cols-2">
            {noteItems.map((note, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 rounded-xl bg-[var(--background-soft)]/70 p-4 text-sm text-[var(--foreground)]/80"
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/70 text-white">
                  •
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {visitStudio?.is_active && visitStudioHasContent && (
        <VisitStudioSection studio={visitStudio} hoursRows={visitHoursRows} footerLines={visitFooterLines} />
      )}
    </div>
  );
}

/** @deprecated Use DynamicSections instead. Kept for backward compatibility. */
export const StaticSections = DynamicSections;

function VisitStudioSection({
  studio,
  hoursRows,
  footerLines,
}: {
  studio: LandingVisitStudio;
  hoursRows: LandingVisitStudioHoursRow[];
  footerLines: string[];
}) {
  const contactCol =
    studio.column_order === "hours_left" ? "order-2 lg:order-2" : "order-1 lg:order-1";
  const hoursCol =
    studio.column_order === "hours_left" ? "order-1 lg:order-1" : "order-2 lg:order-2";

  const headingTitle = studio.heading?.title?.trim() || "Visit Our Studio";
  const openingTitle = studio.opening_hours_heading?.trim() || "Opening Hours";

  return (
    <section className="space-y-8 pt-4">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-stretch lg:gap-14">
        <div className={`flex flex-col gap-6 ${contactCol}`}>
          <div className="space-y-1">
            {studio.heading?.label ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">
                {studio.heading.label}
              </p>
            ) : null}
            <h2 className="font-serif text-3xl font-normal tracking-tight text-[var(--foreground)] sm:text-4xl">
              {headingTitle}
            </h2>
          </div>

          {studio.studio_name?.trim() ? (
            <div className="flex items-start gap-2">
              <span className="mt-1 text-red-500" aria-hidden>
                <i className="fa-solid fa-location-dot" />
              </span>
              <p className="font-serif text-lg font-semibold uppercase tracking-wide text-[var(--foreground)]">
                {studio.studio_name.trim()}
              </p>
            </div>
          ) : null}

          {studio.address?.trim() ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-muted)]">{studio.address.trim()}</p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            {studio.google_maps_url?.trim() ? (
              <Link
                href={studio.google_maps_url.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--foreground)] transition hover:bg-[var(--background-soft)]"
              >
                <i className="fa-solid fa-paper-plane text-xs opacity-80" aria-hidden />
                {studio.google_maps_label?.trim() || "GOOGLE MAPS"}
              </Link>
            ) : null}
            {studio.waze_url?.trim() ? (
              <Link
                href={studio.waze_url.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--foreground)] transition hover:bg-[var(--background-soft)]"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-xs opacity-80" aria-hidden />
                {studio.waze_label?.trim() || "OPEN WAZE"}
              </Link>
            ) : null}
          </div>

          {studio.whatsapp_url?.trim() ? (
            <Link
              href={studio.whatsapp_url.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--foreground)] px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:opacity-90"
            >
              <i className="fa-brands fa-whatsapp mr-2 text-base" aria-hidden />
              {studio.whatsapp_label?.trim() || "MESSAGE US ON WHATSAPP"}
            </Link>
          ) : null}
        </div>

        <div className={`flex ${hoursCol}`}>
          <div className="flex w-full flex-col rounded-2xl border border-[var(--card-border)] bg-[#f5f0e8] p-6 shadow-sm dark:bg-[var(--card)]/90">
            <h3 className="font-serif text-xl font-medium text-[var(--foreground)]">{openingTitle}</h3>
            {hoursRows.length > 0 ? (
              <div className="mt-5 divide-y divide-[var(--card-border)]/80">
                {hoursRows.map((row, idx) => (
                  <div key={idx} className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0">
                    <span className="text-sm text-[var(--foreground)]/85">{row.day_range}</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">{row.time_range}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {footerLines.length > 0 ? (
              <div className="mt-auto space-y-2 pt-8 text-[10px] font-medium uppercase leading-relaxed tracking-[0.12em] text-[var(--text-muted)]">
                {footerLines.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Footer under opening hours: `bottom_label` lines, or legacy API fields until content is re-saved. */
function getVisitStudioFooterLines(studio: LandingVisitStudio): string[] {
  const text = studio.bottom_label?.trim();
  if (text) {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }
  const ext = studio as LandingVisitStudio & {
    operated_by?: string;
    registration_number?: string;
    copyright_year?: string;
    copyright_brand?: string;
  };
  const ob = String(ext.operated_by ?? "").trim();
  const reg = String(ext.registration_number ?? "").trim();
  const cy = String(ext.copyright_year ?? "").trim();
  const cb = String(ext.copyright_brand ?? "").trim();
  const lines: string[] = [];
  if (ob || reg) {
    let l = "Operated by";
    if (ob) l += ` ${ob}`;
    if (reg) l += ` (${reg})`;
    lines.push(l);
  }
  if (cy || cb) {
    const y = cy || String(new Date().getFullYear());
    lines.push(`© ${y}${cb ? ` ${cb}` : ""}`.trim());
  }
  return lines;
}

function normalizeVisitStudioHours(raw: unknown): LandingVisitStudioHoursRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = row as Record<string, unknown>;
      const day = String(r.day_range ?? "").trim();
      const time = String(r.time_range ?? "").trim();
      if (!day && !time) return null;
      return { day_range: day, time_range: time };
    })
    .filter((x): x is LandingVisitStudioHoursRow => x !== null);
}

function normalizeCurriculumLines(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter((x) => x.length > 0);
  }
  if (typeof raw === "string") {
    return raw
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}
