import type { BookingRecord } from "@/lib/types";
import {
  formatBookingAddonDurationText,
  formatBookingAddonPriceText,
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
  add_ons?: Array<StoredBookingAddonRow & { id?: number | null; name: string; cn_name?: string | null }>;
};

export function formatCurrency(value?: number | string | null) {
  return `RM ${Number(value ?? 0).toFixed(2)}`;
}

export function formatServicePrice(
  service: Pick<BookingServiceBlock, "amount" | "price_mode" | "price_range_min" | "price_range_max" | "price_finalized">,
  formatMoney: (value: number) => string = formatCurrency,
) {
  const mode = String(service.price_mode ?? "fixed").toLowerCase();
  const finalized = service.price_finalized !== false;
  const amount = Number(service.amount ?? 0);
  const rangeMin = Number(service.price_range_min ?? 0);
  const rangeMax = Number(service.price_range_max ?? 0);

  if (mode === "range" && !finalized && amount <= 0) {
    if (rangeMin > 0 || rangeMax > 0) {
      return `${formatMoney(Math.min(rangeMin, rangeMax))} – ${formatMoney(Math.max(rangeMin, rangeMax))}`;
    }
    return "Price on consultation";
  }

  return formatMoney(amount);
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
