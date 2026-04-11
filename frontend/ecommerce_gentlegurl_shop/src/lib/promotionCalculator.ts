// Promotion calculation utility based on backend POS logic

export type PromotionTier = {
  min_qty?: number | null;
  min_amount?: number | null;
  discount_type: 'bundle_fixed_price' | 'percentage_discount' | 'fixed_discount';
  discount_value: number;
};

export type Promotion = {
  id: number;
  name?: string | null;
  title?: string | null;
  is_active: boolean;
  trigger_type: 'quantity' | 'amount';
  promotion_products?: Array<{ product_id: number }>;
  promotion_tiers?: PromotionTier[];
};

export type CartItemForPromotion = {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type PromotionResult = {
  promotion_id: number;
  promotion_name: string;
  promotion_type: string;
  discount_amount: number;
  summary: string;
  applied: boolean;
};

/**
 * Calculate promotion discounts for cart items
 * Based on backend POS logic in PosController::resolvePosCartPricing
 */
export function calculatePromotionDiscounts(
  cartItems: CartItemForPromotion[],
  promotions: Promotion[]
): {
  totalDiscount: number;
  promotionResults: PromotionResult[];
  itemDiscounts: Record<number, number>;
} {
  const itemDiscounts: Record<number, number> = {};
  const promotionResults: PromotionResult[] = [];
  let totalDiscount = 0;

  // Filter active promotions that have products
  const activePromotions = promotions.filter(
    (promo) =>
      promo.is_active &&
      promo.promotion_products &&
      promo.promotion_products.length > 0 &&
      promo.promotion_tiers &&
      promo.promotion_tiers.length > 0
  );

  for (const promotion of activePromotions) {
    // Handle both snake_case (from API) and camelCase formats
    const promotionProducts = promotion.promotion_products || (promotion as any).promotionProducts || [];
    const promotionTiers = promotion.promotion_tiers || (promotion as any).promotionTiers || [];
    
    const productIds = promotionProducts.map((pp: any) => pp.product_id || pp.productId);
    
    // Find eligible items (items whose product_id is in the promotion's product list)
    const eligibleItems: Array<{ item: CartItemForPromotion; qty: number }> = [];
    for (const cartItem of cartItems) {
      if (productIds.includes(cartItem.product_id)) {
        eligibleItems.push({ item: cartItem, qty: cartItem.quantity });
      }
    }

    if (eligibleItems.length === 0) continue;

    // Calculate total quantity or amount
    const totalQty = eligibleItems.reduce((sum, e) => sum + e.qty, 0);
    const totalAmount = eligibleItems.reduce(
      (sum, e) => sum + e.item.line_total,
      0
    );

    // Find the best matching tier
    let applicableTier: PromotionTier | null = null;
    for (const tier of promotionTiers) {
      const meetsRequirement =
        promotion.trigger_type === 'amount'
          ? totalAmount >= (tier.min_amount ?? 0)
          : totalQty >= (tier.min_qty ?? 0);

      if (meetsRequirement) {
        if (!applicableTier) {
          applicableTier = tier;
        } else {
          // Choose the tier with higher requirement (better discount)
          const tierRequirement =
            promotion.trigger_type === 'amount'
              ? tier.min_amount ?? 0
              : tier.min_qty ?? 0;
          const applicableRequirement =
            promotion.trigger_type === 'amount'
              ? applicableTier.min_amount ?? 0
              : applicableTier.min_qty ?? 0;

          if (tierRequirement > applicableRequirement) {
            applicableTier = tier;
          }
        }
      }
    }

    if (!applicableTier) continue;

    // For quantity-based promotions, select items up to the threshold
    // For amount-based, use all eligible items
    let selectedItems = eligibleItems;
    if (promotion.trigger_type === 'quantity') {
      const requiredQty = applicableTier.min_qty ?? 0;
      if (totalQty < requiredQty) continue;

      // Select items up to the threshold (sorted by price descending, like backend)
      const sorted = [...eligibleItems].sort(
        (a, b) => b.item.unit_price - a.item.unit_price
      );
      let remaining = requiredQty;
      selectedItems = [];
      for (const entry of sorted) {
        if (remaining <= 0) break;
        const use = Math.min(remaining, entry.qty);
        selectedItems.push({ item: entry.item, qty: use });
        remaining -= use;
      }

      if (remaining > 0) continue; // Can't form complete set
    }

    // Calculate discount based on selected items
    const selectedSubtotal = selectedItems.reduce(
      (sum, e) => sum + e.item.unit_price * e.qty,
      0
    );

    let discount = 0;
    if (applicableTier.discount_type === 'bundle_fixed_price') {
      discount = Math.max(0, selectedSubtotal - applicableTier.discount_value);
    } else if (applicableTier.discount_type === 'percentage_discount') {
      discount = Math.max(0, selectedSubtotal * (applicableTier.discount_value / 100));
    } else if (applicableTier.discount_type === 'fixed_discount') {
      discount = Math.max(0, Math.min(selectedSubtotal, applicableTier.discount_value));
    }

    if (discount <= 0) continue;

    // Distribute discount proportionally across selected items
    for (const { item, qty } of selectedItems) {
      const portionBase = item.unit_price * qty;
      const portion = selectedSubtotal > 0 ? (portionBase / selectedSubtotal) * discount : 0;
      itemDiscounts[item.id] = (itemDiscounts[item.id] || 0) + portion;
    }

    totalDiscount += discount;

    // Create summary text
    const summary =
      promotion.trigger_type === 'quantity'
        ? `${applicableTier.min_qty ?? 0} items`
        : `RM ${(applicableTier.min_amount ?? 0).toFixed(2)}`;

    promotionResults.push({
      promotion_id: promotion.id,
      promotion_name: promotion.name || promotion.title || 'Promotion',
      promotion_type: applicableTier.discount_type,
      discount_amount: discount,
      summary: `${summary} - ${applicableTier.discount_type}`,
      applied: true,
    });
  }

  return {
    totalDiscount,
    promotionResults,
    itemDiscounts,
  };
}
