<?php

namespace App\Console;

use App\Jobs\SendDailyOrderSummaryEmailJob;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use Illuminate\Console\Scheduling\Schedule;

class Kernel extends ConsoleKernel
{
    protected $commands = [
        Commands\SendLowStockSummary::class,
        Commands\ExpirePendingOrders::class,
        Commands\ExpireApprovedReturns::class,
    ];

    protected function schedule(Schedule $schedule): void
    {
        $schedule->job(new SendDailyOrderSummaryEmailJob())
            ->dailyAt('10:00')
            ->onOneServer()
            ->withoutOverlapping();
    }

    protected function commands(): void
    {
        $this->load(__DIR__ . '/Commands');
        require base_path('routes/console.php');
    }
}
