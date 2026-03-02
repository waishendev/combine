<?php

namespace App\Console\Commands;

use App\Services\Booking\BookingCartCleanupService;
use Illuminate\Console\Command;

class ExpireBookingCartItems extends Command
{
    protected $signature = 'booking:expire-cart-items';

    protected $description = 'Expire active booking cart items whose hold time has elapsed';

    public function handle(BookingCartCleanupService $cleanupService): int
    {
        $expired = $cleanupService->expireItems();
        $this->info('Expired cart items: ' . $expired);

        return self::SUCCESS;
    }
}
