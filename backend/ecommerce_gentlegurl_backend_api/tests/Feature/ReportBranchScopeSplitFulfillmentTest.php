<?php

namespace Tests\Feature;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\StoreLocation;
use App\Services\Reports\ReportBranchScope;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReportBranchScopeSplitFulfillmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_query_builder_visibility_uses_grouped_exists_without_duplicates(): void
    {
        [$one, $two, $three] = [$this->branch('ONE'), $this->branch('TWO'), $this->branch('THREE')];
        $legacy = $this->order('LEGACY', $one->id, 'pending');
        $mixed = $this->order('MIXED', null, 'pending');
        $filtered = $this->order('FILTERED', null, 'cancelled');
        foreach ([$mixed, $filtered] as $order) {
            $this->item($order->id, $one->id);
            $this->item($order->id, $two->id);
        }

        $branchOne = new ReportBranchScope([$one->id], $one->id, false);
        $numbers = $branchOne->apply(DB::table('orders'), 'orders.store_location_id')
            ->where('orders.status', 'pending')->orderBy('orders.id')->pluck('order_number')->all();
        $this->assertSame(['LEGACY', 'MIXED'], $numbers);

        $branchThree = new ReportBranchScope([$three->id], $three->id, false);
        $this->assertSame([], $branchThree->apply(DB::table('orders'), 'orders.store_location_id')->pluck('order_number')->all());

        $all = new ReportBranchScope([$one->id, $two->id, $three->id], null, true);
        $this->assertSame(1, $all->apply(DB::table('orders'), 'orders.store_location_id')
            ->where('orders.id', $mixed->id)->count());
    }

    public function test_eloquent_order_path_uses_the_same_sql_level_scope(): void
    {
        [$one, $two] = [$this->branch('ONE'), $this->branch('TWO')];
        $mixed = $this->order('MIXED-ELOQUENT', null, 'pending');
        $this->item($mixed->id, $two->id);

        $scope = new ReportBranchScope([$two->id], $two->id, false);
        $this->assertTrue($scope->apply(Order::query(), 'orders.store_location_id')->whereKey($mixed->id)->exists());
        $this->assertFalse((new ReportBranchScope([$one->id], $one->id, false))
            ->apply(Order::query(), 'orders.store_location_id')->whereKey($mixed->id)->exists());
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create(['name' => $code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true]);
    }

    private function order(string $number, ?int $branchId, string $status): Order
    {
        return Order::create(['order_number' => $number, 'status' => $status, 'payment_status' => 'unpaid', 'pickup_or_shipping' => 'shipping', 'store_location_id' => $branchId, 'subtotal' => 1, 'discount_total' => 0, 'shipping_fee' => 0, 'grand_total' => 1]);
    }

    private function item(int $orderId, int $branchId): void
    {
        $product = Product::create([
            'name' => 'Scope Product', 'slug' => uniqid('scope-'), 'sku' => uniqid('SCOPE-'),
            'type' => 'single', 'price' => 1, 'stock' => 0, 'stock_quantity' => 0,
            'track_stock' => false, 'is_active' => true,
        ]);
        DB::table('order_items')->insert([
            'order_id' => $orderId,
            'fulfillment_store_location_id' => $branchId,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'price_snapshot' => 1,
            'quantity' => 1,
            'line_total' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
