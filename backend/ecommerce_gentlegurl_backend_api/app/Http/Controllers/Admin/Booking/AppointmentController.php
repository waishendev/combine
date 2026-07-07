<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Ecommerce\PosController;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingPhoto;
use App\Models\Ecommerce\CustomerVoucher;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\Voucher;
use App\Services\Booking\StaffCommissionService;
use App\Services\Booking\CustomerServicePackageService;
use App\Support\BookingNotes;
use App\Models\Booking\BookingPayment;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class AppointmentController extends Controller
{
    public function __construct(
        private readonly StaffCommissionService $staffCommissionService,
        private readonly CustomerServicePackageService $customerServicePackageService,
    )
    {
    }

    public function index(Request $request)
    {
        $query = Booking::query()->with(['service', 'staff', 'customer']);

        if ($request->filled('date')) {
            $query->whereDate('start_at', $request->string('date'));
        }
        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->staff_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return $this->respond($query->orderBy('start_at')->paginate($request->integer('per_page', 20)));
    }



    public function daily(Request $request)
    {
        $date = $request->filled('date')
            ? Carbon::parse((string) $request->query('date'))->toDateString()
            : Carbon::today()->toDateString();
        $search = trim((string) $request->query('search', ''));

        $query = Booking::query()
            ->with([
                'service:id,name,cn_name,duration_min,service_price,price,price_mode',
                'staff:id,name',
                'customer:id,name,phone,email',
                'itemPhotos:id,booking_id,file_path,original_name,mime_type,size,sort_order,created_at',
                'servicePhotos:id,booking_id,image_path,caption,sort_order,created_at,updated_at',
                'payments:id,booking_id,provider,amount,status,raw_response,created_at,updated_at',
                'orderItems:id,order_id,booking_id',
                'orderItems.order:id,payment_method',
                'orderItems.order.uploads:id,order_id,type,file_path,note,status,created_at,updated_at',
            ])
            ->whereDate('start_at', $date)
            ->where('status', 'COMPLETED');

        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->query('staff_id'));
        }

        if ($search !== '') {
            $query->where(function ($nested) use ($search) {
                $nested->where('booking_code', 'like', "%{$search}%")
                    ->orWhere('guest_name', 'like', "%{$search}%")
                    ->orWhere('guest_phone', 'like', "%{$search}%")
                    ->orWhere('guest_email', 'like', "%{$search}%")
                    ->orWhereHas('customer', function ($customerQuery) use ($search) {
                        $customerQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $rows = $query->orderBy('start_at')
            ->get()
            ->map(fn (Booking $booking) => $this->mapDailyBooking($booking))
            ->values();

        return $this->respond([
            'date' => $date,
            'data' => $rows,
        ]);
    }

    public function history(Request $request)
    {
        $query = Booking::query()->with(['service', 'staff', 'customer']);

        if ($request->filled('from_date')) {
            $query->whereDate('created_at', '>=', $request->string('from_date'));
        }
        if ($request->filled('to_date')) {
            $query->whereDate('created_at', '<=', $request->string('to_date'));
        }
        if ($request->filled('date')) {
            $query->whereDate('created_at', $request->string('date'));
        }
        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->staff_id);
        }
        if ($request->filled('status')) {
            $query->where('status', strtoupper(trim((string) $request->string('status'))));
        }
        if ($request->filled('q')) {
            $search = trim((string) $request->string('q'));
            $query->where(function ($nested) use ($search) {
                $nested->where('booking_code', 'like', "%{$search}%")
                    ->orWhere('guest_name', 'like', "%{$search}%")
                    ->orWhere('guest_phone', 'like', "%{$search}%")
                    ->orWhere('guest_email', 'like', "%{$search}%")
                    ->orWhereHas('customer', function ($customerQuery) use ($search) {
                        $customerQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $paymentStatus = strtolower(trim((string) $request->query('payment_status', '')));
        $needsComputedFilter = in_array($paymentStatus, ['paid', 'unpaid', 'partial'], true);
        $perPage = max(1, min(100, $request->integer('per_page', 25)));
        $page = max(1, $request->integer('page', 1));

        if (! $needsComputedFilter) {
            $paginator = $query->orderByDesc('created_at')->orderByDesc('id')->paginate($perPage, ['*'], 'page', $page);

            return $this->respond([
                'data' => collect($paginator->items())->map(fn (Booking $booking) => $this->mapHistoryBooking($booking))->values(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]);
        }

        $rows = $query->orderByDesc('created_at')->orderByDesc('id')->get()
            ->map(fn (Booking $booking) => $this->mapHistoryBooking($booking))
            ->filter(fn (array $row) => strtolower((string) $row['computed_payment_status']) === $paymentStatus)
            ->values();

        $total = $rows->count();
        $pageRows = $rows->forPage($page, $perPage)->values();

        return $this->respond([
            'data' => $pageRows,
            'current_page' => $page,
            'last_page' => max(1, (int) ceil($total / $perPage)),
            'per_page' => $perPage,
            'total' => $total,
        ]);
    }

    public function historyShow(int $id)
    {
        $booking = Booking::with([
            'service',
            'staff',
            'customer',
            'itemPhotos:id,booking_id,file_path,original_name,mime_type,size,sort_order,created_at',
            'servicePhotos:id,booking_id,image_path,caption,sort_order,created_at,updated_at',
            'payments:id,booking_id,provider,amount,status,raw_response,created_at,updated_at',
            'orderItems:id,order_id,booking_id',
            'orderItems.order:id,payment_method',
            'orderItems.order.uploads:id,order_id,type,file_path,note,status,created_at,updated_at',
        ])->findOrFail($id);
        $row = $this->mapHistoryBooking($booking);
        $logs = BookingLog::query()
            ->where('booking_id', $booking->id)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get(['id', 'actor_type', 'actor_id', 'action', 'meta', 'created_at'])
            ->map(fn (BookingLog $log) => [
                'id' => (int) $log->id,
                'actor_type' => (string) $log->actor_type,
                'actor_id' => $log->actor_id ? (int) $log->actor_id : null,
                'action' => (string) $log->action,
                'meta' => $log->meta ?? [],
                'created_at' => $log->created_at ? Carbon::parse((string) $log->created_at)->toIso8601String() : null,
            ])->values();

        return $this->respond(array_merge($row, [
            'notes' => BookingNotes::customerRemarksForDisplay($booking->notes),
            'void_remarks' => BookingNotes::voidRemarksForDisplay($booking->notes),
            'reschedule_reason' => ($rescheduleReason = trim((string) ($booking->reschedule_reason ?? ''))) !== '' ? $rescheduleReason : null,
            'source' => $booking->source,
            'logs' => $logs,
            ...$this->mapBookingMediaFields($booking),
        ]));
    }


    private function mapDailyBooking(Booking $booking): array
    {
        $row = $this->mapHistoryBooking($booking);

        return array_merge($row, [
            'notes' => BookingNotes::customerRemarksForDisplay($booking->notes),
            'void_remarks' => BookingNotes::voidRemarksForDisplay($booking->notes),
            'reschedule_reason' => ($rescheduleReason = trim((string) ($booking->reschedule_reason ?? ''))) !== '' ? $rescheduleReason : null,
        ], $this->mapBookingMediaFields($booking));
    }

    private function mapBookingMediaFields(Booking $booking): array
    {
        $referencePhotos = $booking->itemPhotos->map(fn ($photo) => [
            'id' => (int) $photo->id,
            'file_url' => $photo->file_url,
            'original_name' => (string) ($photo->original_name ?? ''),
            'mime_type' => (string) ($photo->mime_type ?? ''),
            'size' => (int) ($photo->size ?? 0),
            'created_at' => optional($photo->created_at)?->toIso8601String(),
        ])->values();

        $servicePhotos = $booking->servicePhotos->map(fn ($photo) => [
            'id' => (int) $photo->id,
            'booking_id' => (int) $photo->booking_id,
            'image_path' => (string) ($photo->image_path ?? ''),
            'image_url' => $photo->image_url,
            'caption' => $photo->caption,
            'sort_order' => (int) ($photo->sort_order ?? 0),
            'created_at' => optional($photo->created_at)?->toIso8601String(),
            'updated_at' => optional($photo->updated_at)?->toIso8601String(),
        ])->values();

        return [
            'customer_reference_photos_count' => $referencePhotos->count(),
            'customer_reference_photos' => $referencePhotos,
            'service_photos_count' => $servicePhotos->count(),
            'service_photos' => $servicePhotos,
            'payment_proofs' => $this->mapBookingPaymentProofs($booking),
        ];
    }

    private function mapBookingPaymentProofs(Booking $booking): array
    {
        $proofs = collect();

        $booking->payments->each(function (BookingPayment $payment) use ($proofs) {
            $raw = $payment->raw_response ?? [];
            $manualUrl = data_get($raw, 'manual_slip_url');
            $proofPath = data_get($raw, 'proof_path');
            $fileUrl = $manualUrl ?: ($proofPath ? Storage::disk('public')->url((string) $proofPath) : null);

            if (! $fileUrl) {
                return;
            }

            $proofs->push([
                'id' => 'booking-payment-' . $payment->id,
                'file_url' => (string) $fileUrl,
                'uploaded_at' => optional($payment->updated_at ?? $payment->created_at)?->toIso8601String(),
                'payment_method' => (string) data_get($raw, 'payment_method', $payment->provider),
                'note' => data_get($raw, 'manual_slip_note'),
                'status' => (string) ($payment->status ?? data_get($raw, 'payment_status', '')),
            ]);
        });

        $booking->orderItems
            ->pluck('order')
            ->filter()
            ->unique('id')
            ->each(function ($order) use ($proofs) {
                $order->uploads
                    ->where('type', 'payment_slip')
                    ->each(function ($upload) use ($proofs, $order) {
                        if (! $upload->file_url) {
                            return;
                        }

                        $proofs->push([
                            'id' => 'order-upload-' . $upload->id,
                            'file_url' => $upload->file_url,
                            'uploaded_at' => optional($upload->created_at)?->toIso8601String(),
                            'payment_method' => (string) ($order->payment_method ?? ''),
                            'note' => $upload->note,
                            'status' => $upload->status,
                        ]);
                    });
            });

        return $proofs
            ->unique(fn (array $proof) => $proof['file_url'])
            ->values()
            ->all();
    }

    private function mapHistoryBooking(Booking $booking): array
    {
        $booking->loadMissing(['service', 'staff', 'customer']);
        $posController = app(PosController::class);
        $summary = $posController->appointmentFinancialSummaryForBooking($booking);
        $packageClaims = $posController->resolvePerLinePackageClaims($booking, $summary);
        $financial = $this->resolveHistoryFinancialsFromSummary($booking, $summary);
        $mainStaffSplits = $this->resolveHistoryStaffSplits($booking);
        $services = $this->mapHistoryServiceBlocksFromSummary($booking, $summary, $mainStaffSplits);
        $addonItems = collect($services)->flatMap(fn (array $service) => $service['add_ons'] ?? [])->values()->all();
        $guestName = trim((string) ($booking->guest_name ?? ''));
        $primaryService = $services[0] ?? null;

        return [
            'id' => (int) $booking->id,
            'booking_code' => (string) ($booking->booking_code ?: ('BOOKING-' . $booking->id)),
            'customer' => $booking->customer ? [
                'id' => (int) $booking->customer->id,
                'name' => (string) $booking->customer->name,
                'phone' => $booking->customer->phone,
                'email' => $booking->customer->email,
            ] : null,
            'guest_name' => $booking->guest_name,
            'guest_phone' => $booking->guest_phone,
            'guest_email' => $booking->guest_email,
            'customer_display_name' => $booking->customer?->name
                ?: ($guestName !== '' ? ($guestName . ' (GUEST)') : 'Walk-in / Unknown'),
            'service' => $primaryService ? [
                'id' => (int) ($primaryService['service_id'] ?? $primaryService['id'] ?? 0),
                'name' => (string) ($primaryService['name'] ?? 'Service'),
                'cn_name' => $primaryService['cn_name'] ?? null,
                'duration_min' => (int) ($primaryService['duration_min'] ?? 0),
                'amount' => (float) ($primaryService['amount'] ?? 0),
                'price_mode' => $primaryService['price_mode'] ?? null,
                'price_range_min' => $primaryService['price_range_min'] ?? null,
                'price_range_max' => $primaryService['price_range_max'] ?? null,
                'price_finalized' => (bool) ($primaryService['price_finalized'] ?? true),
                'staff_splits' => $primaryService['staff_splits'] ?? $mainStaffSplits,
            ] : null,
            'services' => $services,
            'service_blocks' => $services,
            'add_ons' => $addonItems,
            'staff' => $booking->staff ? [
                'id' => (int) $booking->staff->id,
                'name' => (string) $booking->staff->name,
            ] : null,
            'start_at' => optional($booking->start_at)?->toIso8601String(),
            'end_at' => optional($booking->end_at)?->toIso8601String(),
            'created_at' => optional($booking->created_at)?->toIso8601String(),
            'completed_at' => optional($booking->completed_at)?->toIso8601String(),
            'cancelled_at' => optional($booking->cancelled_at)?->toIso8601String(),
            'status' => (string) $booking->status,
            'booking_payment_status' => (string) $booking->payment_status,
            'payment_status' => (string) ($financial['computed_payment_status'] ?? $booking->payment_status),
            'settlement_notes' => ($settlementNotes = trim((string) ($booking->settlement_notes ?? ''))) !== '' ? $settlementNotes : null,
            'package_claims' => $packageClaims,
            ...$financial,
        ];
    }

    private function mapHistoryServiceBlocksFromSummary(Booking $booking, array $summary, array $defaultStaffSplits): array
    {
        return collect($summary['main_services'] ?? [])->map(function (array $service) use ($booking, $defaultStaffSplits) {
            $staffSplits = $this->mapHistoryRawStaffSplits($service['staff_splits'] ?? [], $defaultStaffSplits);
            $isOriginal = (bool) ($service['is_original'] ?? false);

            return [
                'id' => isset($service['id']) ? (int) $service['id'] : null,
                'service_id' => isset($service['linked_booking_service_id'])
                    ? (int) $service['linked_booking_service_id']
                    : (isset($service['id']) ? (int) $service['id'] : null),
                'name' => (string) ($service['name'] ?? 'Service'),
                'cn_name' => $service['cn_name'] ?? null,
                'amount' => round(max(0, (float) ($service['extra_price'] ?? 0)), 2),
                'price_mode' => $service['price_mode'] ?? null,
                'price_range_min' => $service['price_range_min'] ?? null,
                'price_range_max' => $service['price_range_max'] ?? null,
                'price_finalized' => (bool) ($service['price_finalized'] ?? true),
                'duration_min' => max(0, (int) ($service['extra_duration_min'] ?? ($isOriginal ? ($booking->service?->duration_min ?? 0) : 0))),
                'start_at' => optional($booking->start_at)?->toIso8601String(),
                'end_at' => optional($booking->end_at)?->toIso8601String(),
                'staff_splits' => $staffSplits,
                'is_original' => $isOriginal,
                'add_ons' => collect($service['add_ons'] ?? [])->map(function (array $addon) use ($staffSplits) {
                    $addonStaffSplits = $this->mapHistoryRawStaffSplits($addon['staff_splits'] ?? [], $staffSplits);
                    $addonQty = max(1, (int) ($addon['quantity'] ?? 1));
                    $addonUnitPrice = round(max(0, (float) ($addon['extra_price'] ?? 0)), 2);
                    $addonLineGross = round(max(0, (float) ($addon['line_gross_amount'] ?? ($addonUnitPrice * $addonQty))), 2);

                    return [
                        'id' => isset($addon['id']) ? (int) $addon['id'] : null,
                        'linked_booking_service_id' => isset($addon['linked_booking_service_id']) ? (int) $addon['linked_booking_service_id'] : null,
                        'name' => (string) ($addon['name'] ?? 'Add-on'),
                        'cn_name' => $addon['cn_name'] ?? null,
                        'extra_duration_min' => max(0, (int) ($addon['extra_duration_min'] ?? 0)),
                        'extra_price' => $addonUnitPrice,
                        'quantity' => $addonQty,
                        'line_gross_amount' => $addonLineGross,
                        'price_mode' => $addon['price_mode'] ?? null,
                        'price_range_min' => $addon['price_range_min'] ?? null,
                        'price_range_max' => $addon['price_range_max'] ?? null,
                        'price_finalized' => (bool) ($addon['price_finalized'] ?? true),
                        'staff_splits' => $addonStaffSplits,
                        'staff_split_source' => ! empty($addon['staff_splits'] ?? []) ? 'explicit' : 'inherited',
                        'service_ref' => $addon['service_ref'] ?? null,
                        'item_kind' => $addon['item_kind'] ?? 'addon',
                    ];
                })->values()->all(),
            ];
        })->values()->all();
    }

    private function resolveHistoryAmountDisplayBounds(Booking $booking, array $summary): array
    {
        $min = 0.0;
        $max = 0.0;
        $hasRange = false;

        foreach (collect($summary['main_services'] ?? []) as $service) {
            $mode = strtolower((string) ($service['price_mode'] ?? 'fixed'));
            $finalized = (bool) ($service['price_finalized'] ?? true);
            if ($mode === 'range' && ! $finalized) {
                $rangeMin = (float) ($service['price_range_min'] ?? 0);
                $rangeMax = (float) ($service['price_range_max'] ?? 0);
                $min += min($rangeMin, $rangeMax);
                $max += max($rangeMin, $rangeMax);
                $hasRange = true;
            } else {
                $amount = max(0, (float) ($service['extra_price'] ?? 0));
                $min += $amount;
                $max += $amount;
            }
        }

        foreach (collect($summary['add_ons'] ?? []) as $addon) {
            $mode = strtolower((string) ($addon['price_mode'] ?? 'fixed'));
            $finalized = (bool) ($addon['price_finalized'] ?? true);
            if ($mode === 'range' && ! $finalized) {
                $rangeMin = (float) ($addon['price_range_min'] ?? 0);
                $rangeMax = (float) ($addon['price_range_max'] ?? 0);
                $min += min($rangeMin, $rangeMax);
                $max += max($rangeMin, $rangeMax);
                $hasRange = true;
            } else {
                $addonQty = max(1, (int) ($addon['quantity'] ?? 1));
                $amount = max(0, (float) ($addon['line_gross_amount'] ?? ((float) ($addon['extra_price'] ?? 0) * $addonQty)));
                $min += $amount;
                $max += $amount;
            }
        }

        $payableTotal = round((float) ($summary['service_total'] ?? 0) + (float) ($summary['addon_total_price'] ?? 0), 2);
        if (! $hasRange) {
            $min = $max = $payableTotal;
        }

        $paidTotal = round(
            (float) ($summary['deposit_paid'] ?? 0)
            + (float) ($summary['settlement_paid'] ?? 0)
            + (float) ($summary['package_offset'] ?? 0),
            2,
        );
        $balanceMin = max(0, round($min - $paidTotal, 2));
        $balanceMax = max(0, round($max - $paidTotal, 2));

        return [
            'min' => round($min, 2),
            'max' => round($max, 2),
            'has_range' => $hasRange && abs($min - $max) > 0.0001,
            'balance_min' => $balanceMin,
            'balance_max' => $balanceMax,
            'balance_has_range' => $hasRange && abs($balanceMin - $balanceMax) > 0.0001,
        ];
    }

    private function resolveHistoryFinancialsFromSummary(Booking $booking, array $summary): array
    {
        $payableTotal = round((float) ($summary['service_total'] ?? 0) + (float) ($summary['addon_total_price'] ?? 0), 2);
        $depositPaid = round((float) ($summary['deposit_paid'] ?? 0), 2);
        $settlementPaid = round((float) ($summary['settlement_paid'] ?? 0), 2);
        $packageOffset = round((float) ($summary['package_offset'] ?? 0), 2);
        $paidAmount = round($depositPaid + $settlementPaid + $packageOffset, 2);
        $balanceDue = round((float) ($summary['balance_due'] ?? 0), 2);
        $amountBounds = $this->resolveHistoryAmountDisplayBounds($booking, $summary);
        $computedPaymentStatus = $this->resolveHistoryPaymentStatus(
            $summary,
            $balanceDue,
            $paidAmount,
            $packageOffset,
            $amountBounds,
        );

        return [
            'total_amount' => $payableTotal,
            'total_amount_min' => $amountBounds['min'],
            'total_amount_max' => $amountBounds['max'],
            'amount_has_range' => $amountBounds['has_range'],
            'paid_amount' => $paidAmount,
            'deposit_paid' => $depositPaid,
            'settlement_paid' => $settlementPaid,
            'package_offset' => $packageOffset,
            'balance_due' => $balanceDue,
            'balance_due_min' => $amountBounds['balance_min'],
            'balance_due_max' => $amountBounds['balance_max'],
            'balance_has_range' => $amountBounds['balance_has_range'],
            'computed_payment_status' => $computedPaymentStatus,
            'is_range_priced' => (bool) ($summary['is_range_priced'] ?? false),
            'requires_settled_amount' => (bool) ($summary['requires_settled_amount'] ?? false),
            'settled_service_amount' => $summary['settled_service_amount'] ?? null,
            'service_total' => round((float) ($summary['service_total'] ?? 0), 2),
            'addon_total_price' => round((float) ($summary['addon_total_price'] ?? 0), 2),
        ];
    }

    private function resolveHistoryPaymentStatus(
        array $summary,
        float $balanceDue,
        float $paidAmount,
        float $packageOffset,
        array $amountBounds,
    ): string {
        $requiresSettledAmount = (bool) ($summary['requires_settled_amount'] ?? false);
        $hasOutstandingRangeBalance = (bool) ($amountBounds['balance_has_range'] ?? false)
            && (float) ($amountBounds['balance_max'] ?? 0) > 0.0001;

        if ($requiresSettledAmount || $hasOutstandingRangeBalance) {
            return ($paidAmount > 0.0001 || $packageOffset > 0.0001) ? 'partial' : 'unpaid';
        }

        if ($balanceDue <= 0.0001) {
            return 'paid';
        }

        return ($paidAmount > 0.0001 || $packageOffset > 0.0001) ? 'partial' : 'unpaid';
    }

    private function mapHistoryRawStaffSplits($rawSplits, array $fallback = []): array
    {
        $splits = collect(is_array($rawSplits) ? $rawSplits : []);
        $staffNameLookup = DB::table('staffs')
            ->whereIn('id', $splits->pluck('staff_id')->filter()->unique()->values()->all())
            ->pluck('name', 'id');

        $mapped = $splits
            ->map(fn ($split) => [
                'staff_id' => (int) ($split['staff_id'] ?? 0),
                'staff_name' => (string) ($split['staff_name'] ?? $split['name'] ?? $staffNameLookup[(int) ($split['staff_id'] ?? 0)] ?? '-'),
                'share_percent' => (int) ($split['share_percent'] ?? $split['split_percent'] ?? 0),
            ])
            ->filter(fn (array $split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)
            ->values()
            ->all();

        return ! empty($mapped) ? $mapped : $fallback;
    }

    public function show(int $id)
    {
        $booking = Booking::with(['service', 'staff', 'customer', 'itemPhotos'])->findOrFail($id);
        $addonItems = $this->mapAddonItems($booking->addon_items_json);

        return $this->respond(array_merge($booking->toArray(), [
            'add_ons' => $addonItems,
            'addon_total_duration_min' => (int) collect($addonItems)->sum('extra_duration_min'),
            'addon_total_price' => round((float) collect($addonItems)->sum('extra_price'), 2),
            'uploaded_item_photos' => $booking->itemPhotos->map(fn ($photo) => [
                'id' => (int) $photo->id,
                'file_url' => $photo->file_url,
                'original_name' => (string) $photo->original_name,
            ])->values(),
        ]));
    }

    private function resolveHistoryStaffSplits(Booking $booking): array
    {
        $rows = DB::table('booking_service_staff_splits as splits')
            ->leftJoin('staffs', 'staffs.id', '=', 'splits.staff_id')
            ->where('splits.booking_id', (int) $booking->id)
            ->orderBy('splits.id')
            ->get(['splits.staff_id', 'staffs.name as staff_name', 'splits.split_percent'])
            ->map(fn ($row) => [
                'staff_id' => (int) ($row->staff_id ?? 0),
                'staff_name' => (string) ($row->staff_name ?? '-'),
                'share_percent' => (int) ($row->split_percent ?? 0),
            ])
            ->filter(fn (array $row) => $row['staff_id'] > 0 && $row['share_percent'] > 0)
            ->values();

        if ($rows->isNotEmpty()) {
            return $rows->all();
        }

        return $booking->staff ? [[
            'staff_id' => (int) $booking->staff->id,
            'staff_name' => (string) ($booking->staff->name ?? '-'),
            'share_percent' => 100,
        ]] : [];
    }

    private function mapAddonItems($rawItems, array $mainStaffSplits = []): array
    {
        return collect(is_array($rawItems) ? $rawItems : [])
            ->flatMap(function ($item) {
                if (! is_array($item)) {
                    return [null];
                }

                $itemKind = strtolower((string) ($item['item_kind'] ?? $item['line_type'] ?? 'addon'));
                if ($itemKind === 'main_service') {
                    return collect($item['addon_items'] ?? [])
                        ->filter(fn ($addon) => is_array($addon))
                        ->map(fn (array $addon) => [
                            ...$addon,
                            'parent_service_ref' => $item['is_original'] ?? false ? 'original' : (string) ($item['name'] ?? $item['label'] ?? 'Service'),
                            'service_ref' => null,
                        ])
                        ->values()
                        ->all();
                }

                return [$item];
            })
            ->map(function ($item) use ($mainStaffSplits) {
                if (!is_array($item)) {
                    return null;
                }

                $itemKind = strtolower((string) ($item['item_kind'] ?? $item['line_type'] ?? 'addon'));
                if ($itemKind === 'main_service') {
                    return null;
                }

                $staffNameLookup = DB::table('staffs')
                    ->whereIn('id', collect($item['staff_splits'] ?? [])->pluck('staff_id')->filter()->unique()->values()->all())
                    ->pluck('name', 'id');
                $explicitSplits = collect($item['staff_splits'] ?? [])
                    ->map(fn ($split) => [
                        'staff_id' => (int) ($split['staff_id'] ?? 0),
                        'staff_name' => (string) ($split['staff_name'] ?? $split['name'] ?? $staffNameLookup[(int) ($split['staff_id'] ?? 0)] ?? '-'),
                        'share_percent' => (int) ($split['share_percent'] ?? $split['split_percent'] ?? 0),
                    ])
                    ->filter(fn (array $split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)
                    ->values()
                    ->all();

                return [
                    'id' => isset($item['id']) ? (int) $item['id'] : null,
                    'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
                    'cn_name' => $item['cn_label'] ?? $item['cn_name'] ?? $item['linked_cn_name'] ?? null,
                    'extra_duration_min' => max(0, (int) ($item['extra_duration_min'] ?? 0)),
                    'extra_price' => round((float) ($item['extra_price'] ?? 0), 2),
                    'service_ref' => strtolower((string) ($item['service_ref'] ?? '')) === 'original' ? null : ($item['service_ref'] ?? null),
                    'parent_service_ref' => $item['parent_service_ref'] ?? null,
                    'item_kind' => $itemKind,
                    'staff_splits' => ! empty($explicitSplits) ? $explicitSplits : $mainStaffSplits,
                    'staff_split_source' => ! empty($explicitSplits) ? 'explicit' : 'inherited',
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    public function updateStatus(Request $request, int $id)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:COMPLETED,CANCELLED,LATE_CANCELLATION,NO_SHOW,CONFIRMED,NOTIFIED_CANCELLATION'],
            'notes' => ['nullable', 'string'],
            'reason' => ['nullable', 'string'],
            'grant_voucher_override' => ['nullable', 'boolean'],
        ]);

        $booking = Booking::findOrFail($id);
        $status = $validated['status'];
        $previousStatus = $booking->status;

        if ($previousStatus === 'CONFIRMED') {
            $allowed = ['COMPLETED', 'CANCELLED', 'LATE_CANCELLATION', 'NO_SHOW', 'NOTIFIED_CANCELLATION'];
            if (!in_array($status, $allowed, true)) {
                return $this->respondError('Invalid status transition from CONFIRMED.', 422);
            }
        }

        if ($previousStatus === 'NO_SHOW' && $status === 'NOTIFIED_CANCELLATION') {
            return $this->respondError('NO_SHOW booking cannot be marked as NOTIFIED_CANCELLATION.', 422);
        }

        if ($previousStatus === 'NOTIFIED_CANCELLATION' && $status === 'CONFIRMED') {
            return $this->respondError('NOTIFIED_CANCELLATION cannot be reverted to CONFIRMED.', 422);
        }

        $responseMeta = [];

        DB::transaction(function () use ($request, $validated, $booking, $status, $previousStatus, &$responseMeta) {
            if ($status === 'COMPLETED' && !$booking->completed_at) {
                $booking->completed_at = now();
            }

            if ($previousStatus === 'COMPLETED' && $status !== 'COMPLETED') {
                $this->staffCommissionService->reverseCompletedBooking($booking->loadMissing('service'));
            }

            $booking->status = $status;
            if (in_array($status, ['CANCELLED', 'LATE_CANCELLATION', 'NOTIFIED_CANCELLATION'], true)) {
                $booking->cancelled_at = now();
                $booking->cancellation_type = in_array($status, ['CANCELLED', 'LATE_CANCELLATION'], true)
                    ? $status
                    : 'CANCELLED';
            }
            if (!empty($validated['notes'])) {
                $booking->notes = $validated['notes'];
            }
            $booking->save();

            if ($status === 'COMPLETED') {
                $this->customerServicePackageService->consumeReservedClaimsForBooking((int) $booking->id);
                $this->staffCommissionService->syncBookingCommissionState($booking->loadMissing('service'));
            }

            if (in_array($status, ['CANCELLED', 'LATE_CANCELLATION', 'NO_SHOW', 'NOTIFIED_CANCELLATION'], true)) {
                $this->customerServicePackageService->releaseReservedClaimsForBooking((int) $booking->id);
            }

            $logAction = 'UPDATE_STATUS';
            $logMeta = [
                'previous_status' => $previousStatus,
                'new_status' => $status,
                'reason' => $validated['reason'] ?? null,
            ];

            if ($status === 'NOTIFIED_CANCELLATION') {
                $logAction = 'MARK_NOTIFIED_CANCELLATION';
                $voucherContext = $this->tryGrantNotifiedCancellationVoucher(
                    $booking,
                    optional($request->user())->id,
                    (bool) ($validated['grant_voucher_override'] ?? false)
                );
                $logMeta = array_merge($logMeta, $voucherContext);
                $responseMeta = $voucherContext;
            }

            BookingLog::create([
                'booking_id' => $booking->id,
                'actor_type' => 'ADMIN',
                'actor_id' => optional($request->user())->id,
                'action' => $logAction,
                'meta' => $logMeta,
                'created_at' => now(),
            ]);
        });

        return $this->respond([
            'booking' => $booking->fresh(['service', 'staff', 'customer']),
            'meta' => $responseMeta,
        ]);
    }

    private function tryGrantNotifiedCancellationVoucher(Booking $booking, ?int $adminId, bool $override): array
    {
        if (!$booking->customer_id) {
            return ['voucher_message' => 'Guest booking does not receive auto voucher.'];
        }

        if ($booking->status === 'NO_SHOW') {
            return ['voucher_message' => 'NO_SHOW booking is not eligible for voucher.'];
        }

        if ($booking->notified_cancellation_voucher_id) {
            BookingLog::create([
                'booking_id' => $booking->id,
                'actor_type' => 'ADMIN',
                'actor_id' => $adminId,
                'action' => 'VOUCHER_ALREADY_GRANTED',
                'meta' => ['voucher_id' => $booking->notified_cancellation_voucher_id],
                'created_at' => now(),
            ]);

            return [
                'voucher_id' => $booking->notified_cancellation_voucher_id,
                'voucher_message' => 'Voucher already issued for this booking.',
            ];
        }

        $hoursDiff = Carbon::now()->diffInHours($booking->start_at, false);
        if ($hoursDiff < 24 && !$override) {
            return ['voucher_message' => 'Not eligible for voucher because cancellation is less than 24 hours before start time.'];
        }

        $settings = $this->getVoucherSettings();
        if (!($settings['enabled'] ?? false)) {
            return ['voucher_message' => 'Voucher setting is disabled.'];
        }

        $baseAmount = (float) $booking->deposit_amount;
        $rewardType = strtoupper((string) ($settings['reward_type'] ?? 'PERCENT'));
        $rewardValue = (float) ($settings['reward_value'] ?? 0);

        $voucherAmount = $rewardType === 'FIXED'
            ? $rewardValue
            : round($baseAmount * ($rewardValue / 100), 2);

        if ($voucherAmount <= 0) {
            return ['voucher_message' => 'Voucher amount resolved to zero.'];
        }

        $now = now();
        $expiryDays = (int) ($settings['expiry_days'] ?? 45);

        $voucher = Voucher::create([
            'code' => sprintf('BNC-%d-%s', $booking->id, strtoupper(substr(bin2hex(random_bytes(2)), 0, 4))),
            'type' => 'fixed',
            'value' => $voucherAmount,
            'amount' => $voucherAmount,
            'min_order_amount' => $settings['min_spend'] ?? null,
            'scope_type' => 'all',
            'start_at' => $now,
            'end_at' => $now->copy()->addDays($expiryDays),
            'usage_limit_total' => (int) ($settings['usage_limit'] ?? 1),
            'usage_limit_per_customer' => 1,
            'is_active' => true,
            'is_reward_only' => true,
        ]);

        CustomerVoucher::create([
            'customer_id' => $booking->customer_id,
            'voucher_id' => $voucher->id,
            'quantity_total' => (int) ($settings['usage_limit'] ?? 1),
            'quantity_used' => 0,
            'status' => 'active',
            'claimed_at' => $now,
            'assigned_by_admin_id' => $adminId,
            'assigned_at' => $now,
            'start_at' => $now,
            'end_at' => $now->copy()->addDays($expiryDays),
            'expires_at' => $now->copy()->addDays($expiryDays),
            'note' => 'Booking Notified Cancellation (booking_id=' . $booking->id . ')',
            'meta' => [
                'booking_id' => $booking->id,
                'non_combinable' => (bool) ($settings['non_combinable'] ?? true),
            ],
        ]);

        $booking->notified_cancellation_voucher_id = $voucher->id;
        $booking->save();

        BookingLog::create([
            'booking_id' => $booking->id,
            'actor_type' => 'SYSTEM',
            'actor_id' => null,
            'action' => 'VOUCHER_GRANTED',
            'meta' => ['voucher_id' => $voucher->id, 'amount' => $voucherAmount],
            'created_at' => now(),
        ]);

        return [
            'voucher_id' => $voucher->id,
            'voucher_amount' => $voucherAmount,
            'voucher_message' => 'Voucher granted.',
        ];
    }

    private function getVoucherSettings(): array
    {
        return Setting::where('type', 'booking')->where('key', 'BOOKING_NOTIFIED_CANCELLATION_VOUCHER')
            ->value('value') ?? [
                'enabled' => false,
                'reward_type' => 'PERCENT',
                'reward_value' => 10,
                'base_amount_source' => 'DEPOSIT',
                'expiry_days' => 45,
                'non_combinable' => true,
                'min_spend' => null,
                'usage_limit' => 1,
            ];
    }

    public function uploadPhoto(Request $request, int $id)
    {
        $validated = $request->validate([
            'url' => ['required', 'url'],
            'uploaded_by_staff_id' => ['required', 'integer', 'exists:staffs,id'],
        ]);

        Booking::findOrFail($id);
        $photo = BookingPhoto::create([
            'booking_id' => $id,
            'url' => $validated['url'],
            'uploaded_by_staff_id' => $validated['uploaded_by_staff_id'],
            'created_at' => now(),
        ]);

        BookingLog::create([
            'booking_id' => $id,
            'actor_type' => 'STAFF',
            'actor_id' => $validated['uploaded_by_staff_id'],
            'action' => 'UPLOAD_PHOTO',
            'meta' => ['url' => $validated['url']],
            'created_at' => now(),
        ]);

        return $this->respond($photo);
    }
}
