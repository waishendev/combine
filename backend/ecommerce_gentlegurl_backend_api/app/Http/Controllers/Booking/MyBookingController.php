<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingCancellationRequest;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Booking\BookingPayment;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderReceiptToken;
use Illuminate\Http\Request;

class MyBookingController extends Controller
{
    public function index(Request $request)
    {
        $customer = $request->user('customer');

        $bookings = Booking::query()
            ->with([
                'service:id,name,duration_min,deposit_amount,buffer_min',
                'staff:id,name',
            ])
            ->where('customer_id', $customer->id)
            ->orderByDesc('start_at')
            ->get();

        $claimsByBooking = CustomerServicePackageUsage::query()
            ->whereIn('booking_id', $bookings->pluck('id')->all())
            ->orderByDesc('id')
            ->get()
            ->groupBy('booking_id');

        $latestCancellationRequests = BookingCancellationRequest::query()
            ->whereIn('booking_id', $bookings->pluck('id')->all())
            ->orderByDesc('id')
            ->get()
            ->groupBy('booking_id')
            ->map(fn ($group) => $group->first());

        $latestPaymentsByBooking = BookingPayment::query()
            ->whereIn('booking_id', $bookings->pluck('id')->all())
            ->orderByDesc('id')
            ->get()
            ->groupBy('booking_id')
            ->map(fn ($group) => $group->first());

        $payload = $bookings->map(function (Booking $booking) use ($claimsByBooking, $latestCancellationRequests, $latestPaymentsByBooking) {
            $receiptRows = OrderItem::query()
                ->with('order:id,order_number,payment_method,paid_at,created_at')
                ->where('booking_id', (int) $booking->id)
                ->whereIn('line_type', ['booking_deposit', 'booking_settlement'])
                ->orderBy('id')
                ->get();

            $orderIds = $receiptRows
                ->pluck('order.id')
                ->filter()
                ->unique()
                ->values();

            $tokensByOrderId = $orderIds->isNotEmpty()
                ? OrderReceiptToken::query()
                    ->whereIn('order_id', $orderIds->all())
                    ->orderByDesc('id')
                    ->get()
                    ->unique('order_id')
                    ->keyBy('order_id')
                : collect();

            $depositOrderItem = OrderItem::query()
                ->with('order:id,order_number')
                ->where('line_type', 'booking_deposit')
                ->where('booking_id', (int) $booking->id)
                ->latest('id')
                ->first();

            return [
                'id' => (int) $booking->id,
                'status' => $booking->status,
                'start_at' => $booking->start_at?->toIso8601String(),
                'starts_at' => $booking->start_at?->toIso8601String(),
                'deposit_amount' => (float) $booking->deposit_amount,
                'payment_status' => (string) $booking->payment_status,
                'reschedule_count' => (int) ($booking->reschedule_count ?? 0),
                'cancellation_request' => (function () use ($latestCancellationRequests, $booking) {
                    $request = $latestCancellationRequests->get($booking->id);

                    if (! $request) {
                        return null;
                    }

                    return [
                        'id' => (int) $request->id,
                        'status' => (string) $request->status,
                        'requested_at' => $request->requested_at?->toIso8601String(),
                    ];
                })(),
                'package_claim_status' => (function () use ($claimsByBooking, $booking) {
                    $claims = $claimsByBooking->get($booking->id) ?? collect();
                    if ($claims->contains(fn ($claim) => $claim->status === 'consumed')) return 'consumed';
                    if ($claims->contains(fn ($claim) => $claim->status === 'reserved')) return 'reserved';
                    if ($claims->contains(fn ($claim) => $claim->status === 'released')) return 'released';
                    return null;
                })(),
                'service_name' => $booking->service?->name,
                'staff_name' => $booking->staff?->name,
                'service' => $booking->service ? [
                    'id' => (int) $booking->service->id,
                    'name' => $booking->service->name,
                    'duration_min' => (int) $booking->service->duration_min,
                    'deposit_amount' => (float) $booking->service->deposit_amount,
                    'buffer_min' => (int) $booking->service->buffer_min,
                ] : null,
                'staff' => $booking->staff ? [
                    'id' => (int) $booking->staff->id,
                    'name' => $booking->staff->name,
                ] : null,
                'latest_payment' => (function () use ($latestPaymentsByBooking, $booking) {
                    $payment = $latestPaymentsByBooking->get($booking->id);
                    if (! $payment) {
                        return null;
                    }

                    return [
                        'id' => (int) $payment->id,
                        'status' => (string) $payment->status,
                        'provider' => (string) $payment->provider,
                        'payment_method' => data_get($payment->raw_response, 'payment_method'),
                        'payment_url' => data_get($payment->raw_response, 'payment_url'),
                        'manual_status' => data_get($payment->raw_response, 'payment_status'),
                        'manual_slip_url' => data_get($payment->raw_response, 'manual_slip_url'),
                    ];
                })(),
                'paid_via_order' => $depositOrderItem?->order ? [
                    'order_id' => (int) $depositOrderItem->order->id,
                    'order_number' => (string) $depositOrderItem->order->order_number,
                    'deposit_order_item_id' => (int) $depositOrderItem->id,
                ] : null,
                'receipt_history' => $receiptRows->map(function (OrderItem $item) use ($tokensByOrderId) {
                    $orderId = (int) ($item->order?->id ?? 0);
                    $token = $orderId > 0 ? ($tokensByOrderId->get($orderId)?->token ?? null) : null;

                    return [
                        'order_id' => $orderId,
                        'order_number' => (string) ($item->order?->order_number ?? '-'),
                        'line_type' => (string) ($item->line_type ?? ''),
                        'amount' => (float) ($item->line_total ?? 0),
                        'payment_method' => (string) ($item->order?->payment_method ?? ''),
                        'paid_at' => optional($item->order?->paid_at ?? $item->order?->created_at)?->toIso8601String(),
                        'receipt_token' => $token,
                        'receipt_invoice_url' => $token ? '/api/proxy/public/receipt/' . $token . '/invoice' : null,
                    ];
                })->values()->all(),
            ];
        })->values();

        return $this->respond($payload);
    }
}
