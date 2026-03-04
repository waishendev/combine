import Link from "next/link";

import type { HomepageFooter } from "@/lib/serverHomepage";

type SocialType = "instagram" | "facebook" | "tiktok";

function SocialIcon({ type, href }: { type: SocialType; href: string }) {
  const iconClass =
    type === "instagram"
      ? "fa-brands fa-instagram"
      : type === "facebook"
        ? "fa-brands fa-facebook-f"
        : "fa-brands fa-tiktok";

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--muted)] text-[var(--foreground)]/80 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
      aria-label={type}
    >
      <i className={iconClass} />
    </a>
  );
}

export function Footer({ footer }: { footer?: HomepageFooter | null }) {
  if (!footer || footer.enabled === false) return null;

  const year = new Date().getFullYear();

  const hasContact =
    !!footer.contact?.whatsapp || !!footer.contact?.email || !!footer.contact?.address;
  const hasSocial =
    !!footer.social?.instagram || !!footer.social?.facebook || !!footer.social?.tiktok;

  return (
    <footer className="border-t border-[var(--muted)] bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-[1200px] px-4 pt-14 pb-10 md:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]/70">
              About
            </h3>
            <p className="mt-4 max-w-md text-sm leading-7 text-[var(--foreground)]/75">
              {footer.about_text ?? "Premium salon experiences with trusted stylists."}
            </p>
          </div>

          <div className="md:col-span-4">
            <h3 className="text-sm font-semibold tracking-wide text-[var(--foreground)]">Helpful Links</h3>
            <ul className="mt-4 space-y-3 text-sm text-[var(--foreground)]/75">
              <li>
                <Link className="transition hover:text-[var(--accent-strong)]" href={footer.links?.shipping_policy ?? "/shipping-policy"}>
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[var(--accent-strong)]" href={footer.links?.return_refund ?? "/return-refund"}>
                  Return &amp; Refund
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[var(--accent-strong)]" href={footer.links?.privacy ?? "/privacy-policy"}>
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-sm font-semibold tracking-wide text-[var(--foreground)]">Follow Us</h3>

            {hasSocial ? (
              <div className="mt-4 flex gap-3">
                {footer.social?.instagram && <SocialIcon type="instagram" href={footer.social.instagram} />}
                {footer.social?.facebook && <SocialIcon type="facebook" href={footer.social.facebook} />}
                {footer.social?.tiktok && <SocialIcon type="tiktok" href={footer.social.tiktok} />}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--foreground)]/60">Coming soon.</p>
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

        <div className="mt-12 border-t border-[var(--muted)] py-5">
          <div className="flex flex-col gap-2 text-center text-xs text-[var(--foreground)]/65 md:flex-row md:items-center md:justify-between md:text-left">
            <p>© {year} Gentlegurl. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
