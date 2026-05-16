<?php

namespace Tests\Unit;

use App\Http\Controllers\Ecommerce\PosController;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class PosAppointmentPaymentStatusTest extends TestCase
{
    /**
     * @dataProvider paymentStatusProvider
     */
    public function testAppointmentPaymentStatusIsCalculatedFromAmounts(array $summary, string $expectedStatus): void
    {
        $controller = (new ReflectionClass(PosController::class))->newInstanceWithoutConstructor();
        $method = new \ReflectionMethod(PosController::class, 'calculateAppointmentPaymentStatus');
        $method->setAccessible(true);

        $this->assertSame($expectedStatus, $method->invoke($controller, $summary));
    }

    public static function paymentStatusProvider(): array
    {
        return [
            'guest fully paid by deposit and settlement' => [
                [
                    'deposit_paid' => 20,
                    'settlement_paid' => 1110,
                    'package_offset' => 0,
                    'service_total' => 1130,
                    'addon_total_price' => 0,
                ],
                'PAID',
            ],
            'guest partially paid by deposit only' => [
                [
                    'deposit_paid' => 20,
                    'settlement_paid' => 0,
                    'package_offset' => 0,
                    'service_total' => 1130,
                    'addon_total_price' => 0,
                ],
                'PARTIAL',
            ],
            'unpaid booking' => [
                [
                    'deposit_paid' => 0,
                    'settlement_paid' => 0,
                    'package_offset' => 0,
                    'service_total' => 1130,
                    'addon_total_price' => 0,
                ],
                'UNPAID',
            ],
            'package offset covers payable total' => [
                [
                    'deposit_paid' => 0,
                    'settlement_paid' => 0,
                    'package_offset' => 1130,
                    'service_total' => 1130,
                    'addon_total_price' => 0,
                ],
                'PAID',
            ],
        ];
    }
}
