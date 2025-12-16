import Link from "next/link";

import type { HomepageFooter } from "@/lib/server/getHomepage";

function SocialIcon({
  type,
  href,
}: {
  type: "instagram" | "facebook" | "tiktok";
  href: string;
}) {
  const icons: Record<string, JSX.Element> = {
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

export function ShopFooter({ footer }: { footer?: HomepageFooter | null }) {
  if (!footer || footer.enabled === false) {
    return null;
  }

  const hasContact =
    !!footer.contact?.whatsapp ||
    !!footer.contact?.email ||
    !!footer.contact?.address;

  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-14 md:flex-row md:justify-between">
        <div className="max-w-md space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--accent-strong)]">
              Gentlegurl Shop
            </h2>
            {footer.about_text && (
              <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]/80">
                {footer.about_text}
              </p>
            )}
          </div>

          {hasContact && (
            <div className="space-y-2 text-sm text-[var(--foreground)]/80">
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

        <div className="grid flex-1 grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-3">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Customer Care</h3>
            <ul className="space-y-2 text-sm text-[var(--foreground)]/80">
              <li>
                <Link className="hover:text-[var(--accent-strong)]" href={footer.links?.shipping_policy ?? "/shipping-policy"}>
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link className="hover:text-[var(--accent-strong)]" href={footer.links?.return_refund ?? "/return-refund"}>
                  Return &amp; Refund
                </Link>
              </li>
              <li>
                <Link className="hover:text-[var(--accent-strong)]" href={footer.links?.privacy ?? "/privacy-policy"}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link className="hover:text-[var(--accent-strong)]" href={footer.links?.terms ?? "/terms"}>
                  Terms
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Follow Us</h3>
            <div className="flex gap-3">
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
            <p className="text-xs text-[var(--foreground)]/60">
              Stay close to our pink universe.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl bg-white/70 p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Payment</h3>
            <div className="space-y-2 text-sm text-[var(--foreground)]/80">
              <div className="flex items-center gap-2 rounded-full bg-[var(--muted)] px-3 py-1 text-[var(--foreground)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                Billplz FPX
              </div>
              <div className="flex items-center gap-2 rounded-full bg-[var(--muted)] px-3 py-1 text-[var(--foreground)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                Manual Transfer
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-pink-100 bg-[var(--background-soft)]/60 py-4 text-center text-xs text-[var(--foreground)]/70">
        © {year} Gentlegurl Shop. All rights reserved.
      </div>
    </footer>
  );
}
