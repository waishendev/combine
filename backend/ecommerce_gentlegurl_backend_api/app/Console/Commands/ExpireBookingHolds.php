<?php

namespace App\Console\Commands;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Services\Booking\CustomerServicePackageService;
use Illuminate\Console\Command;

class ExpireBookingHolds extends Command
{
    public function __construct(private readonly CustomerServicePackageService $customerServicePackageService)
    {
        parent::__construct();
    }

    protected $signature = 'booking:expire-holds';
    protected $description = 'Expire booking HOLD records once hold_expires_at is reached';

    public function handle(): int
    {
        $bookings = Booking::where('status', 'HOLD')
            ->whereNotNull('hold_expires_at')
            ->where('hold_expires_at', '<', now())
            ->get();

        foreach ($bookings as $booking) {
            $booking->update(['status' => 'EXPIRED']);
            $this->customerServicePackageService->releaseReservedClaimsForBooking((int) $booking->id);
            BookingLog::create([
                'booking_id' => $booking->id,
                'actor_type' => 'SYSTEM',
                'actor_id' => null,
                'action' => 'HOLD_EXPIRED',
                'meta' => null,
                'created_at' => now(),
            ]);
        }

        $this->info('Expired holds: ' . $bookings->count());

        return self::SUCCESS;
    }
}
