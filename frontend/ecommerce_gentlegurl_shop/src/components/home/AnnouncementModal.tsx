"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Announcement = {
  id: number | string;
  title?: string;
  content?: string;
  image_path?: string | null;
  image_url?: string | null;
  button_link?: string | null;
  button_label?: string | null;
};

type AnnouncementModalProps = {
  items: Announcement[];
};

export default function AnnouncementModal({ items }: AnnouncementModalProps) {
  const [open, setOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [mouseStart, setMouseStart] = useState<number | null>(null);
  const [mouseEnd, setMouseEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Prevent page jump when modal opens by locking scroll position
  useEffect(() => {
    if (open && items?.length) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.body.style.margin = "0";

      return () => {
        // Restore scroll position
        const savedScrollY = document.body.style.top;
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        document.body.style.margin = "";
        if (savedScrollY) {
          const scrollYValue = Math.abs(parseInt(savedScrollY.replace("px", ""), 10));
          window.scrollTo(0, scrollYValue);
        }
      };
    }
  }, [open, items]);

  useEffect(() => {
    if (items?.length) {
      setActiveIndex(0);
    }
  }, [items]);

  if (!open || !items?.length) return null;

  const item = items[activeIndex];
  const hasMultiple = items.length > 1;

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  // Touch handlers for mobile
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
    const isLeftSwipe = distance > minSwipeDistance; // Swipe left (拉左去右) = NEXT
    const isRightSwipe = distance < -minSwipeDistance; // Swipe right (拉右去左) = PREV

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  // Mouse drag handlers for desktop
  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setMouseStart(e.clientX);
    setMouseEnd(null);
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
      const isLeftSwipe = distance > minSwipeDistance; // Swipe left (拉左去右) = NEXT
      const isRightSwipe = distance < -minSwipeDistance; // Swipe right (拉右去左) = PREV

      if (isLeftSwipe) {
        handleNext();
      } else if (isRightSwipe) {
        handlePrev();
      }
    }

    setIsDragging(false);
    setMouseStart(null);
    setMouseEnd(null);
  };

  return (
    <div className="fixed inset-0 z-50 m-0 flex items-center justify-center bg-[var(--foreground)]/25 px-4 backdrop-blur-sm">
      <div 
        className="relative w-[90%] max-w-lg overflow-hidden rounded-3xl border border-[var(--card-border)] bg-gradient-to-br from-[var(--background)] via-[var(--background-soft)] to-[var(--card)] p-8 shadow-[0_25px_90px_-45px_rgba(var(--accent-rgb),0.55)] cursor-grab active:cursor-grabbing"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" aria-hidden />

        <button
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card)]/80 text-[var(--foreground)]/70 shadow-sm transition hover:-translate-y-0.5 hover:text-[var(--foreground)]"
          onClick={() => setOpen(false)}
          aria-label="Close announcement"
        >
          ×
        </button>
        {item.title && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Latest Drop
          </div>
        )}

        {item.title && <h3 className="text-2xl font-semibold text-[var(--foreground)]">{item.title}</h3>}
        {item.content && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]/75">{item.content}</p>
        )}

        {(item.image_url || item.image_path) && (
          <div className="relative mt-5 w-full overflow-hidden rounded-md border border-[var(--card-border)] bg-[var(--card)] aspect-[4/3]">
            <Image
              src={item.image_url || item.image_path || ""}
              alt={item.title ?? "announcement"}
              fill
              className="object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--accent)]/15 via-transparent to-[var(--card)]/70" />
          </div>
        )}

        {item.button_link && (
          <a
            href={item.button_link}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(var(--accent-rgb),0.35)] transition hover:translate-y-[-2px] hover:shadow-[0_18px_40px_-22px_rgba(var(--accent-rgb),0.45)]"
            >
            {item.button_label ?? "Shop the edit"}
            <span aria-hidden className="text-base">→</span>
          </a>
        )}

        {hasMultiple && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--foreground)]/60">
            {items.map((announcement, index) => (
              <button
                key={announcement.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2 w-2 rounded-full transition ${
                  index === activeIndex ? "bg-[var(--accent)]" : "bg-[var(--card-border)]"
                }`}
                aria-label={`Go to announcement ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
