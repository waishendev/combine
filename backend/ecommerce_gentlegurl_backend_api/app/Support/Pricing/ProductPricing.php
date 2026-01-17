<?php

namespace App\Support\Pricing;

use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use Carbon\Carbon;
use DateTimeInterface;

class ProductPricing
{
    public static function build(Product $product, ?ProductVariant $variant = null, ?Carbon $now = null): array
    {
        $now = $now ?? Carbon::now();

        if ($variant) {
            $originalPrice = (float) ($variant->price ?? $product->price ?? 0);
            $salePrice = $variant->sale_price !== null ? (float) $variant->sale_price : null;
            $startAt = self::normalizeDateTime($variant->sale_price_start_at);
            $endAt = self::normalizeDateTime($variant->sale_price_end_at);
        } else {
            $originalPrice = (float) ($product->price ?? 0);
            $salePrice = $product->sale_price !== null ? (float) $product->sale_price : null;
            $startAt = self::normalizeDateTime($product->sale_price_start_at);
            $endAt = self::normalizeDateTime($product->sale_price_end_at);
        }

        $isOnSale = self::isOnSale($salePrice, $originalPrice, $startAt, $endAt, $now);
        $effectivePrice = $isOnSale && $salePrice !== null ? $salePrice : $originalPrice;
        $discountPercent = $isOnSale && $salePrice !== null && $originalPrice > 0
            ? (int) round((1 - ($salePrice / $originalPrice)) * 100)
            : null;
        $promotionActive = $discountPercent !== null && $discountPercent > 0 && $isOnSale;

        return [
            'original_price' => $originalPrice,
            'sale_price' => $salePrice,
            'sale_price_start_at' => $startAt?->toDateTimeString(),
            'sale_price_end_at' => $endAt?->toDateTimeString(),
            'is_on_sale' => $isOnSale,
            'promotion_active' => $promotionActive,
            'promotion_end_at' => $endAt?->toDateTimeString(),
            'effective_price' => $effectivePrice,
            'discount_percent' => $discountPercent,
        ];
    }

    public static function resolvePriceChangeReason(float $previousPrice, array $pricing): ?string
    {
        if (self::isSamePrice($previousPrice, $pricing['effective_price'] ?? 0)) {
            return null;
        }

        if (($pricing['is_on_sale'] ?? false) && self::isSamePrice($previousPrice, $pricing['original_price'] ?? 0)) {
            return 'promotion_started';
        }

        if (!($pricing['is_on_sale'] ?? false)
            && ($pricing['sale_price'] ?? null) !== null
            && self::isSamePrice($previousPrice, $pricing['sale_price'])
        ) {
            return 'promotion_ended';
        }

        return 'price_updated';
    }

    public static function isOnSale(
        ?float $salePrice,
        float $originalPrice,
        ?Carbon $startAt,
        ?Carbon $endAt,
        Carbon $now,
    ): bool
    {
        if ($salePrice === null) {
            return false;
        }

        if ($salePrice >= $originalPrice) {
            return false;
        }

        if ($startAt && $now->lt($startAt)) {
            return false;
        }

        if ($endAt && $now->gt($endAt)) {
            return false;
        }

        return true;
    }

    private static function normalizeDateTime(mixed $value): ?Carbon
    {
        if (! $value) {
            return null;
        }

        if ($value instanceof Carbon) {
            return $value;
        }

        if ($value instanceof DateTimeInterface) {
            return Carbon::instance($value);
        }

        return Carbon::parse($value);
    }

    private static function isSamePrice(float $left, float $right): bool
    {
        return abs($left - $right) < 0.01;
    }
}
