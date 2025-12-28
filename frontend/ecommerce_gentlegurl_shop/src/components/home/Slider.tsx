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
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const slides = useMemo(() => items ?? [], [items]);
  
  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

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

    if (isLeftSwipe || isRightSwipe) {
      setHasSwiped(true);
      if (isLeftSwipe) {
        // Swipe left = next slide
        goTo(activeIndex + 1);
      } else {
        // Swipe right = previous slide
        goTo(activeIndex - 1);
      }
      // Prevent link clicks after swipe
      setTimeout(() => setHasSwiped(false), 100);
    }
  };

  // Mouse drag handlers for desktop
  const [mouseStart, setMouseStart] = useState<number | null>(null);
  const [mouseEnd, setMouseEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasSwiped, setHasSwiped] = useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setMouseStart(e.clientX);
    setMouseEnd(null);
    setHasSwiped(false);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setMouseEnd(e.clientX);
  };

  const onMouseUp = () => {
    if (!isDragging || !mouseStart) {
      setIsDragging(false);
      return;
    }
    
    if (mouseEnd !== null) {
      const distance = mouseStart - mouseEnd;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;

      if (isLeftSwipe || isRightSwipe) {
        setHasSwiped(true);
        if (isLeftSwipe) {
          goTo(activeIndex + 1);
        } else {
          goTo(activeIndex - 1);
        }
        // Prevent link clicks after swipe
        setTimeout(() => setHasSwiped(false), 100);
      }
    }

    setIsDragging(false);
    setMouseStart(null);
    setMouseEnd(null);
  };

  return (
    <div className="relative overflow-hidden border border-[var(--card-border)]/80 bg-gradient-to-br from-[var(--background)] via-[var(--background-soft)] to-[var(--card)] shadow-[var(--shadow)]">
      <div className="pointer-events-none absolute -left-10 top-8 h-32 w-32  bg-[color:var(--accent)]/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-4 h-40 w-40 bg-[color:var(--muted)]/70 blur-3xl" />

      <div
        className="relative h-[380px] sm:h-[420px] lg:h-[480px] cursor-grab active:cursor-grabbing"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {slides.map((item, index) => {
          const isActive = index === activeIndex;
          // const desktopImage = item.image_url ?? item.image_path ?? "/images/slideshow_placeholder.jpg";
          const desktopImage =  "/images/aaa.jpg";
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
                  <div className="inline-flex items-center gap-2 rounded-full bg-[var(--card)]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />
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
                      onClick={(e) => {
                        if (hasSwiped) {
                          e.preventDefault();
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--card)]/90 px-5 py-3 text-sm font-semibold text-[var(--foreground)] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[var(--card)]"
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
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-black/30 px-3 py-2 text-white backdrop-blur">
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(index)}
                className={`h-2.5 rounded-full transition ${
                  index === activeIndex
                    ? "w-7 bg-[var(--card)]"
                    : "w-2.5 bg-[var(--card)]/60 hover:bg-[var(--card)]/80"
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
