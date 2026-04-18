<?php

namespace App\Console\Commands;

use App\Services\Booking\StaffCommissionService;
use Illuminate\Console\Command;

class RecalculateBookingCommissionCommand extends Command
{
    protected $signature = 'booking:commission-recalculate
        {year? : Target year (e.g. 2026)}
        {month? : Target month (1-12)}
        {--staff_id= : Optional staff id. If omitted recalculates all staff in the month}
        {--type=BOOKING : Commission type (BOOKING or ECOMMERCE)}
        {--all : Recalculate all available months for the selected type}
        {--force : Force recalculation even for FROZEN months}';

    protected $description = 'Recalculate monthly commission by type for a staff or all staff';

    public function __construct(private readonly StaffCommissionService $staffCommissionService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $yearArgument = $this->argument('year');
        $monthArgument = $this->argument('month');
        $year = $yearArgument !== null ? (int) $yearArgument : null;
        $month = $monthArgument !== null ? (int) $monthArgument : null;
        $staffId = $this->option('staff_id');
        $type = $this->staffCommissionService->normalizeType((string) $this->option('type'));
        $runAll = (bool) $this->option('all');
        $force = (bool) $this->option('force');

        if ($runAll) {
            $rows = $this->staffCommissionService->recalculateAllMonths(
                $staffId !== null && $staffId !== '' ? (int) $staffId : null,
                $type,
                $force
            );
            $scope = $staffId !== null && $staffId !== '' ? ('staff #' . (int) $staffId) : 'all staff';
            $this->info(sprintf('Recalculated %d rows across all available months for %s (%s).', count($rows), $type, $scope));
            foreach ($rows as $row) {
                $this->staffCommissionService->logAction(
                    'RECALCULATE',
                    $row,
                    null,
                    $row->only(['total_sales', 'booking_count', 'commission_amount', 'tier_percent_snapshot', 'status']),
                    null,
                    sprintf('Command recalculate --all%s', $force ? ' --force' : '')
                );
            }

            return self::SUCCESS;
        }

        if ($year === null || $month === null) {
            $this->error('Year and month are required unless you pass --all.');
            return self::FAILURE;
        }

        if ($month < 1 || $month > 12) {
            $this->error('Month must be between 1 and 12.');
            return self::FAILURE;
        }

        if ($staffId !== null && $staffId !== '') {
            $row = $this->staffCommissionService->recalculateForStaffMonth((int) $staffId, $year, $month, $type, $force);
            $this->staffCommissionService->logAction(
                'RECALCULATE',
                $row,
                null,
                $row->only(['total_sales', 'booking_count', 'commission_amount', 'tier_percent_snapshot', 'status']),
                null,
                sprintf('Command recalculate%s', $force ? ' --force' : '')
            );
            $this->info(sprintf(
                'Recalculated %s staff #%d for %04d-%02d => sales: %.2f, items: %d, tier: %.2f%%, commission: %.2f',
                $row->type,
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

        $rows = $this->staffCommissionService->recalculateForMonthAll($year, $month, $type, $force);
        foreach ($rows as $row) {
            $this->staffCommissionService->logAction(
                'RECALCULATE',
                $row,
                null,
                $row->only(['total_sales', 'booking_count', 'commission_amount', 'tier_percent_snapshot', 'status']),
                null,
                sprintf('Command recalculate%s', $force ? ' --force' : '')
            );
        }
        $this->info(sprintf('Recalculated %d %s staff rows for %04d-%02d.', count($rows), $type, $year, $month));

        return self::SUCCESS;
    }
}
