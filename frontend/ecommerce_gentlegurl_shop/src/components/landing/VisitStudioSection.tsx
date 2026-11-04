"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  buildWhatsAppUrl,
  resolveVisitStudioWhatsAppMessage,
  resolveVisitStudioWhatsAppPhone,
} from "@/lib/whatsapp";
import type {
  LandingVisitStudio,
  LandingVisitStudioHoursRow,
  LandingVisitStudioLocation,
} from "@/lib/types/landingVisitStudio";

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

function normalizeVisitStudioLocation(
  raw: unknown,
  index: number,
): LandingVisitStudioLocation {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const studioName = String(o.studio_name ?? "").trim();
  return {
    is_active: o.is_active === false ? false : true,
    tab_label: String(o.tab_label ?? "").trim() || studioName || `Location ${index + 1}`,
    studio_name: studioName,
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
}

export function resolveVisitStudioLocations(studio: LandingVisitStudio): LandingVisitStudioLocation[] {
  const raw =
    Array.isArray(studio.locations) && studio.locations.length > 0
      ? studio.locations.map((item, index) => normalizeVisitStudioLocation(item, index))
      : [normalizeVisitStudioLocation(studio, 0)];

  return raw
    .filter((location) => location.is_active !== false)
    .filter((location) => visitStudioLocationHasContent(location));
}

export function visitStudioLocationHasContent(location: LandingVisitStudioLocation): boolean {
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

export function visitStudioHasContent(studio: LandingVisitStudio): boolean {
  return resolveVisitStudioLocations(studio).length > 0;
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
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {row.time_range}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {footerLines.length > 0 ? (
            <div className="mt-auto space-y-2 pt-8 text-[10px] font-medium uppercase leading-relaxed tracking-[0.12em] text-[var(--text-muted)]">
              {footerLines.map((line, idx) => (
                <p key={idx} className="break-words">
                  {line}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function VisitStudioSection({ studio }: { studio: LandingVisitStudio }) {
  const locations = resolveVisitStudioLocations(studio);
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

  if (!studio.is_active || locations.length === 0) {
    return null;
  }

  const headingTitle = studio.heading?.title?.trim() || "Visit Our Studio";

  const goTo = (index: number) => {
    setActiveIndex(Math.min(Math.max(index, 0), locations.length - 1));
    setDragX(0);
    setDragging(false);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!multi) return;
    suppressClickRef.current = false;
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
        {studio.heading?.label ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">
            {studio.heading.label}
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
        <div
          className="w-full will-change-transform"
          style={{
            transform: `translate3d(calc(${-safeIndex * 100}% + ${dragX}px), 0, 0)`,
            transition: dragging ? "none" : "transform 280ms ease",
            WebkitUserSelect: dragging ? "none" : undefined,
            userSelect: dragging ? "none" : undefined,
          }}
        >
          <div className="flex" style={multi ? { width: `${locations.length * 100}%` } : undefined}>
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
