<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class ServicePackageTestingSeeder extends Seeder
{
    public function run(): void
    {
        if (!Schema::hasTable('service_packages') || !Schema::hasTable('customer_service_packages')) {
            $this->command?->warn('Service package tables not found. Run migrations first.');
            return;
        }

        $customerId = $this->resolveCustomerId();
        $serviceIds = $this->resolveBookingServices();

        if (count($serviceIds) === 0) {
            $this->command?->warn('No booking services available for package seeding.');
            return;
        }

        $this->seedStaffServiceCommissionRates();
        $packageIds = $this->seedServicePackages($serviceIds);
        $this->seedServiceQuestionsAndOptions($serviceIds);
        $this->seedCustomerOwnershipAndBalances($customerId, $packageIds);

        $this->command?->info('Service package testing data seeded successfully.');
    }

    private function resolveCustomerId(): int
    {
        $existing = DB::table('customers')->orderBy('id')->value('id');
        if ($existing) {
            return (int) $existing;
        }

        return (int) DB::table('customers')->insertGetId([
            'name' => 'Service Package Demo Customer',
            'email' => 'service.package.demo.customer@example.com',
            'phone' => '60123450000',
            'password' => Hash::make('Password123!'),
            'tier' => 'basic',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @return int[]
     */
    private function resolveBookingServices(): array
    {
        $serviceIds = DB::table('booking_services')->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id)->all();

        if (count($serviceIds) > 0) {
            $this->ensureBookingServicePriceAndEligibility($serviceIds);
            $this->ensureBookingCategoryAndPrimarySlots($serviceIds);
            return $serviceIds;
        }

        $now = now();
        $defaults = [
            [
                'name' => 'Seed Hair Wash',
                'description' => 'Service package seed: hair wash.',
                'service_type' => 'standard',
                'duration_min' => 30,
                'buffer_min' => 15,
                'deposit_amount' => 10,
                'service_price' => 45,
                'price' => 45,
                'is_package_eligible' => true,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Seed Scalp Treatment',
                'description' => 'Service package seed: scalp treatment.',
                'service_type' => 'premium',
                'duration_min' => 60,
                'buffer_min' => 15,
                'deposit_amount' => 20,
                'service_price' => 120,
                'price' => 120,
                'is_package_eligible' => true,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        foreach ($defaults as $payload) {
            DB::table('booking_services')->insert($this->filterBookingServiceColumns($payload));
        }

        $serviceIds = DB::table('booking_services')->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id)->all();
        $this->ensureBookingCategoryAndPrimarySlots($serviceIds);

        return $serviceIds;
    }

    private function ensureBookingServicePriceAndEligibility(array $serviceIds): void
    {
        if (Schema::hasColumn('booking_services', 'price')) {
            DB::table('booking_services')
                ->whereIn('id', $serviceIds)
                ->whereNull('price')
                ->update(['price' => DB::raw('COALESCE(service_price, 0)'), 'updated_at' => now()]);
        }

        if (Schema::hasColumn('booking_services', 'is_package_eligible')) {
            DB::table('booking_services')
                ->whereIn('id', $serviceIds)
                ->whereNull('is_package_eligible')
                ->update(['is_package_eligible' => true, 'updated_at' => now()]);
        }
    }

    private function filterBookingServiceColumns(array $payload): array
    {
        return collect($payload)
            ->filter(fn ($_value, $key) => Schema::hasColumn('booking_services', $key))
            ->all();
    }

    /**
     * @param int[] $serviceIds
     */
    private function ensureBookingCategoryAndPrimarySlots(array $serviceIds): void
    {
        $now = now();

        if (Schema::hasTable('booking_service_categories') && Schema::hasTable('booking_service_category_service')) {
            DB::table('booking_service_categories')->updateOrInsert(
                ['slug' => 'seed-service-packages'],
                [
                    'name' => 'Seed Service Packages',
                    'description' => 'Auto-seeded category used for package QA.',
                    'is_active' => true,
                    'sort_order' => 99,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );

            $categoryId = (int) DB::table('booking_service_categories')
                ->where('slug', 'seed-service-packages')
                ->value('id');

            foreach ($serviceIds as $serviceId) {
                DB::table('booking_service_category_service')->updateOrInsert(
                    [
                        'booking_service_category_id' => $categoryId,
                        'booking_service_id' => (int) $serviceId,
                    ],
                    [
                        'updated_at' => $now,
                        'created_at' => $now,
                    ]
                );
            }
        }

        if (Schema::hasTable('booking_service_primary_slots')) {
            foreach ($serviceIds as $serviceId) {
                $baseTimes = ['10:00:00', '13:00:00', '16:00:00'];

                DB::table('booking_service_primary_slots')
                    ->where('booking_service_id', (int) $serviceId)
                    ->delete();

                foreach ($baseTimes as $slotOrder => $time) {
                    DB::table('booking_service_primary_slots')->insert([
                        'booking_service_id' => (int) $serviceId,
                        'start_time' => $time,
                        'sort_order' => $slotOrder,
                        'is_active' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }
    }

    private function seedStaffServiceCommissionRates(): void
    {
        if (!Schema::hasColumn('staffs', 'service_commission_rate')) {
            return;
        }

        DB::table('staffs')
            ->orderBy('id')
            ->limit(5)
            ->update([
                'service_commission_rate' => 0.10,
                'updated_at' => now(),
            ]);
    }

    /**
     * @param int[] $serviceIds
     */
    private function seedServiceQuestionsAndOptions(array $serviceIds): void
    {
        if (!Schema::hasTable('booking_service_questions') || !Schema::hasTable('booking_service_question_options')) {
            return;
        }

        $serviceId = (int) ($serviceIds[0] ?? 0);
        if ($serviceId <= 0) {
            return;
        }

        $now = now();

        DB::table('booking_service_questions')
            ->where('booking_service_id', $serviceId)
            ->delete();

        $questionId = DB::table('booking_service_questions')->insertGetId([
            'booking_service_id' => $serviceId,
            'title' => 'Package QA Add-ons',
            'description' => 'Use this to verify package covers main service only, while add-ons remain chargeable.',
            'question_type' => 'multi_choice',
            'sort_order' => 1,
            'is_required' => false,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $addonServices = DB::table('booking_services')
            ->where('id', '!=', $serviceId)
            ->where('is_active', true)
            ->orderBy('id')
            ->limit(2)
            ->get(['id', 'name', 'duration_min', 'service_price']);

        if ($addonServices->isEmpty()) {
            return;
        }

        foreach ($addonServices as $index => $addonService) {
            DB::table('booking_service_question_options')->insert([
                'booking_service_question_id' => $questionId,
                'label' => (string) ($addonService->name ?? ('Package QA Add-on ' . ($index + 1))),
                'linked_booking_service_id' => (int) $addonService->id,
                'extra_duration_min' => max(0, (int) ($addonService->duration_min ?? 0)),
                'extra_price' => max(0, (float) ($addonService->service_price ?? 0)),
                'sort_order' => $index + 1,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * @param int[] $serviceIds
     * @return array<string, int>
     */
    private function seedServicePackages(array $serviceIds): array
    {
        $now = now();
        $primaryServiceId = $serviceIds[0];
        $secondaryServiceId = $serviceIds[1] ?? $serviceIds[0];

        $packages = [
            'Seed Hair Wash 10x' => [
                'description' => 'Auto seed package for QA: 10 sessions of hair wash.',
                'selling_price' => 350,
                'valid_days' => 180,
                'is_active' => true,
                'items' => [
                    ['booking_service_id' => $primaryServiceId, 'quantity' => 10],
                ],
            ],
            'Seed Premium Care Combo' => [
                'description' => 'Auto seed package for QA: combo package with 2 services.',
                'selling_price' => 899,
                'valid_days' => 365,
                'is_active' => true,
                'items' => [
                    ['booking_service_id' => $primaryServiceId, 'quantity' => 10],
                    ['booking_service_id' => $secondaryServiceId, 'quantity' => 5],
                ],
            ],
        ];

        $packageIds = [];

        foreach ($packages as $name => $package) {
            $packageId = DB::table('service_packages')->updateOrInsert(
                ['name' => $name],
                [
                    'description' => $package['description'],
                    'selling_price' => $package['selling_price'],
                    'valid_days' => $package['valid_days'],
                    'is_active' => $package['is_active'],
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );

            // updateOrInsert returns bool in query builder, fetch id explicitly
            $resolvedPackageId = (int) DB::table('service_packages')->where('name', $name)->value('id');
            $packageIds[$name] = $resolvedPackageId;

            foreach ($package['items'] as $item) {
                DB::table('service_package_items')->updateOrInsert(
                    [
                        'service_package_id' => $resolvedPackageId,
                        'booking_service_id' => $item['booking_service_id'],
                    ],
                    [
                        'quantity' => $item['quantity'],
                        'updated_at' => $now,
                        'created_at' => $now,
                    ]
                );
            }
        }

        return $packageIds;
    }

    /**
     * @param array<string, int> $packageIds
     */
    private function seedCustomerOwnershipAndBalances(int $customerId, array $packageIds): void
    {
        $now = Carbon::now();

        foreach ($packageIds as $packageName => $packageId) {
            $package = DB::table('service_packages')->where('id', $packageId)->first();
            if (!$package) {
                continue;
            }

            $seedRef = $packageName === 'Seed Hair Wash 10x' ? 910001 : 910002;
            $expiresAt = $package->valid_days
                ? $now->copy()->addDays((int) $package->valid_days)
                : null;

            DB::table('customer_service_packages')->updateOrInsert(
                [
                    'customer_id' => $customerId,
                    'service_package_id' => $packageId,
                    'purchased_from' => 'ADMIN',
                    'purchased_ref_id' => $seedRef,
                ],
                [
                    'started_at' => $now,
                    'expires_at' => $expiresAt,
                    'status' => 'active',
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

            $customerPackageId = (int) DB::table('customer_service_packages')
                ->where('customer_id', $customerId)
                ->where('service_package_id', $packageId)
                ->where('purchased_from', 'ADMIN')
                ->where('purchased_ref_id', $seedRef)
                ->value('id');

            $items = DB::table('service_package_items')
                ->where('service_package_id', $packageId)
                ->get();

            foreach ($items as $item) {
                DB::table('customer_service_package_balances')->updateOrInsert(
                    [
                        'customer_service_package_id' => $customerPackageId,
                        'booking_service_id' => $item->booking_service_id,
                    ],
                    [
                        'total_qty' => (int) $item->quantity,
                        'used_qty' => 0,
                        'remaining_qty' => (int) $item->quantity,
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }

            // Seed one usage record only for the first package to make redeem history visible immediately
            if ($packageName === 'Seed Hair Wash 10x') {
                $balance = DB::table('customer_service_package_balances')
                    ->where('customer_service_package_id', $customerPackageId)
                    ->orderBy('id')
                    ->first();

                if ($balance && (int) $balance->used_qty === 0 && (int) $balance->remaining_qty > 0) {
                    DB::table('customer_service_package_balances')
                        ->where('id', $balance->id)
                        ->update([
                            'used_qty' => 1,
                            'remaining_qty' => max(0, (int) $balance->total_qty - 1),
                            'updated_at' => now(),
                        ]);

                    DB::table('customer_service_package_usages')->updateOrInsert(
                        [
                            'customer_service_package_id' => $customerPackageId,
                            'customer_id' => $customerId,
                            'booking_service_id' => $balance->booking_service_id,
                            'used_from' => 'ADMIN',
                            'used_ref_id' => 910099,
                        ],
                        [
                            'used_qty' => 1,
                            'notes' => 'Auto-seeded usage log for QA verification.',
                            'updated_at' => now(),
                            'created_at' => now(),
                        ]
                    );
                }
            }
        }
    }
}
