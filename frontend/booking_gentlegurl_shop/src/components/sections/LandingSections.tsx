"use client";

import Link from "next/link";
import Image from "next/image";
import { Service } from "@/lib/types";
import { SectionTitle } from "./SectionTitle";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type {
  LandingSections,
  LandingGalleryItem,
  LandingNailAcademyItem,
  LandingVisitStudio,
  LandingVisitStudioHoursRow,
  LandingVisitStudioLocation,
} from "@/lib/types";
import Slider, { justBreathe } from "@/components/home/Slider";
import type { BookingHomepageSlider } from "@/lib/getBookingHomepageSliders";
import { HERO_DECOR_LAYERS } from "@/components/sections/heroDecorLayers";
import { HeroViewportRichText } from "@/components/sections/heroRichText";
import {
  buildWhatsAppUrl,
  resolveVisitStudioWhatsAppMessage,
  resolveVisitStudioWhatsAppPhone,
} from "@/lib/whatsapp";
import { resolveOurArtistsSections, resolveServiceMenuSections } from "@/lib/landingSectionBlocks";

function asDisplayText(value: unknown): string {
  if (value == null) return "";
  const text = String(value).trim();
  if (text.toLowerCase() === "null") return "";
  return text;
}

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
            className={`${heroFont} mt-3 inline-flex min-h-[44px] items-center justify-center self-center rounded-full bg-[var(--hero-cta-bg)] px-7 py-2.5 text-xl font-semibold leading-tight tracking-tight text-[var(--hero-cta-text)] shadow-sm transition-colors hover:bg-[var(--hero-cta-bg-hover)] active:scale-[0.98] sm:mt-3 sm:min-h-0 sm:px-8 sm:py-2.5 sm:text-base sm:tracking-wide md:px-10 md:py-3 md:text-lg`}
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
  const serviceMenuSections = resolveServiceMenuSections(sections);
  const artistSections = resolveOurArtistsSections(sections);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxImages, setLightboxImages] = useState<LandingGalleryItem[] | null>(null);
  const [loadedLightboxSrcs, setLoadedLightboxSrcs] = useState<Set<string>>(() => new Set());
  const [lightboxImageError, setLightboxImageError] = useState(false);
  const [isLightboxMounted, setIsLightboxMounted] = useState(false);

  const activeLightboxSrc =
    lightboxIndex !== null ? lightboxImages?.[lightboxIndex]?.src || "/images/dummy.webp" : null;
  const isLightboxImageLoading = Boolean(
    activeLightboxSrc && !loadedLightboxSrcs.has(activeLightboxSrc) && !lightboxImageError,
  );

  const openLightbox = (idx: number, images: LandingGalleryItem[]) => {
    setLightboxImages(images);
    setLightboxIndex(idx);
    setLightboxImageError(false);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setLightboxImages(null);
    setLightboxImageError(false);
  };

  const goToLightboxIndex = (nextIndex: number) => {
    setLightboxIndex(nextIndex);
    setLightboxImageError(false);
  };

  const markLightboxImageLoaded = (src: string) => {
    setLoadedLightboxSrcs((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
    setLightboxImageError(false);
  };

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
    keyPrefix: string,
  ) => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((image, idx) => (
        <button
          key={`${keyPrefix}-${idx}`}
          type="button"
          onClick={() => openLightbox(idx, items)}
          className="group flex w-full cursor-zoom-in flex-col gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-3 text-left shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] transition hover:-translate-y-1 hover:shadow-[0_22px_50px_-32px_rgba(17,24,39,0.45)]"
          aria-label="Open image zoom"
        >
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--background-soft)]">
            <Image
              src={image.src || "/images/dummy.webp"}
              alt={asDisplayText(image.caption) || ""}
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
              sizes="(min-width: 1280px) 240px, (min-width: 768px) 220px, 50vw"
              priority={idx < 4}
            />
          </div>
          {asDisplayText(image.caption) ? (
            <p className="text-sm text-[var(--foreground)]/70 text-center">{asDisplayText(image.caption)}</p>
          ) : null}
        </button>
      ))}
    </div>
  );

  useEffect(() => {
    setIsLightboxMounted(true);
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxIndex]);

  const faqItems = sections.faqs?.items ?? [];
  const noteItems = sections.notes?.items ?? [];
  const visitStudio = sections.visit_studio;
  const visitStudioLocations = resolveVisitStudioLocations(visitStudio);
  const visitStudioHasContent =
    Boolean(visitStudio?.is_active) &&
    visitStudioLocations.some((location) => visitStudioLocationHasContent(location));
  const nailAcademy = sections.nail_academy;
  const nailItems: LandingNailAcademyItem[] = (nailAcademy?.items ?? []).map((raw) => ({
    src: asDisplayText(raw.src),
    duration_badge: asDisplayText(raw.duration_badge),
    title: asDisplayText(raw.title),
    target_audience: asDisplayText(raw.target_audience),
    curriculum: normalizeCurriculumLines(raw.curriculum),
    details_link: asDisplayText(raw.details_link),
    details_label: asDisplayText(raw.details_label) || "CLICK FOR MORE DETAILS →",
    text_align: raw.text_align === "center" || raw.text_align === "right" ? raw.text_align : "left",
  }));
  const nailLightboxItems: LandingGalleryItem[] = nailItems.map((course) => ({
    src: course.src,
    caption: course.title,
  }));

  const isLightboxOpen = lightboxIndex !== null && (lightboxImages?.length ?? 0) > 0;
  const lightboxPortal =
    isLightboxMounted && isLightboxOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] w-full items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={closeLightbox}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
          >
            <div
              className="relative z-[105] w-full max-w-5xl"
              onClick={(event) => event.stopPropagation()}
            >
              {(lightboxImages?.length ?? 0) > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      goToLightboxIndex(
                        lightboxIndex === null || !lightboxImages
                          ? 0
                          : (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length,
                      )
                    }
                    className="absolute left-2 top-1/2 z-30 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md bg-black/65 text-white transition hover:bg-black/80 sm:left-3"
                    aria-label="Previous image"
                  >
                    <i className="fa-solid fa-chevron-left" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      goToLightboxIndex(
                        lightboxIndex === null || !lightboxImages
                          ? 0
                          : (lightboxIndex + 1) % lightboxImages.length,
                      )
                    }
                    className="absolute right-2 top-1/2 z-30 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md bg-black/65 text-white transition hover:bg-black/80 sm:right-3"
                    aria-label="Next image"
                  >
                    <i className="fa-solid fa-chevron-right" aria-hidden />
                  </button>
                </>
              ) : null}

              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-2xl">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeLightbox();
                  }}
                  className="absolute right-3 top-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black/80"
                  aria-label="Close image preview"
                >
                  <span aria-hidden>✕</span>
                </button>
                {isLightboxImageLoading ? (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3">
                    <div
                      className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/25 border-t-white"
                      aria-hidden
                    />
                    <p className="text-sm font-medium text-white/85">Loading image...</p>
                  </div>
                ) : null}
                {lightboxImageError ? (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 px-6 text-center">
                    <p className="text-sm font-medium text-white/90">Unable to load image</p>
                    <p className="text-xs text-white/60">Please try again in a moment.</p>
                  </div>
                ) : null}
                {(lightboxImages ?? []).map((image, index) => {
                  const imageSrc = image.src || "/images/dummy.webp";
                  const isActive = index === lightboxIndex;
                  const isVisible = isActive && (loadedLightboxSrcs.has(imageSrc) || lightboxImageError);

                  return (
                    <div
                      key={`lightbox-${index}`}
                      className={`absolute inset-0 transition-all duration-500 ease-out will-change-transform ${
                        isActive ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
                      }`}
                      aria-hidden={!isActive}
                    >
                      <Image
                        src={imageSrc}
                        alt={asDisplayText(image.caption) || ""}
                        fill
                        className={`object-contain transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`}
                        sizes="100vw"
                        priority={isActive}
                        onLoad={() => {
                          markLightboxImageLoaded(imageSrc);
                        }}
                        onError={() => {
                          if (isActive) {
                            setLightboxImageError(true);
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-12 py-10 pb-4">
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
          {renderImageGrid(galleryItems, "gallery")}
        </section>
      )}

      {serviceMenuSections.map((menuSection, blockIndex) =>
        menuSection.is_active && (menuSection.items?.length ?? 0) > 0 ? (
          <section key={`service-menu-${blockIndex}`} className="space-y-6">
            <div className={`mb-8 ${getTextAlignClass(menuSection.heading?.align)}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {menuSection.heading?.label ?? "Service Menu"}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                {menuSection.heading?.title ?? "Click to view services and pricing"}
              </h2>
            </div>
            {renderImageGrid(menuSection.items ?? [], `menu-${blockIndex}`)}
          </section>
        ) : null,
      )}

      {artistSections.map((artistSection, blockIndex) =>
        artistSection.is_active && (artistSection.items?.length ?? 0) > 0 ? (
          <section key={`our-artists-${blockIndex}`} className="space-y-6">
            <div className={`mb-8 ${getTextAlignClass(artistSection.heading?.align)}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {artistSection.heading?.label ?? "Our Artists"}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                {artistSection.heading?.title ?? "Meet our creative professionals"}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(artistSection.items ?? []).map((artist, idx) => (
                <div key={`artist-${blockIndex}-${idx}`} className="group flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => openLightbox(idx, artistSection.items ?? [])}
                    className="relative aspect-[3/4] w-full cursor-zoom-in overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--background-soft)] text-left transition hover:border-[var(--accent-strong)]/40"
                    aria-label={`Zoom ${artist.caption || `artist ${idx + 1}`}`}
                  >
                    <Image
                      src={artist.src || "/images/dummy.webp"}
                      alt={asDisplayText(artist.caption) || ""}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-[1.02]"
                      sizes="(min-width: 1280px) 240px, (min-width: 768px) 220px, 50vw"
                    />
                  </button>
                  {asDisplayText(artist.caption) ? (
                    <p className={`text-xs text-[var(--foreground)]/60 ${getTextAlignClass(artist.text_align)}`}>
                      {asDisplayText(artist.caption)}
                    </p>
                  ) : null}
                  {asDisplayText(artist.text) ? (
                    artist.link_url ? (
                      <Link href={artist.link_url} className={`text-sm font-medium text-[var(--accent-strong)] hover:underline ${getTextAlignClass(artist.text_align)}`}>
                        {asDisplayText(artist.text)}
                      </Link>
                    ) : (
                      <p className={`text-sm text-[var(--foreground)]/80 ${getTextAlignClass(artist.text_align)}`}>{asDisplayText(artist.text)}</p>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null,
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

          <div className="grid items-stretch gap-6 md:grid-cols-3">
            {nailItems.map((course, idx) => (
              <article
                key={`nail-academy-${idx}`}
                className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-[0_16px_40px_-32px_rgba(17,24,39,0.45)]"
              >
                <button
                  type="button"
                  onClick={() => openLightbox(idx, nailLightboxItems)}
                  className="group relative aspect-square w-full shrink-0 cursor-zoom-in overflow-hidden bg-[var(--background-soft)] text-left transition hover:opacity-95"
                  aria-label={`Zoom ${course.title || `Course ${idx + 1}`}`}
                >
                  <Image
                    src={course.src || "/images/dummy.webp"}
                    alt={course.title || ""}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    sizes="(min-width: 1024px) 33vw, 100vw"
                  />
                  {course.duration_badge ? (
                    <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-[11px] font-medium tracking-wide text-white">
                      {course.duration_badge}
                    </span>
                  ) : null}
                </button>

                <div className={`flex min-h-0 flex-1 flex-col gap-4 p-5 pt-6 ${getTextAlignClass(course.text_align)}`}>
                  {course.title ? (
                    <h3 className="shrink-0 font-serif text-xl font-semibold leading-snug text-[var(--foreground)]">{course.title}</h3>
                  ) : null}

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] max-h-[18rem] sm:max-h-[20rem]">
                    {course.target_audience ? (
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                          {asDisplayText(nailAcademy.target_label) || "面向对象"}
                        </p>
                        <p className="text-sm leading-relaxed text-[var(--foreground)]/85">{course.target_audience}</p>
                      </div>
                    ) : null}

                    {course.curriculum.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                          {asDisplayText(nailAcademy.curriculum_label) || "教学核心"}
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
                    ) : null}
                  </div>

                  {course.details_link ? (
                    <div className="mt-auto shrink-0 border-t border-[var(--card-border)] pt-4">
                      <Link
                        href={course.details_link}
                        className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--foreground)] underline-offset-4 hover:underline"
                      >
                        {course.details_label}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {sections.faqs?.is_active && faqItems.length > 0 && (
        <section className="space-y-6">
          {renderSectionHeading(sections.faqs.heading ?? { label: "FAQ", title: "You might be wondering", align: "left" }, "accent")}

          <div className="grid items-start gap-4 sm:grid-cols-2">
            {faqItems.map((item, index) => {
              const faqId = `faq-${index}`;
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
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-5 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)]"
                >
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">{item.question}</h3>
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

      {visitStudio?.is_active && visitStudioHasContent ? (
        <VisitStudioSection heading={visitStudio.heading} locations={visitStudioLocations} />
      ) : null}

      {lightboxPortal}
    </div>
  );
}

/** @deprecated Use DynamicSections instead. Kept for backward compatibility. */
export const StaticSections = DynamicSections;

function VisitStudioSection({
  heading,
  locations,
}: {
  heading: LandingVisitStudio["heading"];
  locations: LandingVisitStudioLocation[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    axis: "x" | "y" | null;
    lastX: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const multi = locations.length > 1;
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(locations.length - 1, 0));

  useEffect(() => {
    if (activeIndex > locations.length - 1) setActiveIndex(0);
  }, [activeIndex, locations.length]);

  if (locations.length === 0) return null;

  const headingTitle = heading?.title?.trim() || "Visit Our Studio";

  const goTo = (index: number) => {
    setActiveIndex(Math.min(Math.max(index, 0), locations.length - 1));
    setDragX(0);
    setDragging(false);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!multi) return;
    suppressClickRef.current = false;
    // Avoid blue text highlight while starting a swipe.
    const sel = typeof window !== "undefined" ? window.getSelection?.() : null;
    sel?.removeAllRanges?.();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      axis: null,
      lastX: e.clientX,
    };
    setDragging(true);
    setDragX(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (drag.axis === "y") {
        // Let the page scroll normally.
        dragRef.current = null;
        setDragging(false);
        setDragX(0);
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        return;
      }
    }
    if (drag.axis !== "x") return;
    suppressClickRef.current = true;
    drag.lastX = e.clientX;
    const atStart = safeIndex === 0 && dx > 0;
    const atEnd = safeIndex === locations.length - 1 && dx < 0;
    setDragX(atStart || atEnd ? dx * 0.35 : dx);
  };

  const endPointerDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (drag.axis !== "x") {
      setDragX(0);
      setDragging(false);
      return;
    }
    const width = viewportRef.current?.clientWidth || 1;
    const dx = drag.lastX - drag.startX;
    const threshold = Math.min(72, width * 0.18);
    if (dx <= -threshold) goTo(safeIndex + 1);
    else if (dx >= threshold) goTo(safeIndex - 1);
    else {
      setDragX(0);
      setDragging(false);
    }
  };

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = false;
  };

  return (
    <section className="space-y-4 pt-2 pb-0">
      <div className="space-y-1">
        {heading?.label ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">
            {heading.label}
          </p>
        ) : null}
        <h2 className="font-serif text-3xl font-normal tracking-tight text-[var(--foreground)] sm:text-4xl">
          {headingTitle}
        </h2>
      </div>

      <div
        ref={viewportRef}
        className={`relative w-full min-w-0 ${
          multi ? "overflow-hidden touch-pan-y select-none [-webkit-touch-callout:none]" : ""
        } ${dragging ? "cursor-grabbing" : multi ? "cursor-grab" : ""}`}
        onPointerDown={multi ? onPointerDown : undefined}
        onPointerMove={multi ? onPointerMove : undefined}
        onPointerUp={multi ? endPointerDrag : undefined}
        onPointerCancel={multi ? endPointerDrag : undefined}
        onClickCapture={multi ? onClickCapture : undefined}
      >
        {/*
          Outer mover is viewport-width; percentage translateX is relative to it.
          Inner track is N * 100% so -100% moves exactly one slide.
        */}
        <div
          className="w-full will-change-transform"
          style={{
            transform: `translate3d(calc(${-safeIndex * 100}% + ${dragX}px), 0, 0)`,
            transition: dragging ? "none" : "transform 280ms ease",
            WebkitUserSelect: dragging ? "none" : undefined,
            userSelect: dragging ? "none" : undefined,
          }}
        >
          <div
            className="flex"
            style={multi ? { width: `${locations.length * 100}%` } : undefined}
          >
            {locations.map((location, index) => (
              <div
                key={`visit-slide-${index}`}
                className="min-w-0 box-border px-0.5"
                style={
                  multi
                    ? { width: `${100 / locations.length}%`, flex: `0 0 ${100 / locations.length}%` }
                    : { width: "100%" }
                }
              >
                <VisitStudioLocationBlock location={location} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {multi ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-2">
            {locations.map((_, index) => (
              <button
                key={`visit-dot-${index}`}
                type="button"
                aria-label={`Show location ${index + 1}`}
                onClick={() => goTo(index)}
                className={`h-2.5 rounded-full transition-all ${
                  index === safeIndex ? "w-6 bg-[var(--foreground)]" : "w-2.5 bg-[var(--foreground)]/25"
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Swipe to see more</p>
        </div>
      ) : null}
    </section>
  );
}

function VisitStudioLocationBlock({ location }: { location: LandingVisitStudioLocation }) {
  const hoursRows = normalizeVisitStudioHours(location.opening_hours);
  const footerLines = getVisitStudioFooterLines(location);
  const contactCol =
    location.column_order === "hours_left" ? "order-2 lg:order-2" : "order-1 lg:order-1";
  const hoursCol =
    location.column_order === "hours_left" ? "order-1 lg:order-1" : "order-2 lg:order-2";
  const openingTitle = location.opening_hours_heading?.trim() || "Opening Hours";
  const whatsappPhone = resolveVisitStudioWhatsAppPhone(location);
  const whatsappMessage = resolveVisitStudioWhatsAppMessage(location);
  const whatsappUrl = buildWhatsAppUrl(whatsappPhone, whatsappMessage);

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-2 lg:items-stretch lg:gap-14">
      <div className={`flex min-w-0 flex-col gap-5 ${contactCol}`}>
        {location.studio_name?.trim() ? (
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-1 shrink-0 text-red-500" aria-hidden>
              <i className="fa-solid fa-location-dot" />
            </span>
            <p className="min-w-0 break-words font-serif text-lg font-semibold uppercase tracking-wide text-[var(--foreground)]">
              {location.studio_name.trim()}
            </p>
          </div>
        ) : null}

        {location.address?.trim() ? (
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[var(--text-muted)]">
            {location.address.trim()}
          </p>
        ) : null}

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
          {location.google_maps_url?.trim() ? (
            <Link
              href={location.google_maps_url.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)] transition hover:bg-[var(--background-soft)] sm:px-4 sm:tracking-[0.15em]"
            >
              <i className="fa-solid fa-paper-plane shrink-0 text-xs opacity-80" aria-hidden />
              <span className="truncate">{location.google_maps_label?.trim() || "GOOGLE MAPS"}</span>
            </Link>
          ) : null}
          {location.waze_url?.trim() ? (
            <Link
              href={location.waze_url.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)] transition hover:bg-[var(--background-soft)] sm:px-4 sm:tracking-[0.15em]"
            >
              <i className="fa-solid fa-arrow-up-right-from-square shrink-0 text-xs opacity-80" aria-hidden />
              <span className="truncate">{location.waze_label?.trim() || "OPEN WAZE"}</span>
            </Link>
          ) : null}
        </div>

        {whatsappUrl ? (
          <Link
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-[var(--foreground)] px-3 py-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:opacity-90 sm:px-4 sm:tracking-[0.2em]"
          >
            <i className="fa-brands fa-whatsapp shrink-0 text-base" aria-hidden />
            <span className="truncate">{location.whatsapp_label?.trim() || "MESSAGE US ON WHATSAPP"}</span>
          </Link>
        ) : null}
      </div>

      <div className={`flex min-w-0 ${hoursCol}`}>
        <div className="flex w-full min-w-0 flex-col rounded-2xl border border-[var(--card-border)] bg-[#f5f0e8] p-5 shadow-sm sm:p-6 dark:bg-[var(--card)]/90">
          <h3 className="font-serif text-xl font-medium text-[var(--foreground)]">{openingTitle}</h3>
          {hoursRows.length > 0 ? (
            <div className="mt-5 divide-y divide-[var(--card-border)]/80">
              {hoursRows.map((row, idx) => (
                <div key={idx} className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0">
                  <span className="min-w-0 break-words text-sm text-[var(--foreground)]/85">{row.day_range}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">{row.time_range}</span>
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
  );
}

function resolveVisitStudioLocations(
  studio: LandingVisitStudio | null | undefined,
): LandingVisitStudioLocation[] {
  if (!studio) return [];
  const fromArray = Array.isArray(studio.locations)
    ? studio.locations
        .map((item, index) => normalizeVisitStudioLocation(item, index))
        .filter((item): item is LandingVisitStudioLocation => item !== null)
        .filter((item) => item.is_active !== false)
        .filter((item) => visitStudioLocationHasContent(item))
    : [];
  if (fromArray.length > 0) return fromArray;

  const legacy = normalizeVisitStudioLocation(studio, 0);
  if (!legacy || legacy.is_active === false || !visitStudioLocationHasContent(legacy)) return [];
  return [legacy];
}

function normalizeVisitStudioLocation(
  raw: unknown,
  index: number,
): LandingVisitStudioLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const location: LandingVisitStudioLocation = {
    is_active: o.is_active === false ? false : true,
    tab_label: String(o.tab_label ?? "").trim(),
    studio_name: String(o.studio_name ?? "").trim(),
    address: String(o.address ?? ""),
    google_maps_url: String(o.google_maps_url ?? ""),
    waze_url: String(o.waze_url ?? ""),
    whatsapp_phone: String(o.whatsapp_phone ?? ""),
    whatsapp_message: String(o.whatsapp_message ?? ""),
    whatsapp_url: String(o.whatsapp_url ?? "").trim() || undefined,
    google_maps_label: String(o.google_maps_label ?? "GOOGLE MAPS"),
    waze_label: String(o.waze_label ?? "OPEN WAZE"),
    whatsapp_label: String(o.whatsapp_label ?? "MESSAGE US ON WHATSAPP"),
    opening_hours_heading: String(o.opening_hours_heading ?? "Opening Hours"),
    opening_hours: normalizeVisitStudioHours(o.opening_hours),
    bottom_label: String(o.bottom_label ?? ""),
    column_order: o.column_order === "hours_left" ? "hours_left" : "contact_left",
  };
  if (!location.tab_label) {
    location.tab_label = location.studio_name || `Location ${index + 1}`;
  }
  return location;
}

function visitStudioLocationHasContent(location: LandingVisitStudioLocation): boolean {
  return Boolean(
    location.studio_name?.trim() ||
      location.address?.trim() ||
      normalizeVisitStudioHours(location.opening_hours).length > 0 ||
      location.google_maps_url?.trim() ||
      location.waze_url?.trim() ||
      resolveVisitStudioWhatsAppPhone(location).trim() ||
      getVisitStudioFooterLines(location).length > 0,
  );
}

/** Footer under opening hours: `bottom_label` lines, or legacy API fields until content is re-saved. */
function getVisitStudioFooterLines(
  studio: Pick<LandingVisitStudioLocation, "bottom_label"> & Record<string, unknown>,
): string[] {
  const text = studio.bottom_label?.trim();
  if (text) {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }
  const ob = String(studio.operated_by ?? "").trim();
  const reg = String(studio.registration_number ?? "").trim();
  const cy = String(studio.copyright_year ?? "").trim();
  const cb = String(studio.copyright_brand ?? "").trim();
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
  const isMeaningful = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    // Placeholder leftovers from incomplete CMS cards
    if (trimmed === "." || trimmed.toLowerCase() === "null") return false;
    return true;
  };

  if (Array.isArray(raw)) {
    return raw.map((x) => asDisplayText(x)).filter(isMeaningful);
  }
  if (typeof raw === "string") {
    return raw
      .split("\n")
      .map((s) => asDisplayText(s))
      .filter(isMeaningful);
  }
  return [];
}
