<?php

namespace Tests\Feature;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingCart;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
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
        $this->assertTrue(Schema::hasColumn('booking_carts', 'store_location_id'));
        $branch = $this->branch('P4');
        $order = Order::create(['order_number' => 'P4-1', 'store_location_id' => $branch->id, 'pickup_store_id' => $branch->id]);
        $booking = Booking::create(['booking_code' => 'P4-B', 'source' => 'STAFF', 'store_location_id' => $branch->id]);
        $cart = BookingCart::create(['guest_token' => 'phase-4-branch-cart', 'store_location_id' => $branch->id, 'status' => 'active']);
        $this->assertTrue($order->storeLocation->is($branch));
        $this->assertTrue($order->pickupStore->is($branch));
        $this->assertTrue($booking->storeLocation->is($branch));
        $this->assertSame($branch->id, $cart->store_location_id);
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

    public function test_backfill_prefers_unique_linked_order_branch_for_a_null_booking(): void
    {
        $default = $this->branch('DEFAULT-EVIDENCE');
        $actual = $this->branch('BRANCH-B');
        $booking = Booking::create(['booking_code' => 'POS-BROKEN-B', 'source' => 'STAFF']);
        $order = Order::create(['order_number' => 'POS-B-EVIDENCE', 'store_location_id' => $actual->id]);
        OrderItem::create([
            'order_id' => $order->id,
            'booking_id' => $booking->id,
            'line_type' => 'booking_settlement',
            'product_name_snapshot' => 'Service',
            'quantity' => 1,
            'price_snapshot' => 10,
            'line_total' => 10,
        ]);

        $this->artisan('branch-transactions:backfill --store-code=DEFAULT-EVIDENCE --force')->assertSuccessful();
        $this->assertSame($actual->id, $booking->fresh()->store_location_id);
        $this->assertNotSame($default->id, $booking->fresh()->store_location_id);
    }

    private function branch(string $code, bool $active = true): StoreLocation
    {
        return StoreLocation::create(['name' => $code, 'code' => $code, 'is_active' => $active, 'is_pickup_available' => true, 'is_review_available' => true, 'is_booking_available' => true, 'is_pos_available' => true]);
    }
}
