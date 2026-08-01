<?php

namespace Tests\Unit;

use App\Models\Ecommerce\OrderItem;
use App\Services\Booking\CustomerServicePackageService;
use App\Services\Ecommerce\InvoiceService;
use App\Services\Reports\SalesChannelReportService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

class SalesChannelBookingPackageMetaBatchTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'service_packages',
            'customer_service_packages',
            'customer_service_package_usages',
            'order_item_staff_splits',
            'order_items',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->unsignedBigInteger('booking_id')->nullable();
            $table->unsignedBigInteger('booking_service_id')->nullable();
            $table->string('line_type')->nullable();
            $table->timestamps();
        });

        Schema::create('order_item_staff_splits', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_item_id');
            $table->unsignedBigInteger('staff_id')->nullable();
            $table->json('snapshot')->nullable();
            $table->timestamps();
        });

        Schema::create('service_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('customer_service_packages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('service_package_id');
            $table->timestamps();
        });

        Schema::create('customer_service_package_usages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('customer_service_package_id');
            $table->unsignedBigInteger('booking_service_id')->nullable();
            $table->unsignedBigInteger('booking_id')->nullable();
            $table->string('used_from')->nullable();
            $table->unsignedBigInteger('used_ref_id')->nullable();
            $table->string('status');
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        foreach ([
            'customer_service_package_usages',
            'customer_service_packages',
            'service_packages',
            'order_item_staff_splits',
            'order_items',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_batch_package_meta_matches_per_line_resolvers(): void
    {
        $packageId = $this->insertPackage('Glow Package');
        $cspId = $this->insertCustomerPackage($packageId);

        $itemBookingScoped = $this->insertOrderItem(bookingId: 10, bookingServiceId: 20);
        $itemPosScoped = $this->insertOrderItem(bookingId: 11, bookingServiceId: 21);
        $itemNoService = $this->insertOrderItem(bookingId: 12, bookingServiceId: null);
        $itemNoMatch = $this->insertOrderItem(bookingId: 13, bookingServiceId: 22);

        $this->insertUsage($cspId, bookingServiceId: 20, bookingId: 10, status: 'consumed');
        $this->insertUsage($cspId, bookingServiceId: 21, bookingId: null, status: 'reserved', usedFrom: 'POS', usedRefId: 501);
        $this->insertUsage($cspId, bookingServiceId: 22, bookingId: 99, status: 'consumed');

        $this->insertStaffSplit($itemPosScoped, staffId: 1, cartServiceItemId: 501);

        $this->assertBatchMatchesPerLine([
            $itemBookingScoped,
            $itemPosScoped,
            $itemNoService,
            $itemNoMatch,
        ]);
    }

    public function test_missing_package_usage_returns_not_applied(): void
    {
        $item = $this->insertOrderItem(bookingId: 40, bookingServiceId: 400);
        $meta = $this->batchMetaForIds([$item]);

        $this->assertSame(['applied' => false, 'name' => null], $meta[$item]);
        $this->assertBatchMatchesPerLine([$item]);
    }

    public function test_multiple_usages_for_same_booking_service_selects_lowest_id(): void
    {
        $olderPackage = $this->insertPackage('Older Name');
        $newerPackage = $this->insertPackage('Newer Name');
        $olderCsp = $this->insertCustomerPackage($olderPackage);
        $newerCsp = $this->insertCustomerPackage($newerPackage);

        $item = $this->insertOrderItem(bookingId: 50, bookingServiceId: 500);

        // Insert newer first physically, then older with lower id intent via separate inserts —
        // ids are autoincrement so first insert wins as lowest id.
        $this->insertUsage($olderCsp, bookingServiceId: 500, bookingId: 50, status: 'consumed');
        $this->insertUsage($newerCsp, bookingServiceId: 500, bookingId: 50, status: 'reserved');

        $meta = $this->batchMetaForIds([$item]);
        $this->assertTrue($meta[$item]['applied']);
        $this->assertSame('Older Name', $meta[$item]['name']);
        $this->assertBatchMatchesPerLine([$item]);
    }

    public function test_cancelled_usage_is_ignored_while_consumed_counts(): void
    {
        $packageId = $this->insertPackage('Active Pack');
        $cspId = $this->insertCustomerPackage($packageId);
        $item = $this->insertOrderItem(bookingId: 60, bookingServiceId: 600);

        $this->insertUsage($cspId, bookingServiceId: 600, bookingId: 60, status: 'cancelled');
        $this->insertUsage($cspId, bookingServiceId: 600, bookingId: 60, status: 'consumed');

        $meta = $this->batchMetaForIds([$item]);
        $this->assertTrue($meta[$item]['applied']);
        $this->assertSame('Active Pack', $meta[$item]['name']);
        $this->assertBatchMatchesPerLine([$item]);
    }

    public function test_only_cancelled_usage_is_not_applied(): void
    {
        $packageId = $this->insertPackage('Cancelled Pack');
        $cspId = $this->insertCustomerPackage($packageId);
        $item = $this->insertOrderItem(bookingId: 61, bookingServiceId: 601);

        $this->insertUsage($cspId, bookingServiceId: 601, bookingId: 61, status: 'cancelled');

        $meta = $this->batchMetaForIds([$item]);
        $this->assertSame(['applied' => false, 'name' => null], $meta[$item]);
        $this->assertBatchMatchesPerLine([$item]);
    }

    public function test_applied_package_name_uses_current_service_package_name(): void
    {
        // Name comes from joined service_packages.name (live package), not a usage snapshot column.
        $packageId = $this->insertPackage('Live Package Title');
        $cspId = $this->insertCustomerPackage($packageId);
        $item = $this->insertOrderItem(bookingId: 70, bookingServiceId: 700);
        $this->insertUsage($cspId, bookingServiceId: 700, bookingId: 70, status: 'consumed');

        DB::table('service_packages')->where('id', $packageId)->update([
            'name' => 'Renamed Live Package Title',
            'updated_at' => now(),
        ]);

        $meta = $this->batchMetaForIds([$item]);
        $this->assertSame('Renamed Live Package Title', $meta[$item]['name']);
        $this->assertBatchMatchesPerLine([$item]);
    }

    public function test_missing_pos_cart_snapshot_does_not_match_pos_only_usage(): void
    {
        $packageId = $this->insertPackage('POS Pack');
        $cspId = $this->insertCustomerPackage($packageId);
        $item = $this->insertOrderItem(bookingId: 80, bookingServiceId: 800);

        // Usage only reachable via POS cart ref — no staff-split snapshot on the order item.
        $this->insertUsage($cspId, bookingServiceId: 800, bookingId: null, status: 'reserved', usedFrom: 'POS', usedRefId: 999);

        $meta = $this->batchMetaForIds([$item]);
        // booking_id=80 does not match usage.booking_id=null / used_ref_id=999 without cart ids.
        $this->assertSame(['applied' => false, 'name' => null], $meta[$item]);
        $this->assertBatchMatchesPerLine([$item]);
    }

    public function test_missing_staff_split_and_empty_snapshot_are_ignored(): void
    {
        $itemMissing = $this->insertOrderItem(bookingId: 90, bookingServiceId: 900);
        $itemEmpty = $this->insertOrderItem(bookingId: 91, bookingServiceId: 901);

        DB::table('order_item_staff_splits')->insert([
            'order_item_id' => $itemEmpty,
            'staff_id' => 1,
            'snapshot' => json_encode(['note' => 'no cart id']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $svc = app(CustomerServicePackageService::class);
        $batch = $svc->resolvePosCartServiceItemIdsForOrderItems([$itemMissing, $itemEmpty]);

        $this->assertSame([], $batch[$itemMissing]);
        $this->assertSame([], $batch[$itemEmpty]);
        $this->assertSame([], $svc->resolvePosCartServiceItemIdsForOrderItem($itemMissing));
        $this->assertSame([], $svc->resolvePosCartServiceItemIdsForOrderItem($itemEmpty));
    }

    public function test_multiple_staff_splits_collect_unique_cart_ids_in_id_order(): void
    {
        $item = $this->insertOrderItem(bookingId: 100, bookingServiceId: 1000);

        $this->insertStaffSplit($item, staffId: 1, cartServiceItemId: 30);
        $this->insertStaffSplit($item, staffId: 2, cartServiceItemId: 10);
        $this->insertStaffSplit($item, staffId: 3, cartServiceItemId: 30); // duplicate cart id
        $this->insertStaffSplit($item, staffId: 4, cartServiceItemId: 20);

        $svc = app(CustomerServicePackageService::class);
        $expected = $svc->resolvePosCartServiceItemIdsForOrderItem($item);
        $batch = $svc->resolvePosCartServiceItemIdsForOrderItems([$item])[$item];

        $this->assertSame([30, 10, 20], $expected);
        $this->assertSame($expected, $batch);
    }

    public function test_batch_pos_cart_ids_match_single_lookup(): void
    {
        $itemA = $this->insertOrderItem(bookingId: 1, bookingServiceId: 1);
        $itemB = $this->insertOrderItem(bookingId: 2, bookingServiceId: 2);

        $this->insertStaffSplit($itemA, staffId: 1, cartServiceItemId: 11);
        $this->insertStaffSplit($itemA, staffId: 2, cartServiceItemId: 12);
        $this->insertStaffSplit($itemB, staffId: 1, cartServiceItemId: 21);

        $svc = app(CustomerServicePackageService::class);
        $batch = $svc->resolvePosCartServiceItemIdsForOrderItems([$itemA, $itemB, 0]);

        $this->assertSame($svc->resolvePosCartServiceItemIdsForOrderItem($itemA), $batch[$itemA]);
        $this->assertSame($svc->resolvePosCartServiceItemIdsForOrderItem($itemB), $batch[$itemB]);
    }

    public function test_refund_style_package_fields_remain_false_null_when_usages_exist_elsewhere(): void
    {
        // Refund report rows hard-code package_applied=false / applied_package_name=null.
        // Ensure batching for settlement lines does not invent package meta for items without booking_service_id.
        $packageId = $this->insertPackage('Redeemed Pack');
        $cspId = $this->insertCustomerPackage($packageId);
        $settlement = $this->insertOrderItem(bookingId: 110, bookingServiceId: 1100);
        $refundLikeLine = $this->insertOrderItem(bookingId: null, bookingServiceId: null);

        $this->insertUsage($cspId, bookingServiceId: 1100, bookingId: 110, status: 'consumed');

        $meta = $this->batchMetaForIds([$settlement, $refundLikeLine]);
        $this->assertTrue($meta[$settlement]['applied']);
        $this->assertSame('Redeemed Pack', $meta[$settlement]['name']);
        $this->assertSame(['applied' => false, 'name' => null], $meta[$refundLikeLine]);
        $this->assertBatchMatchesPerLine([$settlement, $refundLikeLine]);
    }

    public function test_main_and_addon_apply_different_packages_same_booking(): void
    {
        // Mirrors production: one booking, settlement + addon lines with distinct booking_service_id.
        $bookingId = 200;
        $mainServiceId = 201; // booking_services.id for main
        $addonServiceId = 202; // booking_services.id for add-on
        $mainCartId = 901;
        $addonCartId = 902;

        $pkgA = $this->insertPackage('Package A Main');
        $pkgB = $this->insertPackage('Package B Addon');
        $cspA = $this->insertCustomerPackage($pkgA);
        $cspB = $this->insertCustomerPackage($pkgB);

        $mainItem = $this->insertOrderItem(bookingId: $bookingId, bookingServiceId: $mainServiceId, lineType: 'booking_settlement');
        $addonItem = $this->insertOrderItem(bookingId: $bookingId, bookingServiceId: $addonServiceId, lineType: 'booking_addon');

        $this->insertStaffSplit($mainItem, staffId: 1, cartServiceItemId: $mainCartId);
        $this->insertStaffSplit($addonItem, staffId: 1, cartServiceItemId: $addonCartId);

        $this->insertUsage($cspA, bookingServiceId: $mainServiceId, bookingId: $bookingId, status: 'consumed', usedFrom: 'POS', usedRefId: $mainCartId);
        $this->insertUsage($cspB, bookingServiceId: $addonServiceId, bookingId: $bookingId, status: 'consumed', usedFrom: 'POS', usedRefId: $addonCartId);

        $meta = $this->batchMetaForIds([$mainItem, $addonItem]);

        $this->assertSame(['applied' => true, 'name' => 'Package A Main'], $meta[$mainItem]);
        $this->assertSame(['applied' => true, 'name' => 'Package B Addon'], $meta[$addonItem]);
        $this->assertBatchMatchesPerLine([$mainItem, $addonItem]);
    }

    public function test_main_package_only_addon_without_package(): void
    {
        $bookingId = 210;
        $mainServiceId = 211;
        $addonServiceId = 212;

        $pkgA = $this->insertPackage('Main Only Pack');
        $cspA = $this->insertCustomerPackage($pkgA);

        $mainItem = $this->insertOrderItem(bookingId: $bookingId, bookingServiceId: $mainServiceId, lineType: 'booking_settlement');
        $addonItem = $this->insertOrderItem(bookingId: $bookingId, bookingServiceId: $addonServiceId, lineType: 'booking_addon');

        $this->insertUsage($cspA, bookingServiceId: $mainServiceId, bookingId: $bookingId, status: 'consumed');
        // No usage for addonServiceId — addon must stay not applied even though same booking_id.

        $meta = $this->batchMetaForIds([$mainItem, $addonItem]);

        $this->assertSame(['applied' => true, 'name' => 'Main Only Pack'], $meta[$mainItem]);
        $this->assertSame(['applied' => false, 'name' => null], $meta[$addonItem]);
        $this->assertBatchMatchesPerLine([$mainItem, $addonItem]);
    }

    public function test_addon_package_only_main_without_package(): void
    {
        $bookingId = 220;
        $mainServiceId = 221;
        $addonServiceId = 222;

        $pkgB = $this->insertPackage('Addon Only Pack');
        $cspB = $this->insertCustomerPackage($pkgB);

        $mainItem = $this->insertOrderItem(bookingId: $bookingId, bookingServiceId: $mainServiceId, lineType: 'booking_settlement');
        $addonItem = $this->insertOrderItem(bookingId: $bookingId, bookingServiceId: $addonServiceId, lineType: 'booking_addon');

        $this->insertUsage($cspB, bookingServiceId: $addonServiceId, bookingId: $bookingId, status: 'reserved');

        $meta = $this->batchMetaForIds([$mainItem, $addonItem]);

        $this->assertSame(['applied' => false, 'name' => null], $meta[$mainItem]);
        $this->assertSame(['applied' => true, 'name' => 'Addon Only Pack'], $meta[$addonItem]);
        $this->assertBatchMatchesPerLine([$mainItem, $addonItem]);
    }

    public function test_two_addons_apply_different_packages_same_booking(): void
    {
        $bookingId = 230;
        $mainServiceId = 231;
        $addon1ServiceId = 232;
        $addon2ServiceId = 233;

        $pkgB = $this->insertPackage('Addon Pack One');
        $pkgC = $this->insertPackage('Addon Pack Two');
        $cspB = $this->insertCustomerPackage($pkgB);
        $cspC = $this->insertCustomerPackage($pkgC);

        $mainItem = $this->insertOrderItem(bookingId: $bookingId, bookingServiceId: $mainServiceId, lineType: 'booking_settlement');
        $addon1 = $this->insertOrderItem(bookingId: $bookingId, bookingServiceId: $addon1ServiceId, lineType: 'booking_addon');
        $addon2 = $this->insertOrderItem(bookingId: $bookingId, bookingServiceId: $addon2ServiceId, lineType: 'booking_addon');

        $this->insertStaffSplit($addon1, staffId: 1, cartServiceItemId: 801);
        $this->insertStaffSplit($addon2, staffId: 2, cartServiceItemId: 802);

        $this->insertUsage($cspB, bookingServiceId: $addon1ServiceId, bookingId: null, status: 'consumed', usedFrom: 'POS', usedRefId: 801);
        $this->insertUsage($cspC, bookingServiceId: $addon2ServiceId, bookingId: null, status: 'consumed', usedFrom: 'POS', usedRefId: 802);

        $meta = $this->batchMetaForIds([$mainItem, $addon1, $addon2]);

        $this->assertSame(['applied' => false, 'name' => null], $meta[$mainItem]);
        $this->assertSame(['applied' => true, 'name' => 'Addon Pack One'], $meta[$addon1]);
        $this->assertSame(['applied' => true, 'name' => 'Addon Pack Two'], $meta[$addon2]);
        $this->assertBatchMatchesPerLine([$mainItem, $addon1, $addon2]);
    }

    public function test_same_booking_different_cart_ids_do_not_cross_attach_packages(): void
    {
        // Both lines share booking_id; usages only match via POS cart refs.
        // Main cart 701 → Pack A; addon cart 702 → Pack B. Cross-attach must not happen.
        $bookingId = 240;
        $mainServiceId = 241;
        $addonServiceId = 242;

        $pkgA = $this->insertPackage('Cart Scoped Main');
        $pkgB = $this->insertPackage('Cart Scoped Addon');
        $cspA = $this->insertCustomerPackage($pkgA);
        $cspB = $this->insertCustomerPackage($pkgB);

        $mainItem = $this->insertOrderItem(bookingId: $bookingId, bookingServiceId: $mainServiceId, lineType: 'booking_settlement');
        $addonItem = $this->insertOrderItem(bookingId: $bookingId, bookingServiceId: $addonServiceId, lineType: 'booking_addon');

        $this->insertStaffSplit($mainItem, staffId: 1, cartServiceItemId: 701);
        $this->insertStaffSplit($addonItem, staffId: 1, cartServiceItemId: 702);

        // booking_id left null so scope relies on used_ref_id ↔ cart_service_item_id
        $this->insertUsage($cspA, bookingServiceId: $mainServiceId, bookingId: null, status: 'reserved', usedFrom: 'POS', usedRefId: 701);
        $this->insertUsage($cspB, bookingServiceId: $addonServiceId, bookingId: null, status: 'reserved', usedFrom: 'POS', usedRefId: 702);

        $meta = $this->batchMetaForIds([$mainItem, $addonItem]);

        $this->assertSame(['applied' => true, 'name' => 'Cart Scoped Main'], $meta[$mainItem]);
        $this->assertSame(['applied' => true, 'name' => 'Cart Scoped Addon'], $meta[$addonItem]);
        $this->assertBatchMatchesPerLine([$mainItem, $addonItem]);
    }

    /**
     * @param  list<int>  $ids
     * @return array<int, array{applied: bool, name: ?string}>
     */
    private function batchMetaForIds(array $ids): array
    {
        $items = OrderItem::query()->whereIn('id', $ids)->orderBy('id')->get();
        $service = new SalesChannelReportService(app(InvoiceService::class));
        $method = new ReflectionMethod(SalesChannelReportService::class, 'resolveLinePackageMetaForOrderItems');
        $method->setAccessible(true);

        return $method->invoke($service, $items);
    }

    /** @param  list<int>  $ids */
    private function assertBatchMatchesPerLine(array $ids): void
    {
        $items = OrderItem::query()->whereIn('id', $ids)->orderBy('id')->get();
        $service = new SalesChannelReportService(app(InvoiceService::class));

        $batchMethod = new ReflectionMethod(SalesChannelReportService::class, 'resolveLinePackageMetaForOrderItems');
        $batchMethod->setAccessible(true);
        $batch = $batchMethod->invoke($service, $items);

        $appliedMethod = new ReflectionMethod(SalesChannelReportService::class, 'resolveLinePackageApplied');
        $appliedMethod->setAccessible(true);
        $nameMethod = new ReflectionMethod(SalesChannelReportService::class, 'resolveLinePackageName');
        $nameMethod->setAccessible(true);

        foreach ($items as $item) {
            $expected = [
                'applied' => (bool) $appliedMethod->invoke($service, $item),
                'name' => $nameMethod->invoke($service, $item),
            ];
            $this->assertSame(
                $expected,
                $batch[(int) $item->id] ?? null,
                'Batch package meta must match per-line resolvers for order_item '.$item->id
            );
        }
    }

    private function insertPackage(string $name): int
    {
        return (int) DB::table('service_packages')->insertGetId([
            'name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertCustomerPackage(int $servicePackageId): int
    {
        return (int) DB::table('customer_service_packages')->insertGetId([
            'service_package_id' => $servicePackageId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertUsage(
        int $cspId,
        int $bookingServiceId,
        ?int $bookingId,
        string $status,
        ?string $usedFrom = null,
        ?int $usedRefId = null,
    ): int {
        return (int) DB::table('customer_service_package_usages')->insertGetId([
            'customer_service_package_id' => $cspId,
            'booking_service_id' => $bookingServiceId,
            'booking_id' => $bookingId,
            'used_from' => $usedFrom,
            'used_ref_id' => $usedRefId,
            'status' => $status,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertStaffSplit(int $orderItemId, int $staffId, int $cartServiceItemId): void
    {
        DB::table('order_item_staff_splits')->insert([
            'order_item_id' => $orderItemId,
            'staff_id' => $staffId,
            'snapshot' => json_encode(['cart_service_item_id' => $cartServiceItemId]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertOrderItem(?int $bookingId, ?int $bookingServiceId, string $lineType = 'booking_settlement'): int
    {
        return (int) DB::table('order_items')->insertGetId([
            'order_id' => 1,
            'booking_id' => $bookingId,
            'booking_service_id' => $bookingServiceId,
            'line_type' => $lineType,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
