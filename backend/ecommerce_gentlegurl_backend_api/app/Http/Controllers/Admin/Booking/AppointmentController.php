<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingPhoto;
use App\Models\Ecommerce\CustomerVoucher;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\Voucher;
use App\Services\Booking\StaffCommissionService;
use App\Services\Booking\CustomerServicePackageService;
use App\Models\Booking\BookingPayment;
use App\Models\Booking\CustomerServicePackageUsage;
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
            $query->whereDate('start_at', '>=', $request->string('from_date'));
        }
        if ($request->filled('to_date')) {
            $query->whereDate('start_at', '<=', $request->string('to_date'));
        }
        if ($request->filled('date')) {
            $query->whereDate('start_at', $request->string('date'));
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
            $paginator = $query->orderByDesc('start_at')->paginate($perPage, ['*'], 'page', $page);

            return $this->respond([
                'data' => collect($paginator->items())->map(fn (Booking $booking) => $this->mapHistoryBooking($booking))->values(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]);
        }

        $rows = $query->orderByDesc('start_at')->get()
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
        $booking = Booking::with(['service', 'staff', 'customer'])->findOrFail($id);
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
            'notes' => $booking->notes,
            'source' => $booking->source,
            'logs' => $logs,
        ]));
    }


    private function mapDailyBooking(Booking $booking): array
    {
        $row = $this->mapHistoryBooking($booking);

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

        return array_merge($row, [
            'customer_reference_photos_count' => $referencePhotos->count(),
            'customer_reference_photos' => $referencePhotos,
            'service_photos_count' => $servicePhotos->count(),
            'service_photos' => $servicePhotos,
            'payment_proofs' => $this->mapBookingPaymentProofs($booking),
        ]);
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
        $financial = $this->resolveHistoryFinancials($booking);
        $addonItems = $this->mapAddonItems($booking->addon_items_json);
        $guestName = trim((string) ($booking->guest_name ?? ''));

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
            'service' => $booking->service ? [
                'id' => (int) $booking->service->id,
                'name' => (string) $booking->service->name,
                'cn_name' => $booking->service->cn_name,
                'duration_min' => (int) ($booking->service->duration_min ?? 0),
            ] : null,
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
            'payment_status' => (string) $booking->payment_status,
            ...$financial,
        ];
    }

    private function resolveHistoryFinancials(Booking $booking): array
    {
        $addonTotal = collect($this->mapAddonItems($booking->addon_items_json))->sum(fn (array $item) => (float) ($item['extra_price'] ?? 0));
        $serviceTotal = $booking->settled_service_amount !== null
            ? (float) $booking->settled_service_amount
            : (float) ($booking->service?->service_price ?? $booking->service?->price ?? 0);
        $totalAmount = round(max(0, $serviceTotal + $addonTotal), 2);

        $orderItems = OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->whereIn('line_type', ['booking_deposit', 'booking_settlement', 'booking_addon'])
            ->get(['line_type', 'line_total', 'variant_name_snapshot']);
        $orderDepositPaid = (float) $orderItems->where('line_type', 'booking_deposit')->sum(fn (OrderItem $item) => (float) ($item->line_total ?? 0));
        $settlementPaid = (float) $orderItems
            ->filter(fn (OrderItem $item) => in_array((string) $item->line_type, ['booking_settlement', 'booking_addon'], true))
            ->sum(fn (OrderItem $item) => (float) ($item->line_total ?? 0));
        $bookingPaymentPaid = (float) BookingPayment::query()
            ->where('booking_id', (int) $booking->id)
            ->where('status', 'PAID')
            ->sum('amount');
        $depositPaid = max($orderDepositPaid, $bookingPaymentPaid, (float) ($booking->payment_status === 'PAID' ? $booking->deposit_amount : 0));

        $packageUsage = CustomerServicePackageUsage::query()
            ->where(function ($query) use ($booking) {
                $query->where('booking_id', (int) $booking->id)
                    ->orWhere(function ($posQuery) use ($booking) {
                        $posQuery->where('used_from', 'POS')
                            ->where('used_ref_id', (int) $booking->id);
                    });
            })
            ->whereIn('status', ['reserved', 'consumed'])
            ->first();
        $packageOffset = $packageUsage ? max(0, $serviceTotal) : 0.0;
        $paidAmount = round(max(0, $depositPaid + $settlementPaid), 2);
        $balanceDue = round(max(0, $totalAmount - $paidAmount - $packageOffset), 2);
        $computedPaymentStatus = $balanceDue <= 0.0001
            ? 'paid'
            : ($paidAmount > 0.0001 || $packageOffset > 0.0001 ? 'partial' : 'unpaid');

        return [
            'total_amount' => $totalAmount,
            'paid_amount' => $paidAmount,
            'deposit_paid' => round($depositPaid, 2),
            'settlement_paid' => round($settlementPaid, 2),
            'package_offset' => round($packageOffset, 2),
            'balance_due' => $balanceDue,
            'computed_payment_status' => $computedPaymentStatus,
        ];
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
