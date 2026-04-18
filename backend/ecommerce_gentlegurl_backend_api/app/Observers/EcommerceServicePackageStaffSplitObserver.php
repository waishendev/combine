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
        $date = $this->resolveOrderCreatedAt((int) $split->order_id);
        if (! $date) {
            return;
        }

        $this->recalculateForStaff((int) $split->staff_id, $date);

        if ($split->wasChanged('staff_id')) {
            $originalStaffId = (int) $split->getOriginal('staff_id');
            if ($originalStaffId > 0 && $originalStaffId !== (int) $split->staff_id) {
                $this->recalculateForStaff($originalStaffId, $date);
            }
        }
    }

    public function deleted(ServicePackageStaffSplit $split): void
    {
        $date = $this->resolveOrderCreatedAt((int) $split->order_id);
        if (! $date) {
            return;
        }

        $this->recalculateForStaff((int) $split->staff_id, $date);
    }

    private function resolveOrderCreatedAt(int $orderId): ?Carbon
    {
        $createdAt = DB::table('orders')->where('id', $orderId)->value('created_at');

        return $createdAt ? Carbon::parse($createdAt) : null;
    }

    private function recalculateForStaff(int $staffId, Carbon $date): void
    {
        if ($staffId <= 0) {
            return;
        }

        app(StaffCommissionService::class)->recalculateForStaffMonth(
            $staffId,
            (int) $date->format('Y'),
            (int) $date->format('m'),
            StaffCommissionService::TYPE_ECOMMERCE
        );
    }
}
