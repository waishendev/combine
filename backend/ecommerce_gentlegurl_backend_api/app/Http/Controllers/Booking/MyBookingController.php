<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingCancellationRequest;
use App\Models\Booking\BookingItemPhoto;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Booking\BookingPayment;
use App\Models\Ecommerce\OrderReceiptToken;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderServiceItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MyBookingController extends Controller
{
    public function index(Request $request)
    {
        $customer = $request->user('customer');

        $bookings = Booking::query()
            ->with([
                'service:id,name,duration_min,deposit_amount,buffer_min,allow_photo_upload',
                'staff:id,name',
                'itemPhotos',
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
                'add_ons' => $addonItems = $this->mapAddonItems($booking->addon_items_json),
                'addon_total_duration_min' => (int) collect($addonItems)->sum('extra_duration_min'),
                'addon_total_price' => round((float) collect($addonItems)->sum('extra_price'), 2),
                'staff_name' => $booking->staff?->name,
                'service' => $booking->service ? [
                    'id' => (int) $booking->service->id,
                    'name' => $booking->service->name,
                    'duration_min' => (int) $booking->service->duration_min,
                    'deposit_amount' => (float) $booking->service->deposit_amount,
                    'buffer_min' => (int) $booking->service->buffer_min,
                    'allow_photo_upload' => (bool) ($booking->service->allow_photo_upload ?? false),
                ] : null,
                'staff' => $booking->staff ? [
                    'id' => (int) $booking->staff->id,
                    'name' => $booking->staff->name,
                ] : null,
                'uploaded_item_photos' => $booking->itemPhotos->map(fn (BookingItemPhoto $photo) => [
                    'id' => (int) $photo->id,
                    'file_url' => $photo->file_url,
                    'original_name' => (string) $photo->original_name,
                    'mime_type' => (string) $photo->mime_type,
                    'size' => (int) $photo->size,
                ])->values(),
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

    public function uploadItemPhotos(Request $request, int $id)
    {
        $customer = $request->user('customer');
        $booking = Booking::query()->with('service')->where('customer_id', $customer->id)->findOrFail($id);

        if (! $this->canManagePhotos($booking)) {
            return $this->respondError('Photos can only be uploaded while booking is HOLD or CONFIRMED.', 422);
        }

        if (! (bool) ($booking->service?->allow_photo_upload ?? false)) {
            return $this->respondError('This service does not allow photo uploads.', 422);
        }

        $validated = $request->validate([
            'photos' => ['required', 'array', 'min:1', 'max:3'],
            'photos.*' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:5120'],
        ]);

        $existingCount = BookingItemPhoto::query()->where('booking_id', (int) $booking->id)->count();
        $incoming = count($validated['photos']);
        if (($existingCount + $incoming) > 3) {
            return $this->respondError('Maximum 3 photos are allowed per booking item.', 422);
        }

        $sortOrder = BookingItemPhoto::query()->where('booking_id', (int) $booking->id)->max('sort_order');
        $nextSort = is_numeric($sortOrder) ? ((int) $sortOrder + 1) : 0;

        foreach ($validated['photos'] as $photo) {
            $ext = strtolower((string) $photo->getClientOriginalExtension());
            $filename = sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $ext);
            $path = $photo->storeAs('booking/item-photos', $filename, 'public');

            BookingItemPhoto::query()->create([
                'booking_id' => (int) $booking->id,
                'file_path' => $path,
                'original_name' => (string) $photo->getClientOriginalName(),
                'mime_type' => (string) $photo->getClientMimeType(),
                'size' => (int) $photo->getSize(),
                'sort_order' => $nextSort++,
            ]);
        }

        return $this->respond(['uploaded_item_photos' => $booking->fresh('itemPhotos')->itemPhotos->values()]);
    }

    public function removeItemPhoto(Request $request, int $id, int $photoId)
    {
        $customer = $request->user('customer');
        $booking = Booking::query()->where('customer_id', $customer->id)->findOrFail($id);

        if (! $this->canManagePhotos($booking)) {
            return $this->respondError('Photos can only be managed while booking is HOLD or CONFIRMED.', 422);
        }

        $photo = BookingItemPhoto::query()
            ->where('booking_id', (int) $booking->id)
            ->findOrFail($photoId);

        if ($photo->file_path && Storage::disk('public')->exists($photo->file_path)) {
            Storage::disk('public')->delete($photo->file_path);
        }
        $photo->delete();

        return $this->respond(['uploaded_item_photos' => $booking->fresh('itemPhotos')->itemPhotos->values()]);
    }

    private function canManagePhotos(Booking $booking): bool
    {
        return in_array((string) $booking->status, ['CONFIRMED', 'HOLD'], true);
    }

    private function mapAddonItems($rawItems): array
    {
        return collect(is_array($rawItems) ? $rawItems : [])
            ->map(function ($item) {
                if (!is_array($item)) {
                    return null;
                }

                return [
                    'id' => isset($item['id']) ? (int) $item['id'] : null,
                    'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
                    'extra_duration_min' => max(0, (int) ($item['extra_duration_min'] ?? 0)),
                    'extra_price' => round((float) ($item['extra_price'] ?? 0), 2),
                ];
            })
            ->filter()
            ->values()
            ->all();
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
