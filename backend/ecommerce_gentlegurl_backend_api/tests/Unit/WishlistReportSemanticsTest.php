<?php

namespace Tests\Unit;

use App\Services\Ecommerce\WishlistReportSemantics;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class WishlistReportSemanticsTest extends TestCase
{
    public static function stockCases(): array
    {
        return [
            'simple available' => [30, true, 0, 0, 'in_stock', 'In stock (30)'],
            'simple unavailable' => [0, true, 0, 0, 'out_of_stock', 'Out of stock'],
            'untracked simple product' => [0, false, 0, 0, 'in_stock', 'In stock'],
            'all variants available' => [0, true, 3, 0, 'in_stock', 'In stock'],
            'one of three unavailable' => [0, true, 3, 1, 'partial', 'Some variants out of stock (1/3)'],
            'all variants unavailable' => [99, true, 3, 3, 'out_of_stock', 'Out of stock'],
        ];
    }

    #[DataProvider('stockCases')]
    public function test_stock_semantics(int $stock, bool $tracks, int $variants, int $unavailable, string $code, string $label): void
    {
        self::assertSame(['code' => $code, 'label' => $label], WishlistReportSemantics::stockStatus($stock, $tracks, $variants, $unavailable));
    }

    public function test_recommendations_are_deterministic_and_have_no_inventory_side_effects(): void
    {
        self::assertSame('No action', WishlistReportSemantics::recommendation(0, 'out_of_stock')['label']);
        self::assertSame('Monitor', WishlistReportSemantics::recommendation(2, 'in_stock')['label']);
        self::assertSame('Restock selected variants', WishlistReportSemantics::recommendation(2, 'partial')['label']);
        self::assertSame('Restock recommended', WishlistReportSemantics::recommendation(2, 'out_of_stock')['label']);
    }

    public function test_top_wishlist_handles_unique_ties_and_empty_scopes(): void
    {
        self::assertSame('A', WishlistReportSemantics::topWishlist([['name' => 'A', 'count' => 5], ['name' => 'B', 'count' => 3]])['label']);
        self::assertSame('Tie — 2 products (5 each)', WishlistReportSemantics::topWishlist([['name' => 'A', 'count' => 5], ['name' => 'B', 'count' => 5]])['label']);
        self::assertSame('Tie — 2 products (1 each)', WishlistReportSemantics::topWishlist([['name' => 'A', 'count' => 1], ['name' => 'B', 'count' => 1]])['label']);
        self::assertSame(3, WishlistReportSemantics::topWishlist([['name' => 'A', 'count' => 2], ['name' => 'B', 'count' => 2], ['name' => 'C', 'count' => 2]])['product_count']);
        self::assertSame('No wishlist data', WishlistReportSemantics::topWishlist([])['label']);
    }
}
