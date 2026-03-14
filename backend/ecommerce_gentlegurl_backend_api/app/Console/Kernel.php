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
        Commands\ExpireBookingHolds::class,
        Commands\ExpireBookingCartItems::class,
        Commands\BookingSeedTestingCommand::class,
        Commands\CommissionSeedTestingCommand::class,
        Commands\RecalculateBookingCommissionCommand::class,
    ];

    protected function schedule(Schedule $schedule): void
    {
        $schedule->command('booking:expire-holds')->everyMinute();
        $schedule->command('booking:expire-cart-items')->everyMinute();

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
