"use client";

import { useEffect } from "react";
import type { ServicePackage } from "@/lib/types";

function packageItemLabel(item: NonNullable<ServicePackage["items"]>[number]) {
  const name = item.booking_service?.name?.trim();
  return name && name.length > 0 ? name : `Service #${item.booking_service_id}`;
}

type ServicePackageDetailModalProps = {
  pkg: ServicePackage | null;
  onClose: () => void;
  onAddToCart: (pkg: ServicePackage) => Promise<boolean>;
};

export function ServicePackageDetailModal({ pkg, onClose, onAddToCart }: ServicePackageDetailModalProps) {
  const lines = pkg?.items?.filter((row) => row.quantity > 0) ?? [];

  useEffect(() => {
    if (!pkg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [pkg, onClose]);

  if (!pkg) return null;

  const validLabel = pkg.valid_days != null ? `${pkg.valid_days} days` : "—";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="package-modal-title">
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />

      <div className="relative flex max-h-[min(92vh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--card-border)] bg-[var(--card)] shadow-[0_24px_80px_-24px_rgba(17,24,39,0.45)] sm:rounded-3xl">
        <div className="relative shrink-0 px-5 pb-4 pt-5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--muted)]/40 hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Package</p>
          <h2 id="package-modal-title" className="mt-1 pr-10 text-xl font-semibold leading-tight text-[var(--foreground)] sm:text-2xl">
            {pkg.name}
          </h2>
          {pkg.description?.trim() ? (
            <p className="mt-2 max-w-prose pr-10 text-sm leading-relaxed text-[var(--text-muted)]">{pkg.description.trim()}</p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-[var(--card-border)]/70 bg-[var(--badge-background)]/55">
            <div className="border-b border-[var(--card-border)]/50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">What&apos;s included</p>
            </div>

            {lines.length > 0 ? (
              <ul className="divide-y divide-[var(--card-border)]/50">
                {lines.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 bg-[var(--card)]/40 px-4 py-3.5 text-sm">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]/30 text-[var(--accent-strong)]">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 4.5h12M3.75 6.75h.007v.008h-.007V6.75Zm0 5.25h.007v.008h-.007V12Zm0 4.5h.007v.008h-.007v-.008Z" />
                      </svg>
                    </span>
                    <p className="min-w-0 flex-1 font-medium text-[var(--foreground)]">{packageItemLabel(row)}</p>
                    <span className="shrink-0 tabular-nums text-sm font-semibold text-[var(--accent-strong)]">×{row.quantity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-b border-[var(--card-border)]/50 bg-[var(--card)]/40 px-4 py-4 text-sm text-[var(--text-muted)]">
                Included services are not listed for this package.
              </p>
            )}

            <div className="flex items-center gap-3 border-t border-b border-[var(--card-border)]/50 bg-[var(--card)]/40 px-4 py-3.5 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]/30 text-[var(--accent-strong)]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5a2.25 2.25 0 0 1 2.25 2.25v7.5" />
                </svg>
              </span>
              <span className="flex-1 font-medium text-[var(--foreground)]">Valid</span>
              <span className="shrink-0 tabular-nums text-sm font-semibold text-[var(--foreground)]">{validLabel}</span>
            </div>

            <div className="flex items-center justify-between gap-3 bg-[var(--card)]/55 px-4 py-4 text-sm">
              <span className="flex items-center gap-2 text-[var(--text-muted)]">
                <svg className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
                Total
              </span>
              <span className="text-lg font-semibold text-[var(--accent-strong)]">RM {pkg.selling_price}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--muted)]/40 bg-[var(--card)] px-5 py-4 sm:px-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--background)] px-5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/30 sm:w-auto sm:min-w-[7.5rem]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await onAddToCart(pkg);
                if (ok) onClose();
              }}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 text-sm font-semibold text-white shadow-md transition hover:bg-[var(--accent-stronger)] sm:w-auto sm:min-w-[10rem]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
