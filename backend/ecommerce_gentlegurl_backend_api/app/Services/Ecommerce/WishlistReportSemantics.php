<?php

namespace App\Services\Ecommerce;

final class WishlistReportSemantics
{
    /** @param array<int, array{name: string, count: int}> $products */
    public static function topWishlist(array $products): array
    {
        $max = empty($products) ? 0 : max(array_column($products, 'count'));
        $top = array_values(array_filter($products, fn (array $product) => $max > 0 && $product['count'] === $max));

        if (empty($top)) {
            return ['state' => 'none', 'label' => 'No wishlist data', 'count' => 0, 'product_count' => 0];
        }

        if (count($top) === 1) {
            return ['state' => 'unique', 'label' => $top[0]['name'], 'count' => $max, 'product_count' => 1];
        }

        return ['state' => 'tie', 'label' => 'Tie — '.count($top)." products ({$max} each)", 'count' => $max, 'product_count' => count($top)];
    }

    public static function stockStatus(
        int $productStock,
        bool $productTracksStock,
        int $variantCount,
        int $unavailableVariantCount,
    ): array {
        if ($variantCount > 0) {
            if ($unavailableVariantCount === 0) {
                return ['code' => 'in_stock', 'label' => 'In stock'];
            }

            if ($unavailableVariantCount < $variantCount) {
                return [
                    'code' => 'partial',
                    'label' => "Some variants out of stock ({$unavailableVariantCount}/{$variantCount})",
                ];
            }

            return ['code' => 'out_of_stock', 'label' => 'Out of stock'];
        }

        if (! $productTracksStock || $productStock > 0) {
            return [
                'code' => 'in_stock',
                'label' => $productTracksStock ? "In stock ({$productStock})" : 'In stock',
            ];
        }

        return ['code' => 'out_of_stock', 'label' => 'Out of stock'];
    }

    public static function recommendation(int $demand, string $stockCode): array
    {
        if ($demand <= 0) {
            return ['label' => 'No action', 'detail' => 'No wishlist demand in the selected filter period.'];
        }

        return match ($stockCode) {
            'partial' => ['label' => 'Restock selected variants', 'detail' => 'Review replenishment for the unavailable variants.'],
            'out_of_stock' => ['label' => 'Restock recommended', 'detail' => "Current stock is unavailable while the product has {$demand} wishlist ".($demand === 1 ? 'add.' : 'adds.')],
            default => ['label' => 'Monitor', 'detail' => 'Wishlist demand exists and stock is currently available. Monitor demand.'],
        };
    }
}
