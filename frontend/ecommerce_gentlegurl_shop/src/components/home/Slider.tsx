"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SliderItem = {
  id: number | string;
  title?: string | null;
  subtitle?: string | null;
  image_path?: string | null;
  mobile_image_path?: string | null;
  button_label?: string | null;
  button_link?: string | null;
  image_url?: string | null;
  mobile_image_url?: string | null;
};

interface SliderProps {
  items: SliderItem[];
}

export default function Slider({ items }: SliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const slides = useMemo(() => items ?? [], [items]);

  useEffect(() => {
    if (!slides.length) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [slides.length]);

  if (!slides.length) return null;

  const goTo = (index: number) => {
    const total = slides.length;
    const nextIndex = ((index % total) + total) % total;
    setActiveIndex(nextIndex);
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-[#fdf2f8] via-white to-[#f5f3ff] shadow-[0_24px_80px_-42px_rgba(109,40,217,0.4)]">
      <div className="pointer-events-none absolute -left-10 top-8 h-32 w-32 rounded-full bg-[#fce7f3]/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-4 h-40 w-40 rounded-full bg-[#ede9fe]/70 blur-3xl" />

      <div className="relative h-[380px] sm:h-[420px] lg:h-[480px]">
        {slides.map((item, index) => {
          const isActive = index === activeIndex;
          // const desktopImage = item.image_url ?? item.image_path ?? "/images/slideshow_placeholder.jpg";
          const desktopImage =  "/images/slideshow_placeholder.jpg";
          // const mobileImage = item.mobile_image_url ?? item.mobile_image_path ?? desktopImage;

          const mobileImage = desktopImage;


          return (
            <article
              key={item.id}
              className={`absolute inset-0 overflow-hidden transition duration-700 ease-out ${isActive ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <div className="absolute inset-0">
                <div className="relative h-full w-full">
                  <Image
                    src={desktopImage}
                    alt={item.title ?? "slide"}
                    fill
                    priority={isActive}
                    sizes="(max-width: 768px) 100vw, 80vw"
                    className="hidden object-cover sm:block"
                  />
                  <Image
                    src={mobileImage}
                    alt={item.title ?? "slide"}
                    fill
                    priority={isActive}
                    sizes="100vw"
                    className="object-cover sm:hidden"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/35 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45)_0%,_rgba(255,255,255,0)_45%)]" />
              </div>

              <div className="relative z-10 flex h-full items-center px-6 py-10 sm:px-10 lg:px-14">
                <div className="max-w-xl space-y-4 text-white sm:space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />
                    Signature Edit
                  </div>

                  {item.subtitle && (
                    <p className="text-sm font-medium uppercase tracking-[0.22em] text-white/80">{item.subtitle}</p>
                  )}

                  {item.title && (
                    <h2 className="text-3xl font-semibold leading-tight drop-shadow-sm sm:text-4xl lg:text-5xl">{item.title}</h2>
                  )}

                  <p className="max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
                    Discover covetable textures, romantic tones, and curated essentials for your everyday statements.
                  </p>

                  {item.button_link && item.button_label && (
                    <Link
                      href={item.button_link}
                      className="inline-flex items-center gap-2 rounded-full bg-white/90 px-5 py-3 text-sm font-semibold text-gray-900 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-white"
                    >
                      {item.button_label}
                      <span aria-hidden className="text-base">
                        →
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {slides.length > 1 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-3">
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/30 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-white/40"
              aria-label="Previous slide"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/30 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-white/40"
              aria-label="Next slide"
            >
              ›
            </button>
          </div>
        )}

        {slides.length > 1 && (
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/30 px-3 py-2 text-white backdrop-blur">
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(index)}
                className={`h-2.5 rounded-full transition ${
                  index === activeIndex ? "w-7 bg-white" : "w-2.5 bg-white/50 hover:bg-white/70"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
