<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingCartItem;
use App\Models\Booking\BookingSetting;
use Carbon\Carbon;

class BookingHoldSettingsService
{
    public function applyHoldMinutesChange(int $holdMinutes): void
    {
        $holdMinutes = max(1, $holdMinutes);

        BookingSetting::query()->firstOrCreate([], [
            'deposit_amount_per_premium' => 30,
            'deposit_base_amount_if_only_standard' => 30,
            'cart_hold_minutes' => $holdMinutes,
        ])->update(['cart_hold_minutes' => $holdMinutes]);

        Booking::query()
            ->where('status', 'HOLD')
            ->whereNotNull('hold_expires_at')
            ->orderBy('id')
            ->chunkById(100, function ($bookings) use ($holdMinutes) {
                foreach ($bookings as $booking) {
                    $base = $booking->created_at instanceof Carbon
                        ? $booking->created_at->copy()
                        : Carbon::now();

                    $booking->update([
                        'hold_expires_at' => $base->addMinutes($holdMinutes),
                    ]);
                }
            });

        BookingCartItem::query()
            ->where('status', 'active')
            ->where('expires_at', '>', now())
            ->orderBy('id')
            ->chunkById(100, function ($items) use ($holdMinutes) {
                foreach ($items as $item) {
                    $base = $item->created_at instanceof Carbon
                        ? $item->created_at->copy()
                        : Carbon::now();

                    $item->update([
                        'expires_at' => $base->addMinutes($holdMinutes),
                    ]);
                }
            });
    }
}
