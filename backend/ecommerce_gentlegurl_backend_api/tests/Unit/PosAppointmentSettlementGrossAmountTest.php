<?php

namespace Tests\Unit;

use App\Http\Controllers\Ecommerce\PosController;
use App\Models\Ecommerce\OrderItem;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class PosAppointmentSettlementGrossAmountTest extends TestCase
{
    /**
     * @dataProvider settlementGrossAmountProvider
     */
    public function testSettlementGrossAmountPrefersPreDiscountSnapshot(float $lineTotal, ?float $snapshot, float $expected): void
    {
        $controller = (new ReflectionClass(PosController::class))->newInstanceWithoutConstructor();
        $method = new \ReflectionMethod(PosController::class, 'resolveOrderItemSettlementGrossAmount');
        $method->setAccessible(true);

        $item = new OrderItem([
            'line_total' => $lineTotal,
            'line_total_snapshot' => $snapshot,
        ]);

        $this->assertSame($expected, $method->invoke($controller, $item));
    }

    public static function settlementGrossAmountProvider(): array
    {
        return [
            'pos cart net line with snapshot gross' => [173.1, 178.0, 178.0],
            'appointment collect gross line' => [178.0, 178.0, 178.0],
            'legacy row without snapshot' => [173.1, null, 173.1],
        ];
    }
}
