export type StoredBookingAddonRow = {
  extra_duration_min?: number | null;
  extra_price?: number | null;
  quantity?: number | null;
  line_gross_amount?: number | null;
  price_mode?: string | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  price_finalized?: boolean | null;
};

export function isAddonRangePending(row: StoredBookingAddonRow): boolean {
  const mode = String(row.price_mode ?? "").toLowerCase();
  const finalized = row.price_finalized === true;
  const unitPrice = Number(row.extra_price ?? 0);
  const lineTotal = Number(row.line_gross_amount ?? 0);
  return mode === "range" && !finalized && unitPrice <= 0 && lineTotal <= 0;
}

const ADDON_QTY_MIN = 1;

export function storedAddonQuantity(row: Pick<StoredBookingAddonRow, "quantity">): number {
  const qty = Number(row.quantity ?? ADDON_QTY_MIN);
  return Number.isFinite(qty) && qty >= ADDON_QTY_MIN ? Math.min(99, Math.floor(qty)) : ADDON_QTY_MIN;
}

export function storedAddonLinePrice(row: StoredBookingAddonRow): number {
  const lineGross = Number(row.line_gross_amount ?? NaN);
  if (Number.isFinite(lineGross) && lineGross >= 0) {
    return lineGross;
  }
  return Number(row.extra_price ?? 0) * storedAddonQuantity(row);
}

export function formatBookingAddonDurationText(row: StoredBookingAddonRow): string | null {
  const unitMinutes = Number(row.extra_duration_min ?? 0);
  if (unitMinutes <= 0) return null;
  const qty = storedAddonQuantity(row);
  const totalMinutes = unitMinutes * qty;
  return qty > 1 ? `+${unitMinutes} mins × ${qty} = ${totalMinutes} mins` : `+${unitMinutes} mins`;
}

export function formatBookingAddonPriceText(row: StoredBookingAddonRow, formatCurrency: (value: number) => string): string {
  const qty = storedAddonQuantity(row);

  if (isAddonRangePending(row)) {
    const rangeMin = Number(row.price_range_min ?? 0);
    const rangeMax = Number(row.price_range_max ?? 0);
    if (rangeMin > 0 || rangeMax > 0) {
      const min = Math.min(rangeMin, rangeMax);
      const max = Math.max(rangeMin, rangeMax);
      const base = min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
      return qty > 1 ? `${base} × ${qty}` : base;
    }
    return formatCurrency(0);
  }

  const lineTotal = storedAddonLinePrice(row);
  const unitPrice = Number(row.extra_price ?? 0);
  if (qty > 1) {
    return `${formatCurrency(unitPrice)} × ${qty} = ${formatCurrency(lineTotal)}`;
  }
  return formatCurrency(unitPrice);
}
