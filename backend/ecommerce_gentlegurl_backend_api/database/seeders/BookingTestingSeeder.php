<?php

namespace Database\Seeders;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingService;
use App\Models\Booking\StaffCommissionTier;
use App\Models\Role;
use App\Models\User;
use App\Models\Ecommerce\CustomerVoucher;
use App\Models\Ecommerce\Voucher;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class BookingTestingSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedBookingTestingData();
    }

    public function seedBookingTestingData(bool $fresh = true): void
    {
        date_default_timezone_set('Asia/Kuala_Lumpur');

        if ($fresh) {
            $this->truncateBookingTables();
        }

        [$staffOneId, $staffTwoId, $staffThreeId] = $this->resolveStaffIds();
        $this->ensureStaffUsersCanLogin([$staffOneId, $staffTwoId, $staffThreeId]);
        $customerId = $this->resolveCustomerId();

        $services = $this->seedServices();
        $haircutService = $services['Haircut'];
        $this->seedServiceCategoriesAndPrimarySlots($services);
        $this->seedServiceQuestionsAndOptions($services);

        // $this->seedCommissionTiers();
        $this->seedServiceStaffMappings($services, [$staffOneId, $staffTwoId, $staffThreeId]);
        $this->seedSchedules([$staffOneId, $staffTwoId, $staffThreeId]);
        $this->seedBlocksAndTimeoffs($staffOneId, $staffTwoId);

        $this->seedBookingSettings();

        // $bookings = $this->seedBookings($staffOneId, $haircutService, $customerId);
        // $this->seedBookingLogs($bookings, $staffOneId);

        // $this->seedGuestCompletedBookingForFeedback($staffOneId, $haircutService);

        // $this->seedVoucherForNotifiedCancellation($bookings['NOTIFIED_CANCELLATION'], $customerId);
    }

    private function truncateBookingTables(): void
    {
        $tables = [
            'staff_monthly_sales',
            'staff_commission_tiers',
            'booking_logs',
            'booking_payments',
            'booking_photos',
            'booking_item_photos',
            'bookings',
            'booking_blocks',
            'booking_staff_timeoffs',
            'booking_staff_schedules',
            'booking_service_staff',
            'booking_service_primary_slots',
            'booking_service_question_options',
            'booking_service_questions',
            'booking_service_category_service',
            'booking_service_categories',
            'booking_cart_items',
            'booking_carts',
            'booking_settings',
            'booking_services',
        ];

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

    private function resolveStaffIds(): array
    {
        $staffIds = DB::table('staffs')->orderBy('id')->limit(3)->pluck('id')->all();

        if (count($staffIds) >= 3) {
            return array_values($staffIds);
        }

        $needed = 3 - count($staffIds);
        $now = now();
        for ($i = 0; $i < $needed; $i++) {
            $code = 'BKG-STAFF-' . strtoupper(substr(md5((string) microtime(true) . $i), 0, 6));
            $staffIds[] = DB::table('staffs')->insertGetId([
                'code' => $code,
                'name' => 'Booking Seed Staff ' . (count($staffIds) + 1),
                'phone' => '6011000000' . (count($staffIds) + 1),
                'email' => sprintf('booking.seed.staff.%d@example.com', count($staffIds) + 1),
                'commission_rate' => 0,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return array_values(array_slice($staffIds, 0, 3));
    }

    private function ensureStaffUsersCanLogin(array $staffIds): void
    {
        $staffRoleId = Role::query()
            ->whereRaw('LOWER(name) = ?', ['staff'])
            ->value('id');

        foreach ($staffIds as $index => $staffId) {
            $staff = DB::table('staffs')->where('id', (int) $staffId)->first();
            if (! $staff) {
                continue;
            }

            $email = (string) ($staff->email ?: sprintf('booking.seed.staff.%d@example.com', $index + 1));
            $username = (string) ($staff->email ? strtok($email, '@') : sprintf('booking.seed.staff.%d', $index + 1));

            $user = User::query()->updateOrCreate(
                ['email' => $email],
                [
                    'name' => (string) ($staff->name ?: sprintf('Booking Seed Staff %d', $index + 1)),
                    'username' => $username,
                    'password' => Hash::make('password'),
                    'is_active' => true,
                    'staff_id' => (int) $staffId,
                ]
            );

            if ($staffRoleId) {
                $user->roles()->syncWithoutDetaching([(int) $staffRoleId]);
            }
        }
    }


    private function resolveCustomerId(): int
    {
        $customerId = DB::table('customers')->orderBy('id')->value('id');
        if ($customerId) {
            return (int) $customerId;
        }

        return (int) DB::table('customers')->insertGetId([
            'name' => 'Booking Test Customer',
            'email' => 'booking.test.customer@example.com',
            'phone' => '60112223344',
            'password' => Hash::make('Password123!'),
            'tier' => 'basic',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }


    private function seedBookingSettings(): void
    {
        DB::table('booking_settings')->updateOrInsert(
            ['id' => 1],
            [
                'deposit_amount_per_premium' => 30,
                'deposit_base_amount_if_only_standard' => 30,
                'cart_hold_minutes' => 15,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    private function seedServices(): array
    {
        // Main bookable services — range priced (settlement / POS range testing).
        $mainRangeSpecs = [
            ['name' => 'Coloring', 'cn_name' => '染发', 'service_type' => 'premium', 'service_price' => 680, 'price_mode' => 'range', 'price_range_min' => 680, 'price_range_max' => 1200, 'duration_min' => 90, 'deposit_amount' => 30, 'buffer_min' => 15],
            ['name' => 'Highlights', 'cn_name' => '挑染', 'service_type' => 'premium', 'service_price' => 450, 'price_mode' => 'range', 'price_range_min' => 450, 'price_range_max' => 900, 'duration_min' => 90, 'deposit_amount' => 30, 'buffer_min' => 15],
            ['name' => 'Balayage', 'cn_name' => '手刷染', 'service_type' => 'premium', 'service_price' => 600, 'price_mode' => 'range', 'price_range_min' => 600, 'price_range_max' => 1300, 'duration_min' => 150, 'deposit_amount' => 35, 'buffer_min' => 15],
            ['name' => 'Perm', 'cn_name' => '烫发', 'service_type' => 'premium', 'service_price' => 350, 'price_mode' => 'range', 'price_range_min' => 350, 'price_range_max' => 650, 'duration_min' => 120, 'deposit_amount' => 25, 'buffer_min' => 15],
            ['name' => 'Rebonding', 'cn_name' => '离子烫', 'service_type' => 'premium', 'service_price' => 800, 'price_mode' => 'range', 'price_range_min' => 800, 'price_range_max' => 1500, 'duration_min' => 180, 'deposit_amount' => 40, 'buffer_min' => 20],
            ['name' => 'Keratin Treatment', 'cn_name' => '角蛋白护理', 'service_type' => 'premium', 'service_price' => 500, 'price_mode' => 'range', 'price_range_min' => 500, 'price_range_max' => 980, 'duration_min' => 120, 'deposit_amount' => 25, 'buffer_min' => 15],
        ];

        // Add-on services — also range priced; linked under main services via questions.
        $addonRangeSpecs = [
            ['name' => 'Gloss Toner Add-on', 'cn_name' => '光泽调色附加', 'service_type' => 'premium', 'service_price' => 80, 'price_mode' => 'range', 'price_range_min' => 80, 'price_range_max' => 150, 'duration_min' => 20, 'deposit_amount' => 15, 'buffer_min' => 10],
            ['name' => 'Bond Repair Add-on', 'cn_name' => '结构修护附加', 'service_type' => 'premium', 'service_price' => 120, 'price_mode' => 'range', 'price_range_min' => 120, 'price_range_max' => 220, 'duration_min' => 30, 'deposit_amount' => 20, 'buffer_min' => 10],
            ['name' => 'Deep Mask Add-on', 'cn_name' => '深层发膜附加', 'service_type' => 'premium', 'service_price' => 90, 'price_mode' => 'range', 'price_range_min' => 90, 'price_range_max' => 180, 'duration_min' => 45, 'deposit_amount' => 18, 'buffer_min' => 10],
            ['name' => 'Olaplex Boost Add-on', 'cn_name' => '蛋白加强附加', 'service_type' => 'premium', 'service_price' => 45, 'price_mode' => 'range', 'price_range_min' => 45, 'price_range_max' => 85, 'duration_min' => 15, 'deposit_amount' => 12, 'buffer_min' => 10],
            ['name' => 'Scalp Booster Add-on', 'cn_name' => '头皮加强附加', 'service_type' => 'premium', 'service_price' => 60, 'price_mode' => 'range', 'price_range_min' => 60, 'price_range_max' => 110, 'duration_min' => 25, 'deposit_amount' => 15, 'buffer_min' => 10],
            ['name' => 'Color Lock Add-on', 'cn_name' => '锁色护理附加', 'service_type' => 'premium', 'service_price' => 70, 'price_mode' => 'range', 'price_range_min' => 70, 'price_range_max' => 130, 'duration_min' => 20, 'deposit_amount' => 15, 'buffer_min' => 10],
        ];

        // Simple fixed-price services for non-range booking paths.
        $fixedStandaloneSpecs = [
            ['name' => 'Haircut', 'cn_name' => '剪发', 'service_type' => 'standard', 'service_price' => 5200, 'price_mode' => 'fixed', 'duration_min' => 30, 'deposit_amount' => 10, 'buffer_min' => 15],
            ['name' => 'Blow Dry', 'cn_name' => '吹发', 'service_type' => 'standard', 'service_price' => 80, 'price_mode' => 'fixed', 'duration_min' => 45, 'deposit_amount' => 10, 'buffer_min' => 10],
            ['name' => 'Hair Wash', 'cn_name' => '洗头', 'service_type' => 'standard', 'service_price' => 35, 'price_mode' => 'fixed', 'duration_min' => 20, 'deposit_amount' => 10, 'buffer_min' => 10],
            ['name' => 'Kids Cut', 'cn_name' => '儿童剪发', 'service_type' => 'standard', 'service_price' => 45, 'price_mode' => 'fixed', 'duration_min' => 25, 'deposit_amount' => 10, 'buffer_min' => 10],
            ['name' => 'Beard Trim', 'cn_name' => '修胡须', 'service_type' => 'standard', 'service_price' => 55, 'price_mode' => 'fixed', 'duration_min' => 20, 'deposit_amount' => 10, 'buffer_min' => 10],
            ['name' => 'Scalp Massage', 'cn_name' => '头皮按摩', 'service_type' => 'premium', 'service_price' => 120, 'price_mode' => 'fixed', 'duration_min' => 30, 'deposit_amount' => 15, 'buffer_min' => 10],
        ];

        $serviceSpecs = array_merge($mainRangeSpecs, $addonRangeSpecs, $fixedStandaloneSpecs);

        $services = [];
        foreach ($serviceSpecs as $spec) {
            $payload = [
                'name' => $spec['name'],
                'description' => $spec['name'] . ' service for booking QA demo data.',
                'service_type' => $spec['service_type'],
                'duration_min' => $spec['duration_min'],
                'deposit_amount' => $spec['deposit_amount'],
                'buffer_min' => $spec['buffer_min'],
                'is_active' => true,
            ];

            if (Schema::hasColumn('booking_services', 'cn_name')) {
                $payload['cn_name'] = $spec['cn_name'] ?? null;
            }

            if (Schema::hasColumn('booking_services', 'service_price')) {
                $payload['service_price'] = $spec['service_price'];
            }

            if (Schema::hasColumn('booking_services', 'price_mode')) {
                $payload['price_mode'] = $spec['price_mode'] ?? 'fixed';
                $payload['price_range_min'] = $spec['price_range_min'] ?? null;
                $payload['price_range_max'] = $spec['price_range_max'] ?? null;
            }

            if (Schema::hasColumn('booking_services', 'allow_photo_upload')) {
                $payload['allow_photo_upload'] = in_array($spec['name'], ['Haircut', 'Balayage'], true);
            }

            $services[$spec['name']] = BookingService::query()->create($payload);
        }

        return $services;
    }

    private function seedCommissionTiers(): void
    {
        if (!Schema::hasTable('staff_commission_tiers')) {
            return;
        }

        $now = now();
        $rows = [
            ['min_sales' => 0, 'commission_percent' => 1],
            ['min_sales' => 5000, 'commission_percent' => 5],
            ['min_sales' => 8000, 'commission_percent' => 10],
        ];

        foreach ($rows as $row) {
            StaffCommissionTier::query()->updateOrCreate(
                ['min_sales' => $row['min_sales']],
                [
                    'commission_percent' => $row['commission_percent'],
                    'updated_at' => $now,
                ]
            );
        }
    }

    private function seedServiceCategoriesAndPrimarySlots(array $services): void
    {
        $now = now();

        if (Schema::hasTable('booking_service_categories') && Schema::hasTable('booking_service_category_service')) {
            $categories = [
                [
                    'name' => 'Hair Essentials',
                    'cn_name' => '头发基础护理',
                    'slug' => 'hair-essentials',
                    'description' => 'Simple fixed-price services.',
                    'sort_order' => 1,
                    'service_names' => ['Haircut', 'Blow Dry', 'Hair Wash', 'Kids Cut', 'Beard Trim', 'Scalp Massage'],
                ],
                [
                    'name' => 'Main Range Services',
                    'cn_name' => '主服务（Range）',
                    'slug' => 'main-range-services',
                    'description' => 'Primary bookable services with range pricing.',
                    'sort_order' => 2,
                    'service_names' => ['Coloring', 'Highlights', 'Balayage', 'Perm', 'Rebonding', 'Keratin Treatment'],
                ],
                [
                    'name' => 'Range Add-ons',
                    'cn_name' => '附加服务（Range）',
                    'slug' => 'range-add-ons',
                    'description' => 'Range-priced add-ons linked under main services.',
                    'sort_order' => 3,
                    'service_names' => [
                        'Gloss Toner Add-on',
                        'Bond Repair Add-on',
                        'Deep Mask Add-on',
                        'Olaplex Boost Add-on',
                        'Scalp Booster Add-on',
                        'Color Lock Add-on',
                    ],
                ],
            ];

            foreach ($categories as $category) {
                $categoryPayload = [
                    'name' => $category['name'],
                    'description' => $category['description'],
                    'is_active' => true,
                    'sort_order' => $category['sort_order'],
                    'updated_at' => $now,
                    'created_at' => $now,
                ];

                if (Schema::hasColumn('booking_service_categories', 'cn_name')) {
                    $categoryPayload['cn_name'] = $category['cn_name'] ?? null;
                }

                DB::table('booking_service_categories')->updateOrInsert(
                    ['slug' => $category['slug']],
                    $categoryPayload
                );

                $resolvedCategoryId = (int) DB::table('booking_service_categories')
                    ->where('slug', $category['slug'])
                    ->value('id');

                foreach ($category['service_names'] as $serviceName) {
                    $service = $services[$serviceName] ?? null;
                    if (! $service) {
                        continue;
                    }
                    DB::table('booking_service_category_service')->updateOrInsert(
                        [
                            'booking_service_category_id' => $resolvedCategoryId,
                            'booking_service_id' => $service->id,
                        ],
                        [
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]
                    );
                }
            }
        }

        if (Schema::hasTable('booking_service_primary_slots')) {
            $slotConfig = [
                'Haircut' => ['10:00:00', '12:00:00', '15:00:00'],
                'Blow Dry' => ['10:30:00', '13:00:00', '16:00:00'],
                'Hair Wash' => ['10:00:00', '11:30:00', '14:00:00', '16:30:00'],
                'Kids Cut' => ['11:00:00', '14:30:00', '17:00:00'],
                'Beard Trim' => ['10:00:00', '12:30:00', '15:30:00'],
                'Scalp Massage' => ['11:00:00', '13:30:00', '16:30:00'],
                'Coloring' => ['11:00:00', '14:00:00', '17:00:00'],
                'Highlights' => ['10:00:00', '13:00:00', '16:00:00'],
                'Balayage' => ['09:30:00', '12:30:00', '15:30:00'],
                'Perm' => ['10:00:00', '14:00:00'],
                'Rebonding' => ['09:00:00', '13:00:00'],
                'Keratin Treatment' => ['11:30:00', '15:30:00'],
            ];

            foreach ($slotConfig as $serviceName => $times) {
                $service = $services[$serviceName] ?? null;
                if (! $service) {
                    continue;
                }

                DB::table('booking_service_primary_slots')
                    ->where('booking_service_id', $service->id)
                    ->delete();

                foreach ($times as $index => $time) {
                    DB::table('booking_service_primary_slots')->insert([
                        'booking_service_id' => $service->id,
                        'start_time' => $time,
                        'sort_order' => $index,
                        'is_active' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }
    }

    private function seedServiceStaffMappings(array $services, array $staffIds): void
    {
        $rows = [];
        foreach ($services as $service) {
            foreach ($staffIds as $staffId) {
                $rows[] = [
                    'service_id' => $service->id,
                    'staff_id' => $staffId,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        DB::table('booking_service_staff')->insert($rows);
    }

    private function seedServiceQuestionsAndOptions(array $services): void
    {
        if (!Schema::hasTable('booking_service_questions') || !Schema::hasTable('booking_service_question_options')) {
            return;
        }

        $now = now();
        $rangeAddonKeys = [
            'Gloss Toner Add-on',
            'Bond Repair Add-on',
            'Deep Mask Add-on',
            'Olaplex Boost Add-on',
            'Scalp Booster Add-on',
            'Color Lock Add-on',
        ];
        $mainRangeKeys = [
            'Coloring',
            'Highlights',
            'Balayage',
            'Perm',
            'Rebonding',
            'Keratin Treatment',
        ];

        $questionTargets = [];
        foreach ($mainRangeKeys as $mainName) {
            $questionTargets[$mainName] = [
                [
                    'title' => 'Range add-ons',
                    'description' => 'Optional range-priced add-ons for this main service.',
                    'question_type' => 'multi_choice',
                    'sort_order' => 1,
                    'is_required' => false,
                    'service_keys' => $rangeAddonKeys,
                ],
                [
                    'title' => 'Premium range add-ons (pick one)',
                    'description' => 'Single-choice range add-on tier.',
                    'question_type' => 'single_choice',
                    'sort_order' => 2,
                    'is_required' => false,
                    'service_keys' => ['Bond Repair Add-on', 'Deep Mask Add-on', 'Color Lock Add-on'],
                ],
            ];
        }

        // Coloring gets an extra question mixing range + fixed for contrast testing.
        $questionTargets['Coloring'][] = [
            'title' => 'Quick fixed finish (optional)',
            'description' => 'Fixed-price finish add-ons for mixed pricing scenarios.',
            'question_type' => 'multi_choice',
            'sort_order' => 3,
            'is_required' => false,
            'service_keys' => ['Blow Dry', 'Hair Wash'],
        ];

        foreach ($questionTargets as $serviceName => $questionRows) {
            $targetService = $services[$serviceName] ?? null;
            if (! $targetService) {
                continue;
            }

            DB::table('booking_service_questions')
                ->where('booking_service_id', $targetService->id)
                ->delete();

            foreach ($questionRows as $row) {
                $questionId = DB::table('booking_service_questions')->insertGetId([
                    'booking_service_id' => $targetService->id,
                    'title' => $row['title'],
                    'description' => $row['description'],
                    'question_type' => $row['question_type'],
                    'sort_order' => $row['sort_order'],
                    'is_required' => $row['is_required'],
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $selectedAddonServices = collect($row['service_keys'] ?? [])
                    ->map(fn ($serviceKey) => $services[$serviceKey] ?? null)
                    ->filter()
                    ->values();

                foreach ($selectedAddonServices as $optionIndex => $addonService) {
                    DB::table('booking_service_question_options')->insert([
                        'booking_service_question_id' => $questionId,
                        'label' => (string) $addonService->name,
                        'linked_booking_service_id' => (int) $addonService->id,
                        'extra_duration_min' => max(0, (int) $addonService->duration_min),
                        'extra_price' => max(0, (float) $addonService->service_price),
                        'sort_order' => $optionIndex + 1,
                        'is_active' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }
    }

    private function seedSchedules(array $staffIds): void
    {
        $rows = [];

        foreach ($staffIds as $staffId) {
            for ($day = 1; $day <= 6; $day++) {
                $rows[] = [
                    'staff_id' => $staffId,
                    'day_of_week' => $day,
                    'start_time' => '10:00:00',
                    'end_time' => '19:00:00',
                    'break_start' => '13:00:00',
                    'break_end' => '14:00:00',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        DB::table('booking_staff_schedules')->insert($rows);
    }

    private function seedBlocksAndTimeoffs(int $staffOneId, int $staffTwoId): void
    {
        DB::table('booking_blocks')->insert([
            [
                'scope' => 'STORE',
                'staff_id' => null,
                'start_at' => Carbon::parse('2026-03-05 15:00:00', 'Asia/Kuala_Lumpur'),
                'end_at' => Carbon::parse('2026-03-05 16:00:00', 'Asia/Kuala_Lumpur'),
                'reason' => 'Store maintenance block',
                'created_by_staff_id' => $staffOneId,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'scope' => 'STAFF',
                'staff_id' => $staffOneId,
                'start_at' => Carbon::parse('2026-03-06 12:00:00', 'Asia/Kuala_Lumpur'),
                'end_at' => Carbon::parse('2026-03-06 13:00:00', 'Asia/Kuala_Lumpur'),
                'reason' => 'Staff private block',
                'created_by_staff_id' => $staffOneId,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('booking_staff_timeoffs')->insert([
            'staff_id' => $staffTwoId,
            'start_at' => Carbon::parse('2026-03-07 10:00:00', 'Asia/Kuala_Lumpur'),
            'end_at' => Carbon::parse('2026-03-07 19:00:00', 'Asia/Kuala_Lumpur'),
            'reason' => 'Full-day leave',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedBookings(int $staffOneId, BookingService $service, int $customerId): array
    {
        $now = Carbon::now('Asia/Kuala_Lumpur');
        $duration = (int) $service->duration_min;

        $definitions = [
            'CONFIRMED' => $now->copy()->addDays(2)->setTime(11, 0),
            'COMPLETED' => $now->copy()->subDays(4)->setTime(10, 0),
            'CANCELLED' => $now->copy()->subDays(2)->setTime(12, 0),
            'LATE_CANCELLATION' => $now->copy()->subDay()->setTime(14, 0),
            'NO_SHOW' => $now->copy()->subDay()->setTime(16, 0),
            'NOTIFIED_CANCELLATION' => $now->copy()->addDays(3)->setTime(15, 0),
            'HOLD_ACTIVE' => $now->copy()->addHours(4),
            'HOLD_EXPIRED' => $now->copy()->subHours(5),
        ];

        $bookings = [];
        foreach ($definitions as $statusKey => $startAt) {
            $status = $statusKey === 'HOLD_ACTIVE' || $statusKey === 'HOLD_EXPIRED' ? 'HOLD' : $statusKey;
            $isHold = $status === 'HOLD';

            $booking = Booking::query()->create([
                'booking_code' => 'BKG-TST-' . strtoupper(substr(md5($statusKey . $startAt->toDateTimeString()), 0, 8)),
                'source' => 'CUSTOMER',
                'customer_id' => $customerId,
                'staff_id' => $staffOneId,
                'service_id' => $service->id,
                'start_at' => $startAt,
                'end_at' => $startAt->copy()->addMinutes($duration),
                'buffer_min' => 15,
                'status' => $status,
                'deposit_amount' => $service->deposit_amount,
                'payment_status' => $isHold ? 'UNPAID' : 'PAID',
                'hold_expires_at' => $isHold
                    ? ($statusKey === 'HOLD_ACTIVE' ? $now->copy()->addMinutes(30) : $now->copy()->subMinutes(30))
                    : null,
                'created_by_staff_id' => $staffOneId,
                'cancelled_at' => in_array($status, ['CANCELLED', 'LATE_CANCELLATION', 'NOTIFIED_CANCELLATION'], true) ? $now : null,
                'cancellation_type' => $status === 'LATE_CANCELLATION' ? 'LATE_CANCELLATION' : ($status === 'CANCELLED' ? 'CANCELLED' : null),
                'notes' => $status === 'CONFIRMED'
                    ? 'Booking testing seeder status: CONFIRMED (change this booking to COMPLETED to test commission) '
                    : 'Booking testing seeder status: ' . $status,
                'reschedule_count' => $status === 'CONFIRMED' ? 1 : 0,
                'rescheduled_at' => $status === 'CONFIRMED' ? $now->copy()->subDay() : null,
                'reschedule_reason' => $status === 'CONFIRMED' ? 'Customer requested a later slot' : null,
            ]);

            $bookings[$statusKey] = $booking;
        }

        return $bookings;
    }

    private function seedGuestCompletedBookingForFeedback(int $staffId, BookingService $service): void
    {
        $startAt = Carbon::parse('2026-05-16 10:00:00', 'Asia/Kuala_Lumpur');
        $completedAt = Carbon::parse('2026-05-16 11:00:00', 'Asia/Kuala_Lumpur');
        $duration = (int) $service->duration_min;

        $booking = Booking::query()->updateOrCreate(
            ['booking_code' => 'BKG-GUEST-TEOH-20260516'],
            [
                'source' => 'GUEST',
                'customer_id' => null,
                'guest_name' => 'TEOH WAI SHEN',
                'guest_phone' => '0124482125',
                'guest_email' => 'waishendev@gmail.com',
                'staff_id' => $staffId,
                'service_id' => $service->id,
                'start_at' => $startAt,
                'end_at' => $startAt->copy()->addMinutes($duration),
                'buffer_min' => 15,
                'status' => 'COMPLETED',
                'deposit_amount' => $service->deposit_amount,
                'payment_status' => 'PAID',
                'completed_at' => $completedAt,
                'created_by_staff_id' => $staffId,
                'notes' => 'Guest completed booking for feedback email testing (16 May 2026)',
            ]
        );

        if (! BookingLog::query()->where('booking_id', $booking->id)->where('action', 'CREATE_BOOKING')->exists()) {
            BookingLog::query()->create([
                'booking_id' => $booking->id,
                'actor_type' => 'STAFF',
                'actor_id' => $staffId,
                'action' => 'CREATE_BOOKING',
                'meta' => ['status' => 'HOLD'],
                'created_at' => $startAt->copy()->subDay(),
            ]);
        }

        if (! BookingLog::query()->where('booking_id', $booking->id)->where('action', 'UPDATE_STATUS')->exists()) {
            BookingLog::query()->create([
                'booking_id' => $booking->id,
                'actor_type' => 'STAFF',
                'actor_id' => $staffId,
                'action' => 'UPDATE_STATUS',
                'meta' => ['previous_status' => 'HOLD', 'new_status' => 'COMPLETED'],
                'created_at' => $completedAt,
            ]);
        }
    }

    private function seedBookingLogs(array $bookings, int $actorStaffId): void
    {
        foreach ($bookings as $statusKey => $booking) {
            BookingLog::query()->create([
                'booking_id' => $booking->id,
                'actor_type' => 'STAFF',
                'actor_id' => $actorStaffId,
                'action' => 'CREATE_BOOKING',
                'meta' => ['status' => 'HOLD'],
                'created_at' => $booking->created_at,
            ]);

            BookingLog::query()->create([
                'booking_id' => $booking->id,
                'actor_type' => 'STAFF',
                'actor_id' => $actorStaffId,
                'action' => 'UPDATE_STATUS',
                'meta' => ['previous_status' => 'HOLD', 'new_status' => $booking->status],
                'created_at' => $booking->created_at->copy()->addMinute(),
            ]);

            if ($statusKey === 'CONFIRMED') {
                BookingLog::query()->create([
                    'booking_id' => $booking->id,
                    'actor_type' => 'STAFF',
                    'actor_id' => $actorStaffId,
                    'action' => 'RESCHEDULE_BOOKING',
                    'meta' => [
                        'old_start_at' => $booking->start_at->copy()->subDay()->toDateTimeString(),
                        'new_start_at' => $booking->start_at->toDateTimeString(),
                        'reschedule_count' => 1,
                    ],
                    'created_at' => $booking->created_at->copy()->addMinutes(2),
                ]);
            }

            if ($statusKey === 'NOTIFIED_CANCELLATION') {
                BookingLog::query()->create([
                    'booking_id' => $booking->id,
                    'actor_type' => 'STAFF',
                    'actor_id' => $actorStaffId,
                    'action' => 'MARK_NOTIFIED_CANCELLATION',
                    'meta' => ['reason' => 'Customer informed >24h prior to appointment'],
                    'created_at' => $booking->created_at->copy()->addMinutes(3),
                ]);
            }
        }
    }

    private function seedVoucherForNotifiedCancellation(Booking $booking, int $customerId): void
    {
        if ($booking->notified_cancellation_voucher_id) {
            return;
        }

        $now = Carbon::now('Asia/Kuala_Lumpur');
        $voucherAmount = (float) $booking->deposit_amount;

        $voucherData = [
            'code' => 'BNC-SEED-' . $booking->id,
            'type' => 'fixed',
            'value' => $voucherAmount,
            'min_order_amount' => 0,
            'start_at' => $now,
            'end_at' => $now->copy()->addDays(45),
            'is_active' => true,
        ];

        if (Schema::hasColumn('vouchers', 'usage_limit_total')) {
            $voucherData['usage_limit_total'] = 1;
        }
        if (Schema::hasColumn('vouchers', 'usage_limit_per_customer')) {
            $voucherData['usage_limit_per_customer'] = 1;
        }
        if (Schema::hasColumn('vouchers', 'max_uses')) {
            $voucherData['max_uses'] = 1;
        }
        if (Schema::hasColumn('vouchers', 'max_uses_per_customer')) {
            $voucherData['max_uses_per_customer'] = 1;
        }
        if (Schema::hasColumn('vouchers', 'is_reward_only')) {
            $voucherData['is_reward_only'] = true;
        }
        if (Schema::hasColumn('vouchers', 'scope_type')) {
            $voucherData['scope_type'] = 'all';
        }
        if (Schema::hasColumn('vouchers', 'amount')) {
            $voucherData['amount'] = $voucherAmount;
        }

        $voucher = Voucher::query()->updateOrCreate(
            ['code' => $voucherData['code']],
            $voucherData
        );

        $customerVoucherData = [
            'status' => 'active',
            'claimed_at' => $now,
            'expires_at' => $now->copy()->addDays(45),
            'meta' => ['booking_id' => $booking->id, 'non_combinable' => true],
        ];

        if (Schema::hasColumn('customer_vouchers', 'quantity_total')) {
            $customerVoucherData['quantity_total'] = 1;
        }
        if (Schema::hasColumn('customer_vouchers', 'quantity_used')) {
            $customerVoucherData['quantity_used'] = 0;
        }
        if (Schema::hasColumn('customer_vouchers', 'assigned_by_admin_id')) {
            $customerVoucherData['assigned_by_admin_id'] = null;
        }
        if (Schema::hasColumn('customer_vouchers', 'assigned_at')) {
            $customerVoucherData['assigned_at'] = $now;
        }
        if (Schema::hasColumn('customer_vouchers', 'start_at')) {
            $customerVoucherData['start_at'] = $now;
        }
        if (Schema::hasColumn('customer_vouchers', 'end_at')) {
            $customerVoucherData['end_at'] = $now->copy()->addDays(45);
        }
        if (Schema::hasColumn('customer_vouchers', 'note')) {
            $customerVoucherData['note'] = 'Booking Notified Cancellation (booking_id=' . $booking->id . ')';
        }

        CustomerVoucher::query()->updateOrCreate(
            [
                'customer_id' => $customerId,
                'voucher_id' => $voucher->id,
            ],
            $customerVoucherData
        );

        $booking->update(['notified_cancellation_voucher_id' => $voucher->id]);

        BookingLog::query()->create([
            'booking_id' => $booking->id,
            'actor_type' => 'SYSTEM',
            'actor_id' => null,
            'action' => 'VOUCHER_GRANTED',
            'meta' => ['voucher_id' => $voucher->id, 'amount' => $voucherAmount],
            'created_at' => now(),
        ]);
    }
}
