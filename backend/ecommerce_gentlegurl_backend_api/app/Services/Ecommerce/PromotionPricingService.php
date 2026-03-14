<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Promotion;

class PromotionPricingService
{
    /**
     * @param array<int, array<string, mixed>> $items
     *
     * @return array<string, mixed>
     */
    public function calculate(array $items): array
    {
        $base = [];
        foreach ($items as $index => $item) {
            $key = (string) ($item['item_key'] ?? $index);
            $qty = max(0, (int) ($item['quantity'] ?? 0));
            $unitPrice = (float) ($item['unit_price'] ?? 0);
            $lineTotal = $unitPrice * $qty;

            $base[$key] = [
                'item_key' => $key,
                'cart_item_id' => $item['cart_item_id'] ?? null,
                'product_id' => (int) ($item['product_id'] ?? 0),
                'product_variant_id' => $item['product_variant_id'] ?? null,
                'name' => $item['name'] ?? null,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'line_total' => $lineTotal,
                'line_total_after_promotion' => $lineTotal,
                'promotion_applied' => false,
                'promotion_discount_amount' => 0.0,
                'promotion_name' => null,
                'promotion_summary' => null,
                'promotion_id' => null,
            ];
        }

        $appliedPromotions = [];

        $promotions = Promotion::query()
            ->where('is_active', true)
            ->whereNotNull('promotion_type')
            ->whereIn('id', \DB::table('promotion_products')->select('promotion_id')->distinct())
            ->with(['promotionProducts', 'promotionTiers'])
            ->get();

        foreach ($promotions as $promotion) {
            $productIds = $promotion->promotionProducts->pluck('product_id')->map(fn ($id) => (int) $id)->all();

            $eligible = collect($base)
                ->filter(fn (array $row) => in_array((int) $row['product_id'], $productIds, true) && (int) $row['quantity'] > 0)
                ->values();

            if ($eligible->isEmpty()) {
                continue;
            }

            $totalQty = (int) $eligible->sum('quantity');
            $totalAmount = (float) $eligible->sum('line_total_after_promotion');

            $applicable = null;
            foreach ($promotion->promotionTiers as $tier) {
                $ok = $promotion->trigger_type === 'amount'
                    ? $totalAmount >= (float) ($tier->min_amount ?? 0)
                    : $totalQty >= (int) ($tier->min_qty ?? 0);

                if (! $ok) {
                    continue;
                }

                $tierThreshold = $promotion->trigger_type === 'amount'
                    ? (float) ($tier->min_amount ?? 0)
                    : (int) ($tier->min_qty ?? 0);

                $currentThreshold = $applicable
                    ? ($promotion->trigger_type === 'amount'
                        ? (float) ($applicable->min_amount ?? 0)
                        : (int) ($applicable->min_qty ?? 0))
                    : null;

                if (! $applicable || $tierThreshold > $currentThreshold) {
                    $applicable = $tier;
                }
            }

            if (! $applicable) {
                continue;
            }

            $thresholdQty = max(1, (int) ($applicable->min_qty ?? 0));
            $remaining = $thresholdQty;
            $sortedEligible = $eligible->sortByDesc('unit_price')->values();
            $selected = [];

            foreach ($sortedEligible as $entry) {
                if ($remaining <= 0) {
                    break;
                }

                $use = min($remaining, (int) $entry['quantity']);
                $selected[] = ['item_key' => (string) $entry['item_key'], 'qty' => $use];
                $remaining -= $use;
            }

            if ($remaining > 0 && $promotion->trigger_type === 'quantity') {
                continue;
            }

            $selectedSubtotal = array_sum(array_map(function (array $entry) use ($base): float {
                $item = $base[$entry['item_key']];
                return (float) $item['unit_price'] * (int) $entry['qty'];
            }, $selected));

            $discount = 0.0;
            if ($applicable->discount_type === 'bundle_fixed_price') {
                $discount = max(0, $selectedSubtotal - (float) $applicable->discount_value);
            } elseif ($applicable->discount_type === 'percentage_discount') {
                $discount = max(0, $selectedSubtotal * ((float) $applicable->discount_value / 100));
            } else {
                $discount = min($selectedSubtotal, (float) $applicable->discount_value);
            }

            if ($discount <= 0) {
                continue;
            }

            $promotionSnapshot = [
                'promotion_id' => (int) $promotion->id,
                'promotion_name' => $promotion->name ?: $promotion->title,
                'promotion_type' => $promotion->promotion_type,
                'trigger_type' => $promotion->trigger_type,
                'selected_tier' => [
                    'tier_id' => (int) $applicable->id,
                    'min_qty' => (int) ($applicable->min_qty ?? 0),
                    'min_amount' => (float) ($applicable->min_amount ?? 0),
                    'discount_type' => $applicable->discount_type,
                    'discount_value' => (float) ($applicable->discount_value ?? 0),
                ],
                'selected_qty' => (int) array_sum(array_map(fn ($entry) => (int) $entry['qty'], $selected)),
                'selected_subtotal' => (float) $selectedSubtotal,
                'tier_total' => (float) max(0, $selectedSubtotal - $discount),
                'discount_amount' => (float) $discount,
                'remaining_qty_charged_normal' => max(0, $totalQty - (int) array_sum(array_map(fn ($entry) => (int) $entry['qty'], $selected))),
                'summary' => $this->formatPromotionSummary($promotion, $applicable),
            ];

            $appliedPromotions[] = $promotionSnapshot;

            foreach ($selected as $entry) {
                $key = $entry['item_key'];
                $line = (float) $base[$key]['line_total'];
                $portionBase = max(0.01, (float) $base[$key]['unit_price'] * (int) $entry['qty']);
                $portion = min($line, $discount * ($portionBase / max(0.01, $selectedSubtotal)));

                $base[$key]['promotion_applied'] = true;
                $base[$key]['promotion_id'] = (int) $promotion->id;
                $base[$key]['promotion_name'] = $promotion->name ?: $promotion->title;
                $base[$key]['promotion_summary'] = $promotionSnapshot['summary'];
                $base[$key]['promotion_discount_amount'] += $portion;
                $base[$key]['line_total_after_promotion'] = max(0, $base[$key]['line_total'] - $base[$key]['promotion_discount_amount']);
            }
        }

        $subtotal = (float) collect($base)->sum('line_total');
        $promotionDiscount = (float) collect($base)->sum('promotion_discount_amount');
        $finalTotal = max(0, $subtotal - $promotionDiscount);

        return [
            'items' => array_values($base),
            'promotions' => $appliedPromotions,
            'promotion_summary' => $appliedPromotions[0] ?? null,
            'subtotal' => $subtotal,
            'promotion_discount' => $promotionDiscount,
            'final_total' => $finalTotal,
        ];
    }

    protected function formatPromotionSummary($promotion, $tier): string
    {
        if ($promotion->trigger_type === 'quantity') {
            return (int) ($tier->min_qty ?? 0) . ' items => RM ' . number_format((float) ($tier->discount_value ?? 0), 2);
        }

        return 'Min spend RM ' . number_format((float) ($tier->min_amount ?? 0), 2)
            . ' => ' . $tier->discount_type
            . ' ' . number_format((float) ($tier->discount_value ?? 0), 2);
    }
}
