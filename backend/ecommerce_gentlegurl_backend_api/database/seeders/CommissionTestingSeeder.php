<?php

namespace Database\Seeders;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingService;
use App\Models\Booking\StaffCommissionTier;
use App\Models\Booking\StaffMonthlySale;
use App\Models\Staff;
use App\Services\Booking\StaffCommissionService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
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
        $this->seedManualMonthlySalesRows($staffIds);
        $this->recalculateFromBookings($staffIds);
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

        foreach ($rows as $row) {
            StaffCommissionTier::query()->updateOrCreate(
                ['min_sales' => $row['min_sales']],
                ['commission_percent' => $row['commission_percent']]
            );
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
                'commission_rate' => 0,
                'is_active' => true,
            ]);
            $ids[] = $staff->id;
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

    private function seedManualMonthlySalesRows(array $staffIds): void
    {
        // Extra fixture rows to test override/tiers immediately in commissions UI.
        $now = Carbon::now();
        $targetYear = (int) $now->format('Y');
        $targetMonth = (int) $now->format('m');

        StaffMonthlySale::query()->updateOrCreate(
            [
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
            $service->recalculateForStaffMonth((int) $booking->staff_id, $year, $month);
        }
    }
}
