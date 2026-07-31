<?php

namespace Tests\Unit;

use App\Http\Controllers\Ecommerce\PosController;
use App\Models\Ecommerce\OrderItem;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionClass;
use ReflectionMethod;
use Tests\TestCase;

class PosAppointmentActiveOrderItemsBatchTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('status');
            $table->string('payment_status')->nullable();
            $table->timestamps();
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id');
            $table->unsignedBigInteger('booking_id')->nullable();
            $table->string('line_type')->nullable();
            $table->string('display_name_snapshot')->nullable();
            $table->string('product_name_snapshot')->nullable();
            $table->string('variant_name_snapshot')->nullable();
            $table->decimal('line_total', 12, 2)->default(0);
            $table->decimal('line_total_snapshot', 12, 2)->nullable();
            $table->decimal('line_total_after_discount', 12, 2)->nullable();
            $table->decimal('effective_line_total', 12, 2)->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        parent::tearDown();
    }

    public function test_batch_preload_matches_per_booking_queries_for_service_addon_deposit_settlement(): void
    {
        $bookingId = 101;
        $activeOrderId = $this->insertOrder('completed');
        $voidOrderId = $this->insertOrder('voided');
        $cancelledOrderId = $this->insertOrder('cancelled');
        $draftOrderId = $this->insertOrder('draft');
        $refundedPaymentOrderId = $this->insertOrder('completed', 'refunded');

        // Active order: settlement + deposit + addon settlement + addon deposit + regular addon
        $this->insertItem($activeOrderId, $bookingId, 'booking_settlement', 'Final Settlement - Cut', null, 100, 100);
        $this->insertItem($activeOrderId, $bookingId, 'booking_deposit', 'Deposit', null, 20, 20, 20);
        $this->insertItem($activeOrderId, $bookingId, 'booking_addon', 'Extra', 'Booking Add-on Settlement', 30, 30);
        $this->insertItem($activeOrderId, $bookingId, 'booking_addon', 'Extra Deposit', 'Booking Add-on Deposit', 10, 10, 10);
        $this->insertItem($activeOrderId, $bookingId, 'booking_addon', 'Extra', null, 5, 5);

        // Second active order for same booking (multiple orders)
        $secondActiveOrderId = $this->insertOrder('processing');
        $this->insertItem($secondActiveOrderId, $bookingId, 'booking_settlement', 'Final Settlement - Cut', null, 15, 15);

        // Inactive orders must be excluded
        $this->insertItem($voidOrderId, $bookingId, 'booking_settlement', 'Voided Settlement', null, 999, 999);
        $this->insertItem($cancelledOrderId, $bookingId, 'booking_deposit', 'Cancelled Deposit', null, 999, 999);
        $this->insertItem($draftOrderId, $bookingId, 'booking_addon', 'Draft Addon', null, 999, 999);

        // Refunded payment_status on completed order is still active under current rules
        $this->insertItem($refundedPaymentOrderId, $bookingId, 'booking_deposit', 'Refunded-payment Deposit', null, 8, 8, 8);

        // Unrelated booking
        $otherBookingOrderId = $this->insertOrder('completed');
        $this->insertItem($otherBookingOrderId, 202, 'booking_settlement', 'Other', null, 50, 50);

        $controller = $this->controller();
        $this->invoke($controller, 'preloadAppointmentSearchActiveOrderItems', [[$bookingId, 202]]);

        $cases = [
            ['booking_addon', null],
            ['booking_deposit', null],
            ['booking_addon', 'Booking Add-on Deposit'],
            ['booking_settlement', null],
        ];

        foreach ($cases as [$lineType, $variant]) {
            $batched = $this->invoke($controller, 'activeBookingOrderItemsFiltered', [$bookingId, $lineType, $variant])
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->sort()
                ->values()
                ->all();

            // Clear preload to force legacy activeBookingOrderItemQuery path.
            $this->setPreload($controller, null);
            $legacy = $this->invoke($controller, 'activeBookingOrderItemsFiltered', [$bookingId, $lineType, $variant])
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->sort()
                ->values()
                ->all();

            $this->invoke($controller, 'preloadAppointmentSearchActiveOrderItems', [[$bookingId, 202]]);

            $this->assertSame(
                $legacy,
                $batched,
                "Mismatch for line_type={$lineType} variant=" . ($variant ?? 'null')
            );
        }

        // Explicit expectations for settlement / deposits / addons
        $settlementIds = $this->invoke($controller, 'activeBookingOrderItemsFiltered', [$bookingId, 'booking_settlement', null])
            ->pluck('line_total')
            ->map(fn ($v) => (float) $v)
            ->sort()
            ->values()
            ->all();
        $this->assertSame([15.0, 100.0], $settlementIds);

        $depositTotal = (float) $this->invoke($controller, 'activeBookingOrderItemsFiltered', [$bookingId, 'booking_deposit', null])
            ->sum(fn (OrderItem $row) => (float) ($row->effective_line_total ?? $row->line_total));
        $this->assertEqualsWithDelta(28.0, $depositTotal, 0.001);

        $addonDeposit = $this->invoke($controller, 'activeBookingOrderItemsFiltered', [$bookingId, 'booking_addon', 'Booking Add-on Deposit']);
        $this->assertCount(1, $addonDeposit);
        $this->assertSame('Extra Deposit', $addonDeposit->first()->display_name_snapshot);

        $addons = $this->invoke($controller, 'activeBookingOrderItemsFiltered', [$bookingId, 'booking_addon', null]);
        $this->assertCount(3, $addons);

        // product line_type must never appear in preload
        $this->insertItem($activeOrderId, $bookingId, 'product', 'Retail', null, 1, 1);
        $this->invoke($controller, 'preloadAppointmentSearchActiveOrderItems', [[$bookingId]]);
        $allPreloaded = $this->getPreload($controller)->get($bookingId, collect());
        $this->assertFalse($allPreloaded->contains(fn (OrderItem $item) => (string) $item->line_type === 'product'));
    }

    public function test_in_memory_filter_matches_line_type_and_variant_exactly(): void
    {
        $controller = $this->controller();
        $rows = collect([
            new OrderItem(['booking_id' => 1, 'line_type' => 'booking_addon', 'variant_name_snapshot' => 'Booking Add-on Deposit', 'line_total' => 1]),
            new OrderItem(['booking_id' => 1, 'line_type' => 'booking_addon', 'variant_name_snapshot' => 'Booking Add-on Settlement', 'line_total' => 2]),
            new OrderItem(['booking_id' => 1, 'line_type' => 'booking_deposit', 'variant_name_snapshot' => null, 'line_total' => 3]),
            new OrderItem(['booking_id' => 1, 'line_type' => 'booking_settlement', 'variant_name_snapshot' => null, 'line_total' => 4]),
        ]);
        $this->setPreload($controller, collect([1 => $rows]));

        $addonDeposit = $this->invoke($controller, 'activeBookingOrderItemsFiltered', [1, 'booking_addon', 'Booking Add-on Deposit']);
        $this->assertCount(1, $addonDeposit);
        $this->assertSame(1.0, (float) $addonDeposit->first()->line_total);

        $addons = $this->invoke($controller, 'activeBookingOrderItemsFiltered', [1, 'booking_addon', null]);
        $this->assertCount(2, $addons);

        $settlement = $this->invoke($controller, 'activeBookingOrderItemsFiltered', [1, 'booking_settlement', null]);
        $this->assertCount(1, $settlement);
        $this->assertSame(4.0, (float) $settlement->first()->line_total);
    }

    public function test_end_appointment_search_memo_clears_order_item_preload(): void
    {
        $controller = $this->controller();
        $this->setPreload($controller, collect([1 => collect()]));
        $this->invoke($controller, 'endAppointmentSearchMemo');
        $this->assertNull($this->getPreload($controller));
    }

    private function controller(): PosController
    {
        return (new ReflectionClass(PosController::class))->newInstanceWithoutConstructor();
    }

    private function invoke(object $controller, string $method, array $args = []): mixed
    {
        $ref = new ReflectionMethod($controller, $method);
        $ref->setAccessible(true);

        return $ref->invokeArgs($controller, $args);
    }

    private function setPreload(PosController $controller, mixed $value): void
    {
        $prop = (new ReflectionClass($controller))->getProperty('appointmentSearchActiveOrderItemsByBookingId');
        $prop->setAccessible(true);
        $prop->setValue($controller, $value);
    }

    private function getPreload(PosController $controller): mixed
    {
        $prop = (new ReflectionClass($controller))->getProperty('appointmentSearchActiveOrderItemsByBookingId');
        $prop->setAccessible(true);

        return $prop->getValue($controller);
    }

    private function insertOrder(string $status, ?string $paymentStatus = null): int
    {
        return (int) DB::table('orders')->insertGetId([
            'status' => $status,
            'payment_status' => $paymentStatus,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertItem(
        int $orderId,
        int $bookingId,
        string $lineType,
        string $displayName,
        ?string $variant,
        float $lineTotal,
        float $snapshot,
        ?float $effective = null,
    ): int {
        return (int) DB::table('order_items')->insertGetId([
            'order_id' => $orderId,
            'booking_id' => $bookingId,
            'line_type' => $lineType,
            'display_name_snapshot' => $displayName,
            'product_name_snapshot' => $displayName,
            'variant_name_snapshot' => $variant,
            'line_total' => $lineTotal,
            'line_total_snapshot' => $snapshot,
            'line_total_after_discount' => $lineTotal,
            'effective_line_total' => $effective,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
