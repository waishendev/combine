import { PublicPromotion } from "@/lib/apiClient";

type PromotionCartItem = {
  product_id: number;
  quantity: number;
  unit_price: number | string;
};

export type BundlePromotionEstimate = {
  promotionId: number;
  promotionName: string;
  matchedTierQty: number;
  matchedTierPrice: number;
  selectedQty: number;
  remainingQtyChargedNormal: number;
  selectedSubtotal: number;
  discountAmount: number;
};

export function calculateBestBundlePromotionEstimate(
  promotions: PublicPromotion[],
  items: PromotionCartItem[],
): BundlePromotionEstimate | null {
  let best: BundlePromotionEstimate | null = null;

  for (const promotion of promotions) {
    const productIds = new Set((promotion.promotion_products ?? []).map((entry) => Number(entry.product_id)));
    if (productIds.size === 0) continue;

    const eligibleItems = items
      .filter((item) => productIds.has(Number(item.product_id)) && Number(item.quantity) > 0)
      .map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
      }))
      .filter((item) => Number.isFinite(item.unitPrice) && item.unitPrice > 0);

    if (eligibleItems.length === 0) continue;

    const totalQty = eligibleItems.reduce((sum, item) => sum + item.quantity, 0);

    const tiers = (promotion.promotion_tiers ?? [])
      .map((tier) => ({
        minQty: Number(tier.min_qty ?? 0),
        discountType: tier.discount_type ?? null,
        discountValue: Number(tier.discount_value ?? 0),
      }))
      .filter((tier) => tier.minQty > 0 && tier.discountType === "bundle_fixed_price" && tier.discountValue > 0)
      .sort((a, b) => b.minQty - a.minQty);

    const matchedTier = tiers.find((tier) => totalQty >= tier.minQty);
    if (!matchedTier) continue;

    let remaining = matchedTier.minQty;
    const selected = [...eligibleItems].sort((a, b) => b.unitPrice - a.unitPrice);
    let selectedSubtotal = 0;

    for (const item of selected) {
      if (remaining <= 0) break;
      const useQty = Math.min(item.quantity, remaining);
      selectedSubtotal += useQty * item.unitPrice;
      remaining -= useQty;
    }

    if (remaining > 0) continue;

    const discountAmount = Math.max(0, selectedSubtotal - matchedTier.discountValue);
    if (discountAmount <= 0) continue;

    const estimate: BundlePromotionEstimate = {
      promotionId: Number(promotion.id),
      promotionName: promotion.name || promotion.title || "Promotion",
      matchedTierQty: matchedTier.minQty,
      matchedTierPrice: matchedTier.discountValue,
      selectedQty: matchedTier.minQty,
      remainingQtyChargedNormal: Math.max(0, totalQty - matchedTier.minQty),
      selectedSubtotal,
      discountAmount,
    };

    if (!best || estimate.discountAmount > best.discountAmount) {
      best = estimate;
    }
  }

  return best;
}
