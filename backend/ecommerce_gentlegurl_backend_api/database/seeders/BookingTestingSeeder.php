<?php

namespace Database\Seeders;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingService;
use App\Models\Booking\StaffCommissionTier;
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
        $customerId = $this->resolveCustomerId();

        $services = $this->seedServices();
        $haircutService = $services['Haircut'];

        $this->seedCommissionTiers();
        $this->seedServiceStaffMappings($services, [$staffOneId, $staffTwoId, $staffThreeId]);
        $this->seedSchedules([$staffOneId, $staffTwoId, $staffThreeId]);
        $this->seedBlocksAndTimeoffs($staffOneId, $staffTwoId);

        $this->seedBookingSettings();

        $bookings = $this->seedBookings($staffOneId, $haircutService, $customerId);
        $this->seedBookingLogs($bookings, $staffOneId);

        $this->seedVoucherForNotifiedCancellation($bookings['NOTIFIED_CANCELLATION'], $customerId);
    }

    private function truncateBookingTables(): void
    {
        $tables = [
            'staff_monthly_sales',
            'staff_commission_tiers',
            'booking_logs',
            'booking_payments',
            'booking_photos',
            'bookings',
            'booking_blocks',
            'booking_staff_timeoffs',
            'booking_staff_schedules',
            'booking_service_staff',
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
        $serviceSpecs = [
            ['name' => 'Haircut', 'service_type' => 'standard', 'service_price' => 5200, 'duration_min' => 30, 'deposit_amount' => 10, 'buffer_min' => 15],
            ['name' => 'Coloring', 'service_type' => 'premium', 'service_price' => 680, 'duration_min' => 90, 'deposit_amount' => 30, 'buffer_min' => 15],
            ['name' => 'Treatment', 'service_type' => 'premium', 'service_price' => 450, 'duration_min' => 60, 'deposit_amount' => 20, 'buffer_min' => 15],
        ];

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

            if (Schema::hasColumn('booking_services', 'service_price')) {
                $payload['service_price'] = $spec['service_price'];
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
            ['min_sales' => 0, 'commission_percent' => 0],
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
