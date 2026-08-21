<?php

namespace App\Observers;

use App\Models\Ecommerce\ServicePackageStaffSplit;
use App\Services\Booking\StaffCommissionService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class EcommerceServicePackageStaffSplitObserver
{
    public function saved(ServicePackageStaffSplit $split): void
    {
        [$date, $branchId] = $this->resolveOrderContext((int) $split->order_id);
        if (! $date || ! $branchId) {
            return;
        }

        $this->recalculateForStaff((int) $split->staff_id, $date, $branchId);

        if ($split->wasChanged('staff_id')) {
            $originalStaffId = (int) $split->getOriginal('staff_id');
            if ($originalStaffId > 0 && $originalStaffId !== (int) $split->staff_id) {
                $this->recalculateForStaff($originalStaffId, $date, $branchId);
            }
        }
    }

    public function deleted(ServicePackageStaffSplit $split): void
    {
        [$date, $branchId] = $this->resolveOrderContext((int) $split->order_id);
        if (! $date || ! $branchId) {
            return;
        }

        $this->recalculateForStaff((int) $split->staff_id, $date, $branchId);
    }

    private function resolveOrderContext(int $orderId): array
    {
        $order = DB::table('orders')->where('id', $orderId)->first(['created_at', 'store_location_id']);
        return [$order?->created_at ? Carbon::parse($order->created_at) : null, $order?->store_location_id ? (int) $order->store_location_id : null];
    }

    private function recalculateForStaff(int $staffId, Carbon $date, int $branchId): void
    {
        if ($staffId <= 0) {
            return;
        }

        app(StaffCommissionService::class)->recalculateForStaffMonth(
            $staffId,
            (int) $date->format('Y'),
            (int) $date->format('m'),
            StaffCommissionService::TYPE_ECOMMERCE,
            false,
            $branchId
        );
    }
}
