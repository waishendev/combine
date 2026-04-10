"use client";

import Link from "next/link";
import Image from "next/image";
import { Service } from "@/lib/types";
import { SectionTitle } from "./SectionTitle";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { addPackageCartItem, getServicePackages } from "@/lib/apiClient";
import { SERVICE_PACKAGES_SECTION_ID } from "@/lib/landingAnchors";
import type { ServicePackage, LandingSections, LandingGalleryItem } from "@/lib/types";

type HeroProps = {
  hero: LandingSections["hero"];
};

export function Hero({ hero }: HeroProps) {
  if (!hero.is_active) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 text-center">
      <p className="text-sm uppercase tracking-[0.25em] text-[var(--text-muted)]">{hero.label}</p>
      <h1 className="mt-4 text-5xl font-semibold tracking-tight text-[var(--foreground)]">{hero.title}</h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-muted)]">{hero.subtitle}</p>
      <Link href={hero.cta_link || "/booking"} className="mt-8 inline-flex rounded-full bg-[var(--accent-strong)] px-8 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-stronger)] transition-colors">
        {hero.cta_label}
      </Link>
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
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const galleryItems = sections.gallery?.items ?? [];
  const menuItems = sections.service_menu?.items ?? [];
  const allImages = [...galleryItems, ...menuItems];

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxSource, setLightboxSource] = useState<"gallery" | "menu">("gallery");
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [packagesMessage, setPackagesMessage] = useState<string | null>(null);

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

  useEffect(() => {
    const run = async () => {
      setPackagesLoading(true);
      setPackagesError(null);
      try {
        const rows = await getServicePackages();
        const list = Array.isArray(rows) ? rows : [];
        setPackages(list.filter((pkg) => pkg.is_active !== false));
      } catch (err) {
        setPackagesError(err instanceof Error ? err.message : "Unable to load service packages");
      } finally {
        setPackagesLoading(false);
      }
    };

    void run();
  }, []);

  useEffect(() => {
    if (pathname !== "/") return;
    if (packagesLoading) return;
    if (packages.length === 0) return;
    if (typeof window === "undefined" || window.location.hash !== `#${SERVICE_PACKAGES_SECTION_ID}`) return;
    const el = document.getElementById(SERVICE_PACKAGES_SECTION_ID);
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, packagesLoading, packages.length]);

  const onAddPackageToCart = async (pkg: ServicePackage) => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || "/")}`);
      return;
    }

    try {
      const updatedCart = await addPackageCartItem({ service_package_id: pkg.id, qty: 1 });
      const itemCount = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
      window.dispatchEvent(new CustomEvent("cartUpdated", { detail: itemCount }));
      setPackagesMessage(`Added ${pkg.name} to cart.`);
      window.dispatchEvent(new CustomEvent("openCart"));
    } catch (err) {
      setPackagesMessage(err instanceof Error ? err.message : "Unable to add package into cart.");
    }
  };

  const faqItems = sections.faqs?.items ?? [];
  const noteItems = sections.notes?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-16 sm:px-6 lg:px-8">
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

      {/* Service Packages (still dynamic from API) */}
      {!packagesLoading && packages.length > 0 ? (
        <section id={SERVICE_PACKAGES_SECTION_ID} className="scroll-mt-24 space-y-6">
          {renderSectionHeading({ label: "Packages", title: "Service Packages", align: "left" }, "accent")}
          {packagesMessage ? <p className="text-sm text-[var(--accent)]">{packagesMessage}</p> : null}
          {packagesError ? <p className="text-sm text-[var(--status-error)]">{packagesError}</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            {packages.slice(0, 4).map((pkg) => (
              <article
                key={pkg.id}
                className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-5 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] transition hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-[var(--foreground)]">{pkg.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--foreground)]/70">
                      {pkg.description || "Service package"}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full bg-[var(--badge-background)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                    RM {pkg.selling_price}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--foreground)]/70">
                  <span className="rounded-full border border-[var(--card-border)] bg-[var(--card)]/60 px-3 py-1">
                    Valid: {pkg.valid_days ?? "-"} days
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void onAddPackageToCart(pkg)}
                    className="inline-flex rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] hover:shadow-lg"
                  >
                    Add to Cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
    </div>
  );
}

/** @deprecated Use DynamicSections instead. Kept for backward compatibility. */
export const StaticSections = DynamicSections;
