export type StoredBookingAddonRow = {
  extra_duration_min?: number | null;
  extra_price?: number | null;
  quantity?: number | null;
  line_gross_amount?: number | null;
};

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
  const lineTotal = storedAddonLinePrice(row);
  const unitPrice = Number(row.extra_price ?? 0);
  if (qty > 1) {
    return `${formatCurrency(unitPrice)} × ${qty} = ${formatCurrency(lineTotal)}`;
  }
  return formatCurrency(unitPrice);
}
