<?php

namespace Database\Seeders;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingService;
use App\Models\Booking\StaffCommissionTier;
use App\Models\Booking\StaffMonthlySale;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderItemStaffSplit;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ServicePackageStaffSplit;
use App\Models\Staff;
use App\Services\Booking\StaffCommissionService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class CommissionTestingSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedCommissionTestingData();
    }

    public function seedCommissionTestingData(bool $fresh = false): void
    {
        if ($fresh) {
            $this->truncateCommissionTables();
        }

        $this->seedCommissionTiers();
        $staffIds = $this->resolveStaffIds();
        $services = $this->resolveServices();

        $this->seedCompletedBookingsAcrossMonths($staffIds, $services);
        $this->seedEcommerceAndPackageSplits($staffIds);

        $this->seedManualMonthlySalesRows($staffIds);
        $this->recalculateFromBookings($staffIds);
        $this->recalculateFromEcommerceSplits();
    }

    private function truncateCommissionTables(): void
    {
        $tables = ['staff_monthly_sales', 'staff_commission_tiers'];
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('TRUNCATE TABLE ' . implode(', ', $tables) . ' RESTART IDENTITY CASCADE');
            return;
        }

        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            foreach ($tables as $table) {
                DB::table($table)->truncate();
            }
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
            return;
        }

        foreach ($tables as $table) {
            DB::table($table)->truncate();
        }
    }

    private function seedCommissionTiers(): void
    {
        if (!Schema::hasTable('staff_commission_tiers')) {
            return;
        }

        $rows = [
            ['min_sales' => 0, 'commission_percent' => 0],
            ['min_sales' => 5000, 'commission_percent' => 5],
            ['min_sales' => 8000, 'commission_percent' => 10],
        ];

        foreach ([StaffCommissionService::TYPE_BOOKING, StaffCommissionService::TYPE_ECOMMERCE] as $type) {
            foreach ($rows as $row) {
                StaffCommissionTier::query()->updateOrCreate(
                    ['type' => $type, 'min_sales' => $row['min_sales']],
                    ['commission_percent' => $row['commission_percent']]
                );
            }
        }
    }

    private function resolveStaffIds(): array
    {
        $ids = Staff::query()->orderBy('id')->limit(3)->pluck('id')->all();

        while (count($ids) < 3) {
            $index = count($ids) + 1;
            $staff = Staff::query()->create([
                'code' => 'CM-STAFF-' . strtoupper(substr(md5((string) microtime(true) . $index), 0, 6)),
                'name' => 'Commission Testing Staff ' . $index,
                'phone' => '6011999000' . $index,
                'email' => 'commission.testing.staff.' . $index . '@example.com',
                'commission_rate' => 0.10,
                'service_commission_rate' => 0.12,
                'is_active' => true,
            ]);
            $ids[] = $staff->id;
        }

        foreach (array_values(array_slice($ids, 0, 3)) as $idx => $staffId) {
            Staff::query()->where('id', $staffId)->update([
                'commission_rate' => [0.10, 0.08, 0.12][$idx] ?? 0.1,
                'service_commission_rate' => [0.12, 0.10, 0.15][$idx] ?? 0.12,
            ]);
        }

        return array_values(array_slice($ids, 0, 3));
    }

    private function resolveServices(): array
    {
        $specs = [
            ['name' => 'Commission Test Basic', 'service_price' => 1200, 'duration_min' => 30, 'deposit_amount' => 50],
            ['name' => 'Commission Test Premium', 'service_price' => 2600, 'duration_min' => 60, 'deposit_amount' => 80],
        ];

        $services = [];
        foreach ($specs as $spec) {
            $payload = [
                'name' => $spec['name'],
                'description' => 'Service for commission test seeder',
                'service_type' => 'standard',
                'duration_min' => $spec['duration_min'],
                'deposit_amount' => $spec['deposit_amount'],
                'buffer_min' => 15,
                'is_active' => true,
            ];

            if (Schema::hasColumn('booking_services', 'service_price')) {
                $payload['service_price'] = $spec['service_price'];
            }

            $services[] = BookingService::query()->updateOrCreate(
                ['name' => $spec['name']],
                $payload
            );
        }

        return $services;
    }

    private function seedCompletedBookingsAcrossMonths(array $staffIds, array $services): void
    {
        $now = Carbon::now();
        $months = [
            $now->copy()->startOfMonth(),
            $now->copy()->subMonth()->startOfMonth(),
            $now->copy()->subMonths(2)->startOfMonth(),
        ];

        foreach ($staffIds as $staffIndex => $staffId) {
            foreach ($months as $monthIndex => $monthStart) {
                foreach ([0, 1] as $bookingIndex) {
                    $service = $services[($staffIndex + $bookingIndex) % count($services)];
                    $startAt = $monthStart->copy()->addDays(3 + $bookingIndex + $staffIndex)->setTime(10 + $bookingIndex, 0);
                    $completedAt = $startAt->copy()->addHours(1);

                    Booking::query()->updateOrCreate(
                        ['booking_code' => sprintf('CMTEST-%d-%d-%d', $staffId, $monthIndex + 1, $bookingIndex + 1)],
                        [
                            'source' => 'STAFF',
                            'customer_id' => null,
                            'staff_id' => $staffId,
                            'service_id' => $service->id,
                            'start_at' => $startAt,
                            'end_at' => $startAt->copy()->addMinutes((int) $service->duration_min),
                            'buffer_min' => (int) ($service->buffer_min ?? 15),
                            'status' => 'COMPLETED',
                            'deposit_amount' => (float) $service->deposit_amount,
                            'payment_status' => 'PAID',
                            'completed_at' => $completedAt,
                            'commission_counted_at' => $completedAt,
                            'notes' => 'CommissionTestingSeeder completed booking',
                        ]
                    );
                }
            }
        }
    }

    private function seedEcommerceAndPackageSplits(array $staffIds): void
    {
        $now = Carbon::now();
        $customerId = $this->resolveCustomerId();

        $product = Product::query()->updateOrCreate(
            ['slug' => 'commission-test-product'],
            [
                'name' => 'Commission Test Product',
                'sku' => 'CM-PROD-001',
                'price' => 1000,
                'stock' => 100,
                'is_active' => true,
            ]
        );

        $servicePackageId = (int) DB::table('service_packages')->updateOrInsert(
            ['name' => 'Commission Test Package'],
            [
                'description' => 'Seeder package for ecommerce commission tier test',
                'selling_price' => 800,
                'valid_days' => 90,
                'is_active' => true,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        $servicePackageId = (int) DB::table('service_packages')->where('name', 'Commission Test Package')->value('id');

        $windows = [
            ['label' => 'current', 'date' => $now->copy()->startOfMonth()->addDays(5)],
            ['label' => 'previous', 'date' => $now->copy()->subMonth()->startOfMonth()->addDays(8)],
        ];

        foreach ($windows as $window) {
            $order = Order::query()->updateOrCreate(
                ['order_number' => 'CM-ECOM-' . strtoupper($window['label']) . '-' . $now->format('Ym')],
                [
                    'customer_id' => $customerId,
                    'status' => 'completed',
                    'payment_status' => 'paid',
                    'payment_method' => 'cash',
                    'subtotal' => 1800,
                    'discount_total' => 0,
                    'shipping_fee' => 0,
                    'grand_total' => 1800,
                    'pickup_or_shipping' => 'pickup',
                    'placed_at' => $window['date'],
                    'paid_at' => $window['date'],
                    'completed_at' => $window['date'],
                ]
            );
            $order->created_at = $window['date'];
            $order->updated_at = $window['date'];
            $order->save();

            $orderItem = OrderItem::query()->updateOrCreate(
                [
                    'order_id' => $order->id,
                    'product_name_snapshot' => 'Commission Test Product',
                ],
                [
                    'product_id' => $product->id,
                    'sku_snapshot' => 'CM-PROD-001',
                    'price_snapshot' => 1000,
                    'quantity' => 1,
                    'line_total' => 1000,
                    'line_total_snapshot' => 1000,
                    'effective_line_total' => 1000,
                    'is_package' => false,
                ]
            );

            OrderItemStaffSplit::query()->updateOrCreate(
                ['order_item_id' => $orderItem->id, 'staff_id' => $staffIds[0]],
                [
                    'share_percent' => 60,
                    'commission_rate_snapshot' => 0.10,
                ]
            );

            OrderItemStaffSplit::query()->updateOrCreate(
                ['order_item_id' => $orderItem->id, 'staff_id' => $staffIds[1]],
                [
                    'share_percent' => 40,
                    'commission_rate_snapshot' => 0.08,
                ]
            );

            $customerServicePackageId = (int) DB::table('customer_service_packages')->updateOrInsert(
                [
                    'customer_id' => $customerId,
                    'service_package_id' => $servicePackageId,
                    'purchased_from' => 'POS',
                    'purchased_ref_id' => $order->id,
                ],
                [
                    'status' => 'active',
                    'started_at' => $window['date'],
                    'expires_at' => $window['date']->copy()->addDays(90),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

            $customerServicePackageId = (int) DB::table('customer_service_packages')
                ->where('customer_id', $customerId)
                ->where('service_package_id', $servicePackageId)
                ->where('purchased_ref_id', $order->id)
                ->value('id');

            ServicePackageStaffSplit::query()->updateOrCreate(
                [
                    'order_id' => $order->id,
                    'customer_service_package_id' => $customerServicePackageId,
                    'staff_id' => $staffIds[0],
                ],
                [
                    'service_package_id' => $servicePackageId,
                    'customer_id' => $customerId,
                    'share_percent' => 50,
                    'split_sales_amount' => 400,
                    'service_commission_rate_snapshot' => 0.12,
                    'commission_amount_snapshot' => 48,
                ]
            );

            ServicePackageStaffSplit::query()->updateOrCreate(
                [
                    'order_id' => $order->id,
                    'customer_service_package_id' => $customerServicePackageId,
                    'staff_id' => $staffIds[2],
                ],
                [
                    'service_package_id' => $servicePackageId,
                    'customer_id' => $customerId,
                    'share_percent' => 50,
                    'split_sales_amount' => 400,
                    'service_commission_rate_snapshot' => 0.15,
                    'commission_amount_snapshot' => 60,
                ]
            );
        }
    }

    private function seedManualMonthlySalesRows(array $staffIds): void
    {
        $now = Carbon::now();
        $targetYear = (int) $now->format('Y');
        $targetMonth = (int) $now->format('m');

        StaffMonthlySale::query()->updateOrCreate(
            [
                'type' => StaffCommissionService::TYPE_BOOKING,
                'staff_id' => $staffIds[0],
                'year' => $targetYear,
                'month' => $targetMonth,
            ],
            [
                'total_sales' => 0,
                'booking_count' => 0,
                'tier_percent' => 0,
                'commission_amount' => 0,
                'is_overridden' => false,
                'override_amount' => null,
            ]
        );

        StaffMonthlySale::query()->updateOrCreate(
            [
                'type' => StaffCommissionService::TYPE_BOOKING,
                'staff_id' => $staffIds[1],
                'year' => $targetYear,
                'month' => $targetMonth,
            ],
            [
                'total_sales' => 9000,
                'booking_count' => 4,
                'tier_percent' => 10,
                'commission_amount' => 1200,
                'is_overridden' => true,
                'override_amount' => 1200,
            ]
        );

        StaffMonthlySale::query()->updateOrCreate(
            [
                'type' => StaffCommissionService::TYPE_ECOMMERCE,
                'staff_id' => $staffIds[2],
                'year' => $targetYear,
                'month' => $targetMonth,
            ],
            [
                'total_sales' => 0,
                'booking_count' => 0,
                'tier_percent' => 0,
                'commission_amount' => 0,
                'is_overridden' => false,
                'override_amount' => null,
            ]
        );
    }

    private function recalculateFromBookings(array $staffIds): void
    {
        /** @var StaffCommissionService $service */
        $service = app(StaffCommissionService::class);
        $bookings = Booking::query()
            ->whereIn('staff_id', $staffIds)
            ->where('status', 'COMPLETED')
            ->whereNotNull('completed_at')
            ->get(['staff_id', 'completed_at']);

        $seen = [];
        foreach ($bookings as $booking) {
            $completedAt = Carbon::parse($booking->completed_at);
            $year = (int) $completedAt->format('Y');
            $month = (int) $completedAt->format('m');
            $key = $booking->staff_id . '-' . $year . '-' . $month;
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $service->recalculateForStaffMonth((int) $booking->staff_id, $year, $month, StaffCommissionService::TYPE_BOOKING);
        }
    }

    private function recalculateFromEcommerceSplits(): void
    {
        /** @var StaffCommissionService $service */
        $service = app(StaffCommissionService::class);

        $months = Order::query()
            ->where(function ($query) {
                $query->where('status', 'completed')
                    ->orWhere('payment_status', 'paid');
            })
            ->whereNotIn('status', ['cancelled', 'draft'])
            ->whereNull('refunded_at')
            ->selectRaw('EXTRACT(YEAR FROM created_at)::int AS year')
            ->selectRaw('EXTRACT(MONTH FROM created_at)::int AS month')
            ->groupByRaw('EXTRACT(YEAR FROM created_at), EXTRACT(MONTH FROM created_at)')
            ->get();

        foreach ($months as $monthRow) {
            $service->recalculateForMonthAll((int) $monthRow->year, (int) $monthRow->month, StaffCommissionService::TYPE_ECOMMERCE);
        }
    }

    private function resolveCustomerId(): int
    {
        $existing = DB::table('customers')->orderBy('id')->value('id');
        if ($existing) {
            return (int) $existing;
        }

        return (int) DB::table('customers')->insertGetId([
            'name' => 'Commission Seeder Customer',
            'email' => 'commission.seeder.customer@example.com',
            'phone' => '60112223399',
            'password' => Hash::make('Password123!'),
            'tier' => 'basic',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
