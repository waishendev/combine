"use client";

import type { BookingRecord } from "@/lib/types";
import { isAddonRangePending } from "@/lib/bookingAddonDisplay";
import {
  formatBookingAddonDurationText,
  formatBookingAddonPriceText,
  formatCurrency,
  formatServicePrice,
  serviceBlocksForBooking,
  type BookingServiceBlock,
} from "@/lib/bookingServiceDisplay";

function ServiceNameStack({ name, cnName }: { name: string; cnName?: string | null }) {
  return (
    <>
      <p className="font-semibold text-[var(--foreground)]">{name}</p>
      {cnName ? <p className="mt-0.5 text-sm text-[var(--text-muted)]">{cnName}</p> : null}
    </>
  );
}

type PackageClaim = NonNullable<BookingRecord["package_claims"]>[number];

function ServiceBlockCard({
  block,
  compact = false,
  packageName,
  packageClaims,
}: {
  block: BookingServiceBlock;
  compact?: boolean;
  packageName?: string | null;
  packageClaims?: PackageClaim[];
}) {
  const addOns = block.add_ons ?? [];
  const priceText = formatServicePrice(block, formatCurrency);
  const isRangePending = String(block.price_mode ?? "").toLowerCase() === "range" && block.price_finalized === false;
  const isPackageCovered = Boolean(packageName);
  const claims = packageClaims ?? [];

  return (
    <div className={`rounded-xl border border-[var(--card-border)] bg-[var(--card)] ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ServiceNameStack name={block.name} cnName={block.cn_name} />
            {block.is_original ? (
              <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Original
              </span>
            ) : null}
            {isPackageCovered ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                [PKG] {packageName}
              </span>
            ) : null}
          </div>
          {!compact && Number(block.duration_min ?? 0) > 0 ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">{block.duration_min} mins</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-semibold tabular-nums ${isRangePending ? "text-amber-700" : "text-[var(--foreground)]"}`}>
            {priceText}
          </p>
        </div>
      </div>

      {addOns.length > 0 ? (
        <div className={`${compact ? "mt-2" : "mt-3"} space-y-2 border-t border-[var(--card-border)] pt-3`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Add-ons</p>
          {addOns.map((addon, index) => {
            const durationText = formatBookingAddonDurationText(addon);
            const priceText = formatBookingAddonPriceText(addon, formatCurrency);
            const addonRangePending = isAddonRangePending(addon);
            const qty = Number(addon.quantity ?? 1);
            const addonClaim = claims.find((c) => c.booking_service_id === Number((addon as { service_id?: number | null }).service_id ?? 0));
            return (
              <div
                key={`${addon.id ?? addon.name}-${index}`}
                className="flex items-start justify-between gap-3 rounded-lg bg-[var(--background)]/30 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[var(--foreground)]">{addon.name}</p>
                    {addonClaim ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        [PKG] {addonClaim.package_name}
                      </span>
                    ) : null}
                    {qty > 1 ? (
                      <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                        × {qty}
                      </span>
                    ) : null}
                  </div>
                  {addon.cn_name ? <p className="mt-0.5 text-xs text-[var(--text-muted)]">{addon.cn_name}</p> : null}
                  {durationText ? <p className="mt-1 text-xs text-[var(--text-muted)]">{durationText}</p> : null}
                </div>
                {priceText ? (
                  <p className={`shrink-0 text-right text-xs font-medium tabular-nums ${addonRangePending ? "text-amber-700" : "text-[var(--text-muted)]"}`}>{priceText}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type BookingServiceBlocksSectionProps = {
  booking: BookingRecord;
  compact?: boolean;
  className?: string;
};

export default function BookingServiceBlocksSection({
  booking,
  compact = false,
  className,
}: BookingServiceBlocksSectionProps) {
  const blocks = serviceBlocksForBooking(booking);
  const multiService = blocks.length > 1;
  const packageClaims = booking.package_claims ?? [];

  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {multiService ? "Services" : "Service"}
        </p>
        {multiService ? (
          <span className="rounded-full bg-[var(--background)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
            {blocks.length} services
          </span>
        ) : null}
      </div>
      <div className={multiService ? "space-y-3" : ""}>
        {blocks.map((block, index) => {
          const claim = (booking.package_claims ?? []).find(
            (c) => c.booking_service_id === block.service_id,
          );
          return (
            <ServiceBlockCard
              key={`${block.service_id ?? block.name}-${index}`}
              block={block}
              compact={compact}
              packageName={claim?.package_name ?? null}
              packageClaims={packageClaims}
            />
          );
        })}
      </div>
    </section>
  );
}
