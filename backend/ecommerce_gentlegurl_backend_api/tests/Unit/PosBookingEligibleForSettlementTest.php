<?php

namespace Tests\Unit;

use App\Http\Controllers\Ecommerce\PosController;
use App\Models\Booking\Booking;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class PosBookingEligibleForSettlementTest extends TestCase
{
    /**
     * @dataProvider settlementEligibilityProvider
     */
    public function testBookingEligibleForPosSettlement(bool $expected, array $attributes): void
    {
        $controller = (new ReflectionClass(PosController::class))->newInstanceWithoutConstructor();
        $method = new \ReflectionMethod(PosController::class, 'bookingEligibleForPosSettlement');
        $method->setAccessible(true);

        $booking = new Booking($attributes);

        $this->assertSame($expected, $method->invoke($controller, $booking));
    }

    public static function settlementEligibilityProvider(): array
    {
        return [
            'member with service' => [true, ['service_id' => 1, 'customer_id' => 10]],
            'unknown walk-in guest' => [true, ['service_id' => 1, 'guest_name' => 'UNKNOWN']],
            'named guest without phone or email' => [true, ['service_id' => 1, 'guest_name' => 'Jane']],
            'named guest with phone only' => [true, ['service_id' => 1, 'guest_name' => 'Jane', 'guest_phone' => '+60123456789']],
            'missing service' => [false, ['customer_id' => 10]],
            'empty guest identity' => [false, ['service_id' => 1]],
        ];
    }
}
