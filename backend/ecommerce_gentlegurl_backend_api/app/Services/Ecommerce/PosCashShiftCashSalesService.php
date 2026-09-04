<?php

namespace App\Services\Ecommerce;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Live cash-drawer sales for a POS shift window (same formula as report serialization).
 * Request-scoped memo avoids N+1 identical windows on cash-shift report loads.
 */
class PosCashShiftCashSalesService
{
    /** @var list<string> */
    private const EXCLUDED_ORDER_STATUSES = ['cancelled', 'draft', 'voided'];

    public function compute(CarbonInterface $start, CarbonInterface $end, ?int $storeLocationId): float
    {
        $memoKey = $this->memoKey($start, $end, $storeLocationId);
        $request = app()->bound('request') ? request() : null;
        if ($request !== null && $request->attributes->has($memoKey)) {
            return (float) $request->attributes->get($memoKey);
        }

        $cashFromPayments = (float) DB::table('order_payments')
            ->join('orders', 'orders.id', '=', 'order_payments.order_id')
            ->whereRaw('LOWER(order_payments.payment_method) = ?', ['cash'])
            ->where(function ($query) use ($start, $end) {
                $query->whereBetween('orders.paid_at', [$start, $end])
                    ->orWhere(function ($nested) use ($start, $end) {
                        $nested->whereNull('orders.paid_at')
                            ->whereBetween('orders.created_at', [$start, $end]);
                    });
            })
            ->whereNotIn('orders.status', self::EXCLUDED_ORDER_STATUSES)
            ->when($storeLocationId, fn ($query) => $query->where('orders.store_location_id', $storeLocationId))
            ->where(function ($query) {
                $query->whereIn('orders.pickup_or_shipping', ['pos', 'in_store'])
                    ->orWhereNotNull('orders.created_by_user_id');
            })
            ->sum('order_payments.amount');

        $fallbackCash = (float) DB::table('orders')
            ->whereRaw('LOWER(payment_method) = ?', ['cash'])
            ->where(function ($query) use ($start, $end) {
                $query->whereBetween('paid_at', [$start, $end])
                    ->orWhere(function ($nested) use ($start, $end) {
                        $nested->whereNull('paid_at')
                            ->whereBetween('created_at', [$start, $end]);
                    });
            })
            ->whereNotIn('status', self::EXCLUDED_ORDER_STATUSES)
            ->when($storeLocationId, fn ($query) => $query->where('store_location_id', $storeLocationId))
            ->where(function ($query) {
                $query->whereIn('pickup_or_shipping', ['pos', 'in_store'])
                    ->orWhereNotNull('created_by_user_id');
            })
            ->whereNotExists(function ($query) {
                $query->selectRaw('1')
                    ->from('order_payments')
                    ->whereColumn('order_payments.order_id', 'orders.id');
            })
            ->sum('grand_total');

        $total = round($cashFromPayments + $fallbackCash, 2);

        if ($request !== null) {
            $request->attributes->set($memoKey, $total);
        }

        return $total;
    }

    private function memoKey(CarbonInterface $start, CarbonInterface $end, ?int $storeLocationId): string
    {
        return sprintf(
            'pos_cash_shift_cash_sales.%s.%s.%s',
            $start->format('Y-m-d H:i:s.u'),
            $end->format('Y-m-d H:i:s.u'),
            $storeLocationId === null ? 'null' : (string) $storeLocationId,
        );
    }
}
