<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingCartItem;
use App\Models\Booking\BookingSetting;
use Carbon\Carbon;

class BookingHoldSettingsService
{
    public function applyCartHoldMinutesChange(int $holdMinutes): void
    {
        $holdMinutes = max(1, $holdMinutes);

        BookingSetting::query()->firstOrCreate([], [
            'deposit_amount_per_premium' => 30,
            'deposit_base_amount_if_only_standard' => 30,
            'cart_hold_minutes' => $holdMinutes,
        ])->update(['cart_hold_minutes' => $holdMinutes]);

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

    public function applyManualTransferHoldMinutesChange(int $holdMinutes): void
    {
        $holdMinutes = max(1, $holdMinutes);

        Booking::query()
            ->where('status', 'HOLD')
            ->whereNotNull('hold_expires_at')
            ->whereHas('orderItems.order', function ($query) {
                $query->where('payment_method', 'manual_transfer')
                    ->where('payment_status', 'unpaid');
            })
            ->with(['orderItems.order'])
            ->orderBy('id')
            ->chunkById(100, function ($bookings) use ($holdMinutes) {
                foreach ($bookings as $booking) {
                    $order = $booking->orderItems
                        ->map(fn ($item) => $item->order)
                        ->filter(fn ($order) => $order
                            && $order->payment_method === 'manual_transfer'
                            && $order->payment_status === 'unpaid')
                        ->sortByDesc('id')
                        ->first();

                    $base = $order?->placed_at?->copy()
                        ?? ($booking->created_at instanceof Carbon ? $booking->created_at->copy() : Carbon::now());

                    $booking->update([
                        'hold_expires_at' => $base->addMinutes($holdMinutes),
                    ]);
                }
            });
    }

    /** @deprecated Use applyCartHoldMinutesChange() or applyManualTransferHoldMinutesChange() */
    public function applyHoldMinutesChange(int $holdMinutes): void
    {
        $this->applyCartHoldMinutesChange($holdMinutes);
        $this->applyManualTransferHoldMinutesChange($holdMinutes);
    }
}
