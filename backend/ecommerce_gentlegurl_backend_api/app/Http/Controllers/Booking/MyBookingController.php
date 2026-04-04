<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingCancellationRequest;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Booking\BookingPayment;
use App\Models\Ecommerce\OrderReceiptToken;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderServiceItem;
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
            $addons = $this->formatBookingAddons($booking);
            $depositOrderItem = OrderItem::query()
                ->with('order:id,order_number')
                ->where('line_type', 'booking_deposit')
                ->where('booking_id', (int) $booking->id)
                ->latest('id')
                ->first();

            $receiptRows = $this->resolveBookingReceipts((int) $booking->id);

            return [
                'id' => (int) $booking->id,
                'booking_code' => (string) $booking->booking_code,
                'status' => $booking->status,
                'start_at' => $booking->start_at?->toIso8601String(),
                'starts_at' => $booking->start_at?->toIso8601String(),
                'deposit_amount' => (float) $booking->deposit_amount,
                'addon_duration_min' => (int) $addons['total_extra_duration_min'],
                'addon_price' => (float) $addons['total_extra_price'],
                'addon_items' => $addons['items'],
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
                'receipts' => $receiptRows,
            ];
        })->values();

        return $this->respond($payload);
    }

    private function formatBookingAddons(Booking $booking): array
    {
        $items = collect($booking->addon_items_json ?? [])
            ->filter(fn ($row) => is_array($row))
            ->map(function (array $row) {
                return [
                    'id' => (int) ($row['id'] ?? 0),
                    'name' => trim((string) ($row['label'] ?? $row['name'] ?? 'Add-on')),
                    'extra_duration_min' => max(0, (int) ($row['extra_duration_min'] ?? 0)),
                    'extra_price' => round(max(0, (float) ($row['extra_price'] ?? 0)), 2),
                ];
            })
            ->values();

        $durationTotal = (int) $items->sum(fn (array $item) => (int) ($item['extra_duration_min'] ?? 0));
        $priceTotal = round((float) $items->sum(fn (array $item) => (float) ($item['extra_price'] ?? 0)), 2);

        return [
            'items' => $items->all(),
            'total_extra_duration_min' => $durationTotal > 0 ? $durationTotal : (int) ($booking->addon_duration_min ?? 0),
            'total_extra_price' => $priceTotal > 0 ? $priceTotal : round((float) ($booking->addon_price ?? 0), 2),
        ];
    }

    private function resolveBookingReceipts(int $bookingId): array
    {
        $depositAndSettlementItems = OrderItem::query()
            ->with('order:id,order_number,payment_method,paid_at,created_at')
            ->where('booking_id', $bookingId)
            ->whereIn('line_type', ['booking_deposit', 'booking_settlement'])
            ->orderBy('id')
            ->get();

        $serviceOrderRows = OrderServiceItem::query()
            ->with('order:id,order_number,payment_method,paid_at,created_at,grand_total')
            ->where('booking_id', $bookingId)
            ->orderBy('id')
            ->get()
            ->filter(fn (OrderServiceItem $item) => (float) ($item->order?->grand_total ?? 0) <= 0.0001)
            ->map(function (OrderServiceItem $item) {
                return [
                    'order_id' => (int) ($item->order?->id ?? 0),
                    'order_number' => (string) ($item->order?->order_number ?? '-'),
                    'line_type' => 'package_covered_booking',
                    'stage_label' => 'Package-Covered Booking Receipt',
                    'amount' => 0.0,
                    'payment_method' => (string) ($item->order?->payment_method ?? ''),
                    'paid_at' => optional($item->order?->paid_at ?? $item->order?->created_at)?->toIso8601String(),
                    'receipt_public_url' => $item->order ? $this->resolveReceiptUrl((int) $item->order->id) : null,
                ];
            });

        $orderItemRows = $depositAndSettlementItems->map(function (OrderItem $item) {
            return [
                'order_id' => (int) ($item->order?->id ?? 0),
                'order_number' => (string) ($item->order?->order_number ?? '-'),
                'line_type' => (string) ($item->line_type ?? ''),
                'stage_label' => match ((string) ($item->line_type ?? '')) {
                    'booking_deposit' => 'Booking Deposit Receipt',
                    'booking_settlement' => 'Final Settlement Receipt',
                    default => 'Receipt',
                },
                'amount' => (float) ($item->line_total ?? 0),
                'payment_method' => (string) ($item->order?->payment_method ?? ''),
                'paid_at' => optional($item->order?->paid_at ?? $item->order?->created_at)?->toIso8601String(),
                'receipt_public_url' => $item->order ? $this->resolveReceiptUrl((int) $item->order->id) : null,
            ];
        });

        return $orderItemRows
            ->concat($serviceOrderRows)
            ->unique(fn (array $row) => ($row['order_id'] ?? 0) . ':' . ($row['line_type'] ?? ''))
            ->sortBy('paid_at')
            ->values()
            ->all();
    }

    private function resolveReceiptUrl(int $orderId): ?string
    {
        $token = OrderReceiptToken::query()
            ->where('order_id', $orderId)
            ->latest('id')
            ->first();

        if (! $token) {
            return null;
        }

        $frontendUrl = rtrim((string) config('services.frontend_url', config('app.url')), '/');
        return $frontendUrl . '/api/proxy/public/receipt/' . $token->token . '/invoice';
    }
}
