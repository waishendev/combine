<?php

namespace App\Support;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingCancellationRequest;
use App\Models\Booking\BookingPaymentLink;
use App\Models\Ecommerce\CustomerWalletTransaction;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\ReturnRequest;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

/**
 * Pending tasks shown in POS Request Center (Ecommerce + Booking tabs).
 */
class RequestCenterPendingTasksQuery
{
    /** @var array<int, string> */
    public const BOOKING_HOLD_STATUSES = ['HOLD', 'PENDING', 'PENDING_CONFIRMATION'];

    /** @var array<int, string> */
    public const RETURN_ACTIVE_STATUSES = ['requested', 'approved', 'in_transit', 'received'];

    /**
     * Lightweight badge counts for POS Request Center (no row hydration).
     *
     * @return array{
     *   cancellations:int,
     *   holds:int,
     *   deposit_proofs:int,
     *   package_purchases:int,
     *   booking:int,
     *   ecommerce_orders:int,
     *   returns:int,
     *   ecommerce:int,
     *   balance_topups:int,
     *   total:int
     * }
     */
    public static function summaryCounts(): array
    {
        $cancellations = (int) BookingCancellationRequest::query()->where('status', 'pending')->count();
        $holds = (int) Booking::query()->whereIn('status', static::BOOKING_HOLD_STATUSES)->count();
        $depositProofs = (int) BookingPaymentLink::query()
            ->where('status', 'PENDING')
            ->where('manual_review_status', 'slip_uploaded_pending_review')
            ->count();
        $packagePurchases = (int) Order::query()
            ->whereIn('status', ['pending', 'processing'])
            ->where('payment_status', 'unpaid')
            ->whereHas('items', fn ($items) => $items->where('line_type', 'service_package'))
            ->count();
        $ecommerceOrders = (int) PendingEcommerceOrderQuery::pendingRequestOrders()->count();
        $returns = (int) ReturnRequest::query()->whereIn('status', static::RETURN_ACTIVE_STATUSES)->count();
        $balanceTopups = (int) CustomerWalletTransaction::query()->pendingReview()->count();

        $booking = $cancellations + $holds + $depositProofs + $packagePurchases;
        $ecommerce = $ecommerceOrders + $returns;

        return [
            'cancellations' => $cancellations,
            'holds' => $holds,
            'deposit_proofs' => $depositProofs,
            'package_purchases' => $packagePurchases,
            'booking' => $booking,
            'ecommerce_orders' => $ecommerceOrders,
            'returns' => $returns,
            'ecommerce' => $ecommerce,
            'balance_topups' => $balanceTopups,
            'total' => $booking + $ecommerce + $balanceTopups,
        ];
    }

    /**
     * @return EloquentCollection<int, BookingCancellationRequest>
     */
    public static function pendingCancellationRequests(): EloquentCollection
    {
        return BookingCancellationRequest::query()
            ->with([
                'booking:id,booking_code,guest_name,guest_phone,guest_email,customer_id',
                'booking.customer:id,name,phone,email',
            ])
            ->where('status', 'pending')
            ->orderByDesc('requested_at')
            ->get();
    }

    /**
     * @return EloquentCollection<int, Booking>
     */
    public static function pendingHoldBookings(): EloquentCollection
    {
        return Booking::query()
            ->with(['customer:id,name,phone,email'])
            ->whereIn('status', static::BOOKING_HOLD_STATUSES)
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * @return Collection<int, array{
     *   key:string,
     *   request_type:string,
     *   reference:string,
     *   customer_name:string,
     *   contact:string,
     *   requested_at:?string,
     *   status:string,
     *   reason:?string
     * }>
     */
    public static function pendingBookingRequestRows(): Collection
    {
        $cancellationRows = static::pendingCancellationRequests()->map(function (BookingCancellationRequest $row) {
            $booking = $row->booking;
            $customer = $booking?->customer;
            $bookingId = (int) ($row->booking_id ?? $booking?->id ?? 0);
            $reference = (string) ($booking?->booking_code ?: ($bookingId > 0 ? "#{$bookingId}" : "Request #{$row->id}"));

            return [
                'key' => "cancel-{$row->id}",
                'request_type' => 'Cancellation request',
                'reference' => $reference,
                'customer_name' => (string) ($customer?->name ?: $booking?->guest_name ?: 'Guest'),
                'contact' => (string) ($customer?->phone ?: $booking?->guest_phone ?: $customer?->email ?: $booking?->guest_email ?: '-'),
                'requested_at' => optional($row->requested_at ?? $row->created_at)?->toIso8601String(),
                'status' => (string) ($row->status ?? 'pending'),
                'reason' => $row->reason !== null && trim((string) $row->reason) !== '' ? (string) $row->reason : null,
            ];
        });

        $holdRows = static::pendingHoldBookings()->map(function (Booking $booking) {
            return [
                'key' => "hold-{$booking->id}",
                'request_type' => 'Hold confirmation',
                'reference' => (string) ($booking->booking_code ?: "#{$booking->id}"),
                'customer_name' => (string) ($booking->customer?->name ?: $booking->guest_name ?: 'Guest'),
                'contact' => (string) ($booking->customer?->phone ?: $booking->guest_phone ?: $booking->customer?->email ?: $booking->guest_email ?: '-'),
                'requested_at' => optional($booking->created_at ?? $booking->start_at)?->toIso8601String(),
                'status' => (string) ($booking->status ?? 'HOLD'),
                'reason' => null,
            ];
        });

        return $cancellationRows
            ->concat($holdRows)
            ->unique('key')
            ->values();
    }
}
