<?php

namespace App\Services\Booking;

use App\Models\Booking\BookingCart;
use App\Models\Booking\BookingCartItem;

class BookingCartCleanupService
{
    public function expireItems(?BookingCart $cart = null): int
    {
        $query = BookingCartItem::query()
            ->where('status', 'active')
            ->where('expires_at', '<', now());

        if ($cart) {
            $query->where('booking_cart_id', $cart->id);
        }

        return $query->update([
            'status' => 'expired',
            'updated_at' => now(),
        ]);
    }
}
