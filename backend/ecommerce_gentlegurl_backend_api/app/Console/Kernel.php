<?php

namespace App\Console;

use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

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

    protected function commands(): void
    {
        $this->load(__DIR__ . '/Commands');
        require base_path('routes/console.php');
    }
}
