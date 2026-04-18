<?php

namespace App\Observers;

use App\Models\Ecommerce\Order;
use App\Services\Booking\StaffCommissionService;
use Carbon\Carbon;

class EcommerceOrderObserver
{
    public function saved(Order $order): void
    {
        if (! $order->wasRecentlyCreated && ! $order->wasChanged(['status', 'payment_status', 'refunded_at', 'created_at'])) {
            return;
        }

        $this->recalculateMonthFromDate($order->created_at ? Carbon::parse($order->created_at) : null);

        if ($order->wasChanged('created_at')) {
            $originalCreatedAt = $order->getOriginal('created_at');
            $this->recalculateMonthFromDate($originalCreatedAt ? Carbon::parse($originalCreatedAt) : null);
        }
    }

    public function deleted(Order $order): void
    {
        $this->recalculateMonthFromDate($order->created_at ? Carbon::parse($order->created_at) : null);
    }

    private function recalculateMonthFromDate(?Carbon $date): void
    {
        if (! $date) {
            return;
        }

        app(StaffCommissionService::class)->recalculateForMonthAll(
            (int) $date->format('Y'),
            (int) $date->format('m'),
            StaffCommissionService::TYPE_ECOMMERCE
        );
    }
}
