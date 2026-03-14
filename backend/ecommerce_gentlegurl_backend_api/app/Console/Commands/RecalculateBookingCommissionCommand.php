<?php

namespace App\Console\Commands;

use App\Services\Booking\StaffCommissionService;
use Illuminate\Console\Command;

class RecalculateBookingCommissionCommand extends Command
{
    protected $signature = 'booking:commission-recalculate
        {year : Target year (e.g. 2026)}
        {month : Target month (1-12)}
        {--staff_id= : Optional staff id. If omitted recalculates all staff in the month}';

    protected $description = 'Recalculate booking commission by month for a staff or all staff';

    public function __construct(private readonly StaffCommissionService $staffCommissionService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $year = (int) $this->argument('year');
        $month = (int) $this->argument('month');
        $staffId = $this->option('staff_id');

        if ($month < 1 || $month > 12) {
            $this->error('Month must be between 1 and 12.');
            return self::FAILURE;
        }

        if ($staffId !== null && $staffId !== '') {
            $row = $this->staffCommissionService->recalculateForStaffMonth((int) $staffId, $year, $month);
            $this->info(sprintf(
                'Recalculated staff #%d for %04d-%02d => sales: %.2f, bookings: %d, tier: %.2f%%, commission: %.2f',
                $row->staff_id,
                $row->year,
                $row->month,
                (float) $row->total_sales,
                (int) $row->booking_count,
                (float) $row->tier_percent,
                (float) $row->commission_amount,
            ));

            return self::SUCCESS;
        }

        $rows = $this->staffCommissionService->recalculateForMonthAll($year, $month);
        $this->info(sprintf('Recalculated %d staff rows for %04d-%02d.', count($rows), $year, $month));

        return self::SUCCESS;
    }
}
