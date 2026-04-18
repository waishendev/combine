<?php

namespace App\Services\Ecommerce;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingPayment;
use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderActionLog;
use App\Models\Staff;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OfflineOrderManagementService
{
    private const ALLOWED_VOID_STATUSES = ['paid', 'completed', 'confirmed', 'packed', 'shipped', 'ready_for_pickup'];

    public function getSalesPersonDraft(Order $order): array
    {
        $this->ensureOfflineOrder($order);

        $items = DB::table('order_items as oi')
            ->where('oi.order_id', (int) $order->id)
            ->orderBy('oi.id')
            ->get([
                'oi.id',
                'oi.line_type',
                'oi.product_name_snapshot',
                'oi.display_name_snapshot',
                'oi.customer_service_package_id',
                'oi.quantity',
                'oi.effective_unit_price',
                'oi.unit_price_snapshot',
                'oi.price_snapshot',
                'oi.effective_line_total',
                'oi.line_total_after_discount',
                'oi.line_total',
            ]);

        $orderItemIds = $items->pluck('id')->map(fn ($v) => (int) $v)->all();
        $cspIds = $items->pluck('customer_service_package_id')->filter()->map(fn ($v) => (int) $v)->all();

        $productSplits = DB::table('order_item_staff_splits as split')
            ->leftJoin('staffs', 'staffs.id', '=', 'split.staff_id')
            ->whereIn('split.order_item_id', $orderItemIds)
            ->orderBy('split.id')
            ->get([
                'split.order_item_id',
                'split.staff_id',
                'split.share_percent',
                'staffs.name as staff_name',
            ])
            ->groupBy('order_item_id');

        $packageSplits = empty($cspIds)
            ? collect()
            : DB::table('service_package_staff_splits as split')
                ->leftJoin('staffs', 'staffs.id', '=', 'split.staff_id')
                ->whereIn('split.customer_service_package_id', $cspIds)
                ->orderBy('split.id')
                ->get([
                    'split.customer_service_package_id',
                    'split.staff_id',
                    'split.share_percent',
                    'staffs.name as staff_name',
                ])
                ->groupBy('customer_service_package_id');

        return $items->map(function ($item) use ($productSplits, $packageSplits) {
            $isPackage = (string) $item->line_type === 'service_package' && $item->customer_service_package_id;
            $splitRows = $isPackage
                ? ($packageSplits->get((int) $item->customer_service_package_id) ?? collect())
                : ($productSplits->get((int) $item->id) ?? collect());

            return [
                'order_item_id' => (int) $item->id,
                'item_type' => $isPackage ? 'service_package' : 'product',
                'name' => (string) ($item->display_name_snapshot ?: $item->product_name_snapshot ?: 'Item'),
                'qty' => (int) ($item->quantity ?? 0),
                'unit_amount' => (float) ($item->effective_unit_price ?? $item->unit_price_snapshot ?? $item->price_snapshot ?? 0),
                'line_total' => (float) ($item->effective_line_total ?? $item->line_total_after_discount ?? $item->line_total ?? 0),
                'customer_service_package_id' => $item->customer_service_package_id ? (int) $item->customer_service_package_id : null,
                'splits' => $splitRows->map(fn ($split) => [
                    'staff_id' => (int) ($split->staff_id ?? 0),
                    'staff_name' => (string) ($split->staff_name ?? ''),
                    'share_percent' => (int) ($split->share_percent ?? 0),
                ])->values()->all(),
            ];
        })->values()->all();
    }

    public function updateSalesPerson(Order $order, array $itemSplits, ?string $remark, ?int $actorId): Order
    {
        $this->ensureOfflineOrder($order);
        if (empty($itemSplits)) {
            throw new RuntimeException('At least one item split is required.');
        }

        DB::transaction(function () use ($order, $itemSplits, $remark, $actorId) {
            $orderItems = DB::table('order_items')
                ->where('order_id', (int) $order->id)
                ->get([
                    'id',
                    'line_type',
                    'line_total',
                    'line_total_after_discount',
                    'effective_line_total',
                    'customer_service_package_id',
                    'service_package_id',
                ])->keyBy('id');

            $staffs = Staff::query()->get(['id', 'commission_rate', 'service_commission_rate'])->keyBy('id');

            foreach ($itemSplits as $itemSplit) {
                $orderItemId = (int) ($itemSplit['order_item_id'] ?? 0);
                $orderItem = $orderItems->get($orderItemId);
                if (! $orderItem) {
                    throw new RuntimeException("Order item {$orderItemId} not found.");
                }

                $splits = collect($itemSplit['splits'] ?? []);
                if ($splits->isEmpty()) {
                    throw new RuntimeException('Each item must have at least one staff split.');
                }
                $sum = (int) $splits->sum(fn (array $row) => (int) ($row['share_percent'] ?? 0));
                $unique = $splits->pluck('staff_id')->map(fn ($id) => (int) $id)->unique()->count();
                if ($sum !== 100 || $unique !== $splits->count()) {
                    throw new RuntimeException('Invalid staff split. Total must be 100% and staffs must be unique.');
                }

                $before = (string) $orderItem->line_type === 'service_package' && $orderItem->customer_service_package_id
                    ? DB::table('service_package_staff_splits')
                        ->where('customer_service_package_id', (int) $orderItem->customer_service_package_id)
                        ->get(['staff_id', 'share_percent', 'service_commission_rate_snapshot', 'split_sales_amount'])
                        ->map(fn ($row) => (array) $row)
                        ->values()
                        ->all()
                    : DB::table('order_item_staff_splits')
                        ->where('order_item_id', $orderItemId)
                        ->get(['staff_id', 'share_percent', 'commission_rate_snapshot'])
                        ->map(fn ($row) => (array) $row)
                        ->values()
                        ->all();

                if ((string) $orderItem->line_type === 'service_package' && $orderItem->customer_service_package_id) {
                    DB::table('service_package_staff_splits')
                        ->where('customer_service_package_id', (int) $orderItem->customer_service_package_id)
                        ->delete();

                    $itemTotal = (float) ($orderItem->effective_line_total ?? $orderItem->line_total_after_discount ?? $orderItem->line_total ?? 0);

                    $rows = $splits->map(function (array $row) use ($order, $orderItem, $staffs, $itemTotal) {
                        $staffId = (int) ($row['staff_id'] ?? 0);
                        $share = (int) ($row['share_percent'] ?? 0);
                        $staff = $staffs->get($staffId);
                        $rate = (float) ($staff?->service_commission_rate ?? 0);
                        $sales = round($itemTotal * ($share / 100), 2);

                        return [
                            'order_id' => (int) $order->id,
                            'customer_service_package_id' => (int) $orderItem->customer_service_package_id,
                            'service_package_id' => $orderItem->service_package_id ? (int) $orderItem->service_package_id : null,
                            'customer_id' => $order->customer_id ? (int) $order->customer_id : null,
                            'staff_id' => $staffId,
                            'share_percent' => $share,
                            'split_sales_amount' => $sales,
                            'service_commission_rate_snapshot' => $rate,
                            'commission_amount_snapshot' => round($sales * $rate, 2),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    })->values()->all();

                    DB::table('service_package_staff_splits')->insert($rows);

                    $after = DB::table('service_package_staff_splits')
                        ->where('customer_service_package_id', (int) $orderItem->customer_service_package_id)
                        ->get(['staff_id', 'share_percent', 'service_commission_rate_snapshot', 'split_sales_amount'])
                        ->map(fn ($row) => (array) $row)
                        ->values()
                        ->all();
                } else {
                    DB::table('order_item_staff_splits')
                        ->where('order_item_id', $orderItemId)
                        ->delete();

                    $rows = $splits->map(function (array $row) use ($orderItemId, $staffs) {
                        $staffId = (int) ($row['staff_id'] ?? 0);
                        $staff = $staffs->get($staffId);
                        return [
                            'order_item_id' => $orderItemId,
                            'staff_id' => $staffId,
                            'share_percent' => (int) ($row['share_percent'] ?? 0),
                            'commission_rate_snapshot' => (float) ($staff?->commission_rate ?? 0),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    })->values()->all();

                    DB::table('order_item_staff_splits')->insert($rows);

                    $after = DB::table('order_item_staff_splits')
                        ->where('order_item_id', $orderItemId)
                        ->get(['staff_id', 'share_percent', 'commission_rate_snapshot'])
                        ->map(fn ($row) => (array) $row)
                        ->values()
                        ->all();
                }

                $this->log(
                    'order_item',
                    $orderItemId,
                    'edit_sales_person',
                    ['splits' => $before],
                    ['splits' => $after],
                    $remark,
                    $actorId,
                );
            }
        });

        return $order;
    }

    public function updatePaymentMethod(Order $order, string $paymentMethod, ?string $remark, ?int $actorId): Order
    {
        $this->ensureOfflineOrder($order);

        $before = [
            'payment_method' => $order->payment_method,
        ];

        $order->payment_method = trim($paymentMethod);
        $order->save();

        $this->log('order', (int) $order->id, 'edit_payment_method', $before, [
            'payment_method' => $order->payment_method,
        ], $remark, $actorId);

        return $order->fresh();
    }

    public function voidOrder(Order $order, string $remark, ?int $actorId): Order
    {
        $this->ensureOfflineOrder($order);

        if ($order->status === 'voided') {
            throw new RuntimeException('This order is already voided.');
        }

        if (! in_array((string) $order->status, self::ALLOWED_VOID_STATUSES, true)) {
            throw new RuntimeException('Order is not in a valid status for void.');
        }

        DB::transaction(function () use ($order, $remark, $actorId) {
            $order->refresh();
            if ($order->status === 'voided') {
                throw new RuntimeException('This order is already voided.');
            }

            $packageIds = CustomerServicePackage::query()
                ->where('purchased_from', 'POS')
                ->where('purchased_ref_id', (int) $order->id)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

            if (! empty($packageIds)) {
                $usedCount = CustomerServicePackageUsage::query()
                    ->whereIn('customer_service_package_id', $packageIds)
                    ->count();

                if ($usedCount > 0) {
                    throw new RuntimeException('This package has already been used and cannot be voided.');
                }
            }

            $bookingIds = DB::table('order_items')
                ->where('order_id', (int) $order->id)
                ->whereNotNull('booking_id')
                ->pluck('booking_id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all();

            $beforeOrder = [
                'status' => $order->status,
                'payment_status' => $order->payment_status,
            ];

            $order->status = 'voided';
            $order->save();

            $this->log('order', (int) $order->id, 'void_order', $beforeOrder, [
                'status' => $order->status,
                'payment_status' => $order->payment_status,
            ], $remark, $actorId);

            if (! empty($bookingIds)) {
                $bookings = Booking::query()
                    ->whereIn('id', $bookingIds)
                    ->get();

                foreach ($bookings as $booking) {
                    $beforeBooking = [
                        'status' => $booking->status,
                        'payment_status' => $booking->payment_status,
                        'notes' => $booking->notes,
                    ];

                    $booking->status = 'VOIDED';
                    $booking->payment_status = 'FAILED';
                    $booking->notes = trim((string) $booking->notes . "\n[VOID REMARK] {$remark}");
                    $booking->save();

                    $this->log('appointment', (int) $booking->id, 'void_order', $beforeBooking, [
                        'status' => $booking->status,
                        'payment_status' => $booking->payment_status,
                        'notes' => $booking->notes,
                    ], $remark, $actorId);
                }

                $payments = BookingPayment::query()
                    ->whereIn('booking_id', $bookingIds)
                    ->where('status', 'PAID')
                    ->get();

                foreach ($payments as $payment) {
                    $beforePayment = [
                        'status' => $payment->status,
                        'raw_response' => $payment->raw_response,
                    ];

                    $raw = is_array($payment->raw_response) ? $payment->raw_response : [];
                    $raw['voided_by_order_id'] = (int) $order->id;
                    $raw['void_remark'] = $remark;

                    $payment->status = 'VOIDED';
                    $payment->raw_response = $raw;
                    $payment->save();

                    $this->log('settlement', (int) $payment->id, 'void_order', $beforePayment, [
                        'status' => $payment->status,
                        'raw_response' => $payment->raw_response,
                    ], $remark, $actorId);
                }
            }

            if (! empty($packageIds)) {
                $packages = CustomerServicePackage::query()
                    ->whereIn('id', $packageIds)
                    ->get();

                DB::table('service_package_staff_splits')
                    ->whereIn('customer_service_package_id', $packageIds)
                    ->delete();

                DB::table('customer_service_package_balances')
                    ->whereIn('customer_service_package_id', $packageIds)
                    ->delete();

                foreach ($packages as $package) {
                    $beforePackage = [
                        'id' => $package->id,
                        'status' => $package->status,
                        'purchased_ref_id' => $package->purchased_ref_id,
                    ];

                    $package->delete();

                    $this->log('service_package', (int) $beforePackage['id'], 'void_order', $beforePackage, [
                        'deleted' => true,
                    ], $remark, $actorId);
                }
            }
        });

        return $order->fresh();
    }

    private function ensureOfflineOrder(Order $order): void
    {
        if (! $order->created_by_user_id) {
            throw new RuntimeException('This action is only available for offline/POS orders.');
        }

        if (in_array((string) $order->status, ['cancelled', 'draft'], true)) {
            throw new RuntimeException('Order is not in a valid state for this action.');
        }
    }

    private function log(
        string $entityType,
        int $entityId,
        string $actionType,
        ?array $before,
        ?array $after,
        ?string $remark,
        ?int $actorId,
    ): void {
        OrderActionLog::query()->create([
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action_type' => $actionType,
            'before_value' => $before,
            'after_value' => $after,
            'remark' => $remark,
            'created_by' => $actorId,
        ]);
    }
}
