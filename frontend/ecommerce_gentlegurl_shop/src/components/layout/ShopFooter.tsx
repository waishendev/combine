import Link from "next/link";
import { ReactElement } from "react";
import Image from "next/image";

import type { HomepageFooter } from "@/lib/server/getHomepage";

function SocialIcon({
  type,
  href,
}: {
  type: "instagram" | "facebook" | "tiktok";
  href: string;
}) {
  const icons: Record<string, ReactElement> = {
    instagram: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1" />
      </svg>
    ),
    facebook: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="currentColor"
      >
        <path d="M13 10h2.5l.5-3H13V5.5c0-.9.3-1.5 1.6-1.5H16V1.2C15.4 1.1 14.3 1 13 1c-2.8 0-4.5 1.7-4.5 4.7V7H6v3h2.5v9h4.5z" />
      </svg>
    ),
    tiktok: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="currentColor"
      >
        <path d="M17.5 7.3c-.9-.6-1.5-1.5-1.6-2.6V3h-2.9v11a2.2 2.2 0 1 1-2.2-2.2c.2 0 .5 0 .7.1V8c-3.2-.3-5.2 1.8-5.2 4.5A5.5 5.5 0 0 0 17.3 16v-5.5c.7.6 1.5 1 2.4 1.2V9c-.6-.1-1.4-.4-2.2-.9z" />
      </svg>
    ),
  };

  return (
    <Link
      href={href}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[var(--accent-strong)] shadow-sm transition hover:-translate-y-0.5 hover:shadow"
      aria-label={type}
      target="_blank"
      rel="noreferrer"
    >
      {icons[type]}
    </Link>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--muted)] bg-white/70 px-3 py-1 text-xs text-[var(--foreground)]/80 shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
      {children}
    </span>
  );
}

export function ShopFooter({ footer }: { footer?: HomepageFooter | null }) {
  if (!footer || footer.enabled === false) return null;

  const year = new Date().getFullYear();

  const hasContact =
    !!footer.contact?.whatsapp ||
    !!footer.contact?.email ||
    !!footer.contact?.address;

  const hasSocial =
    !!footer.social?.instagram || !!footer.social?.facebook || !!footer.social?.tiktok;

  // ✅ Payment 作为低调信任信息：可选显示（你要关掉也很简单）
  const showPaymentBadges = true;

  return (
    <footer className="bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-6xl px-6 pt-14">
        {/* Top */}
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-4">
                  {/* Logo - Mobile */}
            <Link href="/" className="flex items-center">
              <Image
                src="/images/logo.png"
                alt="Gentlegurl Shop"
                width={120}
                height={40}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>

            {footer.about_text ? (
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--foreground)]/80">
                {footer.about_text}
              </p>
            ) : (
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--foreground)]/70">
                Curated beauty & lifestyle picks — soft, minimal, and made to feel good.
              </p>
            )}

            {showPaymentBadges && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge>Billplz FPX</Badge>
                <Badge>Manual Transfer</Badge>
              </div>
            )}
          </div>

          {/* Links */}
          <div className="md:col-span-5">
            <h3 className="text-sm font-semibold tracking-wide text-[var(--foreground)]">
              Customer Care
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-[var(--foreground)]/80">
              <li>
                <Link
                  className="transition hover:text-[var(--accent-strong)]"
                  href={footer.links?.shipping_policy ?? "/shipping-policy"}
                >
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link
                  className="transition hover:text-[var(--accent-strong)]"
                  href={footer.links?.return_refund ?? "/return-refund"}
                >
                  Return &amp; Refund
                </Link>
              </li>
              <li>
                <Link
                  className="transition hover:text-[var(--accent-strong)]"
                  href={footer.links?.privacy ?? "/privacy-policy"}
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Social + Contact */}
          <div className="md:col-span-3">
            <h3 className="text-sm font-semibold tracking-wide text-[var(--foreground)]">
              Follow Us
            </h3>

            {hasSocial ? (
              <div className="mt-4 flex gap-3">
                {footer.social?.instagram && (
                  <SocialIcon type="instagram" href={footer.social.instagram} />
                )}
                {footer.social?.facebook && (
                  <SocialIcon type="facebook" href={footer.social.facebook} />
                )}
                {footer.social?.tiktok && (
                  <SocialIcon type="tiktok" href={footer.social.tiktok} />
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--foreground)]/60">
                Coming soon.
              </p>
            )}


            {hasContact && (
              <div className="mt-6 space-y-2 text-sm text-[var(--foreground)]/75">
                {footer.contact?.whatsapp && (
                  <p className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                    {footer.contact.whatsapp}
                  </p>
                )}
                {footer.contact?.email && (
                  <p className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                    {footer.contact.email}
                  </p>
                )}
                {footer.contact?.address && (
                  <p className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <span>{footer.contact.address}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 border-t border-[var(--muted)] py-5">
          <div className="flex flex-col gap-2 text-center text-xs text-[var(--foreground)]/65 md:flex-row md:items-center md:justify-between md:text-left">
            <p>© {year} Gentlegurl. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
