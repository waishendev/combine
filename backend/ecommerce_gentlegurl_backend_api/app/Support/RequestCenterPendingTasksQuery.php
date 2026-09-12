<?php

namespace App\Support;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingCancellationRequest;
use App\Models\Booking\BookingPaymentLink;
use App\Models\Ecommerce\CustomerWalletTransaction;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\ReturnRequest;
use App\Services\Reports\ReportBranchScope;
use App\Services\StoreLocationAccessService;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Request;
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
     * Booking + package purchases: selected Branch only (or all accessible when All Branches).
     * Ecommerce orders/returns: same Branch rules as product fulfilment (order branch OR item fulfilment branch).
     * Balance top-ups: global (customers are global).
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
    public static function summaryCounts(?Request $request = null): array
    {
        $request = $request ?? request();
        [$bookingIds, $includeNullBookings, $orderScope] = static::resolveBranchScopes($request);

        $scopeBooking = function ($query) use ($bookingIds, $includeNullBookings): void {
            $query->where(function ($inner) use ($bookingIds, $includeNullBookings) {
                $inner->whereIn('store_location_id', $bookingIds);
                if ($includeNullBookings) {
                    $inner->orWhereNull('store_location_id');
                }
            });
        };

        $cancellations = (int) BookingCancellationRequest::query()
            ->where('status', 'pending')
            ->whereHas('booking', $scopeBooking)
            ->count();
        $holds = (int) Booking::query()
            ->whereIn('status', static::BOOKING_HOLD_STATUSES)
            ->where(function ($inner) use ($bookingIds, $includeNullBookings) {
                $inner->whereIn('store_location_id', $bookingIds);
                if ($includeNullBookings) {
                    $inner->orWhereNull('store_location_id');
                }
            })
            ->count();
        $depositProofs = (int) BookingPaymentLink::query()
            ->where('status', 'PENDING')
            ->where('manual_review_status', 'slip_uploaded_pending_review')
            ->whereHas('booking', $scopeBooking)
            ->count();
        $packagePurchases = (int) $orderScope->apply(
            Order::query()
                ->whereIn('status', ['pending', 'processing'])
                ->where('payment_status', 'unpaid')
                ->whereHas('items', fn ($items) => $items->where('line_type', 'service_package')),
            'orders.store_location_id'
        )->count();
        $ecommerceOrders = (int) $orderScope->apply(
            PendingEcommerceOrderQuery::pendingRequestOrders(),
            'orders.store_location_id'
        )->count();
        $returns = (int) ReturnRequest::query()
            ->whereIn('status', static::RETURN_ACTIVE_STATUSES)
            ->whereHas('order', fn ($orders) => $orderScope->apply($orders, 'orders.store_location_id'))
            ->count();
        // Customers (and wallet top-ups) are global — not Branch-scoped.
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
     * @return array{0: list<int>, 1: bool, 2: ReportBranchScope}
     */
    private static function resolveBranchScopes(Request $request): array
    {
        $access = app(StoreLocationAccessService::class);
        $user = $request->user();
        abort_unless($user, 401);

        $requested = null;
        foreach (['store_location_id', 'branch_store_location_id'] as $key) {
            if ($request->filled($key)) {
                $requested = (int) $request->integer($key);
                break;
            }
        }

        if ($requested !== null) {
            $access->authorizeStoreLocation($user, $requested, false);

            return [
                [$requested],
                false,
                new ReportBranchScope([$requested], $requested, false),
            ];
        }

        $ids = $access->accessibleStoreLocations($user, false)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        return [
            $ids,
            true,
            new ReportBranchScope($ids, null, true),
        ];
    }

    /**
     * @return EloquentCollection<int, BookingCancellationRequest>
     */
    public static function pendingCancellationRequests(?int $storeLocationId = null): EloquentCollection
    {
        return BookingCancellationRequest::query()
            ->with([
                'booking:id,booking_code,guest_name,guest_phone,guest_email,customer_id',
                'booking.customer:id,name,phone,email',
            ])
            ->where('status', 'pending')
            ->when($storeLocationId, fn ($query) => $query->whereHas('booking', fn ($booking) => $booking->where('store_location_id', $storeLocationId)))
            ->orderByDesc('requested_at')
            ->get();
    }

    /**
     * @return EloquentCollection<int, Booking>
     */
    public static function pendingHoldBookings(?int $storeLocationId = null): EloquentCollection
    {
        return Booking::query()
            ->with(['customer:id,name,phone,email'])
            ->whereIn('status', static::BOOKING_HOLD_STATUSES)
            ->when($storeLocationId, fn ($query) => $query->where('store_location_id', $storeLocationId))
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
    public static function pendingBookingRequestRows(?int $storeLocationId = null): Collection
    {
        $cancellationRows = static::pendingCancellationRequests($storeLocationId)->map(function (BookingCancellationRequest $row) {
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

        $holdRows = static::pendingHoldBookings($storeLocationId)->map(function (Booking $booking) {
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
