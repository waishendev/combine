import Link from "next/link";

import type { EcommerceLandingHero } from "@/lib/types/ecommerceLanding";

function renderRichText(raw: string): React.ReactNode[] {
  const lines = raw.split("\n");
  return lines.map((line, idx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <span key={idx}>
        {idx > 0 ? <br /> : null}
        {parts.map((part, partIdx) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
          }
          return <span key={partIdx}>{part}</span>;
        })}
      </span>
    );
  });
}

export default function EcommerceLandingHero({ hero }: { hero: EcommerceLandingHero }) {
  if (!hero.is_active) return null;

  const labelText = hero.label?.trim() ?? "";
  const primaryTitle = hero.title?.trim();
  const title2 = hero.title_2?.trim();
  const subtitle2 = hero.subtitle_2?.trim();
  const smallEyebrow = primaryTitle && labelText ? labelText : "";
  const useLabelAsHeadline = !primaryTitle && Boolean(labelText);
  const mainHeading =
    primaryTitle ||
    (useLabelAsHeadline ? labelText : "") ||
    (!primaryTitle && !labelText && title2 ? title2 : "");
  const subHeading = primaryTitle && title2 ? title2 : null;

  const hasContent =
    mainHeading ||
    hero.subtitle?.trim() ||
    subHeading ||
    subtitle2 ||
    (hero.cta_label?.trim() && hero.cta_link?.trim());

  if (!hasContent) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-2 pt-6 text-center sm:pt-8">
      {smallEyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
          {smallEyebrow}
        </p>
      ) : null}

      {mainHeading ? (
        <h2 className="text-2xl font-semibold leading-snug tracking-tight text-[var(--foreground)] sm:text-3xl">
          {mainHeading}
        </h2>
      ) : null}

      {hero.subtitle?.trim() ? (
        <div className="text-sm leading-relaxed text-[var(--foreground)]/80 sm:text-base">
          {renderRichText(hero.subtitle.trim())}
        </div>
      ) : null}

      {subHeading ? (
        <h3 className="text-2xl font-semibold leading-snug tracking-tight text-[var(--foreground)] sm:text-3xl">
          {subHeading}
        </h3>
      ) : null}

      {subtitle2 ? (
        <div className="text-sm leading-relaxed text-[var(--foreground)]/80 sm:text-base">
          {renderRichText(subtitle2)}
        </div>
      ) : null}

      {hero.cta_label?.trim() && hero.cta_link?.trim() ? (
        <div className="pt-2">
          <Link
            href={hero.cta_link.trim()}
            className="inline-flex items-center justify-center rounded-full bg-[var(--foreground)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {hero.cta_label.trim()}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
