<?php

namespace Tests\Feature;

use App\Models\Booking\Booking;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\StoreLocationProductInventory;
use App\Http\Controllers\Ecommerce\DashboardAnalyticsController;
use App\Models\User;
use App\Services\Reports\ReportBranchScope;
use App\Services\Reports\SalesReportService;
use App\Services\StoreLocationAccessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class Phase9BReportingScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_sales_specific_branch_uses_persisted_business_branch_and_excludes_null(): void
    {
        [$user, $a, $b] = $this->actorAndBranches();
        $this->order($a, 'SHIP-A', 10, 'shipping');
        $this->order($b, 'PICK-B', 20, 'pickup', $b);
        $this->order(null, 'LEGACY', 30);
        $this->bindRequest($user, ['branch_store_location_id' => $a->id]);

        $totals = app(SalesReportService::class)->getOverview(now()->subDay(), now()->addDay())['totals'];
        $this->assertSame(1, $totals['orders_count']);
        $this->assertSame(10.0, $totals['revenue']);
    }

    public function test_sales_all_is_accessible_plus_unassigned_and_excludes_inaccessible_branch(): void
    {
        [$user, $a, $b, $c] = $this->actorAndBranches(includeInaccessible: true);
        $this->order($a, 'A', 10); $this->order($b, 'B', 20); $this->order($c, 'C', 40); $this->order(null, 'NULL', 5);
        $this->bindRequest($user, ['branch_scope' => 'all']);

        $totals = app(SalesReportService::class)->getOverview(now()->subDay(), now()->addDay())['totals'];
        $this->assertSame(3, $totals['orders_count']);
        $this->assertSame(35.0, $totals['revenue']);
    }

    public function test_manual_inaccessible_branch_is_rejected(): void
    {
        [$user, , , $c] = $this->actorAndBranches(includeInaccessible: true);
        $request = $this->bindRequest($user, ['branch_store_location_id' => $c->id]);
        $this->expectException(HttpException::class);
        ReportBranchScope::fromRequest($request, app(StoreLocationAccessService::class));
    }

    public function test_booking_scope_uses_booking_history_not_current_staff_assignment(): void
    {
        [$user, $a, $b] = $this->actorAndBranches();
        Booking::query()->create(['booking_code' => 'A', 'store_location_id' => $a->id, 'start_at' => now(), 'end_at' => now()->addHour(), 'status' => 'CONFIRMED']);
        Booking::query()->create(['booking_code' => 'B', 'store_location_id' => $b->id, 'start_at' => now(), 'end_at' => now()->addHour(), 'status' => 'CONFIRMED']);
        Booking::query()->create(['booking_code' => 'NULL', 'store_location_id' => null, 'start_at' => now(), 'end_at' => now()->addHour(), 'status' => 'CONFIRMED']);
        $this->bindRequest($user, ['branch_store_location_id' => $a->id]);

        $this->assertSame(['A'], ReportBranchScope::applyCurrent(Booking::query(), 'bookings.store_location_id')->pluck('booking_code')->all());
    }

    public function test_all_branch_inventory_excludes_inaccessible_and_preserves_a_low_shortage(): void
    {
        [$user, $a, $b, $c] = $this->actorAndBranches(includeInaccessible: true);
        $product = Product::query()->create(['name' => 'X', 'slug' => 'x', 'sku' => 'X', 'type' => 'single', 'price' => 10, 'cost_price' => 2, 'stock' => 42, 'stock_quantity' => 42, 'track_stock' => true, 'low_stock_threshold' => 5, 'is_active' => true]);
        $product->storeLocations()->sync([$a->id => ['is_available' => true], $b->id => ['is_available' => true], $c->id => ['is_available' => true]]);
        foreach ([[$a, 2], [$b, 20], [$c, 20]] as [$branch, $qty]) {
            StoreLocationProductInventory::query()->create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => null, 'quantity' => $qty]);
        }
        $request = $this->bindRequest($user, ['branch_scope' => 'all']);

        $payload = app(DashboardAnalyticsController::class)->ecommerce($request, app(StoreLocationAccessService::class))->getData(true);
        $this->assertSame(22, $payload['products']['current_stock_qty']);
        $this->assertSame(1, $payload['products']['low_stock_count']);
    }

    private function actorAndBranches(bool $includeInaccessible = false): array
    {
        $user = User::factory()->create();
        $a = $this->branch('A'); $b = $this->branch('B');
        $user->storeLocations()->sync([$a->id, $b->id]);
        if ($includeInaccessible) return [$user, $a, $b, $this->branch('C')];
        return [$user, $a, $b];
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::query()->create(['name' => $code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true]);
    }

    private function order(?StoreLocation $branch, string $number, float $total, string $mode = 'shipping', ?StoreLocation $pickup = null): Order
    {
        return Order::query()->create(['order_number' => $number, 'store_location_id' => $branch?->id, 'pickup_store_id' => $pickup?->id, 'pickup_or_shipping' => $mode, 'status' => 'completed', 'payment_status' => 'paid', 'subtotal' => $total, 'discount_total' => 0, 'shipping_fee' => 0, 'grand_total' => $total, 'placed_at' => now()]);
    }

    private function bindRequest(User $user, array $query): Request
    {
        $request = Request::create('/report', 'GET', $query);
        $request->setUserResolver(fn () => $user);
        app()->instance('request', $request);
        return $request;
    }
}
