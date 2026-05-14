import { Fragment, type ReactNode } from "react";

/** Line that is only `mobile` (optional spaces) splits desktop vs phone copy. Case-insensitive. */
const HERO_VIEWPORT_SPLIT = /\r?\n[ \t]*mobile[ \t]*\r?\n/i;

/**
 * Split CRM hero/slide text: above a line containing only `mobile` = tablet/desktop;
 * below = phones (under Tailwind `sm`, 640px). If omitted, both viewports use the full string.
 */
export function splitHeroViewportCopy(raw: string): { desktop: string; mobile: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  const m = normalized.match(HERO_VIEWPORT_SPLIT);
  if (!m || m.index === undefined) {
    return { desktop: normalized, mobile: normalized };
  }
  const desktop = normalized.slice(0, m.index).trimEnd();
  const mobile = normalized.slice(m.index + m[0].length).trim();
  if (!mobile) {
    return { desktop: normalized, mobile: normalized };
  }
  if (!desktop) {
    return { desktop: mobile, mobile };
  }
  return { desktop, mobile };
}

/**
 * Renders hero / slide copy from the CRM: newline = line break; `**text**` = bold.
 * (Intentionally limited markup — no HTML.)
 */
function splitBoldSegments(line: string): ReactNode[] {
  const parts = line.split("**");
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-bold">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

type HeroRichTextProps = {
  text: string;
  className?: string;
  id?: string;
};

export function HeroRichText({ text, className, id }: HeroRichTextProps) {
  const lines = text.split("\n");
  return (
    <p id={id} className={className}>
      {lines.map((line, idx) => (
        <Fragment key={idx}>
          {idx > 0 ? <br /> : null}
          {splitBoldSegments(line)}
        </Fragment>
      ))}
    </p>
  );
}

type HeroViewportRichTextProps = {
  raw: string;
  className?: string;
};

/**
 * Same as {@link HeroRichText}, but if the string contains a line that is only `mobile`,
 * the part above is shown from `sm` up; the part below on smaller screens only (CSS).
 */
export function HeroViewportRichText({ raw, className }: HeroViewportRichTextProps) {
  const { desktop, mobile } = splitHeroViewportCopy(raw);
  if (desktop === mobile) {
    return <HeroRichText text={desktop} className={className} />;
  }
  return (
    <>
      <div className="hidden sm:block">
        <HeroRichText text={desktop} className={className} />
      </div>
      <div className="block sm:hidden">
        <HeroRichText text={mobile} className={className} />
      </div>
    </>
  );
}
