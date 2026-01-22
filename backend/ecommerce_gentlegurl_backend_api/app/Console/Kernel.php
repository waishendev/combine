<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected $commands = [
        Commands\SendLowStockSummary::class,
        Commands\ExpirePendingOrders::class,
        Commands\ExpireApprovedReturns::class,
    ];

    protected function schedule(Schedule $schedule): void
    {
        $schedule->command('ecommerce:send-low-stock-summary')
            ->dailyAt('12:00')
            ->withoutOverlapping();

        $schedule->command('ecommerce:expire-pending-orders')
            ->everyMinute()
            ->withoutOverlapping();

        $schedule->command('ecommerce:expire-approved-returns')
            ->daily()
            ->withoutOverlapping();
    }

    protected function commands(): void
    {
        $this->load(__DIR__ . '/Commands');

        require base_path('routes/console.php');
    }
}
