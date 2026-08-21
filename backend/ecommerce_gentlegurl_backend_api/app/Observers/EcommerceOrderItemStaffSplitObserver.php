<?php

namespace App\Observers;

use App\Models\Ecommerce\OrderItemStaffSplit;
use App\Services\Booking\StaffCommissionService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class EcommerceOrderItemStaffSplitObserver
{
    public function saved(OrderItemStaffSplit $split): void
    {
        [$date, $lineType, $branchId] = $this->resolveOrderContext((int) $split->order_item_id);
        if (! $date) {
            return;
        }

        if (! $branchId) return;
        $this->recalculateForStaff((int) $split->staff_id, $date, $lineType, $branchId);

        if ($split->wasChanged('staff_id')) {
            $originalStaffId = (int) $split->getOriginal('staff_id');
            if ($originalStaffId > 0 && $originalStaffId !== (int) $split->staff_id) {
                $this->recalculateForStaff($originalStaffId, $date, $lineType, $branchId);
            }
        }
    }

    public function deleted(OrderItemStaffSplit $split): void
    {
        [$date, $lineType, $branchId] = $this->resolveOrderContext((int) $split->order_item_id);
        if (! $date) {
            return;
        }

        if (! $branchId) return;
        $this->recalculateForStaff((int) $split->staff_id, $date, $lineType, $branchId);
    }

    private function resolveOrderContext(int $orderItemId): array
    {
        $row = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.id', $orderItemId)
            ->select(['orders.created_at', 'orders.store_location_id', 'order_items.line_type'])
            ->first();

        if (! $row || ! $row->created_at) {
            return [null, null, null];
        }

        return [Carbon::parse($row->created_at), (string) ($row->line_type ?? ''), $row->store_location_id ? (int) $row->store_location_id : null];
    }

    private function recalculateForStaff(int $staffId, Carbon $date, ?string $lineType, int $branchId): void
    {
        if ($staffId <= 0) {
            return;
        }

        $type = StaffCommissionService::isBookingCommissionLineType($lineType)
            ? StaffCommissionService::TYPE_BOOKING
            : StaffCommissionService::TYPE_ECOMMERCE;

        app(StaffCommissionService::class)->recalculateForStaffMonth(
            $staffId,
            (int) $date->format('Y'),
            (int) $date->format('m'),
            $type,
            false,
            $branchId
        );
    }
}
