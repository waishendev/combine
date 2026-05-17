<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingCancellationRequest;
use App\Models\Booking\BookingItemPhoto;
use App\Models\Booking\BookingServicePhoto;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Booking\BookingPayment;
use App\Models\Ecommerce\OrderReceiptToken;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderServiceItem;
use App\Models\Booking\BookingSetting;
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
                'service:id,name,cn_name,duration_min,deposit_amount,buffer_min,allow_photo_upload,service_price,price,service_type,price_mode',
                'staff:id,name',
                'itemPhotos',
                'servicePhotos',
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
            $summary = $this->resolveAppointmentFinancialSummary($booking);

            return [
                'id' => (int) $booking->id,
                'booking_code' => (string) $booking->booking_code,
                'status' => $booking->status,
                'start_at' => $booking->start_at?->toIso8601String(),
                'starts_at' => $booking->start_at?->toIso8601String(),
                'end_at' => $booking->end_at?->toIso8601String(),
                'appointment_start_at' => $booking->start_at?->toIso8601String(),
                'appointment_end_at' => $booking->end_at?->toIso8601String(),
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
                'service_cn_name' => $booking->service?->cn_name,
                'add_ons' => $addonItems = $this->mapAddonItems($booking->addon_items_json),
                'addon_total_duration_min' => (int) $summary['addon_total_duration_min'],
                'addon_total_price' => (float) $summary['addon_total_price'],
                'service_total' => (float) $summary['service_total'],
                'deposit_paid' => (float) $summary['deposit_paid'],
                'linked_booking_deposit_total' => (float) $summary['linked_booking_deposit_total'],
                'deposit_previously_collected_amount' => (float) $summary['deposit_previously_collected_amount'],
                'settlement_paid' => (float) $summary['settlement_paid'],
                'package_offset' => (float) $summary['package_offset'],
                'balance_due' => (float) $summary['balance_due'],
                'amount_due_now' => (float) $summary['amount_due_now'],
                'total_paid' => (float) $summary['total_paid'],
                'estimated_duration_min' => (int) $summary['estimated_duration_min'],
                'staff_name' => $booking->staff?->name,
                'customer_remarks' => $this->extractCustomerRemarks($booking->notes),
                'service' => $booking->service ? [
                    'id' => (int) $booking->service->id,
                    'name' => $booking->service->name,
                    'cn_name' => $booking->service->cn_name,
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
                'service_photos' => $booking->servicePhotos->map(fn (BookingServicePhoto $photo) => [
                    'id' => (int) $photo->id,
                    'booking_id' => (int) $photo->booking_id,
                    'image_path' => (string) $photo->image_path,
                    'image_url' => $photo->image_url,
                    'caption' => $photo->caption,
                    'created_at' => $photo->created_at?->toIso8601String(),
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


    protected function resolveAppointmentFinancialSummary(Booking $booking): array
    {
        $settlementItems = collect($booking->addon_items_json ?? []);
        $settledServiceAmount = $booking->settled_service_amount !== null ? (float) $booking->settled_service_amount : null;
        $originalServiceAmount = $settledServiceAmount !== null
            ? $settledServiceAmount
            : (float) ($booking->service?->service_price ?? $booking->service?->price ?? 0);

        $extraMainServices = $settlementItems
            ->filter(fn ($item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service')
            ->filter(fn ($item) => ! (bool) ($item['is_original'] ?? false))
            ->filter(fn ($item) => (int) ($item['linked_booking_service_id'] ?? 0) !== (int) ($booking->service_id ?? 0))
            ->map(fn ($item) => [
                'extra_price' => round(max(0, (float) ($item['extra_price'] ?? 0)), 2),
                'add_ons' => collect($item['addon_items'] ?? [])->map(fn ($addon) => [
                    'extra_duration_min' => max(0, (int) ($addon['extra_duration_min'] ?? 0)),
                    'extra_price' => round(max(0, (float) ($addon['extra_price'] ?? 0)), 2),
                ])->values()->all(),
            ])
            ->values();

        $serviceTotal = round($originalServiceAmount + (float) $extraMainServices->sum('extra_price'), 2);
        $originalMainServiceItem = $settlementItems
            ->first(fn ($item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service' && (bool) ($item['is_original'] ?? false));
        $originalAddonSource = is_array($originalMainServiceItem)
            ? collect((array) ($originalMainServiceItem['addon_items'] ?? []))
            : $settlementItems->filter(fn ($item) => strtolower((string) ($item['item_kind'] ?? 'addon')) !== 'main_service');
        $addonItems = $originalAddonSource->map(fn ($item) => [
            'extra_duration_min' => max(0, (int) ($item['extra_duration_min'] ?? 0)),
            'extra_price' => round(max(0, (float) ($item['extra_price'] ?? 0)), 2),
        ])->concat($extraMainServices->flatMap(fn (array $service) => $service['add_ons'] ?? []))->values();
        $addonTotalDurationMin = (int) $addonItems->sum('extra_duration_min');
        $addonTotalPrice = round((float) ($booking->addon_price ?? $addonItems->sum('extra_price')), 2);

        $actualAppointmentDepositCollected = (float) OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->where('line_type', 'booking_deposit')
            ->sum('line_total');
        $linkedOrderIds = OrderServiceItem::query()
            ->where('booking_id', (int) $booking->id)
            ->pluck('order_id')
            ->merge(
                OrderItem::query()
                    ->where('booking_id', (int) $booking->id)
                    ->where('line_type', 'booking_deposit')
                    ->pluck('order_id')
            )
            ->filter()
            ->unique()
            ->values();

        $linkedBookingRows = $linkedOrderIds->isNotEmpty()
            ? OrderServiceItem::query()
                ->leftJoin('bookings', 'bookings.id', '=', 'order_service_items.booking_id')
                ->leftJoin('booking_services', 'booking_services.id', '=', 'bookings.service_id')
                ->whereIn('order_service_items.order_id', $linkedOrderIds->all())
                ->whereNotNull('order_service_items.booking_id')
                ->get([
                    'order_service_items.booking_id',
                    'booking_services.service_type',
                ])
                ->unique('booking_id')
                ->values()
            : collect();

        $settings = BookingSetting::query()->first();
        $premiumDeposit = (float) ($settings?->deposit_amount_per_premium ?? 0);
        $standardDeposit = (float) ($settings?->deposit_base_amount_if_only_standard ?? 0);
        $premiumBookings = $linkedBookingRows
            ->filter(fn ($row) => strtoupper((string) ($row->service_type ?? 'STANDARD')) === 'PREMIUM')
            ->values();
        $standardBookings = $linkedBookingRows
            ->filter(fn ($row) => strtoupper((string) ($row->service_type ?? 'STANDARD')) !== 'PREMIUM')
            ->sortBy(fn ($row) => (int) ($row->booking_id ?? 0))
            ->values();
        $expectedDepositTotal = $premiumBookings->isNotEmpty()
            ? (float) $premiumBookings->count() * $premiumDeposit
            : ($standardBookings->isNotEmpty() ? $standardDeposit : 0.0);
        $depositFromOrderItems = $linkedOrderIds->isNotEmpty()
            ? (float) OrderItem::query()
                ->whereIn('order_id', $linkedOrderIds->all())
                ->where('line_type', 'booking_deposit')
                ->sum('line_total')
            : 0.0;
        $depositFromOrderNotes = $linkedOrderIds->isNotEmpty()
            ? (float) Order::query()
                ->whereIn('id', $linkedOrderIds->all())
                ->get(['notes'])
                ->reduce(function (float $carry, Order $order) {
                    $notes = (string) ($order->notes ?? '');
                    if (preg_match('/booking_deposit=([0-9]+(?:\.[0-9]+)?)/', $notes, $matches) === 1) {
                        return $carry + (float) ($matches[1] ?? 0);
                    }

                    return $carry;
                }, 0.0)
            : 0.0;
        $linkedBookingDeposit = $depositFromOrderNotes > 0
            ? $depositFromOrderNotes
            : ($depositFromOrderItems > 0
                ? ($expectedDepositTotal > 0 ? min($depositFromOrderItems, $expectedDepositTotal) : $depositFromOrderItems)
                : 0.0);
        $depositPaid = 0.0;
        $currentType = strtoupper((string) ($booking->service?->service_type ?? 'STANDARD'));
        if ($premiumBookings->isNotEmpty()) {
            $depositPaid = $currentType === 'PREMIUM'
                ? round($linkedBookingDeposit / max(1, $premiumBookings->count()), 2)
                : 0.0;
        } elseif ($standardBookings->isNotEmpty()) {
            $firstStandardBookingId = (int) ($standardBookings->first()?->booking_id ?? 0);
            $depositPaid = (int) $booking->id === $firstStandardBookingId ? $linkedBookingDeposit : 0.0;
        }
        if ($depositPaid <= 0.0001 && $actualAppointmentDepositCollected > 0.0001) {
            $depositPaid = $actualAppointmentDepositCollected;
        }
        if ($linkedBookingDeposit <= 0.0001 && $actualAppointmentDepositCollected > 0.0001) {
            $linkedBookingDeposit = $actualAppointmentDepositCollected;
        }

        $serviceSettlementPaid = (float) OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->where('line_type', 'booking_settlement')
            ->sum('line_total');
        $addonPaidSettlement = (float) OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->where('line_type', 'booking_addon')
            ->where('variant_name_snapshot', 'Booking Add-on Settlement')
            ->sum('line_total');
        $settlementPaid = round($serviceSettlementPaid + $addonPaidSettlement, 2);

        $packageUsage = CustomerServicePackageUsage::query()
            ->where('booking_id', (int) $booking->id)
            ->whereIn('status', ['reserved', 'consumed'])
            ->latest('id')
            ->first();
        if (! $packageUsage && $booking->customer_id && $booking->service_id) {
            $packageUsage = CustomerServicePackageUsage::query()
                ->where('customer_id', (int) $booking->customer_id)
                ->where('booking_service_id', (int) $booking->service_id)
                ->where('used_from', 'POS')
                ->where('used_ref_id', (int) $booking->id)
                ->whereIn('status', ['reserved', 'consumed'])
                ->latest('id')
                ->first();
        }
        $packageOffset = $packageUsage ? max(0.0, $originalServiceAmount) : 0.0;
        $payableTotal = round($serviceTotal + $addonTotalPrice, 2);
        $paidTotal = round($depositPaid + $settlementPaid + $packageOffset, 2);
        $balanceDue = max(0.0, round($payableTotal - $paidTotal, 2));

        return [
            'service_total' => round($serviceTotal, 2),
            'addon_total_duration_min' => $addonTotalDurationMin,
            'estimated_duration_min' => max(0, (int) ($booking->service?->duration_min ?? 0)) + $addonTotalDurationMin,
            'addon_total_price' => round($addonTotalPrice, 2),
            'deposit_paid' => round($depositPaid, 2),
            'linked_booking_deposit_total' => round($linkedBookingDeposit, 2),
            'deposit_previously_collected_amount' => round($actualAppointmentDepositCollected, 2),
            'package_offset' => round($packageOffset, 2),
            'settlement_paid' => $settlementPaid,
            'balance_due' => round($balanceDue, 2),
            'amount_due_now' => round($balanceDue, 2),
            'total_paid' => round($depositPaid + $settlementPaid, 2),
        ];
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


    private function extractCustomerRemarks(?string $notes): ?string
    {
        $raw = trim((string) ($notes ?? ''));
        if ($raw === '') {
            return null;
        }

        if (preg_match('/(?:^|\|\s*)customer_remarks:\s*(.+?)(?:\s*\|\s*deposit_waived_for_member|$)/i', $raw, $matches)) {
            $value = trim((string) ($matches[1] ?? ''));
            return $value !== '' ? $value : null;
        }

        return null;
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
                    'cn_name' => $item['cn_label'] ?? $item['cn_name'] ?? $item['linked_cn_name'] ?? null,
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
