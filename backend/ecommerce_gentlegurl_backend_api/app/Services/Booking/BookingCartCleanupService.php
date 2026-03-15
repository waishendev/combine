<?php

namespace App\Services\Booking;

use App\Models\Booking\BookingCart;
use App\Models\Booking\BookingCartItem;
use App\Models\Booking\CustomerServicePackageUsage;

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

        $expiredIds = $query->pluck('id')->map(fn ($id) => (int) $id)->all();

        if (empty($expiredIds)) {
            return 0;
        }

        $updated = BookingCartItem::query()
            ->whereIn('id', $expiredIds)
            ->update([
                'status' => 'expired',
                'updated_at' => now(),
            ]);

        CustomerServicePackageUsage::query()
            ->where('used_from', 'BOOKING')
            ->whereIn('used_ref_id', $expiredIds)
            ->where('status', 'reserved')
            ->update([
                'status' => 'released',
                'released_at' => now(),
                'updated_at' => now(),
            ]);

        return $updated;
    }
}
