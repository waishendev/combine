<?php

namespace Tests\Feature;

use App\Models\Booking\Booking;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TransactionBranchPhase4Test extends TestCase
{
    use RefreshDatabase;

    public function test_nullable_columns_and_distinct_relationships_exist(): void
    {
        $this->assertTrue(Schema::hasColumn('orders', 'store_location_id'));
        $this->assertTrue(Schema::hasColumn('bookings', 'store_location_id'));
        $branch = $this->branch('P4');
        $order = Order::create(['order_number' => 'P4-1', 'store_location_id' => $branch->id, 'pickup_store_id' => $branch->id]);
        $booking = Booking::create(['booking_code' => 'P4-B', 'source' => 'STAFF', 'store_location_id' => $branch->id]);
        $this->assertTrue($order->storeLocation->is($branch));
        $this->assertTrue($order->pickupStore->is($branch));
        $this->assertTrue($booking->storeLocation->is($branch));
        $this->assertNull((new Order)->store_location_id);
        $this->assertNull((new Booking)->store_location_id);
    }

    public function test_dry_run_is_zero_write_and_force_is_idempotent_without_changing_pickup(): void
    {
        $default = $this->branch('DEFAULT');
        $pickup = $this->branch('PICKUP');
        $booking = Booking::create(['booking_code' => 'P4-B2', 'source' => 'CUSTOMER']);
        $order = Order::create(['order_number' => 'P4-2', 'pickup_or_shipping' => 'pickup', 'pickup_store_id' => $pickup->id]);

        $this->artisan('branch-transactions:backfill --store-code=DEFAULT --dry-run')->assertSuccessful();
        $this->assertNull($booking->fresh()->store_location_id);
        $this->assertNull($order->fresh()->store_location_id);

        $this->artisan('branch-transactions:backfill --store-code=DEFAULT --force')->assertSuccessful();
        $this->artisan('branch-transactions:backfill --store-code=DEFAULT --force')->assertSuccessful();
        $this->assertSame($default->id, $booking->fresh()->store_location_id);
        $this->assertSame($pickup->id, $order->fresh()->store_location_id);
        $this->assertSame($pickup->id, $order->fresh()->pickup_store_id);
    }

    public function test_invalid_or_inactive_default_fails_without_writes(): void
    {
        $this->branch('OFF', false);
        $booking = Booking::create(['booking_code' => 'P4-B3', 'source' => 'CUSTOMER']);
        $this->artisan('branch-transactions:backfill --store-code=NOPE --force')->assertFailed();
        $this->artisan('branch-transactions:backfill --store-code=OFF --force')->assertFailed();
        $this->assertNull($booking->fresh()->store_location_id);
    }

    private function branch(string $code, bool $active = true): StoreLocation
    {
        return StoreLocation::create(['name' => $code, 'code' => $code, 'is_active' => $active, 'is_pickup_available' => true, 'is_review_available' => true, 'is_booking_available' => true, 'is_pos_available' => true]);
    }
}
