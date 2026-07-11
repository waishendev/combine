<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Ecommerce\Order;
use Illuminate\Support\Collection;

class BookingOrderConfirmationService
{
    public function linkedBookingIdsForOrder(Order $order): Collection
    {
        $itemBookingIds = $order->items()
            ->whereNotNull('booking_id')
            ->pluck('booking_id');

        $serviceBookingIds = $order->serviceItems()
            ->whereNotNull('booking_id')
            ->pluck('booking_id');

        return $itemBookingIds
            ->merge($serviceBookingIds)
            ->unique()
            ->filter()
            ->values();
    }

    /**
     * @return int[]
     */
    public function confirmLinkedBookingsForPaidOrder(Order $order, string $source, array $extraLogMeta = []): array
    {
        $bookingIds = $this->linkedBookingIdsForOrder($order);
        if ($bookingIds->isEmpty()) {
            return [];
        }

        $confirmedIds = [];

        $bookings = Booking::query()
            ->whereIn('id', $bookingIds)
            ->lockForUpdate()
            ->get();

        foreach ($bookings as $booking) {
            $status = strtoupper((string) $booking->status);
            if (in_array($status, [
                'CANCELLED',
                'VOIDED',
                'EXPIRED',
                'COMPLETED',
                'NO_SHOW',
                'NOTIFIED_CANCELLATION',
                'LATE_CANCELLATION',
            ], true)) {
                continue;
            }

            $paymentStatus = strtoupper((string) $booking->payment_status);
            $shouldConfirm = in_array($status, ['HOLD', 'PENDING'], true)
                || $paymentStatus !== 'PAID';

            if (! $shouldConfirm) {
                continue;
            }

            $booking->status = 'CONFIRMED';
            $booking->payment_status = 'PAID';
            $booking->hold_expires_at = null;
            $booking->save();

            $confirmedIds[] = (int) $booking->id;

            BookingLog::create([
                'booking_id' => (int) $booking->id,
                'actor_type' => 'SYSTEM',
                'actor_id' => null,
                'action' => 'PAYMENT_CONFIRMED',
                'meta' => array_merge([
                    'order_id' => $order->id,
                    'order_no' => $order->order_number,
                    'source' => $source,
                ], $extraLogMeta),
                'created_at' => now(),
            ]);
        }

        return $confirmedIds;
    }
}
