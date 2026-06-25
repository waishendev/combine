<?php

namespace Tests\Unit;

use App\Http\Controllers\Ecommerce\PosController;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

class PosBookingProductCommissionLinesTest extends TestCase
{
    public function testBookingProductCommissionLinesUseSeparateBaseAndOptionAmounts(): void
    {
        $controller = (new ReflectionClass(PosController::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(PosController::class, 'resolveBookingProductCommissionLines');
        $method->setAccessible(true);

        $lines = collect($method->invoke($controller, 123, 1, 33.0, [[
            'id' => 987,
            'label' => 'Anti Dandruff',
            'extra_price' => 8.0,
            'line_total_after_discount' => 8.0,
        ]], [[
            'staff_id' => 1,
            'share_percent' => 100,
        ]], [[
            'line_key' => 'booking_product_option:987',
            'staff_splits' => [[
                'staff_id' => 2,
                'share_percent' => 100,
            ]],
        ]]));

        $baseLine = $lines->firstWhere('line_type', 'booking_product_base');
        $optionLine = $lines->firstWhere('line_type', 'booking_product_option');

        $this->assertSame(25.0, $baseLine['amount_basis']);
        $this->assertSame([['staff_id' => 1, 'share_percent' => 100]], $baseLine['staff_splits']);
        $this->assertSame(8.0, $optionLine['amount_basis']);
        $this->assertSame([['staff_id' => 2, 'share_percent' => 100]], $optionLine['staff_splits']);
        $this->assertSame('explicit', $optionLine['staff_split_source']);
    }

    public function testBookingProductOptionCommissionInheritsParentSplitsWhenOptionHasNoExplicitSplit(): void
    {
        $controller = (new ReflectionClass(PosController::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(PosController::class, 'resolveBookingProductCommissionLines');
        $method->setAccessible(true);

        $lines = collect($method->invoke($controller, 123, 1, 33.0, [[
            'id' => 987,
            'label' => 'Anti Dandruff',
            'extra_price' => 8.0,
        ]], [[
            'staff_id' => 1,
            'share_percent' => 100,
        ]], []));

        $optionLine = $lines->firstWhere('line_type', 'booking_product_option');

        $this->assertSame(8.0, $optionLine['amount_basis']);
        $this->assertSame([['staff_id' => 1, 'share_percent' => 100]], $optionLine['staff_splits']);
        $this->assertSame('inherited', $optionLine['staff_split_source']);
    }
}
