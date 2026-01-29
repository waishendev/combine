"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

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

type SectionHeading = {
  label: string;
  title: string;
  align?: "left" | "center" | "right";
};

type GalleryImage = {
  src: string;
  alt?: string;
  caption?: string;
  captionAlign?: "left" | "center" | "right";
};

type HeroSlide = {
  src: string;
  mobileSrc?: string;
  alt?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  buttonLabel?: string;
  buttonHref?: string;
  sort_order?: number;
};

type ServicesPageLayoutProps = {
  title: string;
  subtitle: string;
  services: ServiceItem[];
  gallery: GalleryImage[];
  pricing: PricingItem[];
  faqs: FAQItem[];
  notes: string[];
  servicesActive?: boolean;
  galleryActive?: boolean;
  pricingActive?: boolean;
  faqsActive?: boolean;
  notesActive?: boolean;
  heroActive?: boolean;
  heroImage?: string;
  heroSlides?: HeroSlide[];
  servicesHeading?: SectionHeading;
  galleryHeading?: SectionHeading;
  galleryFooterText?: string;
  galleryFooterAlign?: "left" | "center" | "right";
  galleryLayout?: "auto" | "fixed";
  pricingHeading?: SectionHeading;
  faqHeading?: SectionHeading;
  notesHeading?: SectionHeading;
  whatsappPhone?: string | null;
  whatsappEnabled?: boolean;
  whatsappDefaultMessage?: string | null;
};

export function ServicesPageLayout({
  title,
  subtitle,
  services,
  gallery,
  pricing,
  faqs,
  notes,
  servicesActive = true,
  galleryActive = true,
  pricingActive = true,
  faqsActive = true,
  notesActive = true,
  heroActive = true,
  heroImage,
  heroSlides,
  servicesHeading,
  galleryHeading,
  galleryFooterText,
  galleryFooterAlign = "center",
  galleryLayout = "fixed",
  pricingHeading,
  faqHeading,
  notesHeading,
  whatsappPhone,
  whatsappEnabled = true,
  whatsappDefaultMessage,
}: ServicesPageLayoutProps) {
  const pricingRef = useRef<HTMLDivElement | null>(null);
  const slideContainerRef = useRef<HTMLDivElement | null>(null);
  const baseSlides: HeroSlide[] = heroActive
    ? heroSlides && heroSlides.length > 0
      ? heroSlides
      : [
          {
            src: heroImage || "/images/slideshow_placeholder.jpg",
            alt: `${title} hero visual`,
          },
        ]
    : [];
  const showHero = baseSlides.length > 0;
  const orderedSlides = baseSlides
    .map((slide, index) => ({ slide, index }))
    .sort((a, b) => (a.slide.sort_order ?? a.index) - (b.slide.sort_order ?? b.index))
    .map(({ slide }) => slide);

  const getWhatsAppUrl = useCallback(() => {
    if (!whatsappEnabled || !whatsappPhone) return undefined;
    const sanitizedPhone = whatsappPhone.replace(/[^\d]/g, "");
    const message = whatsappDefaultMessage ?? `Hi! I would like to book an appointment for ${title}.`;
    return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`;
  }, [title, whatsappDefaultMessage, whatsappEnabled, whatsappPhone]);

  const whatsappUrl = getWhatsAppUrl();
  const showServicesSection = servicesActive && services.length > 0;
  const showGallerySection = galleryActive && gallery.length > 0;
  const showPricingSection = pricingActive && pricing.length > 0;
  const showFaqSection = faqsActive && faqs.length > 0;
  const showNotesSection = notesActive && notes.length > 0;
  const resolvedServicesHeading = servicesHeading ?? {
    label: "Services",
    title: "What's Included",
    align: "left",
  };
  const resolvedGalleryHeading = galleryHeading ?? {
    label: "Service Menu",
    title: "Click to view services and pricing",
    align: "center",
  };
  const resolvedPricingHeading = pricingHeading ?? {
    label: "Pricing",
    title: "Transparent rates",
    align: "left",
  };
  const resolvedFaqHeading = faqHeading ?? {
    label: "FAQ",
    title: "You might be wondering",
    align: "left",
  };
  const resolvedNotesHeading = notesHeading ?? {
    label: "Notes",
    title: "Policy & care",
    align: "left",
  };

  const slides = orderedSlides.map((slide, index) => {
    const resolvedTitle = slide.title ?? `${title} spotlight ${index + 1}`;
    const resolvedAlt = slide.alt ?? resolvedTitle;
    const resolvedDescription =
      slide.description ??
      slide.subtitle ??
      (index === 0
        ? subtitle
        : "Add a short highlight for this slide so it feels like a complete card.");
    const resolvedButtonHref = slide.buttonHref ?? whatsappUrl;
    const resolvedButtonLabel = resolvedButtonHref ? slide.buttonLabel ?? "Book an Appointment" : undefined;

    return {
      ...slide,
      title: resolvedTitle,
      alt: resolvedAlt,
      description: resolvedDescription,
      buttonHref: resolvedButtonHref,
      buttonLabel: resolvedButtonLabel,
    };
  });
  const [activeSlide, setActiveSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [isHoveringHero, setIsHoveringHero] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [galleryLightboxIndex, setGalleryLightboxIndex] = useState<number | null>(null);
  const autoplayDelayMs = 5000;
  const isLightboxOpen = lightboxIndex !== null || galleryLightboxIndex !== null;

  useEffect(() => {
    const resetId = window.setTimeout(() => setActiveSlide(0), 0);
    return () => window.clearTimeout(resetId);
  }, [title, slides.length]);

  const goToSlide = useCallback(
    (index: number) => {
      if (slides.length === 0) return;
      const next = (index + slides.length) % slides.length;
      setActiveSlide(next);
    },
    [slides.length],
  );

  const goToNextSlide = useCallback(() => {
    goToSlide(activeSlide + 1);
  }, [activeSlide, goToSlide]);

  const goToPrevSlide = useCallback(() => {
    goToSlide(activeSlide - 1);
  }, [activeSlide, goToSlide]);

  useEffect(() => {
    if (slides.length <= 1 || isHoveringHero || isLightboxOpen) return;
    const intervalId = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, autoplayDelayMs);
    return () => window.clearInterval(intervalId);
  }, [autoplayDelayMs, isHoveringHero, isLightboxOpen, slides.length]);

  useEffect(() => {
    if (slides.length === 0) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (lightboxIndex !== null || galleryLightboxIndex !== null) {
        if (event.key === "Escape") {
          setLightboxIndex(null);
          setGalleryLightboxIndex(null);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          if (lightboxIndex !== null) {
            setLightboxIndex((prev) => (prev === null ? prev : (prev + 1) % slides.length));
          }
          if (galleryLightboxIndex !== null) {
            setGalleryLightboxIndex((prev) => (prev === null ? prev : (prev + 1) % gallery.length));
          }
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          if (lightboxIndex !== null) {
            setLightboxIndex((prev) => (prev === null ? prev : (prev - 1 + slides.length) % slides.length));
          }
          if (galleryLightboxIndex !== null) {
            setGalleryLightboxIndex((prev) => (prev === null ? prev : (prev - 1 + gallery.length) % gallery.length));
          }
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveSlide((prev) => (prev + 1) % slides.length);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gallery.length, galleryLightboxIndex, lightboxIndex, slides.length]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isLightboxOpen]);

  const getTextAlignClass = (align: SectionHeading["align"] = "left") => {
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return "text-left";
  };

  const getItemsAlignClass = (align: SectionHeading["align"] = "left") => {
    if (align === "center") return "items-center";
    if (align === "right") return "items-end";
    return "items-start";
  };

  const getCaptionAlignClass = (align: GalleryImage["captionAlign"] = "center") => {
    if (align === "left") return "text-left";
    if (align === "right") return "text-right";
    return "text-center";
  };

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    // 如果触摸的是按钮或链接，不处理滑动
    const target = e.target as HTMLElement;
    if (target.closest('button, a')) return;
    
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
      goToNextSlide();
    }
    if (isRightSwipe) {
      goToPrevSlide();
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    // 如果点击的是按钮或链接，不处理滑动
    const target = e.target as HTMLElement;
    if (target.closest('button, a')) return;
    
    e.preventDefault();
    setDragStart(e.clientX);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragStart !== null) {
      e.preventDefault();
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (dragStart === null) return;
    const distance = dragStart - e.clientX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNextSlide();
    }
    if (isRightSwipe) {
      goToPrevSlide();
    }

    setDragStart(null);
  };

  const renderSectionHeading = (
    heading: SectionHeading,
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
        <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
          {heading.title}
        </h2>
        <div className={`h-px w-full ${dividerClass}`} />
      </div>
    );
  };

  return (
    <main className="bg-gradient-to-b from-transparent via-white/60 to-transparent pb-16">
      <div className="mx-auto max-w-6xl space-y-12 px-4 pt-10 sm:px-6 lg:px-8">
        {/* Hero */}
        {showHero && (
          <section
            className="relative overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card)]/80 shadow-sm cursor-grab active:cursor-grabbing"
            onMouseEnter={() => setIsHoveringHero(true)}
            onMouseLeave={(e) => {
              setIsHoveringHero(false);
              onMouseUp(e);
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(231,162,186,0.18),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(247,223,233,0.35),transparent_30%)]" />
          <div className="relative grid min-h-[340px] gap-8 p-6 pb-24 md:min-h-[420px] md:gap-10 md:p-10 md:pb-28 lg:min-h-[480px] lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12 lg:pb-24">
            <div className="order-2 flex h-full flex-col justify-center space-y-6 lg:order-1">
              <div className="relative min-h-[260px] sm:min-h-[280px] lg:min-h-[320px]">
                {slides.map((slide, index) => (
                  <div
                    key={`${slide.src}-content-${index}`}
                    className={`absolute inset-0 flex flex-col justify-center space-y-4 transition-all duration-500 ease-out will-change-transform ${
                      index === activeSlide
                        ? "translate-x-0 opacity-100"
                        : "pointer-events-none translate-x-8 opacity-0"
                    }`}
                    aria-hidden={index !== activeSlide}
                  >
                    <div className="max-w-xl space-y-4">
                      <h1 className="text-3xl font-semibold leading-[1.15] text-[var(--foreground)] sm:text-4xl lg:text-5xl">
                        {slide.title}
                      </h1>
                      <p className="text-base leading-relaxed text-[var(--foreground)]/80 sm:text-lg lg:text-xl">
                        {slide.description}
                      </p>
                    </div>
                    {slide.buttonHref && slide.buttonLabel && (
                      <div className="pt-2">
                        {(() => {
                          const isExternalLink = slide.buttonHref?.startsWith("http");
                          return (
                            <a
                              href={slide.buttonHref}
                              target={isExternalLink ? "_blank" : undefined}
                              rel={isExternalLink ? "noreferrer" : undefined}
                              className="inline-flex rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] hover:shadow-lg"
                            >
                              {slide.buttonLabel}
                            </a>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 flex h-full items-center justify-center lg:order-2 lg:justify-end">
              <div className="relative w-full max-w-2xl">
                <div
                  ref={slideContainerRef}
                  className="relative mx-auto w-full overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--background-soft)] shadow-sm"
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                >
                  <div className="relative aspect-[4/3] w-full md:aspect-[16/10] lg:aspect-[5/4]">
                    {slides.map((slide, index) => (
                      <button
                        key={`${slide.src}-${slide.alt}`}
                        type="button"
                        onClick={() => setLightboxIndex(index)}
                        className={`absolute inset-0 block h-full w-full cursor-zoom-in transition-all duration-500 ease-out will-change-transform ${
                          index === activeSlide
                            ? "translate-x-0 opacity-100"
                            : "pointer-events-none -translate-x-8 opacity-0"
                        }`}
                        aria-label={`Open slide ${index + 1} image`}
                        aria-hidden={index !== activeSlide}
                        tabIndex={index === activeSlide ? 0 : -1}
                      >
                        <Image
                          src={slide.mobileSrc ?? slide.src}
                          alt={slide.alt}
                          fill
                          className="object-cover md:hidden"
                          sizes="100vw"
                          priority={index === activeSlide}
                          draggable={false}
                        />
                        <Image
                          src={slide.src}
                          alt={slide.alt}
                          fill
                          className="hidden object-cover md:block"
                          sizes="(min-width: 1280px) 520px, (min-width: 1024px) 480px, (min-width: 768px) 50vw, 100vw"
                          priority={index === activeSlide}
                          draggable={false}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                {/* {slides.length > 1 && (
                  <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-3 sm:flex">
                    <button
                      type="button"
                      onClick={goToPrevSlide}
                      className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--card-border)]/80 bg-[var(--card)]/90 text-lg text-[var(--foreground)] shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--card)]"
                      aria-label="Previous slide"
                    >
                      <span aria-hidden>‹</span>
                    </button>
                    <button
                      type="button"
                      onClick={goToNextSlide}
                      className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--card-border)]/80 bg-[var(--card)]/90 text-lg text-[var(--foreground)] shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--card)]"
                      aria-label="Next slide"
                    >
                      <span aria-hidden>›</span>
                    </button>
                  </div>
                )} */}
              </div>
            </div>
          </div>
          {slides.length > 1 && (
            <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full border border-[var(--card-border)]/80 bg-[var(--card)]/95 px-3 py-2  text-white backdrop-blur">
              {slides.map((slide, index) => (
                <button
                  key={`${slide.src}-dot`}
                  type="button"
                  onClick={() => goToSlide(index)}
                  className={`h-2.5 rounded-full transition  ${
                    index === activeSlide
                      ?  "w-7 bg-[var(--accent)]" : "w-2 bg-[var(--foreground)]/25 hover:bg-[var(--foreground)]/45"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
          </section>
        )}
        {lightboxIndex !== null && (
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

              {/* {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex((prev) => (prev === null ? prev : (prev - 1 + slides.length) % slides.length))}
                    className="absolute left-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black/80"
                    aria-label="Previous image"
                  >
                    <span aria-hidden>←</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex((prev) => (prev === null ? prev : (prev + 1) % slides.length))}
                    className="absolute right-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black/80"
                    aria-label="Next image"
                  >
                    <span aria-hidden>→</span>
                  </button>
                </>
              )} */}

              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
                {slides.map((slide, index) => (
                  <div
                    key={`${slide.src}-lightbox-${index}`}
                    className={`absolute inset-0 transition-all duration-500 ease-out will-change-transform ${
                      index === lightboxIndex ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
                    }`}
                    aria-hidden={index !== lightboxIndex}
                  >
                    <Image
                      src={slide.src}
                      alt={slide.alt}
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
        {galleryLightboxIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl">
              <button
                type="button"
                onClick={() => setGalleryLightboxIndex(null)}
                className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black/80"
                aria-label="Close image preview"
              >
                <span aria-hidden>✕</span>
              </button>

              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
                {gallery.map((image, index) => {
                  const altText = image.alt ?? image.caption ?? `Gallery image ${index + 1}`;
                  return (
                    <div
                      key={`${image.src}-lightbox-${index}`}
                      className={`absolute inset-0 transition-all duration-500 ease-out will-change-transform ${
                        index === galleryLightboxIndex ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
                      }`}
                      aria-hidden={index !== galleryLightboxIndex}
                    >
                      <Image
                        src={image.src}
                        alt={altText}
                        fill
                        className="object-contain"
                        sizes="100vw"
                        priority={index === galleryLightboxIndex}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {/* Services */}
        {showServicesSection && (
          <section className="space-y-6">
            {renderSectionHeading(resolvedServicesHeading, "accent")}

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
        )}

        {/* Gallery */}
        {showGallerySection && (
          <section className="space-y-6">
            {renderSectionHeading(resolvedGalleryHeading, "accent")}
            <div
              className={
                galleryLayout === "fixed"
                  ? "grid grid-cols-2 gap-4 sm:grid-cols-4"
                  : "grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] xl:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]"
              }
            >
              {gallery.map((image, index) => {
                const altText = image.alt ?? image.caption ?? `Gallery image ${index + 1}`;
                return (
                  <button
                    key={`${image.src}-${index}`}
                    type="button"
                    onClick={() => setGalleryLightboxIndex(index)}
                    className="group flex w-full cursor-zoom-in flex-col gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-3 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] transition hover:-translate-y-1 hover:shadow-[0_22px_50px_-32px_rgba(17,24,39,0.45)]"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--background-soft)]">
                      <Image
                        src={image.src}
                        alt={altText}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-[1.02]"
                        sizes="(min-width: 1280px) 240px, (min-width: 768px) 220px, 50vw"
                      />
                    </div>
                    {image.caption && (
                      <p className={`text-sm text-[var(--foreground)]/70 ${getCaptionAlignClass(image.captionAlign)}`}>
                        {image.caption}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
            {galleryFooterText && (
              <p className={`text-sm uppercase tracking-[0.3em] text-[var(--foreground)]/50 ${getTextAlignClass(galleryFooterAlign)}`}>
                {galleryFooterText}
              </p>
            )}
          </section>
        )}

        {/* Pricing */}
        {showPricingSection && (
          <section className="space-y-6" ref={pricingRef}>
            {renderSectionHeading(resolvedPricingHeading, "accent")}

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
        )}

        {/* FAQ */}
        {showFaqSection && (
          <section className="space-y-6">
            {renderSectionHeading(resolvedFaqHeading, "accent")}

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
        )}

        {/* Policy / Notes */}
        {showNotesSection && (
          <section className="space-y-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_22px_70px_-40px_rgba(17,24,39,0.45)]">
            {renderSectionHeading(resolvedNotesHeading, "muted")}

            <ul className="grid gap-3 sm:grid-cols-2">
              {notes.map((note) => (
                <li key={note} className="flex items-center gap-3 rounded-xl bg-[var(--background-soft)]/70 p-4 text-sm text-[var(--foreground)]/80">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/70 text-white">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
