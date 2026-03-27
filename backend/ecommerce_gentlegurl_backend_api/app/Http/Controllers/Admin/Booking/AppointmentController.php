<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingPhoto;
use App\Models\Ecommerce\CustomerVoucher;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderReceiptToken;
use App\Models\Ecommerce\Voucher;
use App\Services\Booking\StaffCommissionService;
use App\Services\Booking\CustomerServicePackageService;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

    public function show(int $id)
    {
        $booking = Booking::with(['service', 'staff', 'customer'])->findOrFail($id);
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

        $payload = $booking->toArray();
        $payload['receipt_history'] = $receiptRows->map(function (OrderItem $item) use ($tokensByOrderId) {
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
        })->values()->all();

        return $this->respond($payload);
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
                $this->staffCommissionService->applyCompletedBooking($booking->loadMissing('service'));
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
