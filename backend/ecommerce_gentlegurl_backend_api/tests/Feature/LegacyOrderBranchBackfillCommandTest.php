<?php

namespace Tests\Feature;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LegacyOrderBranchBackfillCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_reports_product_profit_candidates_and_performs_no_writes(): void
    {
        $branch = $this->branch('PNG');
        $legacy = $this->order('LEGACY-PRODUCT', '2026-01-01 10:00:00');
        OrderItem::create(['order_id' => $legacy->id, 'line_type' => 'product', 'product_id' => 123, 'product_name_snapshot' => 'Legacy polish', 'quantity' => 1, 'price_snapshot' => 10, 'line_total' => 10]);

        $this->artisan('order-branch:legacy-backfill', ['--store-code' => 'PNG', '--dry-run' => true])
            ->expectsOutputToContain('Rows would be updated: 1')
            ->expectsOutputToContain('Product profit order count: 1')
            ->expectsOutputToContain((string) $legacy->id)
            ->assertSuccessful();

        $this->assertNull($legacy->fresh()->store_location_id);
        $this->assertNotNull($branch);
    }

    public function test_force_assigns_only_null_orders_and_is_idempotent(): void
    {
        $png = $this->branch('PNG');
        $other = $this->branch('OTHER');
        $legacy = $this->order('LEGACY-NULL', '2026-01-01 00:00:00');
        $secondNull = $this->order('SECOND-NULL', '2026-09-01 00:00:00');
        $attributed = $this->order('ALREADY', '2026-01-01 00:00:00', $other->id);
        $arguments = ['--store-code' => 'PNG', '--force' => true];

        $this->artisan('order-branch:legacy-backfill', $arguments)
            ->expectsOutputToContain('Orders changed: 2')->assertSuccessful();
        $this->assertSame($png->id, $legacy->fresh()->store_location_id);
        $this->assertSame($png->id, $secondNull->fresh()->store_location_id);
        $this->assertSame($other->id, $attributed->fresh()->store_location_id);

        $this->artisan('order-branch:legacy-backfill', $arguments)->expectsOutputToContain('Orders changed: 0')->assertSuccessful();
    }

    public function test_invalid_branch_fails_without_writes(): void
    {
        $legacy = $this->order('UNCHANGED', '2026-01-01 00:00:00');
        $this->artisan('order-branch:legacy-backfill', ['--store-code' => 'NOPE', '--force' => true])->assertFailed();
        $this->assertNull($legacy->fresh()->store_location_id);
    }

    private function order(string $number, string $createdAt, ?int $branchId = null): Order
    {
        $order = Order::create(['order_number' => $number, 'store_location_id' => $branchId]);
        $order->timestamps = false;
        $order->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();
        return $order;
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create(['name' => $code, 'code' => $code, 'is_active' => true, 'is_pickup_available' => true, 'is_review_available' => true, 'is_booking_available' => true, 'is_pos_available' => true]);
    }
}
