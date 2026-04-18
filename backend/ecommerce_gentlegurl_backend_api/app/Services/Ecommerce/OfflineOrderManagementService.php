<?php

namespace App\Services\Ecommerce;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingPayment;
use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderActionLog;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OfflineOrderManagementService
{
    private const ALLOWED_VOID_STATUSES = ['paid', 'completed', 'confirmed', 'packed', 'shipped', 'ready_for_pickup'];

    public function updateSalesPerson(Order $order, int $newUserId, ?string $remark, ?int $actorId): Order
    {
        $this->ensureOfflineOrder($order);

        $before = [
            'created_by_user_id' => $order->created_by_user_id,
        ];

        $order->created_by_user_id = $newUserId;
        $order->save();

        $this->log('order', (int) $order->id, 'edit_sales_person', $before, [
            'created_by_user_id' => $order->created_by_user_id,
        ], $remark, $actorId);

        return $order->fresh();
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
