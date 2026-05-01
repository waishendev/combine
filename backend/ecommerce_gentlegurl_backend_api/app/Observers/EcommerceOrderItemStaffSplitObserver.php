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
        [$date, $lineType] = $this->resolveOrderContext((int) $split->order_item_id);
        if (! $date) {
            return;
        }

        $this->recalculateForStaff((int) $split->staff_id, $date, $lineType);

        if ($split->wasChanged('staff_id')) {
            $originalStaffId = (int) $split->getOriginal('staff_id');
            if ($originalStaffId > 0 && $originalStaffId !== (int) $split->staff_id) {
                $this->recalculateForStaff($originalStaffId, $date, $lineType);
            }
        }
    }

    public function deleted(OrderItemStaffSplit $split): void
    {
        [$date, $lineType] = $this->resolveOrderContext((int) $split->order_item_id);
        if (! $date) {
            return;
        }

        $this->recalculateForStaff((int) $split->staff_id, $date, $lineType);
    }

    private function resolveOrderContext(int $orderItemId): array
    {
        $row = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.id', $orderItemId)
            ->select(['orders.created_at', 'order_items.line_type'])
            ->first();

        if (! $row || ! $row->created_at) {
            return [null, null];
        }

        return [Carbon::parse($row->created_at), strtoupper((string) ($row->line_type ?? ''))];
    }

    private function recalculateForStaff(int $staffId, Carbon $date, ?string $lineType = null): void
    {
        if ($staffId <= 0) {
            return;
        }

        $type = $lineType === 'BOOKING_PRODUCT'
            ? StaffCommissionService::TYPE_BOOKING
            : StaffCommissionService::TYPE_ECOMMERCE;

        app(StaffCommissionService::class)->recalculateForStaffMonth(
            $staffId,
            (int) $date->format('Y'),
            (int) $date->format('m'),
            $type
        );
    }
}
