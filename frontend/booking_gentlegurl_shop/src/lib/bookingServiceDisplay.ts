import type { BookingRecord } from "@/lib/types";
import {
  formatBookingAddonDurationText,
  formatBookingAddonPriceText,
  isAddonRangePending,
  storedAddonLinePrice,
  storedAddonQuantity,
  type StoredBookingAddonRow,
} from "@/lib/bookingAddonDisplay";

export type BookingServiceBlock = {
  service_id?: number | null;
  name: string;
  cn_name?: string | null;
  amount?: number | null;
  price_mode?: string | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  price_finalized?: boolean | null;
  duration_min?: number | null;
  is_original?: boolean | null;
  add_ons?: Array<
    StoredBookingAddonRow & { id?: number | null; service_id?: number | null; name: string; cn_name?: string | null }
  >;
};

export type RangeDisplay = { text: string; isRangePending: boolean };

type AccumulatedTotals = {
  minTotal: number;
  maxTotal: number;
  hasPendingRange: boolean;
};

function formatRangeTotal(
  minTotal: number,
  maxTotal: number,
  hasPendingRange: boolean,
  formatMoney: (value: number) => string,
): RangeDisplay {
  if (!hasPendingRange) {
    return { text: formatMoney(minTotal), isRangePending: false };
  }
  if (minTotal === maxTotal) {
    return { text: formatMoney(minTotal), isRangePending: true };
  }
  return { text: `${formatMoney(minTotal)} – ${formatMoney(maxTotal)}`, isRangePending: true };
}

function isServiceBlockRangePending(block: BookingServiceBlock): boolean {
  const mode = String(block.price_mode ?? "fixed").toLowerCase();
  const finalized = block.price_finalized === true;
  const amount = Number(block.amount ?? 0);
  return mode === "range" && !finalized && amount <= 0;
}

function accumulateBlockAmount(
  block: BookingServiceBlock,
  minTotal: number,
  maxTotal: number,
  hasPendingRange: boolean,
): AccumulatedTotals {
  if (isServiceBlockRangePending(block)) {
    const rangeMin = Number(block.price_range_min ?? 0);
    const rangeMax = Number(block.price_range_max ?? 0);
    if (rangeMin > 0 || rangeMax > 0) {
      return {
        minTotal: minTotal + Math.min(rangeMin, rangeMax),
        maxTotal: maxTotal + Math.max(rangeMin, rangeMax),
        hasPendingRange: true,
      };
    }
    return { minTotal, maxTotal, hasPendingRange: true };
  }

  const amount = Number(block.amount ?? 0);
  return {
    minTotal: minTotal + amount,
    maxTotal: maxTotal + amount,
    hasPendingRange,
  };
}

function accumulateAddonAmount(
  addon: StoredBookingAddonRow,
  minTotal: number,
  maxTotal: number,
  hasPendingRange: boolean,
): AccumulatedTotals {
  const qty = storedAddonQuantity(addon);

  if (isAddonRangePending(addon)) {
    const rangeMin = Number(addon.price_range_min ?? 0);
    const rangeMax = Number(addon.price_range_max ?? 0);
    if (rangeMin > 0 || rangeMax > 0) {
      return {
        minTotal: minTotal + Math.min(rangeMin, rangeMax) * qty,
        maxTotal: maxTotal + Math.max(rangeMin, rangeMax) * qty,
        hasPendingRange: true,
      };
    }
    return { minTotal, maxTotal, hasPendingRange: true };
  }

  const lineTotal = storedAddonLinePrice(addon);
  return {
    minTotal: minTotal + lineTotal,
    maxTotal: maxTotal + lineTotal,
    hasPendingRange,
  };
}

function accumulateBookingTotals(booking: BookingRecord, includeAddons = true): AccumulatedTotals {
  let minTotal = 0;
  let maxTotal = 0;
  let hasPendingRange = false;

  for (const block of serviceBlocksForBooking(booking)) {
    const blockNext = accumulateBlockAmount(block, minTotal, maxTotal, hasPendingRange);
    minTotal = blockNext.minTotal;
    maxTotal = blockNext.maxTotal;
    hasPendingRange = blockNext.hasPendingRange;

    if (!includeAddons) continue;

    for (const addon of block.add_ons ?? []) {
      const addonNext = accumulateAddonAmount(addon, minTotal, maxTotal, hasPendingRange);
      minTotal = addonNext.minTotal;
      maxTotal = addonNext.maxTotal;
      hasPendingRange = addonNext.hasPendingRange;
    }
  }

  return { minTotal, maxTotal, hasPendingRange };
}

function accumulateMainServiceTotals(booking: BookingRecord): AccumulatedTotals {
  return accumulateBookingTotals(booking, false);
}

function accumulateAddonTotals(booking: BookingRecord): AccumulatedTotals {
  let minTotal = 0;
  let maxTotal = 0;
  let hasPendingRange = false;

  for (const block of serviceBlocksForBooking(booking)) {
    for (const addon of block.add_ons ?? []) {
      const addonNext = accumulateAddonAmount(addon, minTotal, maxTotal, hasPendingRange);
      minTotal = addonNext.minTotal;
      maxTotal = addonNext.maxTotal;
      hasPendingRange = addonNext.hasPendingRange;
    }
  }

  return { minTotal, maxTotal, hasPendingRange };
}

export function formatCurrency(value?: number | string | null) {
  return `RM ${Number(value ?? 0).toFixed(2)}`;
}

export function formatServicePrice(
  service: Pick<BookingServiceBlock, "amount" | "price_mode" | "price_range_min" | "price_range_max" | "price_finalized">,
  formatMoney: (value: number) => string = formatCurrency,
) {
  const mode = String(service.price_mode ?? "fixed").toLowerCase();
  const finalized = service.price_finalized === true;
  const amount = Number(service.amount ?? 0);
  const rangeMin = Number(service.price_range_min ?? 0);
  const rangeMax = Number(service.price_range_max ?? 0);

  if (mode === "range" && !finalized && amount <= 0) {
    if (rangeMin > 0 || rangeMax > 0) {
      return `${formatMoney(Math.min(rangeMin, rangeMax))} – ${formatMoney(Math.max(rangeMin, rangeMax))}`;
    }
    return formatMoney(0);
  }

  return formatMoney(amount);
}

export function bookingHasPendingRange(booking: BookingRecord): boolean {
  if (booking.has_pending_range_pricing) return true;

  return serviceBlocksForBooking(booking).some((block) => {
    if (isServiceBlockRangePending(block)) return true;
    return (block.add_ons ?? []).some((addon) => isAddonRangePending(addon));
  });
}

export function getBookingMainServiceTotalDisplay(
  booking: BookingRecord,
  formatMoney: (value: number) => string = formatCurrency,
): RangeDisplay {
  const totals = accumulateMainServiceTotals(booking);

  if (totals.hasPendingRange) {
    return formatRangeTotal(totals.minTotal, totals.maxTotal, true, formatMoney);
  }

  const fixedTotal = Number(booking.service_total ?? totals.minTotal);
  return { text: formatMoney(fixedTotal), isRangePending: false };
}

export function getBookingAddonTotalDisplay(
  booking: BookingRecord,
  formatMoney: (value: number) => string = formatCurrency,
): RangeDisplay {
  const totals = accumulateAddonTotals(booking);

  if (totals.hasPendingRange) {
    return formatRangeTotal(totals.minTotal, totals.maxTotal, true, formatMoney);
  }

  const fixedTotal = Number(booking.addon_total_price ?? totals.minTotal);
  return { text: formatMoney(fixedTotal), isRangePending: false };
}

/**
 * Combined services + add-ons total for list cards and overall balance context.
 */
export function getBookingServiceTotalDisplay(
  booking: BookingRecord,
  formatMoney: (value: number) => string = formatCurrency,
): RangeDisplay {
  const totals = accumulateBookingTotals(booking, true);

  if (totals.hasPendingRange) {
    return formatRangeTotal(totals.minTotal, totals.maxTotal, true, formatMoney);
  }

  const fixedTotal = Number(booking.service_total ?? 0) + Number(booking.addon_total_price ?? 0);
  return { text: formatMoney(fixedTotal || totals.minTotal), isRangePending: false };
}

export function getBookingBalanceDueDisplay(
  booking: BookingRecord,
  payment: {
    depositPaid: number;
    settlementPaid: number;
    packageOffset: number;
    balanceDue: number;
  },
  formatMoney: (value: number) => string = formatCurrency,
): RangeDisplay {
  const totals = accumulateBookingTotals(booking, true);

  if (!totals.hasPendingRange) {
    return { text: formatMoney(payment.balanceDue), isRangePending: false };
  }

  const packageCovered = getBookingPackageCoveredTotals(booking);
  const baseDeductions = payment.depositPaid + payment.settlementPaid;
  const minBalance = Math.max(0, totals.minTotal - baseDeductions - packageCovered.minTotal);
  const maxBalance = Math.max(0, totals.maxTotal - baseDeductions - packageCovered.maxTotal);

  return formatRangeTotal(minBalance, maxBalance, true, formatMoney);
}

export function getBookingPackageCoveredTotals(booking: BookingRecord): AccumulatedTotals {
  const claims = booking.package_claims ?? [];
  if (claims.length === 0) return { minTotal: 0, maxTotal: 0, hasPendingRange: false };

  const claimIds = new Set(claims.map((c) => Number(c.booking_service_id ?? 0)).filter((id) => id > 0));
  let minTotal = 0;
  let maxTotal = 0;
  let hasPendingRange = false;

  for (const block of serviceBlocksForBooking(booking)) {
    const id = Number(block.service_id ?? 0);
    if (id > 0 && claimIds.has(id)) {
      if (isServiceBlockRangePending(block)) {
        const rangeMin = Number(block.price_range_min ?? 0);
        const rangeMax = Number(block.price_range_max ?? 0);
        minTotal += Math.min(rangeMin, rangeMax);
        maxTotal += Math.max(rangeMin, rangeMax);
        hasPendingRange = true;
      } else {
        const amount = Number(block.amount ?? 0);
        minTotal += amount;
        maxTotal += amount;
      }
    }

    // Add-on claims: include covered add-ons too.
    for (const addon of block.add_ons ?? []) {
      const addonServiceId = Number((addon as { service_id?: number | null }).service_id ?? 0);
      if (!claimIds.has(addonServiceId)) continue;

      const addonQty = storedAddonQuantity(addon);
      if (isAddonRangePending(addon)) {
        const rangeMin = Number(addon.price_range_min ?? 0) * addonQty;
        const rangeMax = Number(addon.price_range_max ?? 0) * addonQty;
        minTotal += Math.min(rangeMin, rangeMax);
        maxTotal += Math.max(rangeMin, rangeMax);
        hasPendingRange = true;
      } else {
        const lineTotal = storedAddonLinePrice(addon);
        minTotal += lineTotal;
        maxTotal += lineTotal;
      }
    }
  }

  return { minTotal, maxTotal, hasPendingRange };
}

export function getBookingPackageCoveredDisplay(
  booking: BookingRecord,
  formatMoney: (value: number) => string = formatCurrency,
): RangeDisplay {
  const totals = getBookingPackageCoveredTotals(booking);
  if (!totals.hasPendingRange && totals.minTotal <= 0 && totals.maxTotal <= 0) {
    return { text: formatMoney(0), isRangePending: false };
  }

  if (totals.hasPendingRange) {
    return formatRangeTotal(totals.minTotal, totals.maxTotal, true, formatMoney);
  }

  return { text: formatMoney(totals.minTotal), isRangePending: false };
}

export function resolveBookingBalanceDueBounds(
  booking: BookingRecord,
  payment: {
    depositPaid: number;
    settlementPaid: number;
    balanceDue: number;
  },
): { min: number; max: number; hasRange: boolean } {
  const totals = accumulateBookingTotals(booking, true);
  const packageCovered = getBookingPackageCoveredTotals(booking);
  const baseDeductions = payment.depositPaid + payment.settlementPaid;

  if (!totals.hasPendingRange) {
    const due = Number(payment.balanceDue ?? 0);
    return { min: due, max: due, hasRange: false };
  }

  return {
    min: Math.max(0, totals.minTotal - baseDeductions - packageCovered.minTotal),
    max: Math.max(0, totals.maxTotal - baseDeductions - packageCovered.maxTotal),
    hasRange: true,
  };
}

export function resolveBookingPaymentStatus(
  booking: BookingRecord,
  payment: {
    depositPaid: number;
    settlementPaid: number;
    packageOffset: number;
    balanceDue: number;
  },
): "UNPAID" | "PARTIAL" | "PAID" {
  const balanceBounds = resolveBookingBalanceDueBounds(booking, payment);
  const fullySettled = balanceBounds.min <= 0.0001 && balanceBounds.max <= 0.0001;

  if (fullySettled) {
    return "PAID";
  }

  const hasPendingRange = bookingHasPendingRange(booking);
  if (hasPendingRange) {
    return "PARTIAL";
  }

  const totalPaid = Number(booking.total_paid ?? payment.depositPaid + payment.settlementPaid);
  const effectivePaid = totalPaid + payment.packageOffset;

  if (effectivePaid <= 0.0001) {
    return "UNPAID";
  }

  if (payment.balanceDue > 0.0001) {
    return "PARTIAL";
  }

  return "PAID";
}

export function serviceBlocksForBooking(booking: BookingRecord): BookingServiceBlock[] {
  if (booking.service_blocks?.length) {
    return booking.service_blocks;
  }

  return [{
    service_id: booking.service?.id ?? null,
    name: booking.service_name,
    cn_name: booking.service_cn_name ?? booking.service?.cn_name ?? null,
    amount: Number(booking.service_total ?? 0),
    duration_min: booking.service?.duration_min ?? null,
    is_original: true,
    add_ons: booking.add_ons ?? [],
  }];
}

export function serviceSummaryLabel(booking: BookingRecord) {
  const blocks = serviceBlocksForBooking(booking);
  if (blocks.length <= 1) {
    return blocks[0]?.name ?? booking.service_name;
  }
  return blocks.map((block) => block.name).filter(Boolean).join(" · ");
}

export function totalAddonCount(booking: BookingRecord) {
  return serviceBlocksForBooking(booking).reduce((sum, block) => sum + (block.add_ons?.length ?? 0), 0);
}

export {
  formatBookingAddonDurationText,
  formatBookingAddonPriceText,
};
