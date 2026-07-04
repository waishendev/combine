<?php

namespace App\Support;

use App\Models\Ecommerce\Order;
use Illuminate\Database\Eloquent\Builder;

/**
 * Orders surfaced in POS Request Center → Ecommerce tab (daily admin summary email).
 * Excludes booking deposit / settlement orders and POS-created orders.
 */
class PendingEcommerceOrderQuery
{
    /**
     * Customer checkout orders only (exclude POS-created orders).
     */
    public static function customerOrders(): Builder
    {
        return Order::query()->whereNull('created_by_user_id');
    }

    /**
     * Ecommerce shop orders that still appear in POS Request Center.
     *
     * Mirrors PosRequestCenter ECOMMERCE_REQUEST_FILTERS + shouldShowEcommerceOrder:
     * - shop orders only (no booking deposit / settlement lines)
     * - status: pending, processing, confirmed, ready_for_pickup, shipped
     * - or payment_status: failed
     *
     * Excluded: cancelled, completed, reject_payment_proof, booking orders.
     */
    public static function pendingRequestOrders(): Builder
    {
        $query = static::customerOrders();
        static::applyNonBookingOrderScope($query);

        return $query
            ->whereNotIn('status', ['cancelled', 'completed', 'reject_payment_proof'])
            ->where(function ($statusQuery) {
                $statusQuery
                    ->whereIn('status', ['pending', 'processing', 'confirmed', 'ready_for_pickup', 'shipped'])
                    ->orWhere('payment_status', 'failed');
            })
            ->orderByDesc('id');
    }

    /**
     * @param Builder<Order> $query
     */
    protected static function applyNonBookingOrderScope(Builder $query): void
    {
        $query
            ->whereDoesntHave('items', function ($itemQuery) {
                $itemQuery->whereIn('line_type', [
                    'booking_deposit',
                    'booking_addon',
                    'booking_settlement',
                    'booking_product',
                    'service_package',
                ]);
            })
            ->whereDoesntHave('serviceItems')
            ->where(function ($noteQuery) {
                $noteQuery->whereNull('notes')
                    ->orWhere('notes', 'not like', '%Booking cart checkout%');
            });
    }

    public static function isBookingOrder(Order $order): bool
    {
        $items = $order->relationLoaded('items') ? $order->items : $order->items()->get(['id', 'order_id', 'line_type']);

        $hasBookingLineItems = $items->contains(fn ($item) => in_array((string) ($item->line_type ?? ''), [
            'booking_deposit',
            'booking_addon',
            'booking_settlement',
            'booking_product',
            'service_package',
        ], true));

        if ($hasBookingLineItems) {
            return true;
        }

        if ($order->relationLoaded('serviceItems') ? $order->serviceItems->isNotEmpty() : $order->serviceItems()->exists()) {
            return true;
        }

        return stripos((string) ($order->notes ?? ''), 'Booking cart checkout') !== false;
    }

    public static function orderKind(Order $order): string
    {
        return static::isBookingOrder($order) ? 'Booking' : 'Shop';
    }

    public static function displayStatus(Order $order): string
    {
        $status = strtolower(trim((string) ($order->status ?? '')));
        $payment = strtolower(trim((string) ($order->payment_status ?? '')));
        $isBooking = static::isBookingOrder($order);

        if ($isBooking && $payment === 'paid') {
            return 'Completed';
        }

        if ($payment === 'unpaid' && $status === 'pending') {
            return 'Awaiting Payment';
        }

        if ($payment === 'unpaid' && $status === 'processing') {
            return 'Waiting for Verification';
        }

        if ($status === 'reject_payment_proof' && $payment === 'unpaid') {
            return 'Payment Proof Rejected';
        }

        if ($payment === 'failed') {
            return 'Payment Failed';
        }

        if ($status === 'cancelled' && $payment === 'refunded') {
            return 'Refunded';
        }

        if ($status === 'cancelled') {
            return 'Cancelled';
        }

        if ($status === 'confirmed' && $payment === 'paid') {
            return 'Payment Confirmed';
        }

        if ($status === 'processing' && $payment === 'paid') {
            return $isBooking ? 'Deposit Verified' : 'Preparing';
        }

        if ($status === 'ready_for_pickup' && $payment === 'paid') {
            return 'Ready for Pickup';
        }

        if ($status === 'shipped') {
            return 'Shipped';
        }

        if ($status === 'completed') {
            return 'Completed';
        }

        $statusLabel = $status !== '' ? ucfirst(str_replace('_', ' ', $status)) : '';
        $paymentLabel = $payment !== '' ? ucfirst(str_replace('_', ' ', $payment)) : '';

        if ($statusLabel !== '' && $paymentLabel !== '') {
            return "{$statusLabel} / {$paymentLabel}";
        }

        return $statusLabel !== '' ? $statusLabel : ($paymentLabel !== '' ? $paymentLabel : 'Unknown');
    }
}
