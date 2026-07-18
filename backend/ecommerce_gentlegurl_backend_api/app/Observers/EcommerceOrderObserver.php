<?php

namespace App\Observers;

use App\Models\Ecommerce\Order;
use Illuminate\Support\Facades\DB;
use App\Services\Booking\StaffCommissionService;
use Carbon\Carbon;

class EcommerceOrderObserver
{
    public function saved(Order $order): void
    {
        if (! $order->wasRecentlyCreated && ! $order->wasChanged(['status', 'payment_status', 'refunded_at', 'created_at'])) {
            return;
        }

        $this->recalculateMonthFromOrder($order, $order->created_at ? Carbon::parse($order->created_at) : null);

        if ($order->wasChanged('created_at')) {
            $originalCreatedAt = $order->getOriginal('created_at');
            $this->recalculateMonthFromOrder($order, $originalCreatedAt ? Carbon::parse($originalCreatedAt) : null);
        }
    }

    public function deleted(Order $order): void
    {
        $this->recalculateMonthFromOrder($order, $order->created_at ? Carbon::parse($order->created_at) : null);
    }

    private function recalculateMonthFromOrder(Order $order, ?Carbon $date): void
    {
        if (! $date) {
            return;
        }
        $year = (int) $date->format('Y');
        $month = (int) $date->format('m');

        $orderId = (int) ($order->id ?? 0);
        if ($orderId > 0) {
            $lineTypes = DB::table('order_items')
                ->where('order_id', $orderId)
                ->pluck('line_type')
                ->map(fn ($v) => (string) $v)
                ->unique()
                ->values();

            $hasBooking = $lineTypes->contains(
                fn ($lineType) => StaffCommissionService::isBookingCommissionLineType($lineType)
            );
            $hasEcommerce = $lineTypes->contains(
                fn ($lineType) => $lineType !== '' && ! StaffCommissionService::isBookingCommissionLineType($lineType)
            );

            if ($hasBooking) {
                app(StaffCommissionService::class)->recalculateForMonthAll($year, $month, StaffCommissionService::TYPE_BOOKING);
            }
            if ($hasEcommerce) {
                app(StaffCommissionService::class)->recalculateForMonthAll($year, $month, StaffCommissionService::TYPE_ECOMMERCE);
            }
            return;
        }

        app(StaffCommissionService::class)->recalculateForMonthAll($year, $month, StaffCommissionService::TYPE_ECOMMERCE);
    }
}
