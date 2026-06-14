import Link from "next/link";

import {
  buildWhatsAppUrl,
  resolveVisitStudioWhatsAppMessage,
  resolveVisitStudioWhatsAppPhone,
} from "@/lib/whatsapp";
import type { LandingVisitStudio, LandingVisitStudioHoursRow } from "@/lib/types/landingVisitStudio";

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

export function visitStudioHasContent(studio: LandingVisitStudio): boolean {
  const hoursRows = normalizeVisitStudioHours(studio.opening_hours);
  const footerLines = getVisitStudioFooterLines(studio);

  return Boolean(
    studio.studio_name?.trim() ||
      studio.address?.trim() ||
      hoursRows.length > 0 ||
      studio.google_maps_url?.trim() ||
      studio.waze_url?.trim() ||
      resolveVisitStudioWhatsAppPhone(studio).trim() ||
      footerLines.length > 0,
  );
}

export default function VisitStudioSection({ studio }: { studio: LandingVisitStudio }) {
  const hoursRows = normalizeVisitStudioHours(studio.opening_hours);
  const footerLines = getVisitStudioFooterLines(studio);

  if (!studio.is_active || !visitStudioHasContent(studio)) {
    return null;
  }

  const contactCol =
    studio.column_order === "hours_left" ? "order-2 lg:order-2" : "order-1 lg:order-1";
  const hoursCol =
    studio.column_order === "hours_left" ? "order-1 lg:order-1" : "order-2 lg:order-2";

  const headingTitle = studio.heading?.title?.trim() || "Visit Our Studio";
  const openingTitle = studio.opening_hours_heading?.trim() || "Opening Hours";
  const whatsappPhone = resolveVisitStudioWhatsAppPhone(studio);
  const whatsappMessage = resolveVisitStudioWhatsAppMessage(studio);
  const whatsappUrl = buildWhatsAppUrl(whatsappPhone, whatsappMessage);

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
            <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-muted)]">
              {studio.address.trim()}
            </p>
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

          {whatsappUrl ? (
            <Link
              href={whatsappUrl}
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
                  <div
                    key={idx}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0"
                  >
                    <span className="text-sm text-[var(--foreground)]/85">{row.day_range}</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {row.time_range}
                    </span>
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
