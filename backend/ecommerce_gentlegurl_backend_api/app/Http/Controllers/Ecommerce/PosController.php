<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Admin\Booking\CancellationRequestController;
use App\Http\Controllers\Controller;
use App\Mail\BookingConfirmationMail;
use App\Mail\BookingRescheduledMail;
use App\Mail\BookingSettlementReceiptMail;
use App\Mail\PosOrderReceiptMail;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderItemStaffSplit;
use App\Models\Ecommerce\OrderReceiptToken;
use App\Models\Ecommerce\OrderUpload;
use App\Models\Ecommerce\PosCart;
use App\Models\Ecommerce\PosCartAppointmentSettlementItem;
use App\Models\Ecommerce\PosCartItem;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductStockMovement;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Booking\Booking;
use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\CustomerServicePackageBalance;
use App\Models\Booking\BookingCancellationRequest;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingPayment;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingProduct;
use App\Models\Booking\BookingServiceQuestion;
use App\Models\Booking\BookingServiceQuestionOption;
use App\Models\Booking\BookingSetting;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Booking\ServicePackage;
use App\Models\Ecommerce\OrderServiceItem;
use App\Models\Ecommerce\PosCartPackageItem;
use App\Models\Ecommerce\PosCartServiceItem;
use App\Models\Ecommerce\ServicePackageStaffSplit;
use App\Models\Staff;
use App\Services\Booking\BookingAvailabilityService;
use App\Services\Booking\BookingCancellationService;
use App\Services\Booking\CustomerServicePackageService;
use App\Services\Booking\StaffCommissionService;
use App\Services\SettingService;
use App\Models\Promotion;
use App\Models\Ecommerce\OrderVoucher;
use App\Models\Ecommerce\CustomerVoucher;
use App\Models\Ecommerce\PointsEarnBatch;
use App\Services\Ecommerce\InvoiceService;
use App\Services\Ecommerce\OrderPaymentService;
use App\Services\Voucher\VoucherEligibilityService;
use App\Services\Voucher\VoucherService;
use App\Support\OrderReceiptEmailLabels;
use App\Support\Pricing\ProductPricing;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class PosController extends Controller
{
    public function __construct(
        protected VoucherEligibilityService $voucherEligibilityService,
        protected VoucherService $voucherService,
        protected InvoiceService $invoiceService,
        protected CustomerServicePackageService $customerServicePackageService,
        protected BookingAvailabilityService $availabilityService,
        protected StaffCommissionService $staffCommissionService,
        protected OrderPaymentService $orderPaymentService,
        protected BookingCancellationService $bookingCancellationService,
    ) {}

    public function memberSearch(Request $request)
    {
        $query = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(20, (int) $request->query('per_page', 10)));

        if (mb_strlen($query) < 3) {
            return $this->respond([
                'data' => [],
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => $perPage,
                'total' => 0,
            ]);
        }

        $builder = Customer::query();

        $builder->where(function ($queryBuilder) use ($query) {
            $queryBuilder->where('name', 'like', "%{$query}%")
                ->orWhere('phone', 'like', "%{$query}%");
        });

        $paginator = $builder
            ->orderBy('id', 'desc')
            ->paginate($perPage, ['id', 'name', 'phone'], 'page', $page);

        return $this->respond([
            'data' => collect($paginator->items())->map(fn (Customer $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'phone_masked' => $this->maskPhone($member->phone),
                'member_code' => (string) $member->id,
            ])->values(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
    }

    public function memberDetail(Request $request, int $memberId)
    {
        $now = now();
        $page = max(1, (int) $request->query('recent_orders_page', 1));
        $perPage = max(1, min(10, (int) $request->query('recent_orders_per_page', 5)));
        $appointmentsPage = max(1, (int) $request->query('appointments_page', 1));
        $appointmentsPerPage = max(1, min(5, (int) $request->query('appointments_per_page', 2)));

        $member = Customer::query()
            ->with(['customerType:id,name'])
            ->findOrFail($memberId);

        $ordersQuery = Order::query()->where('customer_id', $member->id);
        $totalOrders = (int) (clone $ordersQuery)->count();
        $totalSpent = (float) (clone $ordersQuery)->sum('grand_total');
        $lastOrderAt = (clone $ordersQuery)->max('created_at');

        $recentOrdersPaginator = (clone $ordersQuery)
            ->orderByDesc('created_at')
            ->paginate($perPage, ['id', 'order_number', 'created_at', 'status', 'grand_total', 'pickup_or_shipping'], 'recent_orders_page', $page);

        $recentOrders = collect($recentOrdersPaginator->items())
            ->map(fn (Order $order) => [
                'id' => (int) $order->id,
                'order_number' => $order->order_number,
                'order_date' => optional($order->created_at)->toDateTimeString(),
                'status' => $order->status,
                'total_amount' => (float) $order->grand_total,
                'channel' => $order->pickup_or_shipping,
            ])
            ->values();

        $activePackagesQuery = CustomerServicePackage::query()
            ->with(['servicePackage:id,name'])
            ->where('customer_id', $member->id)
            ->where('status', 'active')
            ->where(function ($query) use ($now) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>=', $now);
            });

        $activePackagesTotal = (clone $activePackagesQuery)->count();
        $activePackagesItems = (clone $activePackagesQuery)
            ->orderByDesc('id')
            ->limit(3)
            ->get(['id', 'service_package_id', 'expires_at'])
            ->map(fn (CustomerServicePackage $package) => [
                'id' => (int) $package->id,
                'package_name' => $package->servicePackage?->name ?? 'Package',
                'expires_at' => optional($package->expires_at)->toDateTimeString(),
            ])
            ->values();

        $upcomingAppointmentsPaginator = Booking::query()
            ->with(['service:id,name,cn_name', 'staff:id,name'])
            ->where('customer_id', $member->id)
            ->whereNotIn('status', ['CANCELLED'])
            ->where('start_at', '>=', $now)
            ->orderBy('start_at')
            ->paginate($appointmentsPerPage, ['id', 'booking_code', 'status', 'start_at', 'end_at', 'service_id', 'staff_id'], 'appointments_page', $appointmentsPage);

        $upcomingAppointments = collect($upcomingAppointmentsPaginator->items())
            ->map(fn (Booking $appointment) => [
                'id' => (int) $appointment->id,
                'booking_code' => $appointment->booking_code,
                'status' => $appointment->status,
                'start_at' => optional($appointment->start_at)->toDateTimeString(),
                'end_at' => optional($appointment->end_at)->toDateTimeString(),
                'service_name' => $appointment->service?->name,
                'service_cn_name' => $appointment->service?->cn_name,
                'staff_name' => $appointment->staff?->name,
            ])
            ->values();

        $memberPointsBalance = (int) PointsEarnBatch::query()
            ->where('customer_id', $member->id)
            ->where('status', 'active')
            ->where('points_remaining', '>', 0)
            ->where(function ($query) use ($now) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', $now);
            })
            ->sum('points_remaining');

        return $this->respond([
            'member' => [
                'id' => (int) $member->id,
                'name' => $member->name,
                'phone' => $member->phone,
                'email' => $member->email,
                'member_code' => (string) $member->id,
                'join_date' => optional($member->created_at)->toDateTimeString(),
                'customer_type' => $member->customerType?->name,
                'total_orders' => $totalOrders,
                'total_spent' => $totalSpent,
                'last_order_date' => $lastOrderAt ? Carbon::parse($lastOrderAt)->toDateTimeString() : null,
                'points_balance' => $memberPointsBalance,
            ],
            'active_packages' => [
                'total_active' => (int) $activePackagesTotal,
                'items' => $activePackagesItems,
                'has_more' => $activePackagesTotal > $activePackagesItems->count(),
            ],
            'upcoming_appointments' => $upcomingAppointments,
            'upcoming_appointments_meta' => [
                'current_page' => $upcomingAppointmentsPaginator->currentPage(),
                'last_page' => $upcomingAppointmentsPaginator->lastPage(),
                'per_page' => $upcomingAppointmentsPaginator->perPage(),
                'total' => $upcomingAppointmentsPaginator->total(),
            ],
            'recent_orders' => $recentOrders,
            'recent_orders_meta' => [
                'current_page' => $recentOrdersPaginator->currentPage(),
                'last_page' => $recentOrdersPaginator->lastPage(),
                'per_page' => $recentOrdersPaginator->perPage(),
                'total' => $recentOrdersPaginator->total(),
            ],
        ]);
    }

    private function maskPhone(?string $phone): ?string
    {
        $phone = trim((string) $phone);
        if ($phone === '') {
            return null;
        }

        $suffix = mb_substr($phone, -4);

        return '***' . $suffix;
    }


    public function serviceSearch(Request $request)
    {
        $query = trim((string) $request->query('q', ''));

        $builder = BookingService::query()->where('is_active', true)->orderBy('name');

        if ($query !== '') {
            $builder->where(function ($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                    ->orWhere('cn_name', 'like', "%{$query}%")
                    ->orWhere('service_type', 'like', "%{$query}%");
            });
        }

        return $this->respond([
            'data' => $builder->with(['allowedStaffs:id,name'])->get(['id', 'name', 'cn_name', 'service_type', 'service_price', 'price', 'duration_min', 'buffer_min'])->map(function (BookingService $service) {
                return [
                    'id' => (int) $service->id,
                    'name' => $service->name,
                    'cn_name' => $service->cn_name,
                    'service_type' => $service->service_type,
                    'service_price' => (float) $service->service_price,
                    'price' => (float) ($service->price ?? $service->service_price),
                    'duration_min' => (int) $service->duration_min,
                    'buffer_min' => (int) $service->buffer_min,
                    'allowed_staffs' => $service->allowedStaffs->map(fn (Staff $staff) => [
                        'id' => (int) $staff->id,
                        'name' => $staff->name,
                    ])->values()->all(),
                ];
            })->values(),
        ]);
    }

    public function packageSearch(Request $request)
    {
        $query = trim((string) $request->query('q', ''));

        $builder = ServicePackage::query()->where('is_active', true)->orderBy('name');

        if ($query !== '') {
            $builder->where('name', 'like', "%{$query}%");
        }

        return $this->respond([
            'data' => $builder->get(['id', 'name', 'description', 'selling_price', 'valid_days']),
        ]);
    }

    public function appointmentSearch(Request $request)
    {
        $query = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $unpaidOnly = (bool) $request->boolean('unpaid_only', false);
        $hasRange = $request->filled('from_date') && $request->filled('to_date');
        $perPageCap = $hasRange ? 500 : 100;
        $perPage = max(1, min($perPageCap, (int) $request->query('per_page', 20)));

        $builder = Booking::query()->with(['customer:id,name', 'service:id,name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type,duration_min', 'staff:id,name']);

        if ($query !== '') {
            $builder->where(function ($q) use ($query) {
                $q->where('booking_code', 'like', "%{$query}%")
                    ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'like', "%{$query}%"))
                    ->orWhereHas('service', fn ($sq) => $sq->where('name', 'like', "%{$query}%")->orWhere('cn_name', 'like', "%{$query}%"))
                    ->orWhere('guest_name', 'like', "%{$query}%")
                    ->orWhere('guest_phone', 'like', "%{$query}%")
                    ->orWhere('guest_email', 'like', "%{$query}%");
            });
        }

        if ($hasRange) {
            $builder->whereDate('start_at', '>=', $request->string('from_date'))
                ->whereDate('start_at', '<=', $request->string('to_date'));
        } elseif ($request->filled('date')) {
            $builder->whereDate('start_at', $request->string('date'));
        }
        if ($request->filled('customer_id')) {
            $builder->where('customer_id', (int) $request->query('customer_id'));
        }
        if ($request->filled('staff_id')) {
            $builder->where('staff_id', (int) $request->query('staff_id'));
        }
        $statusFilterNeedsActiveCheck = false;
        if ($unpaidOnly) {
            $builder->where('status', 'COMPLETED');
            $statusFilterNeedsActiveCheck = true;
        } elseif ($request->filled('status')) {
            $status = strtoupper(trim((string) $request->query('status')));
            if (in_array($status, ['HOLD', 'CONFIRMED', 'PENDING'], true)) {
                $builder->where('status', $status);
            } elseif ($status === 'COMPLETED') {
                // Payment_status can be stale; classify completed paid/unpaid from the resolved balances below.
                $builder->where('status', 'COMPLETED');
                $statusFilterNeedsActiveCheck = true;
            } else {
                $builder->whereIn('status', ['HOLD', 'CONFIRMED', 'PENDING', 'COMPLETED']);
                $statusFilterNeedsActiveCheck = true;
            }
        } else {
            // POS appointments schedule: show completed paid/unpaid; terminal statuses stay hidden.
            // Completed paid/unpaid is decided from financial fields after resolving the appointment summary.
            $builder->whereIn('status', ['HOLD', 'CONFIRMED', 'PENDING', 'COMPLETED']);
            $statusFilterNeedsActiveCheck = true;
        }

        $allRows = $builder->orderBy('start_at')->get()->map(function (Booking $booking) {
            $summary = $this->resolveAppointmentFinancialSummary($booking);
            $guestName = trim((string) ($booking->guest_name ?? ''));
            $guestPhone = trim((string) ($booking->guest_phone ?? ''));
            $guestEmail = trim((string) ($booking->guest_email ?? ''));
            return [
                'id' => (int) $booking->id,
                'booking_code' => (string) ($booking->booking_code ?: ('BOOKING-' . $booking->id)),
                'customer_id' => $booking->customer_id ? (int) $booking->customer_id : null,
                'customer_name' => (string) (str_starts_with(strtoupper($guestName), 'UNKNOWN')
                ? 'Walk-in / Unknown'
                : (($booking->customer?->name ?? '') !== '' ? $booking->customer?->name : ($guestName !== '' ? $guestName . ' (GUEST)' : '-'))),
                'guest_name' => $guestName !== '' ? $guestName : null,
                'guest_phone' => $guestPhone !== '' ? $guestPhone : null,
                'guest_email' => $guestEmail !== '' ? $guestEmail : null,
                'service_names' => [(string) ($booking->service?->name ?? '-')],
                'service_cn_names' => array_values(array_filter([(string) ($booking->service?->cn_name ?? '')])),
                'appointment_start_at' => optional($booking->start_at)?->toIso8601String(),
                'appointment_end_at' => optional($booking->end_at)?->toIso8601String(),
                'staff_id' => $booking->staff_id ? (int) $booking->staff_id : null,
                'staff_name' => (string) ($booking->staff?->name ?? '-'),
                'status' => (string) $booking->status,
                'payment_status' => $this->calculateAppointmentPaymentStatus($summary),
                'deposit_contribution' => (float) $summary['deposit_contribution'],
                'deposit_paid' => (float) $summary['deposit_contribution'],
                'linked_booking_deposit' => (float) $summary['linked_booking_deposit'],
                'linked_booking_deposit_total' => (float) $summary['linked_booking_deposit'],
                'deposit_previously_collected' => (bool) $summary['deposit_previously_collected'],
                'deposit_previously_collected_amount' => (float) $summary['deposit_previously_collected_amount'],
                'package_offset' => (float) $summary['package_offset'],
                'balance_due' => (float) $summary['balance_due'],
                'amount_due_now' => (float) $summary['amount_due_now'],
                'settlement_paid' => (float) ($summary['settlement_paid'] ?? 0),
                'service_total' => (float) $summary['service_total'],
                'settled_service_amount' => $summary['settled_service_amount'] ?? null,
                'is_range_priced' => (bool) ($summary['is_range_priced'] ?? false),
                'requires_settled_amount' => (bool) ($summary['requires_settled_amount'] ?? false),
                'service_price_mode' => (string) ($booking->service?->price_mode ?? 'fixed'),
                'service_price_range_min' => $booking->service?->price_range_min !== null ? (float) $booking->service->price_range_min : null,
                'service_price_range_max' => $booking->service?->price_range_max !== null ? (float) $booking->service->price_range_max : null,
                'addon_total_price' => (float) ($summary['addon_total_price'] ?? 0),
                'add_ons' => $summary['add_ons'] ?? [],
                'package_status' => $summary['package_status'],
                'can_apply_package' => (bool) ($summary['can_apply_package'] ?? false),
                'package_disabled_reason' => $summary['package_disabled_reason'] ?? null,
                'eligible_package_count' => (int) ($summary['eligible_package_count'] ?? 0),
            ];
        })->when($statusFilterNeedsActiveCheck, function ($rows) use ($unpaidOnly) {
            return $rows->filter(fn (array $row) => $this->appointmentRowBlocksActiveSchedule($row, $unpaidOnly));
        })->values();

        $totalRows = $allRows->count();
        $rows = $allRows->forPage($page, $perPage)->values();
        $lastPage = max(1, (int) ceil($totalRows / $perPage));

        $pendingCancellationRequestsCount = BookingCancellationRequest::query()
            ->where('status', 'pending')
            ->count();

        return $this->respond([
            'data' => $rows,
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => $perPage,
            'total' => $totalRows,
            'pending_cancellation_requests_count' => $pendingCancellationRequestsCount,
        ]);
    }

    /**
     * POS: review cancellation requests (same rules as admin; requires auth + pos.checkout on route).
     */
    public function posCancellationRequestsIndex(Request $request)
    {
        $request->merge([
            'status' => $request->query('status', 'pending'),
            'per_page' => min(100, max(1, (int) $request->query('per_page', 50))),
        ]);

        return app(CancellationRequestController::class)->index($request);
    }

    public function posCancellationRequestApprove(Request $request, int $id)
    {
        return app(CancellationRequestController::class)->approve($request, $id);
    }

    public function posCancellationRequestReject(Request $request, int $id)
    {
        return app(CancellationRequestController::class)->reject($request, $id);
    }

    public function appointmentDetail(int $id)
    {
        $booking = Booking::query()
            ->with([
                'customer:id,name,phone,email',
                'service:id,name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type,duration_min',
                'staff:id,name',
                'itemPhotos:id,booking_id,file_path,created_at',
                'servicePhotos:id,booking_id,image_path,caption,sort_order,created_at',
                'payments',
                'orderItems.order.uploads',
            ])
            ->findOrFail($id);

        $summary = $this->resolveAppointmentFinancialSummary($booking);
        $history = $this->resolveAppointmentPaymentHistory((int) $booking->id);
        $staffSplits = $this->resolveBookingStaffSplits((int) $booking->id, (int) ($booking->staff_id ?? 0));
        $holdOrder = $this->resolveHoldDepositOrderForReview($booking);

        $guestName = trim((string) ($booking->guest_name ?? ''));
        $guestPhone = trim((string) ($booking->guest_phone ?? ''));
        $guestEmail = trim((string) ($booking->guest_email ?? ''));

        return $this->respond([
            'id' => (int) $booking->id,
            'booking_code' => (string) ($booking->booking_code ?: ('BOOKING-' . $booking->id)),
            'status' => (string) $booking->status,
            'payment_status' => $this->calculateAppointmentPaymentStatus($summary),
            'hold_expires_at' => optional($booking->hold_expires_at)?->toIso8601String(),
            'hold_deposit_order' => $holdOrder ? [
                'id' => (int) $holdOrder->id,
                'order_number' => (string) $holdOrder->order_number,
                'status' => (string) $holdOrder->status,
                'payment_status' => (string) $holdOrder->payment_status,
                'payment_method' => (string) ($holdOrder->payment_method ?? ''),
                'grand_total' => (float) ($holdOrder->grand_total ?? 0),
            ] : null,
            'payment_proofs' => $this->mapAppointmentPaymentProofs($booking),
            'appointment_start_at' => optional($booking->start_at)?->toIso8601String(),
            'appointment_end_at' => optional($booking->end_at)?->toIso8601String(),
            'schedule_override' => $this->serializeScheduleOverride($booking),
            'customer' => $booking->customer_id
                ? [
                    'id' => (int) $booking->customer_id,
                    'name' => (string) ($booking->customer?->name ?? ''),
                    'phone' => $booking->customer?->phone,
                    'email' => $booking->customer?->email,
                ]
                : null,
            'guest_name' => $guestName !== '' ? $guestName : null,
            'guest_phone' => $guestPhone !== '' ? $guestPhone : null,
            'guest_email' => $guestEmail !== '' ? $guestEmail : null,
            'service' => [
                'id' => (int) ($booking->service?->id ?? 0),
                'name' => (string) ($booking->service?->name ?? '-'),
                'cn_name' => $booking->service?->cn_name,
                'service_type' => (string) ($booking->service?->service_type ?? ''),
                'duration_min' => max(0, (int) ($booking->service?->duration_min ?? 0)),
                'price_mode' => (string) ($booking->service?->price_mode ?? 'fixed'),
                'price_range_min' => $booking->service?->price_range_min !== null ? (float) $booking->service->price_range_min : null,
                'price_range_max' => $booking->service?->price_range_max !== null ? (float) $booking->service->price_range_max : null,
            ],
            'staff' => [
                'id' => (int) ($booking->staff?->id ?? 0),
                'name' => (string) ($booking->staff?->name ?? '-'),
            ],
            'staff_splits' => $staffSplits->values()->all(),
            'service_total' => (float) $summary['service_total'],
            'main_services' => $summary['main_services'] ?? [],
            'main_service_settlement_items' => $summary['main_service_settlement_items'] ?? [],
            'settled_service_amount' => $summary['settled_service_amount'],
            'is_range_priced' => (bool) $summary['is_range_priced'],
            'requires_settled_amount' => (bool) $summary['requires_settled_amount'],
            'deposit_contribution' => (float) $summary['deposit_contribution'],
            'deposit_paid' => (float) $summary['deposit_contribution'],
            'linked_booking_deposit' => (float) $summary['linked_booking_deposit'],
            'linked_booking_deposit_total' => (float) $summary['linked_booking_deposit'],
            'deposit_previously_collected' => (bool) $summary['deposit_previously_collected'],
            'deposit_previously_collected_amount' => (float) $summary['deposit_previously_collected_amount'],
            'package_offset' => (float) $summary['package_offset'],
            'settlement_paid' => (float) $summary['settlement_paid'],
            'service_balance_due' => (float) ($summary['service_balance_due'] ?? 0),
            'balance_due' => (float) $summary['balance_due'],
            'amount_due_now' => (float) $summary['amount_due_now'],
            'add_ons' => $summary['add_ons'],
            'addon_total_duration_min' => (int) $summary['addon_total_duration_min'],
            'estimated_duration_min' => (int) ($summary['estimated_duration_min'] ?? $this->recalculateAppointmentDurationMin($booking)),
            'addon_total_price' => (float) $summary['addon_total_price'],
            'addon_paid_online' => (float) $summary['addon_paid_online'],
            'addon_paid_settlement' => (float) $summary['addon_paid_settlement'],
            'addon_balance_due' => (float) $summary['addon_balance_due'],
            'package_status' => $summary['package_status'],
            'payment_history' => $history,
            'receipts' => $history,
            'uploaded_item_photos' => $booking->itemPhotos->map(fn ($photo) => [
                'id' => (int) $photo->id,
                'image_path' => (string) ($photo->file_path ?? ''),
                'image_url' => $photo->file_url,
                'created_at' => optional($photo->created_at)?->toIso8601String(),
            ])->values()->all(),
            'service_photos' => $booking->servicePhotos->map(fn ($photo) => [
                'id' => (int) $photo->id,
                'booking_id' => (int) $photo->booking_id,
                'image_path' => (string) ($photo->image_path ?? ''),
                'image_url' => $photo->image_url,
                'caption' => $photo->caption,
                'created_at' => optional($photo->created_at)?->toIso8601String(),
            ])->values()->all(),
        ]);
    }

    public function sendBookingConfirmationEmail(Request $request, int $id)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $booking = Booking::query()
            ->with(['service', 'staff', 'customer'])
            ->findOrFail($id);

        if ((string) $booking->status !== 'CONFIRMED') {
            return $this->respondError(__('Only CONFIRMED bookings can receive a confirmation email.'), 422);
        }

        $addonItems = collect(is_array($booking->addon_items_json) ? $booking->addon_items_json : [])
            ->map(fn ($item) => is_array($item) ? [
                'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
                'extra_duration_min' => (int) ($item['extra_duration_min'] ?? 0),
                'extra_price' => round((float) ($item['extra_price'] ?? 0), 2),
            ] : null)
            ->filter()
            ->values()
            ->all();

        $customerName = $booking->billing_name
            ?: $booking->guest_name
            ?: $booking->customer?->name
            ?: 'Customer';

        $contactPhone = $this->resolveContactPhoneForEmail();

        Mail::to($validated['email'])->queue(new BookingConfirmationMail(
            bookingCode: (string) ($booking->booking_code ?? ''),
            customerName: $customerName,
            serviceName: (string) ($booking->service?->name ?? 'Service'),
            staffName: (string) ($booking->staff?->name ?? ''),
            appointmentDate: $booking->start_at?->format('l, d M Y') ?? '—',
            appointmentStartTime: $booking->start_at?->format('h:i A') ?? '—',
            appointmentEndTime: $booking->end_at?->format('h:i A') ?? '—',
            durationMin: (int) ($booking->service?->duration_min ?? 0),
            depositAmount: (float) ($booking->deposit_amount ?? 0),
            source: (string) ($booking->source ?? 'STAFF'),
            addonItems: $addonItems,
            contactPhone: $contactPhone,
        ));

        return $this->respond(['ok' => true]);
    }

    public function applyPackageToAppointment(Request $request, int $id)
    {
        $booking = Booking::query()->with('service')->findOrFail($id);
        if (! $booking->customer_id || ! $booking->service_id) {
            return $this->respondError(__('Appointment must have customer and service to apply package.'), 422);
        }

        try {
            $this->customerServicePackageService->reserve(
                (int) $booking->customer_id,
                (int) $booking->service_id,
                'POS',
                (int) $booking->id,
                1,
                'Applied from POS appointment settlement',
            );
        } catch (\Throwable $e) {
            return $this->respondError($e->getMessage() ?: __('Unable to apply package to this appointment.'), 422);
        }

        return $this->respond([
            'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
        ], __('Package reserved successfully for appointment.'));
    }

    public function releasePackageForAppointment(Request $request, int $id)
    {
        $booking = Booking::query()->with(['service', 'customer', 'staff'])->findOrFail($id);
        if (! $booking->customer_id || ! $booking->service_id) {
            return $this->respondError(__('Appointment must have customer and service to release package.'), 422);
        }

        // Release reserved claims only (consumed cannot be released).
        // POS reservations are stored by used_from/used_ref_id (booking_id) with booking_id null.
        $this->customerServicePackageService->releaseReservedClaimsForBooking((int) $booking->id);
        $this->customerServicePackageService->releaseReservedClaimsBySource('POS', (int) $booking->id);

        return $this->respond([
            'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
        ], __('Package claim released for appointment.'));
    }

    public function collectAppointmentPayment(Request $request, int $id)
    {
        $this->mergeJsonPayload($request);
        $hasPaymentsPayload = is_array($request->input('payments')) && count((array) $request->input('payments')) > 0;

        $validated = $request->validate([
            'payment_method' => $hasPaymentsPayload
                ? ['nullable', 'string', 'max:50']
                : ['required', 'in:cash,qrpay,billplz_credit_card,credit_card'],
            'payments' => ['nullable', 'array'],
            'payments.*.method' => ['required_with:payments', 'string', 'in:cash,qrpay,credit_card,billplz_credit_card'],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'gt:0'],
            'qr_payment_proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
            'discount_type' => ['nullable', 'in:percentage,fixed'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'discount_remark' => ['nullable', 'string', 'max:255'],
            'settlement_line_staff_splits' => ['nullable', 'array'],
            'settlement_line_staff_splits.*.line_key' => ['nullable', 'string', 'max:255'],
            'settlement_line_staff_splits.*.line_type' => ['required_with:settlement_line_staff_splits', 'string', 'max:80'],
            'settlement_line_staff_splits.*.line_ref_id' => ['nullable'],
            'settlement_line_staff_splits.*.staff_splits' => ['nullable', 'array'],
            'settlement_line_staff_splits.*.staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'settlement_line_staff_splits.*.staff_splits.*.share_percent' => ['required', 'integer', 'min:0', 'max:100'],
        ]);

        $booking = Booking::query()->with(['service', 'customer'])->findOrFail($id);
        if (! $this->bookingEligibleForPosSettlement($booking)) {
            return $this->respondError(__('This appointment needs a linked member or guest, and a service, before settlement.'), 422);
        }

        if (str_starts_with(strtoupper(trim((string) ($booking->guest_name ?? ''))), 'UNKNOWN')) {
            $booking->customer_id = null;
            $booking->guest_name = 'UNKNOWN';
            $booking->guest_phone = null;
            $booking->guest_email = null;
            $booking->save();
            $booking->refresh();
        }

        if (($booking->service?->price_mode ?? 'fixed') === 'range' && $booking->settled_service_amount === null) {
            return $this->respondError(__('Please set the service amount before collecting payment. This service uses range pricing.'), 422);
        }

        $summary = $this->resolveAppointmentFinancialSummary($booking);
        $balanceDue = (float) $summary['balance_due'];
        if ($balanceDue <= 0) {
            return $this->respondError(__('No balance due for this appointment.'), 422);
        }

        $discountType = $validated['discount_type'] ?? null;
        $discountValue = (float) ($validated['discount_value'] ?? 0);
        if (! $discountType || $discountValue <= 0) {
            $discountType = null;
            $discountValue = 0.0;
        }

        if ($discountType === 'percentage' && $discountValue > 100) {
            return $this->respondError(__('Percentage discount must be between 0 and 100.'), 422);
        }

        if ($discountType === 'fixed' && $discountValue > $balanceDue + 0.0001) {
            return $this->respondError(__('Fixed discount must not exceed settlement amount due.'), 422);
        }

        $discountRemark = isset($validated['discount_remark']) ? trim((string) $validated['discount_remark']) : null;
        $totalDiscount = $this->resolveManualDiscountAmount((string) $discountType, $discountValue, $balanceDue);
        $amount = max(0, round($balanceDue - $totalDiscount, 2));
        if ($amount <= 0) {
            return $this->respondError(__('Payment amount must be greater than 0.'), 422);
        }
        $paymentRows = $this->resolveOrderPaymentRows($validated, $amount);
        $lineSplitPayloads = collect($validated['settlement_line_staff_splits'] ?? []);
        $payloadStaffIds = $lineSplitPayloads
            ->flatMap(fn (array $line) => collect($line['staff_splits'] ?? [])->pluck('staff_id'))
            ->map(fn ($staffId) => (int) $staffId)
            ->filter(fn (int $staffId) => $staffId > 0)
            ->unique()
            ->values();
        $summaryStaffIds = collect((array) ($summary['main_service_settlement_items'] ?? []))
            ->concat((array) ($summary['addon_settlement_items'] ?? []))
            ->flatMap(fn ($line) => collect($line['staff_splits'] ?? [])->pluck('staff_id'))
            ->concat($this->resolveBookingStaffSplits((int) $booking->id, (int) ($booking->staff_id ?? 0))->pluck('staff_id'))
            ->map(fn ($staffId) => (int) $staffId)
            ->filter(fn (int $staffId) => $staffId > 0);
        $staffCommissionRates = DB::table('staffs')
            ->whereIn('id', $payloadStaffIds->concat($summaryStaffIds)->unique()->values()->all())
            ->pluck('service_commission_rate', 'id')
            ->map(fn ($rate) => (float) $rate)
            ->all();

        [$order, $receiptUrl] = DB::transaction(function () use ($request, $booking, $amount, $validated, $summary, $discountType, $discountValue, $discountRemark, $totalDiscount, $balanceDue, $paymentRows, $lineSplitPayloads, $staffCommissionRates) {
            $mainSettlementItems = collect((array) ($summary['main_service_settlement_items'] ?? []));
            $addonSettlementItems = collect((array) ($summary['addon_settlement_items'] ?? []));
            $lineGrossRows = collect();

            foreach ($mainSettlementItems as $mainLine) {
                $lineGross = max(0, (float) ($mainLine['balance_due'] ?? 0));
                if ($lineGross > 0.0001) {
                    $lineGrossRows->push(['type' => 'service', 'line' => $mainLine, 'gross' => $lineGross]);
                }
            }
            foreach ($addonSettlementItems as $addon) {
                $lineGross = max(0, (float) ($addon['balance_due'] ?? 0));
                if ($lineGross > 0.0001) {
                    $lineGrossRows->push(['type' => 'addon', 'line' => $addon, 'gross' => $lineGross]);
                }
            }

            $normalizeSplits = function ($splits) {
                return collect($splits ?? [])->map(fn ($split) => [
                    'staff_id' => (int) ($split['staff_id'] ?? 0),
                    'share_percent' => (int) ($split['share_percent'] ?? 0),
                ])->filter(fn (array $split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)->values();
            };
            $findLineSplitPayload = function (string $lineKey) use ($lineSplitPayloads) {
                return $lineSplitPayloads->first(function (array $payload) use ($lineKey) {
                    $payloadKey = (string) ($payload['line_key'] ?? '');
                    return $payloadKey === $lineKey || str_ends_with($payloadKey, ':' . $lineKey);
                });
            };
            $bookingSplits = $this->resolveBookingStaffSplits((int) $booking->id, (int) ($booking->staff_id ?? 0))->values()->all();
            $resolveLineSplits = function (string $lineKey, $lineSplits = [], $fallbackSplits = []) use ($findLineSplitPayload, $normalizeSplits) {
                $payload = $findLineSplitPayload($lineKey);
                $splits = $payload ? ($payload['staff_splits'] ?? []) : (! empty($lineSplits) ? $lineSplits : $fallbackSplits);

                return $normalizeSplits($splits);
            };
            $persistLineSplits = function (OrderItem $orderItem, $splits, string $lineType, string $lineKey, float $amountBasis, array $snapshot = []) use ($staffCommissionRates): void {
                $splitRows = collect($splits ?? [])->values();
                if ($splitRows->isEmpty()) {
                    return;
                }
                $sum = (int) $splitRows->sum('share_percent');
                $uniqueCount = $splitRows->pluck('staff_id')->unique()->count();
                if ($sum !== 100 || $uniqueCount !== $splitRows->count()) {
                    abort(422, __('Invalid settlement line staff split.'));
                }
                foreach ($splitRows as $split) {
                    OrderItemStaffSplit::query()->create([
                        'order_item_id' => (int) $orderItem->id,
                        'line_type' => $lineType,
                        'line_ref_id' => $lineKey,
                        'staff_id' => (int) $split['staff_id'],
                        'share_percent' => (int) $split['share_percent'],
                        'amount_basis' => round(max(0, $amountBasis), 2),
                        'commission_rate_snapshot' => (float) ($staffCommissionRates[(int) $split['staff_id']] ?? 0),
                        'snapshot' => $snapshot,
                    ]);
                }
            };

            $lineDiscounts = [];
            $remaining = $totalDiscount;
            $lineCount = $lineGrossRows->count();
            foreach ($lineGrossRows as $index => $lineGrossRow) {
                $lineGross = (float) ($lineGrossRow['gross'] ?? 0);
                $lineGross = max(0, round((float) $lineGross, 2));
                if ($lineCount <= 1 || $index === $lineCount - 1) {
                    $lineDiscount = min($lineGross, max(0, round($remaining, 2)));
                } else {
                    $lineDiscount = min($lineGross, round($totalDiscount * ($lineGross / max($balanceDue, 0.0001)), 2));
                }
                $lineDiscounts[$index] = $lineDiscount;
                $remaining = max(0, round($remaining - $lineDiscount, 2));
            }
            if ($remaining > 0.0001 && $lineCount > 0) {
                $lastIndex = $lineCount - 1;
                $lineDiscounts[$lastIndex] = min(
                    (float) ($lineGrossRows[$lastIndex]['gross'] ?? 0),
                    round(($lineDiscounts[$lastIndex] ?? 0) + $remaining, 2)
                );
            }

            $order = Order::query()->create([
                'order_number' => 'POS-' . now()->format('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                'customer_id' => $booking->customer_id ? (int) $booking->customer_id : null,
                'created_by_user_id' => $request->user()->id,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => $this->orderPaymentMethodForRows($paymentRows),
                'payment_provider' => 'manual',
                'subtotal' => $balanceDue,
                'discount_total' => $totalDiscount,
                'shipping_fee' => 0,
                'grand_total' => $amount,
                'pickup_or_shipping' => 'in_store',
                'pickup_store_id' => null,
                'placed_at' => now(),
                'paid_at' => now(),
                'completed_at' => now(),
                'notes' => 'POS appointment settlement by staff #' . $request->user()->id . ' | booking_id=' . $booking->id,
            ]);

            $discountCursor = 0;
            foreach ($mainSettlementItems as $mainIdx => $mainLine) {
                $serviceBalanceDue = max(0, (float) ($mainLine['balance_due'] ?? 0));
                if ($serviceBalanceDue <= 0.0001) {
                    continue;
                }
                $serviceDiscount = (float) ($lineDiscounts[$discountCursor++] ?? 0);
                $serviceLineNet = max(0, round($serviceBalanceDue - $serviceDiscount, 2));
                $serviceOrderItem = OrderItem::query()->create([
                    'order_id' => (int) $order->id,
                    'line_type' => 'booking_settlement',
                    'product_name_snapshot' => 'Final Settlement - ' . (string) ($mainLine['name'] ?? ($booking->service?->name ?: 'Service')),
                    'display_name_snapshot' => 'Final Settlement - ' . (string) ($mainLine['name'] ?? ($booking->service?->name ?: 'Service')),
                    'quantity' => 1,
                    'price_snapshot' => $serviceBalanceDue,
                    'unit_price_snapshot' => $serviceBalanceDue,
                    'line_total' => $serviceBalanceDue,
                    'line_total_snapshot' => $serviceBalanceDue,
                    'effective_unit_price' => $serviceLineNet,
                    'effective_line_total' => $serviceLineNet,
                    'discount_type' => $serviceDiscount > 0 ? $discountType : null,
                    'discount_value' => $serviceDiscount > 0 ? $discountValue : 0,
                    'discount_amount' => $serviceDiscount,
                    'line_total_after_discount' => $serviceLineNet,
                    'discount_remark' => $serviceDiscount > 0 ? $discountRemark : null,
                    'locked' => true,
                    'booking_id' => (int) $booking->id,
                    'booking_service_id' => (int) ($mainLine['linked_booking_service_id'] ?? $booking->service_id),
                ]);

                $serviceLineKey = (string) ($mainLine['line_key'] ?? $this->appointmentSettlementLineKey('service', (array) $mainLine, (int) $mainIdx));
                $serviceSplits = $resolveLineSplits($serviceLineKey, $mainLine['staff_splits'] ?? [], $bookingSplits);
                $persistLineSplits($serviceOrderItem, $serviceSplits, 'settlement_service', $serviceLineKey, $serviceLineNet, [
                    'booking_id' => (int) $booking->id,
                    'line_key' => $serviceLineKey,
                    'line_type' => 'settlement_service',
                    'service_id' => (int) ($mainLine['linked_booking_service_id'] ?? $booking->service_id),
                    'service_ref' => ($mainLine['is_original'] ?? false) ? 'original' : (string) ($mainLine['name'] ?? $serviceLineKey),
                    'service' => $mainLine,
                    'staff_split_source' => $findLineSplitPayload($serviceLineKey) ? 'explicit' : (! empty($mainLine['staff_splits'] ?? []) ? 'line' : 'inherited'),
                ]);
            }

            foreach ($addonSettlementItems as $addonIdx => $addon) {
                $addonAmount = max(0, (float) ($addon['balance_due'] ?? 0));
                $addonDiscount = (float) ($lineDiscounts[$discountCursor++] ?? 0);
                $addonLineNet = max(0, round($addonAmount - $addonDiscount, 2));
                $addonOrderItem = OrderItem::query()->create([
                    'order_id' => (int) $order->id,
                    'line_type' => 'booking_addon',
                    'product_name_snapshot' => (string) ($addon['name'] ?? 'Add-on'),
                    'display_name_snapshot' => (string) ($addon['name'] ?? 'Add-on'),
                    'variant_name_snapshot' => 'Booking Add-on Settlement',
                    'quantity' => 1,
                    'price_snapshot' => $addonAmount,
                    'unit_price_snapshot' => $addonAmount,
                    'line_total' => $addonAmount,
                    'line_total_snapshot' => $addonAmount,
                    'effective_unit_price' => $addonLineNet,
                    'effective_line_total' => $addonLineNet,
                    'discount_type' => $addonDiscount > 0 ? $discountType : null,
                    'discount_value' => $addonDiscount > 0 ? $discountValue : 0,
                    'discount_amount' => $addonDiscount,
                    'line_total_after_discount' => $addonLineNet,
                    'discount_remark' => $addonDiscount > 0 ? $discountRemark : null,
                    'locked' => true,
                    'booking_id' => (int) $booking->id,
                    'booking_service_id' => (int) $booking->service_id,
                ]);

                $addonLineKey = (string) ($addon['line_key'] ?? $this->appointmentSettlementLineKey('addon', (array) $addon, (int) $addonIdx));
                $addonSplits = $resolveLineSplits($addonLineKey, $addon['staff_splits'] ?? [], $bookingSplits);
                $persistLineSplits($addonOrderItem, $addonSplits, 'settlement_addon', $addonLineKey, $addonLineNet, [
                    'booking_id' => (int) $booking->id,
                    'line_key' => $addonLineKey,
                    'line_type' => 'settlement_addon',
                    'staff_split_source' => $findLineSplitPayload($addonLineKey) ? 'explicit' : (! empty($addon['staff_splits'] ?? []) ? 'line' : 'inherited'),
                    'addon' => $addon,
                ]);
            }

            $this->replaceOrderPayments($order, $paymentRows, 'pos_appointment_settlement');
            if ($request->hasFile('qr_payment_proof')) {
                OrderUpload::query()->create([
                    'order_id' => (int) $order->id,
                    'type' => 'payment_slip',
                    'file_path' => $request->file('qr_payment_proof')->store('payment-slips', 'public'),
                    'note' => 'POS appointment QRPay proof',
                    'status' => 'approved',
                ]);
            }

            $receipt = $this->buildReceiptUrl($order, $request);
            return [$order, $receipt];
        });

        // Match POS cart settlement checkout: keep booking payment_status aligned with resolved balances.
        $booking = $booking->fresh(['service', 'customer']);
        $freshSummary = $this->resolveAppointmentFinancialSummary($booking);

        $booking->payment_status = $this->calculateAppointmentPaymentStatus($freshSummary);
        $booking->save();

        $this->staffCommissionService->syncBookingCommissionState($booking->fresh(['service']));

        return $this->respond([
            'order_id' => (int) $order->id,
            'order_number' => (string) $order->order_number,
            'receipt_public_url' => $receiptUrl,
            'paid_amount' => (float) $amount,
            'balance_due' => (float) $freshSummary['balance_due'],
            'amount_due_now' => (float) $freshSummary['amount_due_now'],
            'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
        ], __('Appointment payment collected.'));
    }

    public function finalizeAppointmentZeroSettlement(Request $request, int $id, OrderPaymentService $orderPaymentService)
    {
        $validated = $request->validate([
            'payment_method' => ['required', 'in:cash,qrpay,billplz_credit_card'],
        ]);

        $booking = Booking::query()->with(['service', 'customer'])->findOrFail($id);
        if (! $this->bookingEligibleForPosSettlement($booking)) {
            return $this->respondError(__('This appointment needs a linked member or guest, and a service, before settlement.'), 422);
        }

        if (str_starts_with(strtoupper(trim((string) ($booking->guest_name ?? ''))), 'UNKNOWN')) {
            $booking->customer_id = null;
            $booking->guest_name = 'UNKNOWN';
            $booking->guest_phone = null;
            $booking->guest_email = null;
            $booking->save();
            $booking->refresh();
        }

        if ((string) $booking->status !== 'COMPLETED') {
            return $this->respondError(__('Only completed appointments can be finalised this way.'), 422);
        }

        if (($booking->service?->price_mode ?? 'fixed') === 'range' && $booking->settled_service_amount === null) {
            return $this->respondError(__('Please set the service amount before finalising. This service uses range pricing.'), 422);
        }

        if (OrderServiceItem::query()->where('booking_id', (int) $booking->id)->exists()) {
            return $this->respondError(__('This appointment is already finalised.'), 422);
        }

        if (OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->where('line_type', 'booking_settlement')
            ->exists()) {
            return $this->respondError(__('This appointment is already finalised.'), 422);
        }

        $summary = $this->resolveAppointmentFinancialSummary($booking);
        if (max(0.0, (float) ($summary['balance_due'] ?? 0)) > 0.0001) {
            return $this->respondError(__('A balance is still due; use standard collection.'), 422);
        }

        try {
            [$order, $receiptUrl] = DB::transaction(function () use ($request, $booking, $validated, $orderPaymentService) {
                $order = Order::query()->create([
                    'order_number' => 'POS-' . now()->format('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                    'customer_id' => $booking->customer_id ? (int) $booking->customer_id : null,
                    'created_by_user_id' => $request->user()->id,
                    'status' => 'completed',
                    'payment_status' => 'paid',
                    'payment_method' => $validated['payment_method'],
                    'payment_provider' => 'manual',
                    'subtotal' => 0,
                    'discount_total' => 0,
                    'shipping_fee' => 0,
                    'grand_total' => 0,
                    'pickup_or_shipping' => 'in_store',
                    'pickup_store_id' => null,
                    'placed_at' => now(),
                    'paid_at' => now(),
                    'completed_at' => now(),
                    'notes' => 'POS appointment zero settlement by staff #' . $request->user()->id . ' | booking_id=' . $booking->id,
                ]);

                $this->recordPackageCoveredAppointmentOnOrder($order, $booking);

                $orderPaymentService->handlePaid($order->fresh(['items']));

                return [$order, $this->buildReceiptUrl($order->fresh(['items']), $request)];
            });
        } catch (\Throwable $e) {
            return $this->respondError($e->getMessage() ?: __('Unable to finalise appointment.'), 422);
        }

        $booking = $booking->fresh(['service', 'customer']);
        $freshSummary = $this->resolveAppointmentFinancialSummary($booking);

        return $this->respond([
            'order_id' => (int) $order->id,
            'order_number' => (string) $order->order_number,
            'receipt_public_url' => $receiptUrl,
            'paid_amount' => 0.0,
            'balance_due' => (float) ($freshSummary['balance_due'] ?? 0),
            'amount_due_now' => (float) ($freshSummary['amount_due_now'] ?? 0),
            'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
        ], __('Appointment finalised.'));
    }

    public function editAppointmentSettlement(Request $request, int $id)
    {
        $booking = Booking::query()->with(['service.questions.options.linkedBookingService', 'customer', 'staff'])->findOrFail($id);
        if (! $booking->service_id) {
            return $this->respondError(__('Appointment must have a service.'), 422);
        }

        $requestedServiceId = $request->filled('booking_service_id')
            ? (int) $request->input('booking_service_id')
            : (int) ($booking->service_id ?? 0);
        $effectiveService = $booking->service;
        if ($requestedServiceId > 0 && $requestedServiceId !== (int) ($booking->service_id ?? 0)) {
            $effectiveService = BookingService::query()
                ->with(['questions.options.linkedBookingService'])
                ->where('is_active', true)
                ->find($requestedServiceId);
            if (! $effectiveService) {
                return $this->respondError(__('Selected service is not active.'), 422);
            }
        }

        $isRangePriced = ($effectiveService?->price_mode ?? 'fixed') === 'range';
        $isEditingSettlement = $request->hasAny([
            'addon_option_ids',
            'main_service_ids',
            'main_service_items',
            'staff_splits',
            'original_service_price',
            'booking_service_id',
        ]);
        $validated = $request->validate([
            'booking_service_id' => ['nullable', 'integer', 'exists:booking_services,id'],
            'settled_service_amount' => [$isRangePriced && $isEditingSettlement ? 'required' : 'nullable', 'numeric', 'min:0'],
            'main_service_ids' => ['nullable', 'array'],
            'main_service_ids.*' => ['integer'],
            'main_service_items' => ['nullable', 'array'],
            'main_service_items.*.booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'main_service_items.*.addon_option_ids' => ['nullable', 'array'],
            'main_service_items.*.addon_option_ids.*' => ['integer'],
            'main_service_items.*.addon_staff_splits' => ['nullable', 'array'],
            'main_service_items.*.addon_staff_splits.*' => ['array'],
            'main_service_items.*.addon_staff_splits.*.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'main_service_items.*.addon_staff_splits.*.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'main_service_items.*.price' => ['nullable', 'numeric', 'min:0'],
            'main_service_items.*.addon_price_overrides' => ['nullable', 'array'],
            'main_service_items.*.addon_price_overrides.*' => ['numeric', 'min:0'],
            'main_service_items.*.staff_splits' => ['nullable', 'array', 'min:1'],
            'main_service_items.*.staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'main_service_items.*.staff_splits.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'addon_option_ids' => ['nullable', 'array'],
            'addon_option_ids.*' => ['integer'],
            'addon_staff_splits' => ['nullable', 'array'],
            'addon_staff_splits.*' => ['array'],
            'addon_staff_splits.*.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'addon_staff_splits.*.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'original_service_price' => ['nullable', 'numeric', 'min:0'],
            'addon_price_overrides' => ['nullable', 'array'],
            'addon_price_overrides.*' => ['numeric', 'min:0'],
            'staff_splits' => ['nullable', 'array', 'min:1'],
            'staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'staff_splits.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'adjusted_deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'deposit_adjustment_remark' => ['nullable', 'string', 'max:255'],
            'availability_override' => ['nullable', 'boolean'],
            'availability_override_type' => ['nullable', 'string', 'in:outside_staff_schedule'],
            'availability_override_reason' => ['nullable', 'string', 'max:500'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'guest_name' => ['nullable', 'string', 'max:255'],
            'guest_phone' => ['nullable', 'string', 'max:32'],
            'guest_email' => ['nullable', 'string', 'email', 'max:255'],
        ]);

        $isDepositOnlyAdjustment = $request->has('adjusted_deposit_amount')
            && ! $isEditingSettlement
            && ! $request->hasAny(['customer_id', 'guest_name', 'guest_phone', 'guest_email']);

        if ($isDepositOnlyAdjustment) {
            try {
                $this->adjustAppointmentDepositContribution(
                    $booking->fresh(['service', 'customer']),
                    round(max(0, (float) $validated['adjusted_deposit_amount']), 2),
                    isset($validated['deposit_adjustment_remark']) ? trim((string) $validated['deposit_adjustment_remark']) : null,
                    (int) $request->user()->id,
                );
            } catch (ValidationException $e) {
                return $this->respondError((string) (collect($e->errors())->flatten()->first() ?: __('Invalid deposit adjustment.')), 422);
            }

            $booking = Booking::query()
                ->with(['service:id,name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type,duration_min', 'customer:id,name,phone,email', 'staff:id,name'])
                ->findOrFail((int) $booking->id);
            $this->staffCommissionService->resyncBookingCommission($booking);
            $summary = $this->resolveAppointmentFinancialSummary($booking);

            return $this->respond([
                'appointment' => $this->resolveAppointmentSnapshot($booking),
                'service_total' => (float) $summary['service_total'],
                'settled_service_amount' => $summary['settled_service_amount'],
                'requires_settled_amount' => (bool) $summary['requires_settled_amount'],
                'main_services' => $summary['main_services'] ?? [],
                'balance_due' => (float) $summary['balance_due'],
                'amount_due_now' => (float) $summary['amount_due_now'],
                'add_ons' => $summary['add_ons'],
                'policy_warnings' => [],
            ], __('Deposit updated.'));
        }

        if ($request->hasAny(['customer_id', 'guest_name', 'guest_phone', 'guest_email'])) {
            $hasPackageUsage = CustomerServicePackageUsage::query()
                ->where('booking_id', (int) $booking->id)
                ->whereIn('status', ['reserved', 'consumed'])
                ->exists();

            if (! empty($validated['customer_id'])) {
                $nextCustomerId = (int) $validated['customer_id'];
                Customer::query()->findOrFail($nextCustomerId);
                if ($hasPackageUsage && $nextCustomerId !== (int) ($booking->customer_id ?? 0)) {
                    return $this->respondError(__('Cannot change member while a package is reserved or consumed on this appointment.'), 422);
                }
                $booking->customer_id = $nextCustomerId;
                $booking->guest_name = null;
                $booking->guest_phone = null;
                $booking->guest_email = null;
            } else {
                if ($hasPackageUsage) {
                    return $this->respondError(__('Cannot switch to guest while a package is reserved or consumed on this appointment.'), 422);
                }

                $guestName = trim((string) ($validated['guest_name'] ?? ''));
                $guestPhone = trim((string) ($validated['guest_phone'] ?? ''));
                $guestEmail = trim((string) ($validated['guest_email'] ?? ''));

                if ($guestName === '' && $guestPhone === '' && $guestEmail === '') {
                    $guestName = 'UNKNOWN';
                }

                if ($guestPhone !== '' && ! preg_match('/^\+?[0-9]{8,15}$/', $guestPhone)) {
                    return $this->respondError(__('Please enter a valid guest phone number (8-15 digits, optional + prefix).'), 422);
                }

                $booking->customer_id = null;
                $booking->guest_name = $guestName !== '' ? $guestName : 'UNKNOWN';
                $booking->guest_phone = $guestPhone !== '' ? $guestPhone : null;
                $booking->guest_email = $guestEmail !== '' ? Str::lower($guestEmail) : null;
            }
        }

        if ($effectiveService && (int) ($booking->service_id ?? 0) !== (int) $effectiveService->id) {
            $booking->service_id = (int) $effectiveService->id;
            $booking->setRelation('service', $effectiveService);
        }

        if ($isRangePriced && isset($validated['settled_service_amount'])) {
            $booking->settled_service_amount = round((float) $validated['settled_service_amount'], 2);
        } elseif (! $isRangePriced) {
            $booking->settled_service_amount = null;
        }

        $existingSettlementItems = collect($booking->addon_items_json ?? []);

        if ($request->has('main_service_ids') || $request->has('main_service_items')) {
            $itemsPayload = collect($validated['main_service_items'] ?? [])
                ->map(function (array $item): array {
                    return [
                        'booking_service_id' => (int) ($item['booking_service_id'] ?? 0),
                        'addon_option_ids' => collect($item['addon_option_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->values()->all(),
                        'price' => array_key_exists('price', $item) ? round(max(0, (float) $item['price']), 2) : null,
                        'addon_price_overrides' => collect($item['addon_price_overrides'] ?? [])->mapWithKeys(fn ($price, $id) => [(int) $id => round(max(0, (float) $price), 2)])->all(),
                        'addon_staff_splits' => collect($item['addon_staff_splits'] ?? [])->mapWithKeys(fn ($splits, $id) => [(int) $id => collect($splits)->values()->all()])->all(),
                        'staff_splits' => collect($item['staff_splits'] ?? [])->map(fn ($split) => [
                            'staff_id' => (int) ($split['staff_id'] ?? 0),
                            'share_percent' => (int) ($split['share_percent'] ?? 0),
                        ])->values()->all(),
                    ];
                })
                ->filter(fn (array $item) => (int) ($item['booking_service_id'] ?? 0) > 0)
                ->values();

            $serviceIds = ($itemsPayload->isNotEmpty()
                ? $itemsPayload->pluck('booking_service_id')
                : collect($validated['main_service_ids'] ?? []))
                ->map(fn ($id) => (int) $id)
                ->filter(fn (int $id) => $id > 0)
                ->reject(fn (int $id) => $id === (int) ($booking->service_id ?? 0))
                ->unique()
                ->values();

            $servicesById = $serviceIds->isEmpty()
                ? collect()
                : BookingService::query()
                    ->whereIn('id', $serviceIds->all())
                    ->where('is_active', true)
                    ->get(['id', 'name', 'service_price', 'price', 'duration_min'])
                    ->keyBy('id');

            $existingMainByServiceId = $existingSettlementItems
                ->filter(fn ($item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service')
                ->filter(fn ($item) => ! (bool) ($item['is_original'] ?? false))
                ->filter(fn ($item) => (int) ($item['linked_booking_service_id'] ?? 0) !== (int) ($booking->service_id ?? 0))
                ->keyBy(fn ($item) => (int) ($item['linked_booking_service_id'] ?? 0));

            $mainServiceRows = $serviceIds
                ->map(function (int $serviceId) use ($servicesById, $existingMainByServiceId, $itemsPayload) {
                    $service = $servicesById->get($serviceId);
                    if (! $service) {
                        return null;
                    }
                    $existing = (array) ($existingMainByServiceId->get($serviceId) ?? []);
                    $itemPayload = (array) ($itemsPayload->first(fn (array $item) => (int) ($item['booking_service_id'] ?? 0) === $serviceId) ?? []);
                    $price = array_key_exists('price', $itemPayload) && $itemPayload['price'] !== null
                        ? round(max(0, (float) $itemPayload['price']), 2)
                        : round(max(0, (float) ($service->service_price ?? $service->price ?? 0)), 2);
                    $addonPriceOverrides = (array) ($itemPayload['addon_price_overrides'] ?? []);
                    $addonStaffSplits = (array) ($itemPayload['addon_staff_splits'] ?? []);
                    $availableOptions = BookingService::query()
                        ->with(['questions.options.linkedBookingService'])
                        ->find($serviceId)?->questions
                        ?->flatMap(fn ($q) => $q->options)
                        ?->filter(fn ($opt) => $opt->is_active)
                        ?->keyBy('id') ?? collect();
                    $addonItems = collect($itemPayload['addon_option_ids'] ?? [])
                        ->map(fn ($optId) => $availableOptions->get($optId))
                        ->filter()
                        ->map(fn (BookingServiceQuestionOption $option) => [
                            'id' => (int) $option->id,
                            'name' => (string) ($option->label ?: $option->linkedBookingService?->name ?: 'Add-on'),
                            'cn_name' => trim((string) ($option->cn_label ?? '')) !== '' ? (string) $option->cn_label : $option->linkedBookingService?->cn_name,
                            'extra_duration_min' => $option->linkedBookingService
                                ? max(0, (int) ($option->linkedBookingService->duration_min ?? 0))
                                : max(0, (int) ($option->extra_duration_min ?? 0)),
                            'extra_price' => array_key_exists((int) $option->id, $addonPriceOverrides)
                                ? round(max(0, (float) $addonPriceOverrides[(int) $option->id]), 2)
                                : ($option->linkedBookingService
                                    ? round(max(0, (float) ($option->linkedBookingService->service_price ?? 0)), 2)
                                    : round(max(0, (float) ($option->extra_price ?? 0)), 2)),
                            'linked_booking_service_id' => $option->linkedBookingService
                                ? (int) $option->linkedBookingService->id
                                : null,
                            'linked_cn_name' => $option->linkedBookingService?->cn_name,
                            'staff_splits' => collect($addonStaffSplits[(int) $option->id] ?? [])->values()->all(),
                        ])->values()->all();
                    $itemSplits = collect($itemPayload['staff_splits'] ?? [])->values();
                    $bookingProductOptionSnapshots = collect($item->selected_booking_product_options ?? [])
                        ->flatMap(fn ($question) => collect($question['options'] ?? []))
                        ->filter(fn ($option) => is_array($option))
                        ->values();

                    if ($itemSplits->isNotEmpty()) {
                        $splitSum = (int) $itemSplits->sum(fn (array $split) => (int) ($split['share_percent'] ?? 0));
                        $uniqueCount = $itemSplits->pluck('staff_id')->filter()->unique()->count();
                        if ($splitSum !== 100 || $uniqueCount !== $itemSplits->count()) {
                            throw ValidationException::withMessages([
                                'main_service_items' => __('Invalid staff split for added main service.'),
                            ]);
                        }
                    }

                    return [
                        'item_kind' => 'main_service',
                        'id' => isset($existing['id']) ? (int) $existing['id'] : null,
                        'name' => (string) ($service->name ?? $existing['name'] ?? 'Service'),
                        'extra_duration_min' => max(0, (int) ($service->duration_min ?? ($existing['extra_duration_min'] ?? 0))),
                        'extra_price' => $price,
                        'linked_booking_service_id' => (int) $serviceId,
                        'is_original' => false,
                        'addon_items' => $addonItems,
                        'addon_total_price' => round((float) collect($addonItems)->sum('extra_price'), 2),
                        'addon_total_duration_min' => (int) collect($addonItems)->sum('extra_duration_min'),
                        'staff_splits' => $itemSplits->values()->all(),
                    ];
                })
                ->filter()
                ->values();

            $existingSettlementItems = $existingSettlementItems
                ->reject(fn ($item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service')
                ->values()
                ->concat($mainServiceRows)
                ->values();
        }

        if ($request->has('addon_option_ids')) {
            $optionIds = collect($validated['addon_option_ids'] ?? []);
            $availableOptions = $booking->service->questions
                ->flatMap(fn ($q) => $q->options)
                ->filter(fn ($opt) => $opt->is_active)
                ->keyBy('id');

            $addonPriceOverrides = collect($validated['addon_price_overrides'] ?? [])->mapWithKeys(fn ($price, $id) => [(int) $id => round(max(0, (float) $price), 2)])->all();
            $addonStaffSplits = collect($validated['addon_staff_splits'] ?? [])->mapWithKeys(fn ($splits, $id) => [(int) $id => collect($splits)->values()->all()])->all();

            $newAddonItems = $optionIds
                ->map(fn ($optId) => $availableOptions->get($optId))
                ->filter()
                ->map(fn (BookingServiceQuestionOption $option) => [
                    'id' => (int) $option->id,
                    'name' => (string) ($option->label ?: $option->linkedBookingService?->name ?: 'Add-on'),
                    'cn_name' => trim((string) ($option->cn_label ?? '')) !== '' ? (string) $option->cn_label : $option->linkedBookingService?->cn_name,
                    'extra_duration_min' => $option->linkedBookingService
                        ? max(0, (int) ($option->linkedBookingService->duration_min ?? 0))
                        : max(0, (int) ($option->extra_duration_min ?? 0)),
                    'extra_price' => array_key_exists((int) $option->id, $addonPriceOverrides)
                        ? round(max(0, (float) $addonPriceOverrides[(int) $option->id]), 2)
                        : ($option->linkedBookingService
                            ? round(max(0, (float) ($option->linkedBookingService->service_price ?? 0)), 2)
                            : round(max(0, (float) ($option->extra_price ?? 0)), 2)),
                    'linked_booking_service_id' => $option->linkedBookingService
                        ? (int) $option->linkedBookingService->id
                        : null,
                    'linked_service_type' => $option->linkedBookingService
                        ? (string) $option->linkedBookingService->service_type
                        : null,
                    'linked_deposit_amount' => $option->linkedBookingService
                        ? round(max(0, (float) ($option->linkedBookingService->deposit_amount ?? 0)), 2)
                        : null,
                    'staff_splits' => collect($addonStaffSplits[(int) $option->id] ?? [])->values()->all(),
                ])->values()->all();

            $existingMainRows = $existingSettlementItems
                ->filter(fn ($item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service')
                ->filter(fn ($item) => ! (bool) ($item['is_original'] ?? false))
                ->filter(fn ($item) => (int) ($item['linked_booking_service_id'] ?? 0) !== (int) ($booking->service_id ?? 0))
                ->values()
                ->all();
            $booking->addon_items_json = array_values([...$existingMainRows, ...$newAddonItems]);
        } else {
            $booking->addon_items_json = $existingSettlementItems->values()->all();
        }

        if (array_key_exists('original_service_price', $validated) && $validated['original_service_price'] !== null) {
            $originalServicePrice = round(max(0, (float) $validated['original_service_price']), 2);
            $existingOriginalRow = collect($booking->addon_items_json ?? [])
                ->first(fn ($item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service' && (bool) ($item['is_original'] ?? false));
            $booking->addon_items_json = collect($booking->addon_items_json ?? [])
                ->reject(fn ($item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service' && (bool) ($item['is_original'] ?? false))
                ->prepend([
                    'item_kind' => 'main_service',
                    'id' => is_array($existingOriginalRow) && isset($existingOriginalRow['id']) ? (int) $existingOriginalRow['id'] : null,
                    'name' => (string) ($effectiveService?->name ?? $booking->service?->name ?? 'Service'),
                    'cn_name' => $effectiveService?->cn_name ?? $booking->service?->cn_name,
                    'extra_duration_min' => max(0, (int) ($effectiveService?->duration_min ?? $booking->service?->duration_min ?? 0)),
                    'extra_price' => $originalServicePrice,
                    'linked_booking_service_id' => (int) ($booking->service_id ?? 0),
                    'is_original' => true,
                    'addon_items' => [],
                ])
                ->values()
                ->all();
        }

        $addonRowsForBooking = collect($booking->addon_items_json ?? [])
            ->filter(fn ($item) => strtolower((string) ($item['item_kind'] ?? 'addon')) !== 'main_service')
            ->values();
        $booking->addon_price = round((float) $addonRowsForBooking->sum(fn ($item) => max(0, (float) ($item['extra_price'] ?? 0))), 2);
        $booking->addon_duration_min = (int) $addonRowsForBooking->sum(fn ($item) => max(0, (int) ($item['extra_duration_min'] ?? 0)));

        $recalculatedDurationMin = $this->recalculateAppointmentDurationMin($booking);
        if ($recalculatedDurationMin <= 0) {
            return $this->respondError(__('Appointment duration is invalid.'), 422);
        }

        $newEndAt = $booking->start_at
            ? Carbon::parse($booking->start_at)->addMinutes($recalculatedDurationMin)
            : null;
        if (! $newEndAt) {
            return $this->respondError(__('Appointment start time is required.'), 422);
        }

        $booking->end_at = $newEndAt;

        $normalizedSplits = $this->normalizeBookingStaffSplits(
            collect($validated['staff_splits'] ?? []),
            (int) ($booking->staff_id ?? 0),
        );
        if ($normalizedSplits['error']) {
            return $this->respondError((string) $normalizedSplits['error'], 422);
        }

        $settlementConflictDiagnostics = null;
        $settlementPolicyWarnings = [];
        try {
            DB::transaction(function () use ($booking, $normalizedSplits, $recalculatedDurationMin, $request, &$settlementConflictDiagnostics, &$settlementPolicyWarnings) {
                $lockedBooking = Booking::query()
                    ->whereKey((int) $booking->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $startAt = Carbon::parse($lockedBooking->start_at ?? $booking->start_at);
                $transactionNewEndAt = $startAt->copy()->addMinutes($recalculatedDurationMin);
                $staffId = (int) ($lockedBooking->staff_id ?? $booking->staff_id ?? 0);
                if ($staffId <= 0) {
                    throw ValidationException::withMessages([
                        'assigned_staff_id' => __('Assigned staff is required.'),
                    ]);
                }
                $lockedStaff = Staff::query()->find($staffId);
                if (! $lockedStaff || ! (bool) ($lockedStaff->is_active ?? true)) {
                    throw ValidationException::withMessages([
                        'assigned_staff_id' => __('Selected staff is inactive.'),
                    ]);
                }

                $bufferMin = (int) ($lockedBooking->buffer_min ?? $booking->buffer_min ?? 0);
                $scheduleDiagnostics = $this->availabilityService->getStaffAvailabilityDiagnostics($staffId, $startAt, $transactionNewEndAt);
                $scheduleFailureReason = (string) ($scheduleDiagnostics['failure_reason'] ?? '');
                $outsideScheduleOverrideRequested = (bool) $request->boolean('availability_override')
                    && (string) $request->input('availability_override_type') === 'outside_staff_schedule'
                    && $scheduleFailureReason === 'outside_staff_schedule';
                $conflictDiagnostics = $this->availabilityService->getConflictDiagnostics($staffId, $startAt, $transactionNewEndAt, $bufferMin, (int) $lockedBooking->id, $lockedBooking);

                if (((! (bool) ($scheduleDiagnostics['is_available'] ?? false)) && ! $outsideScheduleOverrideRequested) || (bool) ($conflictDiagnostics['has_conflict'] ?? false)) {
                    $settlementReasonCode = (bool) ($conflictDiagnostics['has_conflict'] ?? false)
                        ? $this->posAvailabilityReasonCode($conflictDiagnostics)
                        : ($scheduleFailureReason ?: 'staff_unavailable');
                    $settlementConflictDiagnostics = [
                        ...$conflictDiagnostics,
                        'reason_code' => $settlementReasonCode,
                        'staff_schedule' => $scheduleDiagnostics,
                        'current_booking_id' => (int) $lockedBooking->id,
                        'current_appointment_id' => (int) $lockedBooking->id,
                    ];
                    Log::warning('POS edit settlement appointment duration conflict', $settlementConflictDiagnostics);

                    throw ValidationException::withMessages([
                        'appointment_end_at' => $this->formatSettlementConflictMessage($settlementConflictDiagnostics),
                    ]);
                }

                $scheduleOverride = $outsideScheduleOverrideRequested
                    ? $this->resolvePosScheduleOverride($staffId, $startAt, $transactionNewEndAt, $scheduleDiagnostics, $request->user()?->id)
                    : $this->resolvePosScheduleOverride($staffId, $startAt, $transactionNewEndAt, ['failure_reason' => null], $request->user()?->id);

                $booking->start_at = $lockedBooking->start_at;
                $booking->end_at = $transactionNewEndAt;
                $booking->fill($scheduleOverride);
                $booking->save();
                $this->recordScheduleOverrideAudit($booking->fresh(), $scheduleOverride, $request);
                if ((bool) ($scheduleOverride['schedule_override_used'] ?? false)) {
                    $settlementPolicyWarnings[] = 'Updated appointment time is outside staff schedule. POS can continue if this is a walk-in / overtime appointment.';
                }
                $this->persistBookingStaffSplits($booking, collect($normalizedSplits['splits'] ?? []));
            });
        } catch (ValidationException $e) {
            return $this->respondError(
                (string) (collect($e->errors())->flatten()->first() ?: __('This update extends the appointment time and conflicts with another booking or staff availability.')),
                409,
                [
                    'reason_code' => $settlementConflictDiagnostics['reason_code'] ?? null,
                    'validation_reason' => $settlementConflictDiagnostics['reason_code'] ?? null,
                    'conflict_debug' => $settlementConflictDiagnostics,
                ]
            );
        }

        if ($request->has('adjusted_deposit_amount')) {
            try {
                $this->adjustAppointmentDepositContribution(
                    $booking->fresh(['service', 'customer']),
                    round(max(0, (float) $validated['adjusted_deposit_amount']), 2),
                    isset($validated['deposit_adjustment_remark']) ? trim((string) $validated['deposit_adjustment_remark']) : null,
                    (int) $request->user()->id,
                );
            } catch (ValidationException $e) {
                return $this->respondError((string) (collect($e->errors())->flatten()->first() ?: __('Invalid deposit adjustment.')), 422);
            }
        }

        $this->staffCommissionService->resyncBookingCommission($booking->fresh(['service']));
        $booking = Booking::query()
            ->with(['service:id,name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type,duration_min', 'customer:id,name,phone,email', 'staff:id,name'])
            ->findOrFail((int) $booking->id);
        $summary = $this->resolveAppointmentFinancialSummary($booking);

        return $this->respond([
            'appointment' => $this->resolveAppointmentSnapshot($booking),
            'service_total' => (float) $summary['service_total'],
            'settled_service_amount' => $summary['settled_service_amount'],
            'requires_settled_amount' => (bool) $summary['requires_settled_amount'],
            'main_services' => $summary['main_services'] ?? [],
            'balance_due' => (float) $summary['balance_due'],
            'amount_due_now' => (float) $summary['amount_due_now'],
            'add_ons' => $summary['add_ons'],
            'policy_warnings' => $settlementPolicyWarnings,
        ], __('Appointment settlement updated.'));
    }

    public function getServiceAddonOptions(int $serviceId)
    {
        $service = BookingService::query()->with(['questions.options.linkedBookingService'])->findOrFail($serviceId);

        $questions = $service->questions->map(fn (BookingServiceQuestion $question) => [
            'id' => (int) $question->id,
            'title' => (string) $question->title,
            'cn_title' => $question->cn_title,
            'description' => $question->description,
            'cn_description' => $question->cn_description,
            'question_type' => (string) $question->question_type,
            'is_required' => (bool) $question->is_required,
            'options' => $question->options->filter(fn ($opt) => $opt->is_active)->map(fn (BookingServiceQuestionOption $option) => [
                'id' => (int) $option->id,
                'label' => (string) $option->label,
                'cn_label' => trim((string) ($option->cn_label ?? '')) !== '' ? (string) $option->cn_label : $option->linkedBookingService?->cn_name,
                'linked_booking_service_id' => $option->linkedBookingService ? (int) $option->linkedBookingService->id : null,
                'linked_cn_name' => $option->linkedBookingService?->cn_name,
                'extra_duration_min' => $option->linkedBookingService
                    ? max(0, (int) ($option->linkedBookingService->duration_min ?? 0))
                    : max(0, (int) ($option->extra_duration_min ?? 0)),
                'extra_price' => $option->linkedBookingService
                    ? round(max(0, (float) ($option->linkedBookingService->service_price ?? 0)), 2)
                    : round(max(0, (float) ($option->extra_price ?? 0)), 2),
            ])->values(),
        ]);

        return $this->respond(['questions' => $questions]);
    }

    public function markAppointmentCompleted(int $id)
    {
        $booking = Booking::query()->with(['service', 'customer', 'staff'])->findOrFail($id);
        $summary = $this->resolveAppointmentFinancialSummary($booking);
        $balanceDue = (float) ($summary['balance_due'] ?? 0);
        $hasOutstandingBalance = $balanceDue > 0.0001;

        $hasPackageUsage = CustomerServicePackageUsage::query()
            ->where('booking_id', (int) $booking->id)
            ->whereIn('status', ['reserved', 'consumed'])
            ->exists();

        DB::transaction(function () use ($booking, $hasOutstandingBalance, $hasPackageUsage) {
            $booking->status = 'COMPLETED';
            $booking->completed_at = now();
            // Allow "completed but unpaid" so staff can settle later in POS checkout.
            // When there is no outstanding balance, mark as PAID immediately.
            $booking->payment_status = $hasOutstandingBalance ? 'UNPAID' : 'PAID';
            $booking->save();

            // Only consume existing reserved claims. Do NOT auto-attach claims here;
            // otherwise, a normal unpaid completion could incorrectly offset the service with a package.
            if ($hasPackageUsage) {
                $this->customerServicePackageService->consumeReservedClaimsForBooking((int) $booking->id);
            }
        });

        $this->staffCommissionService->syncBookingCommissionState($booking->fresh(['service']));

        return $this->respond([
            'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
        ], __('Appointment marked as completed.'));
    }

    public function updateAppointmentStatus(Request $request, int $id)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:COMPLETED,CANCELLED,LATE_CANCELLATION,NO_SHOW,NOTIFIED_CANCELLATION'],
        ]);

        $booking = Booking::query()->with(['customer', 'service', 'staff'])->findOrFail($id);
        $targetStatus = (string) $validated['status'];
        if ((string) $booking->status !== 'CONFIRMED') {
            return $this->respondError(__('Only CONFIRMED appointment can be updated from POS settlement.'), 422);
        }

        if ($targetStatus === 'COMPLETED') {
            return $this->markAppointmentCompleted($id);
        }

        DB::transaction(function () use ($booking, $targetStatus) {
            $booking->status = $targetStatus;
            if (in_array($targetStatus, ['CANCELLED', 'LATE_CANCELLATION', 'NOTIFIED_CANCELLATION'], true)) {
                $booking->cancelled_at = now();
                $booking->cancellation_type = in_array($targetStatus, ['CANCELLED', 'LATE_CANCELLATION'], true) ? $targetStatus : 'CANCELLED';
            }
            $booking->save();

            if (in_array($targetStatus, ['CANCELLED', 'LATE_CANCELLATION', 'NO_SHOW', 'NOTIFIED_CANCELLATION'], true)) {
                $this->customerServicePackageService->releaseReservedClaimsForBooking((int) $booking->id);
            }
        });

        return $this->respond([
            'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
        ], __('Appointment status updated.'));
    }

    public function approveHoldAppointment(Request $request, int $id)
    {
        $validated = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $booking = Booking::query()->with(['customer', 'service', 'staff'])->findOrFail($id);
        if ((string) $booking->status !== 'HOLD') {
            return $this->respondError(__('Only HOLD appointments can be approved here.'), 422);
        }

        $confirmedBookingIds = [];

        try {
            DB::transaction(function () use ($booking, $validated, $request, &$confirmedBookingIds) {
                $holdOrder = $this->resolveHoldDepositOrder($booking);

                if ($holdOrder) {
                    $lockedOrder = Order::query()->lockForUpdate()->findOrFail($holdOrder->id);
                    if ((string) $lockedOrder->payment_status !== 'paid') {
                        $lockedOrder->payment_status = 'paid';
                        $lockedOrder->status = 'completed';
                        $lockedOrder->paid_at = Carbon::now();
                        if (! empty($validated['admin_note'])) {
                            $lockedOrder->admin_note = trim(($lockedOrder->admin_note ?? '') . "\n" . $validated['admin_note']);
                        }
                        $lockedOrder->save();
                        $this->orderPaymentService->handlePaid($lockedOrder);
                    }

                    $confirmedBookingIds = $this->confirmHoldOrderBookings($lockedOrder);
                } elseif ((float) ($booking->deposit_amount ?? 0) <= 0.0001) {
                    $lockedBooking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
                    $lockedBooking->status = 'CONFIRMED';
                    $lockedBooking->hold_expires_at = null;
                    $lockedBooking->save();
                    $confirmedBookingIds = [(int) $lockedBooking->id];

                    BookingLog::create([
                        'booking_id' => (int) $lockedBooking->id,
                        'actor_type' => 'STAFF',
                        'actor_id' => optional($request->user())->id,
                        'action' => 'HOLD_APPROVED',
                        'meta' => [
                            'source' => 'pos_hold_approve',
                            'admin_note' => $validated['admin_note'] ?? null,
                        ],
                        'created_at' => now(),
                    ]);
                } else {
                    throw new \RuntimeException(__('No pending deposit order found. Customer may still need to pay or upload payment proof.'));
                }
            });
        } catch (\RuntimeException $exception) {
            return $this->respondError(__($exception->getMessage()), 422);
        }

        $this->dispatchBookingConfirmationEmails($confirmedBookingIds);

        return $this->respond([
            'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
        ], __('Booking approved and confirmed.'));
    }

    public function cancelHoldAppointment(Request $request, int $id)
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $reason = trim((string) ($validated['reason'] ?? '')) ?: 'Cancelled from POS';

        $booking = Booking::query()->findOrFail($id);
        if ((string) $booking->status !== 'HOLD') {
            return $this->respondError(__('Only HOLD appointments can be cancelled here.'), 422);
        }

        try {
            DB::transaction(function () use ($booking, $request, $reason) {
                $holdOrder = $this->resolveHoldDepositOrder($booking);

                if ($holdOrder) {
                    $lockedOrder = Order::query()->lockForUpdate()->findOrFail($holdOrder->id);
                    if ((string) $lockedOrder->payment_status === 'paid') {
                        throw new \RuntimeException(__('Deposit order is already paid.'));
                    }
                    if (! in_array((string) $lockedOrder->status, ['pending', 'processing'], true)) {
                        throw new \RuntimeException(__('Deposit order cannot be cancelled in current status.'));
                    }

                    $lockedOrder->status = 'cancelled';
                    $lockedOrder->admin_note = trim(($lockedOrder->admin_note ?? '') . "\n" . $reason);
                    $lockedOrder->save();

                    $this->cancelHoldLinkedBookings($lockedOrder, $request, $reason);
                } else {
                    $lockedBooking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
                    $this->bookingCancellationService->cancel(
                        $lockedBooking,
                        optional($request->user())->id,
                        $reason,
                        'ADMIN',
                        ['HOLD'],
                        ['source' => 'pos_hold_cancel'],
                    );
                }
            });
        } catch (\RuntimeException $exception) {
            return $this->respondError(__($exception->getMessage()), 422);
        }

        return $this->respond([
            'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
        ], __('Hold booking cancelled.'));
    }

    public function rejectHoldPaymentProof(Request $request, int $id)
    {
        $validated = $request->validate([
            'admin_note' => ['required', 'string', 'max:2000'],
        ]);

        $booking = Booking::query()->findOrFail($id);
        if ((string) $booking->status !== 'HOLD') {
            return $this->respondError(__('Only HOLD appointments can reject payment proof here.'), 422);
        }

        try {
            DB::transaction(function () use ($booking, $validated, $request) {
                $holdOrder = $this->resolveHoldDepositOrderForReview($booking);

                if ($holdOrder) {
                    $lockedOrder = Order::query()->lockForUpdate()->findOrFail($holdOrder->id);
                    if ((string) $lockedOrder->payment_status === 'paid') {
                        throw new \RuntimeException(__('Order already paid.'));
                    }
                    if ((string) $lockedOrder->status !== 'processing') {
                        throw new \RuntimeException(__('Payment proof can only be rejected while waiting for verification.'));
                    }

                    $lockedOrder->status = 'reject_payment_proof';
                    $lockedOrder->payment_proof_rejected_at = now();
                    $lockedOrder->admin_note = trim(($lockedOrder->admin_note ?? '') . "\n" . $validated['admin_note']);
                    $lockedOrder->save();

                    BookingLog::create([
                        'booking_id' => (int) $booking->id,
                        'actor_type' => 'STAFF',
                        'actor_id' => optional($request->user())->id,
                        'action' => 'PAYMENT_PROOF_REJECTED',
                        'meta' => [
                            'source' => 'pos_hold_reject_proof',
                            'order_id' => (int) $lockedOrder->id,
                            'order_no' => (string) $lockedOrder->order_number,
                            'admin_note' => $validated['admin_note'],
                        ],
                        'created_at' => now(),
                    ]);

                    return;
                }

                $payment = BookingPayment::query()
                    ->where('booking_id', (int) $booking->id)
                    ->latest('id')
                    ->first();

                $raw = $payment?->raw_response ?? [];
                if (! $payment || empty(data_get($raw, 'manual_slip_url'))) {
                    throw new \RuntimeException(__('No payment proof to reject.'));
                }

                $raw['manual_slip_path'] = null;
                $raw['manual_slip_url'] = null;
                $raw['payment_status'] = 'slip_rejected';
                $raw['slip_rejected_at'] = now()->toIso8601String();
                $raw['slip_reject_note'] = $validated['admin_note'];
                $payment->raw_response = $raw;
                $payment->save();

                BookingLog::create([
                    'booking_id' => (int) $booking->id,
                    'actor_type' => 'STAFF',
                    'actor_id' => optional($request->user())->id,
                    'action' => 'PAYMENT_PROOF_REJECTED',
                    'meta' => [
                        'source' => 'pos_hold_reject_proof',
                        'payment_id' => (int) $payment->id,
                        'admin_note' => $validated['admin_note'],
                    ],
                    'created_at' => now(),
                ]);
            });
        } catch (\RuntimeException $exception) {
            return $this->respondError(__($exception->getMessage()), 422);
        }

        return $this->respond([
            'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
        ], __('Payment proof rejected.'));
    }

    public function rescheduleAppointment(Request $request, int $id)
    {
        $validated = $request->validate([
            'start_at' => ['required', 'date'],
            'staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
            'reason' => ['nullable', 'string'],
            'availability_override' => ['nullable', 'boolean'],
            'availability_override_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $booking = Booking::query()->with(['service', 'customer', 'staff'])->findOrFail($id);
        if ((string) $booking->status !== 'CONFIRMED') {
            return $this->respondError(__('Only CONFIRMED appointment can be rescheduled from POS.'), 422);
        }

        if (! $booking->start_at || now()->greaterThanOrEqualTo($booking->start_at)) {
            return $this->respondError(__('Past bookings cannot be rescheduled.'), 422);
        }

        $targetStaffId = isset($validated['staff_id']) && $validated['staff_id']
            ? (int) $validated['staff_id']
            : (int) ($booking->staff_id ?? 0);
        if ($targetStaffId <= 0) {
            return $this->respondError(__('Assigned staff is required.'), 422);
        }
        $targetStaff = Staff::query()->findOrFail($targetStaffId);
        if (! (bool) ($targetStaff->is_active ?? true)) {
            return $this->respondError(__('Selected staff is inactive.'), 422, ['reason_code' => 'staff_inactive']);
        }

        $policy = SettingService::get('booking_policy', [
            'reschedule' => [
                'enabled' => true,
                'max_changes' => 1,
                'cutoff_hours' => 72,
            ],
        ], 'booking');
        $rescheduleEnabled = (bool) data_get($policy, 'reschedule.enabled', true);
        $maxChanges = (int) data_get($policy, 'reschedule.max_changes', 1);
        $cutoffHours = (int) data_get($policy, 'reschedule.cutoff_hours', 72);

        $policyWarnings = [];
        if (! $rescheduleEnabled) {
            $policyWarnings[] = 'Booking reschedule is disabled in normal customer policy. Admin/staff override is being used.';
        }
        if ($maxChanges >= 0 && (int) ($booking->reschedule_count ?? 0) >= $maxChanges) {
            $policyWarnings[] = "This booking already reached {$maxChanges} normal reschedule change(s). Admin/staff override is being used.";
        }
        if ($cutoffHours > 0 && $booking->start_at && now()->gt($booking->start_at->copy()->subHours($cutoffHours))) {
            $policyWarnings[] = 'This booking is within the normal reschedule cutoff window. Admin/staff override is being used.';
        }

        $newStart = Carbon::parse($validated['start_at']);
        $newEnd = $newStart->copy()->addMinutes($this->recalculateAppointmentDurationMin($booking));
        $scheduleDiagnostics = $this->availabilityService->getStaffAvailabilityDiagnostics($targetStaffId, $newStart, $newEnd);
        $scheduleFailureReason = (string) ($scheduleDiagnostics['failure_reason'] ?? '');
        if (! (bool) ($scheduleDiagnostics['is_available'] ?? false)
            && ! in_array($scheduleFailureReason, $this->posScheduleSoftFailureReasons(), true)) {
            return $this->respondPosScheduleFailure($scheduleFailureReason ?: 'staff_unavailable', Staff::query()->findOrFail($targetStaffId), $newStart, $newEnd, $scheduleDiagnostics);
        }

        $conflictDiagnostics = $this->availabilityService->getConflictDiagnostics($targetStaffId, $newStart, $newEnd, (int) $booking->buffer_min, (int) $booking->id, $booking);
        if ((bool) ($conflictDiagnostics['has_conflict'] ?? false)) {
            return $this->respondPosAvailabilityError($conflictDiagnostics);
        }

        $scheduleOverride = $this->resolvePosScheduleOverride($targetStaffId, $newStart, $newEnd, $scheduleDiagnostics, $request->user()?->id);

        $oldStart = $booking->start_at;
        $oldEnd = $booking->end_at;
        $oldStaffId = $booking->staff_id ? (int) $booking->staff_id : null;

        $booking->update([
            'staff_id' => $targetStaffId,
            'start_at' => $newStart,
            'end_at' => $newEnd,
            'reschedule_count' => (int) ($booking->reschedule_count ?? 0) + 1,
            'rescheduled_at' => now(),
            'rescheduled_from_booking_id' => $booking->rescheduled_from_booking_id ?: $booking->id,
            'reschedule_reason' => $validated['reason'] ?? null,
            ...$scheduleOverride,
        ]);
        $this->recordScheduleOverrideAudit($booking->fresh(), $scheduleOverride, $request);

        BookingLog::create([
            'booking_id' => $booking->id,
            'actor_type' => 'ADMIN',
            'actor_id' => optional($request->user())->id,
            'action' => 'RESCHEDULE_BOOKING',
            'meta' => [
                'source' => 'POS',
                'old_start_at' => $oldStart?->toDateTimeString(),
                'old_end_at' => $oldEnd?->toDateTimeString(),
                'new_start_at' => $newStart->toDateTimeString(),
                'new_end_at' => $newEnd->toDateTimeString(),
                'old_staff_id' => $oldStaffId,
                'new_staff_id' => $targetStaffId,
                'reason' => $validated['reason'] ?? null,
                'admin_override' => true,
                'actor_admin_id' => optional($request->user())->id,
                'actor_staff_id' => optional($request->user())->staff_id,
            ],
            'created_at' => now(),
        ]);

        $this->sendBookingRescheduledEmail($booking->fresh(['service', 'staff', 'customer']), $oldStart, $oldEnd);

        return $this->respond([
            'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
            'override_applied' => ! empty($policyWarnings),
            'policy_warnings' => $policyWarnings,
        ], __('Appointment rescheduled.'));
    }

    public function addByBarcode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'barcode' => ['nullable', 'string'],
            'qty' => ['nullable', 'integer', 'min:1'],
            'selected_option_ids' => ['nullable', 'array'],
            'selected_option_ids.*' => ['integer'],
        ]);

        if ($validator->fails()) {
            return $this->respondError($validator->errors()->first() ?: __('Invalid barcode request.'), 422);
        }

        $validated = $validator->validated();
        $barcode = trim((string) ($validated['barcode'] ?? ''));

        if ($barcode === '') {
            return $this->respondError(__('Barcode is required.'), 422);
        }

        $variant = $this->findSellableVariantByBarcode($barcode);

        $product = null;
        if (! $variant) {
            $product = $this->findSellableProductByBarcode($barcode);
        }

        Log::debug('POS addByBarcode resolve', [
            'barcode' => $barcode,
            'matched_type' => $variant ? 'variant' : ($product ? 'product' : 'none'),
            'matched_variant_id' => $variant?->id,
            'matched_product_id' => $product?->id,
        ]);

        if (! $variant && ! $product) {
            return $this->respondError(__('Barcode not found or not sellable.'), 404);
        }

        $qty = (int) ($validated['qty'] ?? 1);

        return $this->addResolvedToCart($request, $variant, $product, $qty, 'barcode');
    }

    protected function findSellableVariantByBarcode(string $barcode): ?ProductVariant
    {
        $normalized = mb_strtolower($barcode);

        return ProductVariant::query()
            ->with(['product', 'bundleItems.componentVariant'])
            ->where('is_active', true)
            ->whereHas('product', fn ($builder) => $builder->where('is_active', true)->where('is_reward_only', false))
            ->where(function ($query) use ($barcode, $normalized) {
                $query
                    ->where('barcode', $barcode)
                    ->orWhereRaw('LOWER(product_variants.barcode) = ?', [$normalized])
                    ->orWhere('sku', $barcode)
                    ->orWhereRaw('LOWER(product_variants.sku) = ?', [$normalized]);
            })
            ->orderByRaw('CASE WHEN product_variants.barcode = ? THEN 0 ELSE 1 END', [$barcode])
            ->orderByRaw('CASE WHEN LOWER(product_variants.barcode) = ? THEN 0 ELSE 1 END', [$normalized])
            ->orderByRaw('CASE WHEN product_variants.sku = ? THEN 0 ELSE 1 END', [$barcode])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->first();
    }

    protected function findSellableProductByBarcode(string $barcode): ?Product
    {
        $normalized = mb_strtolower($barcode);

        return Product::query()
            ->where('is_active', true)
            ->where('is_reward_only', false)
            ->where(function ($query) use ($barcode, $normalized) {
                $query
                    ->where('barcode', $barcode)
                    ->orWhereRaw('LOWER(products.barcode) = ?', [$normalized])
                    ->orWhere('sku', $barcode)
                    ->orWhereRaw('LOWER(products.sku) = ?', [$normalized]);
            })
            ->orderByRaw('CASE WHEN products.barcode = ? THEN 0 ELSE 1 END', [$barcode])
            ->orderByRaw('CASE WHEN LOWER(products.barcode) = ? THEN 0 ELSE 1 END', [$normalized])
            ->orderByRaw('CASE WHEN products.sku = ? THEN 0 ELSE 1 END', [$barcode])
            ->orderBy('id')
            ->first();
    }

    public function addByVariant(Request $request)
    {
        $validated = $request->validate([
            'variant_id' => ['nullable', 'integer', 'exists:product_variants,id', 'required_without:product_id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id', 'required_without:variant_id'],
            'qty' => ['nullable', 'integer', 'min:1'],
            'selected_option_ids' => ['nullable', 'array'],
            'selected_option_ids.*' => ['integer'],
        ]);

        $qty = (int) ($validated['qty'] ?? 1);

        $variant = null;
        $product = null;

        if (! empty($validated['variant_id'])) {
            $variant = ProductVariant::query()
                ->with(['product', 'bundleItems.componentVariant'])
                ->where('id', (int) $validated['variant_id'])
                ->where('is_active', true)
                ->first();

            if (! $variant) {
                return $this->respondError(__('Product is not sellable.'), 404);
            }
        } elseif (! empty($validated['product_id'])) {
            $product = Product::query()
                ->where('id', (int) $validated['product_id'])
                ->where('is_active', true)
                ->where('is_reward_only', false)
                ->first();

            if (! $product) {
                return $this->respondError(__('Product is not sellable.'), 404);
            }
        }

        Log::debug('POS addByVariant resolve', [
            'input_variant_id' => $validated['variant_id'] ?? null,
            'input_product_id' => $validated['product_id'] ?? null,
            'matched_type' => $variant ? 'variant' : ($product ? 'product' : 'none'),
            'matched_variant_id' => $variant?->id,
            'matched_product_id' => $product?->id,
        ]);

        return $this->addResolvedToCart($request, $variant, $product, $qty, 'manual');
    }

    public function addBookingProduct(Request $request)
    {
        $validated = $request->validate([
            'booking_product_id' => ['required', 'integer', 'exists:booking_products,id'],
            'qty' => ['nullable', 'integer', 'min:1'],
            'selected_option_ids' => ['nullable', 'array'],
            'selected_option_ids.*' => ['integer'],
            'actual_selling_price' => ['nullable', 'numeric', 'min:0'],
        ]);
        $qty = (int) ($validated['qty'] ?? 1);
        $hasItemType = Schema::hasColumn('pos_cart_items', 'item_type');
        $hasBookingProductId = Schema::hasColumn('pos_cart_items', 'booking_product_id');
        if (! $hasItemType || ! $hasBookingProductId) {
            return $this->respondError(__('POS booking product fields are not ready. Please run latest migrations.'), 422);
        }
        $bookingProduct = BookingProduct::query()->where('is_active', true)->with(['activeQuestions.options' => fn ($q) => $q->where('is_active', true)])->findOrFail((int) $validated['booking_product_id']);
        $selectedOptionIds = collect($validated['selected_option_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->unique()->values();
        $activeQuestions = $bookingProduct->activeQuestions;
        $optionsById = $activeQuestions->flatMap(fn ($question) => $question->options)->keyBy('id');
        $invalidIds = $selectedOptionIds->filter(fn ($id) => ! $optionsById->has($id))->values();
        if ($invalidIds->isNotEmpty()) {
            return $this->respondError(__('Invalid booking product options selected.'), 422);
        }
        foreach ($activeQuestions as $question) {
            if (! $question->is_required) {
                continue;
            }
            $hasAnswer = $question->options->contains(fn ($option) => $selectedOptionIds->contains((int) $option->id));
            if (! $hasAnswer) {
                return $this->respondError(__('Required booking product options were not selected.'), 422);
            }
        }
        $selectedSnapshots = $activeQuestions->map(function ($question) use ($selectedOptionIds) {
            $selectedOptions = $question->options->filter(fn ($option) => $selectedOptionIds->contains((int) $option->id))->values();
            if ($selectedOptions->isEmpty()) {
                return null;
            }
            return [
                'question_id' => (int) $question->id,
                'title' => $question->title,
                'cn_title' => $question->cn_title,
                'question_type' => $question->question_type,
                'options' => $selectedOptions->map(fn ($option) => [
                    'id' => (int) $option->id,
                    'label' => $option->label,
                    'cn_label' => $option->cn_label,
                    'extra_price' => (float) $option->extra_price,
                ])->values()->all(),
            ];
        })->filter()->values();
        $selectedSnapshotRows = $selectedSnapshots->all();
        $extraPrice = (float) $selectedSnapshots->flatMap(fn ($q) => $q['options'])->sum('extra_price');
        $basePrice = (float) $bookingProduct->price;
        // Range validation applies only to the booking product base price.
        // Selected option extra prices are added after this check and may make the final unit price exceed the range maximum.
        if (($bookingProduct->price_mode ?? 'fixed') === 'range') {
            if (! array_key_exists('actual_selling_price', $validated) || $validated['actual_selling_price'] === null || $validated['actual_selling_price'] === '') {
                return $this->respondError(__('Product base price is required for range booking products.'), 422);
            }
            $basePrice = round((float) $validated['actual_selling_price'], 2);
            if ($basePrice < 0) {
                return $this->respondError(__('Product base price must be zero or greater.'), 422);
            }
        }
        $unitPriceSnapshot = round($basePrice + $extraPrice, 2);
        $targetSignature = $this->bookingProductOptionConfigurationSignature($selectedSnapshotRows);
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = PosCartItem::query()
            ->where('pos_cart_id', $cart->id)
            ->where('item_type', 'booking_product')
            ->where('booking_product_id', (int) $bookingProduct->id)
            ->whereNull('variant_id')
            ->whereNull('product_id')
            ->where('price_snapshot', $unitPriceSnapshot)
            ->get()
            ->first(function (PosCartItem $candidate) use ($targetSignature) {
                return ! $this->bookingProductCartItemHasDiscountState($candidate)
                    && $this->bookingProductOptionConfigurationSignature($candidate->selected_booking_product_options ?? []) === $targetSignature;
            });

        if (! $item) {
            $item = new PosCartItem([
                'pos_cart_id' => $cart->id,
                'item_type' => 'booking_product',
                'booking_product_id' => (int) $bookingProduct->id,
                'variant_id' => null,
                'product_id' => null,
            ]);
        }

        $item->qty = (int) ($item->exists ? $item->qty : 0) + $qty;
        $item->price_snapshot = $unitPriceSnapshot;
        $item->selected_booking_product_options = $selectedSnapshotRows;
        $item->item_type = 'booking_product';
        $item->booking_product_id = (int) $bookingProduct->id;
        $item->variant_id = null;
        $item->product_id = null;
        $item->save();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'items.bookingProduct.categories', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    protected function bookingProductOptionConfigurationSignature(array $selectedOptionsSnapshot): string
    {
        $rows = collect($selectedOptionsSnapshot)
            ->map(function ($question) {
                if (! is_array($question)) {
                    return null;
                }

                $questionId = (int) ($question['question_id'] ?? 0);

                $options = collect($question['options'] ?? [])
                    ->filter(fn ($option) => is_array($option) && (int) ($option['id'] ?? 0) > 0)
                    ->map(fn ($option) => [
                        'id' => (int) ($option['id'] ?? 0),
                        'extra_price' => round((float) ($option['extra_price'] ?? 0), 2),
                    ])
                    ->sortBy(fn (array $option) => sprintf('%010d:%012.2f', $option['id'], $option['extra_price']))
                    ->values()
                    ->all();

                if (empty($options)) {
                    return null;
                }

                return [
                    'question_id' => $questionId,
                    'options' => $options,
                ];
            })
            ->filter()
            ->sortBy('question_id')
            ->values()
            ->all();

        return json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION) ?: '[]';
    }

    protected function bookingProductCartItemHasDiscountState(PosCartItem $item): bool
    {
        if (! empty($item->discount_type) || (float) ($item->discount_value ?? 0) > 0 || (float) ($item->discount_amount ?? 0) > 0) {
            return true;
        }

        foreach (($item->selected_booking_product_options ?? []) as $question) {
            foreach ((array) ($question['options'] ?? []) as $option) {
                if (! is_array($option)) {
                    continue;
                }

                if (
                    ! empty($option['discount_type'])
                    || (float) ($option['discount_value'] ?? 0) > 0
                    || (float) ($option['discount_amount'] ?? 0) > 0
                ) {
                    return true;
                }
            }
        }

        return false;
    }


    protected function appointmentRowBlocksActiveSchedule(array $row, bool $unpaidOnly = false): bool
    {
        $status = strtoupper((string) ($row['status'] ?? ''));
        if (in_array($status, ['CANCELLED', 'NO_SHOW', 'LATE_CANCELLATION', 'NOTIFIED_CANCELLATION', 'EXPIRED', 'VOIDED'], true)) {
            return false;
        }

        if ($status !== 'COMPLETED') {
            return in_array($status, ['HOLD', 'CONFIRMED', 'PENDING'], true);
        }

        if ($unpaidOnly) {
            return $this->appointmentCompletedRowNeedsSettlement($row);
        }

        return true;
    }

    protected function appointmentCompletedRowNeedsSettlement(array $row): bool
    {
        $amountDueNow = (float) ($row['amount_due_now'] ?? 0);
        $balanceDue = (float) ($row['balance_due'] ?? 0);
        $settlementPaid = (float) ($row['settlement_paid'] ?? 0);
        $paymentStatus = strtoupper((string) ($row['payment_status'] ?? ''));
        $packageStatus = strtolower((string) data_get($row, 'package_status.status', ''));

        if ($amountDueNow > 0.0001 || $balanceDue > 0.0001) {
            return true;
        }

        if ($packageStatus === 'reserved' && $settlementPaid <= 0.0001) {
            return true;
        }

        return $paymentStatus !== 'PAID';
    }

    public function availabilityCheck(Request $request)
    {
        $validated = $request->validate([
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date'],
            'buffer_min' => ['nullable', 'integer', 'min:0'],
            'ignore_booking_id' => ['nullable', 'integer', 'exists:bookings,id'],
        ]);

        $staff = Staff::query()->findOrFail((int) $validated['staff_id']);
        if (! (bool) ($staff->is_active ?? true)) {
            return $this->respond([
                'is_available' => false,
                'is_hard_block' => true,
                'is_outside_staff_schedule' => false,
                'reason_code' => 'staff_inactive',
            ]);
        }

        $startAt = Carbon::parse((string) $validated['start_at']);
        $endAt = Carbon::parse((string) $validated['end_at']);
        $bufferMin = (int) ($validated['buffer_min'] ?? 0);
        $ignoreBooking = null;
        if (! empty($validated['ignore_booking_id'])) {
            $ignoreBooking = Booking::query()->find((int) $validated['ignore_booking_id']);
        }

        $scheduleDiagnostics = $this->availabilityService->getStaffAvailabilityDiagnostics((int) $staff->id, $startAt, $endAt);
        $conflictDiagnostics = $this->availabilityService->getConflictDiagnostics((int) $staff->id, $startAt, $endAt, $bufferMin, $ignoreBooking?->id, $ignoreBooking);
        $conflictPayload = array_merge($conflictDiagnostics, [
            'staff_id' => (int) $staff->id,
            'staff_schedule' => $scheduleDiagnostics,
        ]);
        $reasonCode = null;
        if ((bool) ($conflictDiagnostics['has_conflict'] ?? false)) {
            $reasonCode = $this->posAvailabilityReasonCode($conflictPayload);
        } elseif (! (bool) ($scheduleDiagnostics['is_available'] ?? false)) {
            $reasonCode = (string) ($scheduleDiagnostics['failure_reason'] ?? 'staff_unavailable');
        }

        $isScheduleOverrideAllowed = $this->isPosScheduleOverrideReason($reasonCode);
        $isHardBlock = $reasonCode !== null && ! $isScheduleOverrideAllowed;
        $userMessage = $reasonCode !== null && $isHardBlock
            ? $this->formatPosUserFacingAvailabilityMessage($conflictPayload, $staff, $reasonCode)
            : null;

        return $this->respond([
            'is_available' => $reasonCode === null || $isScheduleOverrideAllowed,
            'is_hard_block' => $isHardBlock,
            'is_outside_staff_schedule' => $isScheduleOverrideAllowed,
            'reason_code' => $reasonCode,
            'message' => $userMessage,
            'staff_schedule' => $scheduleDiagnostics,
            'conflict_debug' => $conflictDiagnostics,
        ]);
    }

    /**
     * POS pooled availability: pick time first (no staff_id required).
     * This is a POS-only endpoint so we can iterate UI safely without impacting public booking flows.
     */
    public function availabilityPooled(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'extra_duration_min' => ['nullable', 'integer', 'min:0'],
        ]);

        if ($validator->fails()) {
            return $this->respondError(__('Invalid availability request.'), 422, [
                'date' => (string) $request->input('date', ''),
                'service_id' => (int) $request->input('service_id', 0),
                'duration_min' => null,
                'buffer_min' => null,
                'slot_step_min' => 15,
                'visible_slots' => [],
                'errors' => $validator->errors(),
            ]);
        }

        $validated = $validator->validated();
        $service = BookingService::query()->with(['allowedStaffs:id', 'primarySlots'])->findOrFail((int) $validated['service_id']);
        $extraDurationMin = (int) ($validated['extra_duration_min'] ?? 0);

        $staffIds = $service->allowedStaffs->pluck('id')->map(fn ($id) => (int) $id)->unique()->values()->all();
        $configuredPrimarySlots = $service->primarySlots
            ->where('is_active', true)
            ->sortBy('sort_order')
            ->values()
            ->map(fn ($slot) => substr((string) $slot->start_time, 0, 5))
            ->filter()
            ->values()
            ->all();

        if ($staffIds === []) {
            return $this->respond([
                'date' => (string) $validated['date'],
                'service_id' => (int) $validated['service_id'],
                'staff_id' => null,
                'duration_min' => (int) $service->duration_min + $extraDurationMin,
                'buffer_min' => (int) $service->buffer_min,
                'slot_step_min' => 15,
                'has_primary_slot_policy' => ! empty($configuredPrimarySlots),
                'configured_primary_slots' => $configuredPrimarySlots,
                'visible_slots' => [],
                'slots' => [],
            ]);
        }

        $mergedByStart = [];
        foreach ($staffIds as $staffId) {
            // POS should ignore primary slot display policy; show all available times.
            $slots = $this->availabilityService->getAvailableSlots($service, $staffId, (string) $validated['date'], 15, $extraDurationMin, false);
            foreach ($slots as $slot) {
                $key = $slot['start_at'] ?? null;
                if (! $key) continue;
                if (! isset($mergedByStart[$key])) {
                    $mergedByStart[$key] = $slot;
                    $mergedByStart[$key]['available_staff_ids'] = [];
                }
                $mergedByStart[$key]['available_staff_ids'][] = (int) $staffId;
            }
        }

        $durationMin = max(1, (int) $service->duration_min + $extraDurationMin);
        $lastStartMinute = max(0, (24 * 60) - $durationMin);
        $timezone = (string) config('app.timezone', 'Asia/Kuala_Lumpur');
        $visible = [];
        for ($minute = 0; $minute <= $lastStartMinute; $minute += 15) {
            $startAt = Carbon::parse(sprintf('%s %02d:%02d:00', (string) $validated['date'], intdiv($minute, 60), $minute % 60), $timezone);
            $endAt = $startAt->copy()->addMinutes($durationMin);
            $key = $startAt->format('Y-m-d\TH:i:s');
            $scheduledStaffIds = [];
            $unavailableStaffReasons = [];
            foreach ($staffIds as $staffId) {
                $staffId = (int) $staffId;
                $diagnostics = $this->availabilityService->getStaffAvailabilityDiagnostics($staffId, $startAt, $endAt);
                if ((bool) ($diagnostics['is_available'] ?? false)) {
                    $scheduledStaffIds[] = $staffId;
                } else {
                    $scheduleFailure = (string) ($diagnostics['failure_reason'] ?? 'staff_unavailable');
                    $unavailableStaffReasons[(string) $staffId] = $scheduleFailure;
                }

                $conflictDiagnostics = $this->availabilityService->getConflictDiagnostics($staffId, $startAt, $endAt, (int) $service->buffer_min);
                if ((bool) ($conflictDiagnostics['has_conflict'] ?? false)) {
                    $unavailableStaffReasons[(string) $staffId] = $this->posAvailabilityReasonCode(array_merge($conflictDiagnostics, [
                        'staff_schedule' => $diagnostics,
                    ]));
                }
            }

            $visible[] = [
                'start_at' => $key,
                'end_at' => $endAt->format('Y-m-d\TH:i:s'),
                'available_staff_ids' => array_values(array_unique($mergedByStart[$key]['available_staff_ids'] ?? [])),
                'scheduled_staff_ids' => array_values(array_unique($scheduledStaffIds)),
                'unavailable_staff_reasons' => $unavailableStaffReasons,
            ];
        }

        return $this->respond([
            'date' => (string) $validated['date'],
            'service_id' => (int) $validated['service_id'],
            'staff_id' => null,
            'duration_min' => (int) $service->duration_min + $extraDurationMin,
            'buffer_min' => (int) $service->buffer_min,
            'slot_step_min' => 15,
            'has_primary_slot_policy' => ! empty($configuredPrimarySlots),
            'configured_primary_slots' => $configuredPrimarySlots,
            'visible_slots' => $visible,
            'slots' => $visible,
        ]);
    }

    public function addService(Request $request)
    {
        $validated = $request->validate([
            'booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'guest_name' => ['nullable', 'string', 'max:255'],
            'guest_phone' => ['nullable', 'string', 'max:32'],
            'guest_email' => ['nullable', 'string', 'email', 'max:255'],
            'start_at' => ['required', 'date'],
            'assigned_staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'selected_option_ids' => ['nullable', 'array'],
            'selected_option_ids.*' => ['integer', 'exists:booking_service_question_options,id'],
            'main_service_items' => ['nullable', 'array', 'min:1'],
            'main_service_items.*.booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'main_service_items.*.selected_option_ids' => ['nullable', 'array'],
            'main_service_items.*.selected_option_ids.*' => ['integer', 'exists:booking_service_question_options,id'],
            'main_service_items.*.staff_splits' => ['nullable', 'array'],
            'main_service_items.*.staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'main_service_items.*.staff_splits.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'main_service_items.*.addon_staff_splits' => ['nullable', 'array'],
            'main_service_items.*.addon_staff_splits.*' => ['array'],
            'main_service_items.*.addon_staff_splits.*.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'main_service_items.*.addon_staff_splits.*.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'qty' => ['nullable', 'integer', 'min:1'],
            'selected_option_ids' => ['nullable', 'array'],
            'selected_option_ids.*' => ['integer'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'staff_splits' => ['nullable', 'array'],
            'staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'staff_splits.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'addon_staff_splits' => ['nullable', 'array'],
            'addon_staff_splits.*' => ['array'],
            'addon_staff_splits.*.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'addon_staff_splits.*.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'deposit_payments' => ['nullable', 'array'],
            'deposit_payments.*.method' => ['required_with:deposit_payments', 'string', 'in:cash,qrpay,credit_card,billplz_credit_card'],
            'deposit_payments.*.amount' => ['required_with:deposit_payments', 'numeric', 'gt:0'],
            'availability_override' => ['nullable', 'boolean'],
            'availability_override_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $mainServicePayload = collect($validated['main_service_items'] ?? [])->map(fn (array $item) => [
            'booking_service_id' => (int) ($item['booking_service_id'] ?? 0),
            'selected_option_ids' => collect($item['selected_option_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->unique()->values()->all(),
            'staff_splits' => collect($item['staff_splits'] ?? [])->values()->all(),
            'addon_staff_splits' => collect($item['addon_staff_splits'] ?? [])->mapWithKeys(fn ($splits, $id) => [(int) $id => collect($splits)->values()->all()])->all(),
        ])->filter(fn (array $item) => $item['booking_service_id'] > 0)->values();
        if ($mainServicePayload->isEmpty()) {
            $mainServicePayload = collect([[
                'booking_service_id' => (int) $validated['booking_service_id'],
                'selected_option_ids' => collect($validated['selected_option_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->unique()->values()->all(),
                'staff_splits' => collect($validated['staff_splits'] ?? [])->values()->all(),
                'addon_staff_splits' => collect($validated['addon_staff_splits'] ?? [])->mapWithKeys(fn ($splits, $id) => [(int) $id => collect($splits)->values()->all()])->all(),
            ]]);
        }
        if ($mainServicePayload->count() !== $mainServicePayload->pluck('booking_service_id')->unique()->count()) {
            return $this->respondError(__('Duplicate main services are not allowed in the same booking.'), 422);
        }

        $serviceIds = $mainServicePayload->pluck('booking_service_id')->unique()->values();
        $servicesById = BookingService::query()->with('allowedStaffs:id')->where('is_active', true)->whereIn('id', $serviceIds->all())->get()->keyBy('id');
        $service = $servicesById->get((int) $mainServicePayload[0]['booking_service_id']);
        if (! $service) {
            return $this->respondError(__('Main service is unavailable.'), 422);
        }

        $customer = null;
        $guestName = null;
        $guestPhone = null;
        $guestEmail = null;

        if (! empty($validated['customer_id'])) {
            $customer = Customer::query()->findOrFail((int) $validated['customer_id']);
        } else {
            $guestName = trim((string) ($validated['guest_name'] ?? ''));
            $guestPhone = trim((string) ($validated['guest_phone'] ?? ''));
            $guestEmail = trim((string) ($validated['guest_email'] ?? ''));

            if ($guestName === '' && $guestPhone === '' && $guestEmail === '') {
                $guestName = 'UNKNOWN';
            }

            if ($guestPhone !== '' && ! preg_match('/^\+?[0-9]{8,15}$/', $guestPhone)) {
                return $this->respondError(__('Please enter a valid guest phone number (8-15 digits, optional + prefix).'), 422);
            }

            $guestEmail = $guestEmail !== '' ? Str::lower($guestEmail) : null;
            $guestPhone = $guestPhone !== '' ? $guestPhone : null;
        }
        $staff = Staff::query()->findOrFail((int) $validated['assigned_staff_id']);

        if (! (bool) ($staff->is_active ?? true)) {
            return $this->respondError(__('Selected staff is inactive.'), 422, ['reason_code' => 'staff_inactive']);
        }

        if (! $service->isStaffAllowed((int) $staff->id)) {
            return $this->respondError(__('Selected staff is not allowed for this service.'), 422);
        }
        $qty = max(1, (int) ($validated['qty'] ?? 1));

        $startAt = Carbon::parse((string) $validated['start_at']);

        $mainItems = $mainServicePayload->map(function (array $item) use ($servicesById) {
            $service = $servicesById->get((int) $item['booking_service_id']);
            if (! $service) {
                throw ValidationException::withMessages([
                    'main_service_items' => __('Main service is unavailable.'),
                ]);
            }

            $itemStaffSplits = collect($item['staff_splits'] ?? [])->values()->all();
            $addonStaffSplits = (array) ($item['addon_staff_splits'] ?? []);
            $selectedOptionIds = collect($item['selected_option_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->unique()->values();
            $serviceQuestions = $service->questions()
                ->where('is_active', true)
                ->with(['options' => fn ($query) => $query->where('is_active', true)])
                ->get();

            $selectedOptions = BookingServiceQuestionOption::query()
                ->whereIn('id', $selectedOptionIds->all())
                ->whereIn('booking_service_question_id', $serviceQuestions->pluck('id')->all())
                ->with('linkedBookingService:id,name,cn_name,duration_min,service_price,service_type,deposit_amount')
                ->get();

            foreach ($serviceQuestions as $question) {
                $selectedForQuestion = $selectedOptions->where('booking_service_question_id', $question->id)->values();
                if ((bool) $question->is_required && $selectedForQuestion->isEmpty()) {
                    throw ValidationException::withMessages([
                        'main_service_items' => __('Please complete required booking questions.'),
                    ]);
                }
                if ((string) $question->question_type === 'single_choice' && $selectedForQuestion->count() > 1) {
                    throw ValidationException::withMessages([
                        'main_service_items' => __('Single choice question allows only one option.'),
                    ]);
                }
            }

            $addonDurationMin = (int) $selectedOptions->sum(function (BookingServiceQuestionOption $option): int {
                return $option->linkedBookingService
                    ? max(0, (int) ($option->linkedBookingService->duration_min ?? 0))
                    : max(0, (int) ($option->extra_duration_min ?? 0));
            });
            $addonPrice = round((float) $selectedOptions->sum(function (BookingServiceQuestionOption $option): float {
                return $option->linkedBookingService
                    ? max(0, (float) ($option->linkedBookingService->service_price ?? 0))
                    : max(0, (float) ($option->extra_price ?? 0));
            }), 2);
            $addonItems = $selectedOptions->map(fn (BookingServiceQuestionOption $option) => [
                'id' => (int) $option->id,
                'name' => (string) ($option->label ?: $option->linkedBookingService?->name ?: 'Add-on'),
                'cn_name' => trim((string) ($option->cn_label ?? '')) !== '' ? (string) $option->cn_label : $option->linkedBookingService?->cn_name,
                'extra_duration_min' => $option->linkedBookingService
                    ? max(0, (int) ($option->linkedBookingService->duration_min ?? 0))
                    : max(0, (int) ($option->extra_duration_min ?? 0)),
                'extra_price' => $option->linkedBookingService
                    ? round(max(0, (float) ($option->linkedBookingService->service_price ?? 0)), 2)
                    : round(max(0, (float) ($option->extra_price ?? 0)), 2),
                'linked_booking_service_id' => $option->linkedBookingService
                    ? (int) $option->linkedBookingService->id
                    : null,
                'linked_cn_name' => $option->linkedBookingService?->cn_name,
                'linked_service_type' => $option->linkedBookingService
                    ? (string) $option->linkedBookingService->service_type
                    : null,
                'linked_deposit_amount' => $option->linkedBookingService
                    ? round(max(0, (float) ($option->linkedBookingService->deposit_amount ?? 0)), 2)
                    : null,
                'staff_splits' => collect($addonStaffSplits[(int) $option->id] ?? [])->values()->all(),
            ])->values()->all();

            return [
                'service' => $service,
                'selected_option_ids' => $selectedOptionIds->all(),
                'addon_duration_min' => $addonDurationMin,
                'addon_price' => $addonPrice,
                'addon_items' => $addonItems,
                'staff_splits' => $itemStaffSplits,
                'duration_min' => max(0, (int) ($service->duration_min ?? 0)) + $addonDurationMin,
            ];
        })->values();

        $addonDurationMin = (int) $mainItems->sum('addon_duration_min');
        $addonPrice = round((float) $mainItems->sum('addon_price'), 2);
        $addonItems = $mainItems->flatMap(function (array $item, int $index) {
            $service = $item['service'];
            $main = [
                'item_kind' => 'main_service',
                'id' => 'main_service_' . ($index + 1),
                'name' => (string) ($service->name ?? 'Service'),
                'cn_name' => $service->cn_name ?? null,
                'extra_duration_min' => max(0, (int) ($service->duration_min ?? 0)),
                'extra_price' => round(max(0, (float) ($service->price ?? $service->service_price ?? 0)), 2),
                'linked_booking_service_id' => (int) $service->id,
                'is_original' => $index === 0,
                'addon_items' => $item['addon_items'],
                'staff_splits' => $item['staff_splits'] ?? [],
            ];
            return [$main, ...$item['addon_items']];
        })->values()->all();
        $selectedOptionIds = $mainItems->flatMap(fn (array $item) => $item['selected_option_ids'])->unique()->values();
        $totalDurationMin = (int) $mainItems->sum('duration_min');
        $endAt = $startAt->copy()->addMinutes($totalDurationMin);
        $bufferMin = (int) ($service->buffer_min ?? 0);

        $scheduleDiagnostics = $this->availabilityService->getStaffAvailabilityDiagnostics((int) $staff->id, $startAt, $endAt);
        $scheduleFailureReason = (string) ($scheduleDiagnostics['failure_reason'] ?? '');
        if (! (bool) ($scheduleDiagnostics['is_available'] ?? false)
            && ! $this->posScheduleFailureAllowsOverride($scheduleFailureReason, (bool) $request->boolean('availability_override'))) {
            return $this->respondPosScheduleFailure($scheduleFailureReason ?: 'staff_unavailable', $staff, $startAt, $endAt, $scheduleDiagnostics);
        }

        $conflictDiagnostics = $this->availabilityService->getConflictDiagnostics((int) $staff->id, $startAt, $endAt, $bufferMin);
        if ((bool) ($conflictDiagnostics['has_conflict'] ?? false)) {
            return $this->respondPosAvailabilityError($conflictDiagnostics);
        }


        $splits = collect($validated['staff_splits'] ?? [
            ['staff_id' => (int) $staff->id, 'share_percent' => 100],
        ])->values();

        $sum = (int) $splits->sum(fn (array $split) => (int) ($split['share_percent'] ?? 0));
        $uniqueCount = $splits->pluck('staff_id')->filter()->unique()->count();
        if ($sum !== 100 || $uniqueCount !== $splits->count()) {
            return $this->respondError(__('Invalid staff split. Total must be 100% and staffs must be unique.'), 422);
        }

        $staffIds = $splits->pluck('staff_id')->map(fn ($id) => (int) $id)->unique()->values();

        foreach ($staffIds as $splitStaffId) {
            if (! $service->isStaffAllowed((int) $splitStaffId)) {
                return $this->respondError(__('Selected staff split contains staff not allowed for this service.'), 422);
            }
        }
        $staffCommissionRates = DB::table('staffs')
            ->whereIn('id', $staffIds)
            ->pluck('service_commission_rate', 'id')
            ->map(fn ($rate) => (float) $rate)
            ->all();

        $normalizedSplits = $splits->map(fn (array $split) => [
            'staff_id' => (int) $split['staff_id'],
            'share_percent' => (int) $split['share_percent'],
            'service_commission_rate_snapshot' => (float) ($staffCommissionRates[(int) $split['staff_id']] ?? 0),
        ])->values()->all();
        $addonItems = collect($addonItems)
            ->map(function (array $item) use ($normalizedSplits): array {
                if (strtolower((string) ($item['item_kind'] ?? '')) === 'main_service') {
                    $item['staff_splits'] = collect($item['staff_splits'] ?? [])
                        ->filter(fn ($split) => is_array($split))
                        ->values()
                        ->all();
                    if (empty($item['staff_splits'])) {
                        $item['staff_splits'] = $normalizedSplits;
                    }
                }

                return $item;
            })
            ->values()
            ->all();

        $primaryStaffId = (int) ($normalizedSplits[0]['staff_id'] ?? $staff->id);
        $primaryCommissionRate = (float) ($staffCommissionRates[$primaryStaffId] ?? $staff->service_commission_rate ?? 0);

        $cart = $this->resolveCart((int) $request->user()->id);

        $item = PosCartServiceItem::query()->create([
            'pos_cart_id' => $cart->id,
            'booking_service_id' => $service->id,
            'customer_id' => $customer?->id,
            'guest_name' => $guestName,
            'guest_phone' => $guestPhone,
            'guest_email' => $guestEmail,
            'service_name_snapshot' => $service->name,
            'price_snapshot' => (float) ($service->price ?? $service->service_price ?? 0),
            'qty' => $qty,
            'assigned_staff_id' => $primaryStaffId,
            'start_at' => $startAt,
            'end_at' => $endAt,
            'addon_duration_min' => $addonDurationMin,
            'addon_price' => $addonPrice,
            'selected_option_ids' => $selectedOptionIds->all(),
            'addon_items_json' => $addonItems,
            'notes' => $validated['notes'] ?? null,
            'staff_splits' => $normalizedSplits,
            'commission_rate_used' => $primaryCommissionRate,
        ]);

        return $this->respond([
            'item' => $item->load(['bookingService:id,name,cn_name', 'assignedStaff:id,name']),
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ], __('Booking service added to POS cart.'));
    }

    /**
     * Apply the same member or guest snapshot to every booking line (and package lines for member) in the POS cart.
     */
    public function syncCustomerContext(Request $request)
    {
        $validated = $request->validate([
            'mode' => ['required', 'in:member,guest'],
            'member_id' => ['nullable', 'integer', 'exists:customers,id'],
            'guest_name' => ['nullable', 'string', 'max:255'],
            'guest_phone' => ['nullable', 'string', 'max:32'],
            'guest_email' => ['nullable', 'string', 'email', 'max:255'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id)
            ->load(['serviceItems', 'packageItems']);

        if ($cart->serviceItems->isEmpty() && $cart->packageItems->isEmpty()) {
            return $this->respond([
                'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
            ]);
        }

        if (($validated['mode'] ?? '') === 'guest') {
            if ($cart->packageItems->isNotEmpty()) {
                return $this->respondError(__('Guest checkout cannot be used when a service package is in the cart. Assign a member first.'), 422);
            }

            $guestName = trim((string) ($validated['guest_name'] ?? ''));
            $guestPhone = trim((string) ($validated['guest_phone'] ?? ''));
            $guestEmail = trim((string) ($validated['guest_email'] ?? ''));

            if ($guestName === '' && $guestPhone === '' && $guestEmail === '') {
                $guestName = 'UNKNOWN';
            }

            $isUnknownGuest = str_starts_with(strtoupper($guestName), 'UNKNOWN');

            if (! $isUnknownGuest && $guestName === '') {
                return $this->respondError(__('Guest name is required.'), 422);
            }

            if ($guestPhone !== '' && ! preg_match('/^\+?[0-9]{8,15}$/', $guestPhone)) {
                return $this->respondError(__('Please enter a valid guest phone number (8-15 digits, optional + prefix).'), 422);
            }

            $guestEmail = $guestEmail !== '' ? Str::lower($guestEmail) : null;
            $guestPhone = $guestPhone !== '' ? $guestPhone : null;

            foreach ($cart->serviceItems as $row) {
                $row->update([
                    'customer_id' => null,
                    'guest_name' => $guestName,
                    'guest_phone' => $guestPhone,
                    'guest_email' => $guestEmail,
                ]);
            }
        } else {
            $memberId = (int) ($validated['member_id'] ?? 0);
            if ($memberId <= 0) {
                return $this->respondError(__('member_id is required for member mode.'), 422);
            }

            Customer::query()->findOrFail($memberId);

            foreach ($cart->serviceItems as $row) {
                $row->update([
                    'customer_id' => $memberId,
                    'guest_name' => null,
                    'guest_phone' => null,
                    'guest_email' => null,
                ]);
            }

            foreach ($cart->packageItems as $row) {
                $row->update(['customer_id' => $memberId]);
            }
        }

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ], __('Cart customer context updated.'));
    }

    public function bookService(Request $request, BookingAvailabilityService $availabilityService)
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'assigned_staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'start_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $service = BookingService::query()->with('allowedStaffs:id')->where('is_active', true)->findOrFail((int) $validated['booking_service_id']);
        $customer = Customer::query()->findOrFail((int) $validated['customer_id']);
        $staff = Staff::query()->findOrFail((int) $validated['assigned_staff_id']);

        if (! $service->isStaffAllowed((int) $staff->id)) {
            return $this->respondError(__('Selected staff is not allowed for this service.'), 422);
        }

        $startAt = Carbon::parse((string) $validated['start_at']);
        $endAt = $startAt->copy()->addMinutes((int) $service->duration_min);

        if (! $availabilityService->isWithinStaffAvailability((int) $staff->id, $startAt, $endAt)
            || $availabilityService->hasConflict((int) $staff->id, $startAt, $endAt, (int) $service->buffer_min)) {
            return $this->respondError(__('Selected slot is no longer available.'), 409);
        }

        $booking = Booking::query()->create([
            'booking_code' => 'BK-' . now()->format('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
            'source' => 'STAFF',
            'customer_id' => $customer->id,
            'staff_id' => $staff->id,
            'service_id' => $service->id,
            'start_at' => $startAt,
            'end_at' => $endAt,
            'buffer_min' => (int) $service->buffer_min,
            'status' => 'CONFIRMED',
            'deposit_amount' => (float) ($service->deposit_amount ?? 0),
            'payment_status' => 'UNPAID',
            'created_by_staff_id' => (int) ($request->user()?->staff_id ?? 0) ?: null,
            'notes' => $validated['notes'] ?? null,
        ]);

        return $this->respond([
            'booking' => $booking->load(['service', 'staff', 'customer']),
        ], __('Booking created successfully.'));
    }

    /**
     * Directly create POS appointment, optionally collecting a deposit receipt/order.
     * Used by POS Appointments "Create Appointment" modal.
     */
    public function createAppointment(Request $request, OrderPaymentService $orderPaymentService)
    {
        $this->mergeJsonPayload($request);

        $validated = $request->validate([
            'booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'guest_name' => ['nullable', 'string', 'max:255'],
            'guest_phone' => ['nullable', 'string', 'max:32'],
            'guest_email' => ['nullable', 'string', 'email', 'max:255'],
            'start_at' => ['required', 'date'],
            'assigned_staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'selected_option_ids' => ['nullable', 'array'],
            'selected_option_ids.*' => ['integer', 'exists:booking_service_question_options,id'],
            'main_service_items' => ['nullable', 'array', 'min:1'],
            'main_service_items.*.booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'main_service_items.*.selected_option_ids' => ['nullable', 'array'],
            'main_service_items.*.selected_option_ids.*' => ['integer', 'exists:booking_service_question_options,id'],
            'main_service_items.*.staff_splits' => ['nullable', 'array'],
            'main_service_items.*.staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'main_service_items.*.staff_splits.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'main_service_items.*.addon_staff_splits' => ['nullable', 'array'],
            'main_service_items.*.addon_staff_splits.*' => ['array'],
            'main_service_items.*.addon_staff_splits.*.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'main_service_items.*.addon_staff_splits.*.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'staff_splits' => ['nullable', 'array'],
            'staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'staff_splits.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'deposit_payments' => ['nullable', 'array'],
            'deposit_payments.*.method' => ['required_with:deposit_payments', 'string', 'in:cash,qrpay,credit_card,billplz_credit_card'],
            'deposit_payments.*.amount' => ['required_with:deposit_payments', 'numeric', 'gt:0'],
            'deposit_qr_payment_proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
            'availability_override' => ['nullable', 'boolean'],
            'availability_override_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $mainServicePayload = collect($validated['main_service_items'] ?? [])->map(fn (array $item) => [
            'booking_service_id' => (int) ($item['booking_service_id'] ?? 0),
            'selected_option_ids' => collect($item['selected_option_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->unique()->values()->all(),
            'staff_splits' => collect($item['staff_splits'] ?? [])->values()->all(),
            'addon_staff_splits' => collect($item['addon_staff_splits'] ?? [])->mapWithKeys(fn ($splits, $id) => [(int) $id => collect($splits)->values()->all()])->all(),
        ])->filter(fn (array $item) => $item['booking_service_id'] > 0)->values();
        if ($mainServicePayload->isEmpty()) {
            $mainServicePayload = collect([[
                'booking_service_id' => (int) $validated['booking_service_id'],
                'selected_option_ids' => collect($validated['selected_option_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->unique()->values()->all(),
                'staff_splits' => collect($validated['staff_splits'] ?? [])->values()->all(),
                'addon_staff_splits' => collect($validated['addon_staff_splits'] ?? [])->mapWithKeys(fn ($splits, $id) => [(int) $id => collect($splits)->values()->all()])->all(),
            ]]);
        }
        if ($mainServicePayload->count() !== $mainServicePayload->pluck('booking_service_id')->unique()->count()) {
            return $this->respondError(__('Duplicate main services are not allowed in the same booking.'), 422);
        }

        $serviceIds = $mainServicePayload->pluck('booking_service_id')->unique()->values();
        $servicesById = BookingService::query()->with('allowedStaffs:id')->where('is_active', true)->whereIn('id', $serviceIds->all())->get()->keyBy('id');
        $service = $servicesById->get((int) $mainServicePayload[0]['booking_service_id']);
        if (! $service) {
            return $this->respondError(__('Main service is unavailable.'), 422);
        }

        $customer = null;
        $guestName = null;
        $guestPhone = null;
        $guestEmail = null;

        if (! empty($validated['customer_id'])) {
            $customer = Customer::query()->findOrFail((int) $validated['customer_id']);
        } else {
            $guestName = trim((string) ($validated['guest_name'] ?? ''));
            $guestPhone = trim((string) ($validated['guest_phone'] ?? ''));
            $guestEmail = trim((string) ($validated['guest_email'] ?? ''));

            if ($guestName === '' && $guestPhone === '' && $guestEmail === '') {
                $guestName = 'UNKNOWN';
            }

            if ($guestPhone !== '' && ! preg_match('/^\+?[0-9]{8,15}$/', $guestPhone)) {
                return $this->respondError(__('Please enter a valid guest phone number (8-15 digits, optional + prefix).'), 422);
            }

            $guestEmail = $guestEmail !== '' ? Str::lower($guestEmail) : null;
            $guestPhone = $guestPhone !== '' ? $guestPhone : null;
        }

        $staff = Staff::query()->findOrFail((int) $validated['assigned_staff_id']);
        if (! (bool) ($staff->is_active ?? true)) {
            return $this->respondError(__('Selected staff is inactive.'), 422, ['reason_code' => 'staff_inactive']);
        }

        if (! $service->isStaffAllowed((int) $staff->id)) {
            return $this->respondError(__('Selected staff is not allowed for this service.'), 422);
        }

        $mainItems = $mainServicePayload->map(function (array $item) use ($servicesById) {
            $service = $servicesById->get((int) $item['booking_service_id']);
            if (! $service) {
                throw ValidationException::withMessages([
                    'main_service_items' => __('Main service is unavailable.'),
                ]);
            }

            $itemStaffSplits = collect($item['staff_splits'] ?? [])->values()->all();
            $addonStaffSplits = (array) ($item['addon_staff_splits'] ?? []);
            $selectedOptionIds = collect($item['selected_option_ids'] ?? [])->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->unique()->values();

            $serviceQuestions = $service->questions()
                ->where('is_active', true)
                ->with(['options' => fn ($query) => $query->where('is_active', true)])
                ->get();

            $selectedOptions = BookingServiceQuestionOption::query()
                ->whereIn('id', $selectedOptionIds->all())
                ->whereIn('booking_service_question_id', $serviceQuestions->pluck('id')->all())
                ->with('linkedBookingService:id,name,cn_name,duration_min,service_price,service_type,deposit_amount')
                ->get();

            foreach ($serviceQuestions as $question) {
                $selectedForQuestion = $selectedOptions->where('booking_service_question_id', $question->id)->values();
                if ((bool) $question->is_required && $selectedForQuestion->isEmpty()) {
                    throw ValidationException::withMessages([
                        'main_service_items' => __('Please complete required booking questions.'),
                    ]);
                }
                if ((string) $question->question_type === 'single_choice' && $selectedForQuestion->count() > 1) {
                    throw ValidationException::withMessages([
                        'main_service_items' => __('Single choice question allows only one option.'),
                    ]);
                }
            }

            $addonDurationMin = (int) $selectedOptions->sum(function (BookingServiceQuestionOption $option): int {
                return $option->linkedBookingService
                    ? max(0, (int) ($option->linkedBookingService->duration_min ?? 0))
                    : max(0, (int) ($option->extra_duration_min ?? 0));
            });

            $addonPrice = round((float) $selectedOptions->sum(function (BookingServiceQuestionOption $option): float {
                return $option->linkedBookingService
                    ? max(0, (float) ($option->linkedBookingService->service_price ?? 0))
                    : max(0, (float) ($option->extra_price ?? 0));
            }), 2);

            $addonRows = $selectedOptions->map(fn (BookingServiceQuestionOption $option) => [
                'id' => (int) $option->id,
                'name' => (string) ($option->label ?: $option->linkedBookingService?->name ?: 'Add-on'),
                'cn_name' => trim((string) ($option->cn_label ?? '')) !== '' ? (string) $option->cn_label : $option->linkedBookingService?->cn_name,
                'extra_duration_min' => $option->linkedBookingService
                    ? max(0, (int) ($option->linkedBookingService->duration_min ?? 0))
                    : max(0, (int) ($option->extra_duration_min ?? 0)),
                'extra_price' => $option->linkedBookingService
                    ? round(max(0, (float) ($option->linkedBookingService->service_price ?? 0)), 2)
                    : round(max(0, (float) ($option->extra_price ?? 0)), 2),
                'linked_booking_service_id' => $option->linkedBookingService
                    ? (int) $option->linkedBookingService->id
                    : null,
                'linked_cn_name' => $option->linkedBookingService?->cn_name,
                'linked_service_type' => $option->linkedBookingService
                    ? (string) $option->linkedBookingService->service_type
                    : null,
                'linked_deposit_amount' => $option->linkedBookingService
                    ? round(max(0, (float) ($option->linkedBookingService->deposit_amount ?? 0)), 2)
                    : null,
                'staff_splits' => collect($addonStaffSplits[(int) $option->id] ?? [])->values()->all(),
            ])->values()->all();

            return [
                'service' => $service,
                'selected_option_ids' => $selectedOptionIds->all(),
                'addon_duration_min' => $addonDurationMin,
                'addon_price' => $addonPrice,
                'addon_items' => $addonRows,
                'staff_splits' => $itemStaffSplits,
                'duration_min' => max(0, (int) ($service->duration_min ?? 0)) + $addonDurationMin,
            ];
        })->values();

        $addonDurationMin = (int) $mainItems->sum('addon_duration_min');
        $addonPrice = round((float) $mainItems->sum('addon_price'), 2);
        $addonItems = $mainItems->flatMap(function (array $item, int $index) {
            $service = $item['service'];
            $main = [
                'item_kind' => 'main_service',
                'id' => 'main_service_' . ($index + 1),
                'name' => (string) ($service->name ?? 'Service'),
                'cn_name' => $service->cn_name ?? null,
                'extra_duration_min' => max(0, (int) ($service->duration_min ?? 0)),
                'extra_price' => round(max(0, (float) ($service->price ?? $service->service_price ?? 0)), 2),
                'linked_booking_service_id' => (int) $service->id,
                'is_original' => $index === 0,
                'addon_items' => $item['addon_items'],
                'staff_splits' => $item['staff_splits'] ?? [],
            ];
            return [$main, ...$item['addon_items']];
        })->values()->all();
        $selectedOptionIds = $mainItems->flatMap(fn (array $item) => $item['selected_option_ids'])->unique()->values();

        $startAt = Carbon::parse((string) $validated['start_at']);
        $totalDurationMin = (int) $mainItems->sum('duration_min');
        $endAt = $startAt->copy()->addMinutes($totalDurationMin);

        $bufferMin = (int) ($service->buffer_min ?? 0);

        $scheduleDiagnostics = $this->availabilityService->getStaffAvailabilityDiagnostics((int) $staff->id, $startAt, $endAt);
        $scheduleFailureReason = (string) ($scheduleDiagnostics['failure_reason'] ?? '');
        if (! (bool) ($scheduleDiagnostics['is_available'] ?? false)
            && ! $this->posScheduleFailureAllowsOverride($scheduleFailureReason, (bool) $request->boolean('availability_override'))) {
            return $this->respondPosScheduleFailure($scheduleFailureReason ?: 'staff_unavailable', $staff, $startAt, $endAt, $scheduleDiagnostics);
        }

        $conflictDiagnostics = $this->availabilityService->getConflictDiagnostics((int) $staff->id, $startAt, $endAt, $bufferMin);
        if ((bool) ($conflictDiagnostics['has_conflict'] ?? false)) {
            return $this->respondPosAvailabilityError($conflictDiagnostics);
        }

        $scheduleOverride = $this->resolvePosScheduleOverride((int) $staff->id, $startAt, $endAt, $scheduleDiagnostics, $request->user()?->id);

        $splits = collect($validated['staff_splits'] ?? [
            ['staff_id' => (int) $staff->id, 'share_percent' => 100],
        ])->values();

        $sum = (int) $splits->sum(fn (array $split) => (int) ($split['share_percent'] ?? 0));
        $uniqueCount = $splits->pluck('staff_id')->filter()->unique()->count();
        if ($sum !== 100 || $uniqueCount !== $splits->count()) {
            return $this->respondError(__('Invalid staff split. Total must be 100% and staffs must be unique.'), 422);
        }

        $staffIds = $splits->pluck('staff_id')->map(fn ($id) => (int) $id)->unique()->values();
        foreach ($staffIds as $splitStaffId) {
            if (! $service->isStaffAllowed((int) $splitStaffId)) {
                return $this->respondError(__('Selected staff split contains staff not allowed for this service.'), 422);
            }
        }

        $staffCommissionRates = DB::table('staffs')
            ->whereIn('id', $staffIds)
            ->pluck('service_commission_rate', 'id')
            ->map(fn ($rate) => (float) $rate)
            ->all();

        $normalizedSplits = $splits->map(fn (array $split) => [
            'staff_id' => (int) $split['staff_id'],
            'share_percent' => (int) $split['share_percent'],
            'service_commission_rate_snapshot' => (float) ($staffCommissionRates[(int) $split['staff_id']] ?? 0),
        ])->values()->all();
        $addonItems = collect($addonItems)
            ->map(function (array $item) use ($normalizedSplits): array {
                if (strtolower((string) ($item['item_kind'] ?? '')) === 'main_service') {
                    $item['staff_splits'] = collect($item['staff_splits'] ?? [])
                        ->filter(fn ($split) => is_array($split))
                        ->values()
                        ->all();
                    if (empty($item['staff_splits'])) {
                        $item['staff_splits'] = $normalizedSplits;
                    }
                }

                return $item;
            })
            ->values()
            ->all();

        $primaryStaffId = (int) ($normalizedSplits[0]['staff_id'] ?? $staff->id);
        $depositAmount = round(max(0, (float) ($validated['deposit_amount'] ?? 0)), 2);
        $depositPayments = $depositAmount > 0 ? $this->resolveDepositPaymentRows($validated, $depositAmount) : [];

        [$booking, $depositOrder, $depositReceiptUrl] = DB::transaction(function () use (
            $request,
            $orderPaymentService,
            $service,
            $customer,
            $guestName,
            $guestPhone,
            $guestEmail,
            $primaryStaffId,
            $startAt,
            $endAt,
            $bufferMin,
            $addonDurationMin,
            $addonPrice,
            $addonItems,
            $normalizedSplits,
            $validated,
            $depositAmount,
            $depositPayments,
            $scheduleOverride,
            $mainItems
        ) {
            $booking = Booking::query()->create([
                'booking_code' => 'BK-' . now()->format('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                'source' => 'STAFF',
                'customer_id' => $customer?->id,
                'guest_name' => $customer ? null : ($guestName !== '' ? $guestName : 'UNKNOWN'),
                'guest_phone' => $customer ? null : $guestPhone,
                'guest_email' => $customer ? null : $guestEmail,
                'staff_id' => $primaryStaffId,
                'service_id' => $service->id,
                'start_at' => $startAt,
                'end_at' => $endAt,
                'buffer_min' => $bufferMin,
                'status' => 'CONFIRMED',
                'deposit_amount' => $depositAmount,
                'addon_duration_min' => $addonDurationMin,
                'addon_price' => $addonPrice,
                'addon_items_json' => $addonItems,
                'payment_status' => $depositAmount > 0 ? 'PARTIAL' : 'UNPAID',
                'created_by_staff_id' => (int) ($request->user()?->staff_id ?? 0) ?: null,
                'notes' => $validated['notes'] ?? null,
                ...$scheduleOverride,
            ]);
            $this->recordScheduleOverrideAudit($booking, $scheduleOverride, $request);

            $depositProofPath = $request->hasFile('deposit_qr_payment_proof')
                ? $request->file('deposit_qr_payment_proof')->store('booking-payment-proofs', 'public')
                : null;

            foreach ($depositPayments as $paymentRow) {
                BookingPayment::query()->create([
                    'booking_id' => (int) $booking->id,
                    'provider' => (string) $paymentRow['method'],
                    'ref' => null,
                    'amount' => round((float) $paymentRow['amount'], 2),
                    'status' => 'PAID',
                    'raw_response' => array_filter([
                        'source' => 'pos_create_appointment_deposit',
                        'payment_method' => (string) $paymentRow['method'],
                        'proof_path' => (string) $paymentRow['method'] === 'qrpay' ? $depositProofPath : null,
                    ]),
                ]);
            }

            $depositOrder = null;
            $depositReceiptUrl = null;
            if ($depositAmount > 0) {
                $depositOrder = Order::query()->create([
                    'order_number' => $this->generateOrderNumber(),
                    'customer_id' => $customer?->id ? (int) $customer->id : null,
                    'created_by_user_id' => (int) $request->user()->id,
                    'status' => 'completed',
                    'payment_status' => 'paid',
                    'payment_method' => $this->orderPaymentMethodForRows($depositPayments),
                    'payment_provider' => 'manual',
                    'subtotal' => $depositAmount,
                    'discount_total' => 0,
                    'shipping_fee' => 0,
                    'grand_total' => $depositAmount,
                    'pickup_or_shipping' => 'in_store',
                    'pickup_store_id' => null,
                    'billing_name' => $customer ? null : ($guestName !== '' ? $guestName : 'UNKNOWN'),
                    'billing_phone' => $customer ? null : $guestPhone,
                    'payment_meta' => $customer ? null : array_filter(['pos_billing_email' => $guestEmail]),
                    'placed_at' => now(),
                    'paid_at' => now(),
                    'completed_at' => now(),
                    'notes' => 'POS create appointment deposit by staff #' . $request->user()->id . ' | booking_id=' . $booking->id . ' | booking_deposit=' . number_format($depositAmount, 2, '.', ''),
                ]);

                $serviceLineTotal = round(max(0, (float) ($service->service_price ?? $service->price ?? 0)), 2);
                $commissionRate = (float) ($normalizedSplits[0]['service_commission_rate_snapshot'] ?? 0);
                OrderServiceItem::query()->create([
                    'order_id' => (int) $depositOrder->id,
                    'booking_id' => (int) $booking->id,
                    'booking_service_id' => (int) $booking->service_id,
                    'customer_id' => $customer?->id ? (int) $customer->id : null,
                    'service_name_snapshot' => (string) ($service->name ?: 'Service'),
                    'price_snapshot' => $serviceLineTotal,
                    'qty' => 1,
                    'line_total' => $serviceLineTotal,
                    'assigned_staff_id' => $primaryStaffId,
                    'start_at' => $startAt,
                    'end_at' => $endAt,
                    'notes' => $validated['notes'] ?? null,
                    'staff_splits' => $normalizedSplits,
                    'commission_rate_used' => $commissionRate,
                    'commission_amount' => round($serviceLineTotal * $commissionRate, 2),
                    'item_type' => 'service',
                ]);

                $persistDepositLineSplits = function (OrderItem $orderItem, array $splits, float $amountBasis, string $lineRefId): void {
                    $rows = collect($splits)
                        ->map(fn (array $split) => [
                            'order_item_id' => (int) $orderItem->id,
                            'line_type' => 'booking_deposit',
                            'line_ref_id' => $lineRefId,
                            'staff_id' => (int) ($split['staff_id'] ?? 0),
                            'share_percent' => (int) ($split['share_percent'] ?? 0),
                            'amount_basis' => round(max(0, $amountBasis), 2),
                            'commission_rate_snapshot' => (float) ($split['service_commission_rate_snapshot'] ?? 0),
                            'snapshot' => json_encode([
                                'booking_id' => (int) $orderItem->booking_id,
                                'booking_service_id' => (int) $orderItem->booking_service_id,
                                'source' => 'pos_create_appointment_deposit',
                            ]),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ])
                        ->filter(fn (array $row) => $row['staff_id'] > 0 && $row['share_percent'] > 0)
                        ->values()
                        ->all();

                    if (! empty($rows)) {
                        DB::table('order_item_staff_splits')->insert($rows);
                    }
                };

                foreach ($mainItems as $index => $mainItem) {
                    $lineService = $mainItem['service'];
                    $lineAmount = $index === 0 ? $depositAmount : 0.0;
                    $lineSplits = collect($mainItem['staff_splits'] ?? [])
                        ->filter(fn ($split) => is_array($split))
                        ->values()
                        ->all();
                    if (empty($lineSplits)) {
                        $lineSplits = $normalizedSplits;
                    }

                    $depositOrderItem = OrderItem::query()->create([
                        'order_id' => (int) $depositOrder->id,
                        'line_type' => 'booking_deposit',
                        'product_id' => null,
                        'product_name_snapshot' => 'Booking Deposit - ' . (string) ($lineService->name ?: 'Service'),
                        'display_name_snapshot' => 'Booking Deposit - ' . (string) ($lineService->name ?: 'Service'),
                        'quantity' => 1,
                        'price_snapshot' => $lineAmount,
                        'unit_price_snapshot' => $lineAmount,
                        'line_total' => $lineAmount,
                        'line_total_snapshot' => $lineAmount,
                        'effective_unit_price' => $lineAmount,
                        'effective_line_total' => $lineAmount,
                        'line_total_after_discount' => $lineAmount,
                        'locked' => true,
                        'booking_id' => (int) $booking->id,
                        'booking_service_id' => (int) $lineService->id,
                    ]);

                    $persistDepositLineSplits($depositOrderItem, $lineSplits, $lineAmount, (string) $lineService->id);
                }

                $this->replaceOrderPayments($depositOrder, $depositPayments, 'pos_create_appointment_deposit');

                if ($depositProofPath) {
                    OrderUpload::query()->create([
                        'order_id' => (int) $depositOrder->id,
                        'type' => 'payment_slip',
                        'file_path' => $depositProofPath,
                        'note' => 'POS create appointment deposit QRPay proof',
                        'status' => 'approved',
                    ]);
                }

                $orderPaymentService->handlePaid($depositOrder);
                $depositReceiptUrl = $this->buildReceiptUrl($depositOrder, $request);
            }

            DB::table('booking_service_staff_splits')->insert(
                collect($normalizedSplits)
                    ->map(fn (array $split) => [
                        'booking_id' => (int) $booking->id,
                        'staff_id' => (int) ($split['staff_id'] ?? 0),
                        'split_percent' => (int) ($split['share_percent'] ?? 0),
                        'service_commission_rate_snapshot' => (float) ($split['service_commission_rate_snapshot'] ?? 0),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ])
                    ->filter(fn (array $row) => $row['staff_id'] > 0)
                    ->values()
                    ->all()
            );

            return [$booking, $depositOrder, $depositReceiptUrl];
        });

        $response = [
            'id' => (int) $booking->id,
            'booking_id' => (int) $booking->id,
            'booking_code' => (string) ($booking->booking_code ?? ''),
            'status' => (string) $booking->status,
        ];

        if ($depositOrder) {
            $response['order_id'] = (int) $depositOrder->id;
            $response['order_number'] = (string) $depositOrder->order_number;
            $response['receipt_public_url'] = $depositReceiptUrl;
            $response['order'] = [
                'id' => (int) $depositOrder->id,
                'order_number' => (string) $depositOrder->order_number,
                'grand_total' => (float) $depositOrder->grand_total,
                'payment_method' => (string) $depositOrder->payment_method,
            ];
        }

        return $this->respond($response, __('Appointment created successfully.'));
    }

    public function addPackageToCart(Request $request)
    {
        $validated = $request->validate([
            'service_package_id' => ['required', 'integer', 'exists:service_packages,id'],
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'qty' => ['nullable', 'integer', 'min:1', 'max:10'],
        ]);

        $package = ServicePackage::query()->where('is_active', true)->findOrFail((int) $validated['service_package_id']);
        $customer = Customer::query()->findOrFail((int) $validated['customer_id']);
        $qty = (int) ($validated['qty'] ?? 1);
        $cart = $this->resolveCart((int) $request->user()->id)->load([
            'appointmentSettlementItems.booking:id,customer_id,guest_email',
            'packageItems:id,customer_id',
        ]);

        // If settlement exists in cart, all lines must belong to the same member.
        if ($cart->appointmentSettlementItems->isNotEmpty()) {
            $guestSettlementExists = $cart->appointmentSettlementItems->contains(function (PosCartAppointmentSettlementItem $row) {
                return empty($row->booking?->customer_id) && trim((string) ($row->booking?->guest_email ?? '')) !== '';
            });
            if ($guestSettlementExists) {
                return $this->respondError(__('Cannot add service package when cart has guest settlement. Remove settlement to continue.'), 422);
            }

            $settlementCustomerIds = $cart->appointmentSettlementItems
                ->map(fn (PosCartAppointmentSettlementItem $row) => (int) ($row->booking?->customer_id ?? 0))
                ->filter(fn (int $id) => $id > 0)
                ->unique()
                ->values();

            if ($settlementCustomerIds->count() !== 1) {
                return $this->respondError(__('All appointment settlement items in one cart must belong to the same member.'), 422);
            }

            $lockedCustomerId = (int) $settlementCustomerIds->first();
            if ($lockedCustomerId > 0 && (int) $customer->id !== $lockedCustomerId) {
                return $this->respondError(__('Settlement is already in cart. Remove settlement to change member before adding a package.'), 422);
            }
        }

        // If other package lines exist, enforce single-member as well.
        $existingPackageCustomerIds = $cart->packageItems
            ->map(fn (PosCartPackageItem $row) => (int) ($row->customer_id ?? 0))
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();
        if ($existingPackageCustomerIds->count() > 0) {
            if ($existingPackageCustomerIds->count() !== 1) {
                return $this->respondError(__('All service packages in one cart must belong to the same member.'), 422);
            }
            $lockedPackageCustomerId = (int) $existingPackageCustomerIds->first();
            if ($lockedPackageCustomerId > 0 && (int) $customer->id !== $lockedPackageCustomerId) {
                return $this->respondError(__('This cart already has a different member for service packages. Remove package items to change member.'), 422);
            }
        }

        $packagePrice = (float) ($package->selling_price ?? 0);

        $item = PosCartPackageItem::query()->firstOrNew([
            'pos_cart_id' => $cart->id,
            'service_package_id' => $package->id,
        ]);

        $item->qty = min(10, (int) ($item->exists ? $item->qty : 0) + $qty);
        $item->customer_id = (int) $customer->id;
        $item->price_snapshot = $packagePrice;
        $item->package_name_snapshot = (string) $package->name;
        $item->staff_splits = [];
        $item->save();

        return $this->respond([
            'item' => $item->load(['servicePackage:id,name,selling_price', 'customer:id,name']),
            'cart' => $this->serializeCart($cart->fresh()->load([
                'items.variant.product',
                'items.product',
                'serviceItems.bookingService',
                'serviceItems.assignedStaff',
                'serviceItems.customer:id,name',
                'packageItems.servicePackage',
                'packageItems.customer:id,name',
                'appointmentSettlementItems.booking.customer:id,name',
                'appointmentSettlementItems.booking.service:id,name,cn_name,cn_name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type',
                'appointmentSettlementItems.booking.staff:id,name',
            ])),
        ], __('Package added to POS cart.'));
    }

    public function addAppointmentSettlementToCart(Request $request)
    {
        $validated = $request->validate([
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
        ]);

        $booking = Booking::query()->with([
            'customer:id,name',
            'service:id,name,cn_name,service_price,price,service_type',
            'staff:id,name',
        ])->findOrFail((int) $validated['booking_id']);
        if ((string) $booking->status !== 'COMPLETED') {
            return $this->respondError(__('Only COMPLETED appointments can be settled from POS cart.'), 422);
        }

        $settlementSummary = $this->resolveAppointmentFinancialSummary($booking);
        if ((float) ($settlementSummary['balance_due'] ?? 0) <= 0.0001) {
            return $this->respondError(__('No balance due for this appointment settlement.'), 422);
        }

        $hasMember = !empty($booking->customer_id);
        $guestName = trim((string) ($booking->guest_name ?? ''));
        $guestPhone = trim((string) ($booking->guest_phone ?? ''));
        $guestEmail = trim((string) ($booking->guest_email ?? ''));
        $isUnknownGuest = str_starts_with(strtoupper($guestName), 'UNKNOWN');
        if (! $hasMember && ! $isUnknownGuest && $guestName === '') {
            return $this->respondError(__('Settlement appointment must have a member or guest details.'), 422);
        }

        if ($isUnknownGuest) {
            $booking->customer_id = null;
            $booking->guest_name = 'UNKNOWN';
            $booking->guest_phone = null;
            $booking->guest_email = null;
            $booking->save();
            $guestPhone = '';
            $guestEmail = '';
        }

        $cart = $this->resolveCart((int) $request->user()->id)->load([
            'serviceItems',
            'packageItems:id,customer_id',
            'appointmentSettlementItems.booking:id,customer_id,guest_email',
        ]);

        $hasGuestServiceContext = $cart->serviceItems->contains(function (PosCartServiceItem $item) {
            if (! empty($item->customer_id)) return false;
            return trim((string) ($item->guest_email ?? '')) !== '' || trim((string) ($item->guest_name ?? '')) !== '';
        });
        if ($hasGuestServiceContext) {
            return $this->respondError(__('Cannot add settlement while cart is using guest details. Remove guest items or switch to a member first.'), 422);
        }

        $existingPackageCustomerIds = $cart->packageItems
            ->map(fn (PosCartPackageItem $row) => (int) ($row->customer_id ?? 0))
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();
        if ($existingPackageCustomerIds->count() > 0) {
            if ($existingPackageCustomerIds->count() !== 1) {
                return $this->respondError(__('All service packages in one cart must belong to the same member.'), 422);
            }
            $lockedPackageCustomerId = (int) $existingPackageCustomerIds->first();
            if (! $hasMember) {
                return $this->respondError(__('Cannot add guest settlement while cart has service packages. Remove packages to continue.'), 422);
            }
            if ($lockedPackageCustomerId > 0 && $lockedPackageCustomerId !== (int) $booking->customer_id) {
                return $this->respondError(__('This settlement belongs to a different member. Remove current package item(s) to change member.'), 422);
            }
        }

        $existingSettlementCustomerIds = $cart->appointmentSettlementItems
            ->map(fn (PosCartAppointmentSettlementItem $row) => (int) ($row->booking?->customer_id ?? 0))
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();
        $existingSettlementGuestKeys = $cart->appointmentSettlementItems
            ->map(fn (PosCartAppointmentSettlementItem $row) => $this->resolvePosGuestIdentityKey($row->booking))
            ->filter(fn (?string $key) => ! empty($key))
            ->unique()
            ->values();
        $currentGuestKey = $hasMember ? null : $this->resolvePosGuestIdentityKey($booking);

        if ($existingSettlementCustomerIds->isNotEmpty() && $existingSettlementGuestKeys->isNotEmpty()) {
            return $this->respondError(__('Appointment settlement items cannot mix member and guest in one cart.'), 422);
        }
        if ($existingSettlementCustomerIds->isNotEmpty()) {
            if ($existingSettlementCustomerIds->count() !== 1) {
                return $this->respondError(__('All appointment settlement items in one cart must belong to the same member.'), 422);
            }
            if (! $hasMember) {
                return $this->respondError(__('This cart already has member settlement. Remove settlement to switch to guest.'), 422);
            }
            $lockedCustomerId = (int) $existingSettlementCustomerIds->first();
            if ($lockedCustomerId > 0 && $lockedCustomerId !== (int) $booking->customer_id) {
                return $this->respondError(__('This settlement belongs to a different member. Remove the current settlement item(s) to change member.'), 422);
            }
        } elseif ($existingSettlementGuestKeys->isNotEmpty()) {
            if ($existingSettlementGuestKeys->count() !== 1) {
                return $this->respondError(__('All appointment settlement items in one cart must belong to the same guest.'), 422);
            }
            if ($hasMember) {
                return $this->respondError(__('This cart already has guest settlement. Remove settlement to switch to member.'), 422);
            }
            $lockedGuestKey = (string) $existingSettlementGuestKeys->first();
            if ($currentGuestKey !== null && $currentGuestKey !== $lockedGuestKey) {
                return $this->respondError(__('This settlement belongs to a different guest. Remove the current settlement item(s) to change guest.'), 422);
            }
        }

        $item = PosCartAppointmentSettlementItem::query()->firstOrCreate([
            'pos_cart_id' => (int) $cart->id,
            'booking_id' => (int) $booking->id,
        ]);

        return $this->respond([
            'item' => $item,
            'cart' => $this->serializeCart($cart->fresh()->load([
                'items.variant.product',
                'items.product',
                'serviceItems.bookingService',
                'serviceItems.assignedStaff',
                'serviceItems.customer:id,name',
                'packageItems.servicePackage',
                'packageItems.customer:id,name',
                'appointmentSettlementItems.booking.customer:id,name',
                'appointmentSettlementItems.booking.service:id,name,cn_name,cn_name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type',
                'appointmentSettlementItems.booking.staff:id,name',
            ])),
        ], __('Appointment settlement added to POS cart.'));
    }

    public function removeAppointmentSettlementCartItem(Request $request, int $itemId)
    {
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->appointmentSettlementItems()->findOrFail($itemId);
        $item->delete();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load([
                'items.variant.product',
                'items.product',
                'serviceItems.bookingService',
                'serviceItems.assignedStaff',
                'serviceItems.customer:id,name',
                'packageItems.servicePackage',
                'packageItems.customer:id,name',
                'appointmentSettlementItems.booking.customer:id,name',
                'appointmentSettlementItems.booking.service:id,name,cn_name,cn_name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type',
                'appointmentSettlementItems.booking.staff:id,name',
            ])),
        ], __('Appointment settlement removed from POS cart.'));
    }

    public function updatePackageCartItem(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'qty' => ['required', 'integer', 'min:1', 'max:10'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->packageItems()->findOrFail($itemId);
        $item->qty = (int) $validated['qty'];
        $item->save();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load([
                'items.variant.product',
                'items.product',
                'serviceItems.bookingService',
                'serviceItems.assignedStaff',
                'serviceItems.customer:id,name',
                'packageItems.servicePackage',
                'packageItems.customer:id,name',
                'appointmentSettlementItems.booking.customer:id,name',
                'appointmentSettlementItems.booking.service:id,name,cn_name,cn_name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type',
                'appointmentSettlementItems.booking.staff:id,name',
            ])),
        ]);
    }

    public function removePackageCartItem(Request $request, int $itemId)
    {
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->packageItems()->findOrFail($itemId);
        $item->delete();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load([
                'items.variant.product',
                'items.product',
                'serviceItems.bookingService',
                'serviceItems.assignedStaff',
                'serviceItems.customer:id,name',
                'packageItems.servicePackage',
                'packageItems.customer:id,name',
                'appointmentSettlementItems.booking.customer:id,name',
                'appointmentSettlementItems.booking.service:id,name,cn_name,cn_name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type',
                'appointmentSettlementItems.booking.staff:id,name',
            ])),
        ]);
    }

    public function purchasePackage(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'service_package_id' => ['required', 'integer', 'exists:service_packages,id'],
            'source_ref_id' => ['nullable', 'integer'],
        ]);

        $package = ServicePackage::query()->with('items')->findOrFail((int) $validated['service_package_id']);

        $owned = $this->customerServicePackageService->purchase(
            (int) $validated['customer_id'],
            $package,
            'POS',
            isset($validated['source_ref_id']) ? (int) $validated['source_ref_id'] : null,
        );

        return $this->respond($owned, __('Package assigned successfully.'));
    }

    protected function addResolvedToCart(Request $request, ?ProductVariant $variant, ?Product $product, int $qty, string $flow)
    {
        $resolvedProduct = $variant?->product ?? $product;

        if (! $resolvedProduct || ! $resolvedProduct->is_active || $resolvedProduct->is_reward_only) {
            return $this->respondError(__('Product is not sellable.'), 404);
        }

        if ($variant) {
            $availableQty = $this->resolveVariantAvailableQty($variant);
            if ($availableQty !== null && $availableQty < $qty) {
                return $this->respondError(__('Insufficient stock.'), 422);
            }
        }

        if (! $variant && $resolvedProduct->track_stock && (int) $resolvedProduct->stock < $qty) {
            return $this->respondError(__('Insufficient stock.'), 422);
        }

        $cart = $this->resolveCart((int) $request->user()->id);

        $pricing = ProductPricing::build($resolvedProduct, $variant);
        $unitPrice = (float) ($pricing['effective_price'] ?? $variant?->sale_price ?? $variant?->price ?? $resolvedProduct->sale_price ?? $resolvedProduct->price ?? 0);

        $itemLookup = [
            'pos_cart_id' => $cart->id,
            'variant_id' => $variant?->id,
            'product_id' => $variant ? null : $resolvedProduct->id,
        ];

        $item = PosCartItem::firstOrNew($itemLookup);
        $item->qty = (int) ($item->exists ? $item->qty : 0) + $qty;
        $item->price_snapshot = $unitPrice;
        $item->variant_id = $variant?->id;
        $item->product_id = $variant ? null : $resolvedProduct->id;

        if ($variant) {
            $availableQty = $this->resolveVariantAvailableQty($variant);
            if ($availableQty !== null && $item->qty > $availableQty) {
                return $this->respondError(__('Insufficient stock.'), 422);
            }
        }

        if (! $variant && $resolvedProduct->track_stock && $item->qty > (int) $resolvedProduct->stock) {
            return $this->respondError(__('Insufficient stock.'), 422);
        }

        Log::debug('POS addResolvedToCart branch', [
            'flow' => $flow,
            'branch' => $variant ? 'variant' : 'single_product',
            'chosen_variant_id' => $variant?->id,
            'chosen_product_id' => $variant ? null : $resolvedProduct->id,
            'qty' => $qty,
        ]);

        $item->save();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    protected function resolveVariantAvailableQty(ProductVariant $variant): ?int
    {
        if ($variant->is_bundle) {
            return $variant->derivedAvailableQty();
        }

        if (! $variant->track_stock) {
            return null;
        }

        return (int) ($variant->stock ?? 0);
    }

    public function productSearch(Request $request)
    {
        $barcodeQuery = trim((string) $request->query('barcode', ''));
        $query = $barcodeQuery !== '' ? $barcodeQuery : trim((string) $request->query('q', ''));
        $isBarcodeSearch = $barcodeQuery !== '' || $request->boolean('barcode_search');
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));
        $categoryId = $request->integer('category_id');

        if ($query === '') {
            return $this->respond([
                'data' => [],
                'current_page' => $page,
                'last_page' => 1,
                'per_page' => $perPage,
                'total' => 0,
            ]);
        }

        $exact = mb_strtolower($query);

        $variants = ProductVariant::query()
            ->with(['product', 'product.images', 'bundleItems.componentVariant'])
            ->where('is_active', true)
            ->whereHas('product', fn ($builder) => $builder->where('is_active', true)->where('is_reward_only', false))
            ->when($categoryId > 0, function ($builder) use ($categoryId) {
                $builder->whereHas('product.categories', fn ($categoryQuery) => $categoryQuery->where('categories.id', $categoryId));
            })
            ->where(function ($builder) use ($query, $exact, $isBarcodeSearch) {
                $builder
                    ->where('product_variants.barcode', $query)
                    ->orWhereRaw('LOWER(product_variants.barcode) = ?', [$exact])
                    ->orWhere('product_variants.barcode', 'like', "%{$query}%")
                    ->orWhere('product_variants.sku', $query)
                    ->orWhereRaw('LOWER(product_variants.sku) = ?', [$exact])
                    ->orWhere('product_variants.sku', 'like', "%{$query}%")
                    ->orWhereHas('product', function ($productQuery) use ($query, $exact, $isBarcodeSearch) {
                        $productQuery
                            ->where('products.barcode', $query)
                            ->orWhereRaw('LOWER(products.barcode) = ?', [$exact])
                            ->orWhere('products.barcode', 'like', "%{$query}%")
                            ->orWhere('products.sku', $query)
                            ->orWhereRaw('LOWER(products.sku) = ?', [$exact])
                            ->orWhere('products.sku', 'like', "%{$query}%");

                        if (! $isBarcodeSearch) {
                            $productQuery->orWhere('products.name', 'like', "%{$query}%");
                        }
                    });
            })
            ->orderByRaw('CASE WHEN product_variants.barcode = ? THEN 0 ELSE 1 END', [$query])
            ->orderByRaw('CASE WHEN LOWER(product_variants.barcode) = ? THEN 0 ELSE 1 END', [$exact])
            ->orderByRaw('CASE WHEN product_variants.sku = ? THEN 0 ELSE 1 END', [$query])
            ->orderByRaw('CASE WHEN LOWER(product_variants.sku) = ? THEN 0 ELSE 1 END', [$exact])
            ->orderByRaw('CASE WHEN EXISTS (SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND p.barcode = ?) THEN 0 ELSE 1 END', [$query])
            ->orderByRaw('CASE WHEN EXISTS (SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND LOWER(p.barcode) = ?) THEN 0 ELSE 1 END', [$exact])
            ->orderByRaw('CASE WHEN EXISTS (SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND p.sku = ?) THEN 0 ELSE 1 END', [$query])
            ->orderByRaw('CASE WHEN EXISTS (SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND LOWER(p.sku) = ?) THEN 0 ELSE 1 END', [$exact])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($perPage, ['*'], 'page', $page);

        return $this->respond([
            'data' => collect($variants->items())->map(function (ProductVariant $variant) {
                $product = $variant->product;
                $pricing = ProductPricing::build($product, $variant);

                return [
                    'id' => $variant->id,
                    'product_id' => $product?->id,
                    'name' => $product?->name,
                    'cn_name' => $product?->cn_name,
                    'sku' => $variant->sku,
                    'barcode' => $variant->barcode ?? $variant->sku,
                    'price' => (float) ($pricing['effective_price'] ?? $variant->sale_price ?? $variant->price ?? 0),
                    'thumbnail_url' => $product?->cover_image_url ?? $variant->image_url,
                    'cover_image_url' => $product?->cover_image_url,
                    'variants_count' => 1,
                    'default_variant_id' => $variant->id,
                    'variants' => [[
                        'id' => $variant->id,
                        'name' => $variant->title,
                        'cn_name' => $variant->cn_name,
                        'title' => $variant->title,
                        'sku' => $variant->sku,
                        'barcode' => $variant->barcode,
                        'price' => (float) ($pricing['effective_price'] ?? $variant->sale_price ?? $variant->price ?? 0),
                        'sale_price' => $variant->sale_price,
                        'image_url' => $variant->image_url,
                        'is_active' => (bool) $variant->is_active,
                        'is_bundle' => (bool) $variant->is_bundle,
                        'track_stock' => (bool) $variant->track_stock,
                        'stock' => $this->resolveVariantAvailableQty($variant),
                        'derived_available_qty' => $variant->is_bundle ? $variant->derivedAvailableQty() : null,
                    ]],
                ];
            })->values(),
            'current_page' => $variants->currentPage(),
            'last_page' => $variants->lastPage(),
            'per_page' => $variants->perPage(),
            'total' => $variants->total(),
        ]);
    }

    public function staffConsumableProducts(Request $request)
    {
        $query = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(100, (int) $request->query('per_page', 60)));
        $categoryId = $request->integer('category_id');

        $products = Product::query()
            ->with(['images', 'categories:id,name', 'variants' => function ($builder) {
                $builder->where('is_active', true)->orderBy('sort_order')->orderBy('id');
            }, 'variants.bundleItems.componentVariant'])
            ->where('is_active', true)
            ->where('is_reward_only', false)
            ->where('is_staff_free', true)
            ->when($categoryId > 0, function ($builder) use ($categoryId) {
                $builder->whereHas('categories', fn ($categoryQuery) => $categoryQuery->where('categories.id', $categoryId));
            })
            ->when($query !== '', function ($builder) use ($query) {
                $exact = mb_strtolower($query);
                $builder->where(function ($search) use ($query, $exact) {
                    $search
                        ->where('products.name', 'like', "%{$query}%")
                        ->orWhere('products.cn_name', 'like', "%{$query}%")
                        ->orWhere('products.sku', 'like', "%{$query}%")
                        ->orWhere('products.barcode', 'like', "%{$query}%")
                        ->orWhereRaw('LOWER(products.sku) = ?', [$exact])
                        ->orWhereRaw('LOWER(products.barcode) = ?', [$exact])
                        ->orWhereHas('variants', function ($variantQuery) use ($query, $exact) {
                            $variantQuery
                                ->where('product_variants.title', 'like', "%{$query}%")
                                ->orWhere('product_variants.cn_name', 'like', "%{$query}%")
                                ->orWhere('product_variants.sku', 'like', "%{$query}%")
                                ->orWhere('product_variants.barcode', 'like', "%{$query}%")
                                ->orWhereRaw('LOWER(product_variants.sku) = ?', [$exact])
                                ->orWhereRaw('LOWER(product_variants.barcode) = ?', [$exact]);
                        });
                });
            })
            ->orderBy('name')
            ->paginate($perPage, ['*'], 'page', $page);

        return $this->respond([
            'data' => collect($products->items())->map(fn (Product $product) => $this->serializeStaffConsumableProduct($product))->values(),
            'current_page' => $products->currentPage(),
            'last_page' => $products->lastPage(),
            'per_page' => $products->perPage(),
            'total' => $products->total(),
        ]);
    }

    public function staffConsumableHistory(Request $request)
    {
        $limit = max(1, min(50, (int) $request->query('limit', 15)));

        $items = $this->staffConsumableClaimQuery()
            ->latest('id')
            ->limit($limit)
            ->get()
            ->map(fn (OrderItem $item) => $this->serializeStaffConsumableClaim($item))
            ->values();

        return $this->respond(['data' => $items]);
    }

    public function myStaffConsumableClaims(Request $request)
    {
        $staffId = (int) ($request->user()?->staff_id ?? 0);
        if ($staffId <= 0) {
            return $this->respondError(__('Only staff accounts can view their consumable claim history.'), 403);
        }

        $limit = max(1, min(50, (int) $request->query('limit', 20)));

        $items = $this->staffConsumableClaimQuery()
            ->where(function ($query) use ($staffId) {
                $query
                    ->where('order_items.staff_id', $staffId)
                    ->orWhereHas('order.creator', fn ($creatorQuery) => $creatorQuery->where('staff_id', $staffId));
            })
            ->latest('order_items.id')
            ->limit($limit)
            ->get()
            ->map(fn (OrderItem $item) => $this->serializeStaffConsumableClaim($item))
            ->values();

        return $this->respond(['data' => $items]);
    }

    public function adminStaffConsumableLogs(Request $request)
    {
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));
        $query = $this->staffConsumableClaimQuery();
        $this->applyStaffConsumableLogFilters($query, $request);

        $logs = $query
            ->latest('order_items.id')
            ->paginate($perPage);

        return $this->respond([
            'data' => collect($logs->items())->map(fn (OrderItem $item) => $this->serializeStaffConsumableClaim($item))->values(),
            'current_page' => $logs->currentPage(),
            'last_page' => $logs->lastPage(),
            'per_page' => $logs->perPage(),
            'total' => $logs->total(),
        ]);
    }

    public function staffConsumableClaims(Request $request, Staff $staff)
    {
        $limit = max(1, min(50, (int) $request->query('limit', 10)));

        $items = $this->staffConsumableClaimQuery()
            ->where(function ($query) use ($staff) {
                $query
                    ->where('order_items.staff_id', (int) $staff->id)
                    ->orWhereHas('order.creator', fn ($creatorQuery) => $creatorQuery->where('staff_id', (int) $staff->id));
            })
            ->latest('order_items.id')
            ->limit($limit)
            ->get()
            ->map(fn (OrderItem $item) => $this->serializeStaffConsumableClaim($item))
            ->values();

        return $this->respond(['data' => $items]);
    }

    protected function staffConsumableClaimQuery()
    {
        return OrderItem::query()
            ->with([
                'order.creator.staff:id,name',
                'staff:id,name',
                'product:id,name,cn_name,sku',
                'productVariant:id,title,cn_name,sku',
            ])
            ->where('is_staff_free_applied', true)
            ->whereHas('order', function ($builder) {
                $builder->where(function ($orderQuery) {
                    $orderQuery
                        ->where('notes', 'like', '%staff_free_consumable_claim%')
                        ->orWhere('payment_method', 'staff_free');
                });
            });
    }

    protected function applyStaffConsumableLogFilters($query, Request $request): void
    {
        $dateFrom = trim((string) ($request->query('from_date', $request->query('date_from', ''))));
        $dateTo = trim((string) ($request->query('to_date', $request->query('date_to', ''))));
        $search = trim((string) ($request->query('search', $request->query('q', ''))));
        $staffId = (int) $request->query('staff_id', 0);

        if ($dateFrom !== '') {
            $query->whereHas('order', fn ($orderQuery) => $orderQuery->whereDate('created_at', '>=', $dateFrom));
        }

        if ($dateTo !== '') {
            $query->whereHas('order', fn ($orderQuery) => $orderQuery->whereDate('created_at', '<=', $dateTo));
        }

        if ($staffId > 0) {
            $query->where(function ($staffQuery) use ($staffId) {
                $staffQuery
                    ->where('order_items.staff_id', $staffId)
                    ->orWhereHas('order.creator', fn ($creatorQuery) => $creatorQuery->where('staff_id', $staffId));
            });
        }

        if ($search !== '') {
            $query->where(function ($searchQuery) use ($search) {
                $searchQuery
                    ->where('product_name_snapshot', 'like', "%{$search}%")
                    ->orWhere('display_name_snapshot', 'like', "%{$search}%")
                    ->orWhere('variant_name_snapshot', 'like', "%{$search}%")
                    ->orWhere('sku_snapshot', 'like', "%{$search}%")
                    ->orWhere('variant_sku_snapshot', 'like', "%{$search}%")
                    ->orWhereHas('product', fn ($productQuery) => $productQuery
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('cn_name', 'like', "%{$search}%"))
                    ->orWhereHas('productVariant', fn ($variantQuery) => $variantQuery
                        ->where('title', 'like', "%{$search}%")
                        ->orWhere('cn_name', 'like', "%{$search}%"))
                    ->orWhereHas('order', fn ($orderQuery) => $orderQuery->where('order_number', 'like', "%{$search}%"))
                    ->orWhereHas('staff', fn ($staffQuery) => $staffQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('order.creator', function ($creatorQuery) use ($search) {
                        $creatorQuery
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }
    }

    protected function serializeStaffConsumableClaim(OrderItem $item): array
    {
        $order = $item->order;
        $creator = $order?->creator;
        $staff = $item->staff ?? $creator?->staff;

        return [
            'id' => (int) $item->id,
            'claimed_at' => optional($order?->created_at)->toDateTimeString(),
            'staff_id' => $staff?->id ? (int) $staff->id : null,
            'staff' => $staff?->name ?? $creator?->name ?? $creator?->email ?? 'Staff',
            'claimed_by' => $staff?->name ?? $creator?->name ?? $creator?->email ?? 'Staff',
            'created_by' => $creator?->name ?? $creator?->email ?? 'System',
            'order_number' => (string) ($order?->order_number ?? '-'),
            'reference_no' => (string) ($order?->order_number ?? '-'),
            'product' => (string) ($item->product_name_snapshot ?: $item->product?->name ?: 'Product'),
            'product_cn_name' => $item->displayCnName(),
            'variant' => (string) ($item->variant_name_snapshot ?: $item->productVariant?->title ?: ''),
            'variant_cn_name' => $item->displayVariantCnName(),
            'sku' => (string) ($item->variant_sku_snapshot ?: $item->sku_snapshot ?: $item->productVariant?->sku ?: $item->product?->sku ?: '-'),
            'qty' => (int) $item->quantity,
            'original_price' => (float) ($item->unit_price_snapshot ?? $item->price_snapshot ?? 0),
            'line_total_snapshot' => (float) ($item->line_total_snapshot ?? 0),
            'final_amount' => (float) ($item->effective_line_total ?? $item->line_total ?? 0),
        ];
    }

    public function staffConsumableCheckout(Request $request)
    {
        if (empty($request->user()?->staff_id)) {
            return $this->respondError(__('Only staff accounts can claim consumables.'), 403);
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
        ]);

        $order = DB::transaction(function () use ($validated, $request) {
            $payloadItems = collect($validated['items']);
            $order = Order::create([
                'order_number' => $this->generateOrderNumber(),
                'customer_id' => null,
                'created_by_user_id' => $request->user()->id,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => 'staff_free',
                'payment_provider' => 'manual',
                'subtotal' => 0,
                'discount_total' => 0,
                'shipping_fee' => 0,
                'grand_total' => 0,
                'pickup_or_shipping' => 'in_store',
                'placed_at' => now(),
                'paid_at' => now(),
                'completed_at' => now(),
                'notes' => 'staff_free_consumable_claim by staff #' . $request->user()->staff_id . ' user #' . $request->user()->id,
                'payment_meta' => [
                    'source' => 'staff_free_consumable_claim',
                    'staff_id' => (int) $request->user()->staff_id,
                    'user_id' => (int) $request->user()->id,
                ],
            ]);

            foreach ($payloadItems as $payloadItem) {
                $qty = max(1, (int) $payloadItem['qty']);
                $variantId = !empty($payloadItem['variant_id']) ? (int) $payloadItem['variant_id'] : null;

                $product = Product::query()
                    ->with(['images', 'variants.bundleItems.componentVariant'])
                    ->where('id', (int) $payloadItem['product_id'])
                    ->where('is_active', true)
                    ->where('is_reward_only', false)
                    ->where('is_staff_free', true)
                    ->lockForUpdate()
                    ->first();

                if (! $product) {
                    abort(422, __('Only staff-free products can be claimed here.'));
                }

                $variant = null;
                if ($variantId) {
                    $variant = ProductVariant::query()
                        ->with(['product', 'bundleItems.componentVariant.product'])
                        ->where('id', $variantId)
                        ->where('product_id', (int) $product->id)
                        ->where('is_active', true)
                        ->lockForUpdate()
                        ->first();

                    if (! $variant) {
                        abort(422, __('Selected variant is not available.'));
                    }
                }

                $availableQty = $variant ? $this->resolveVariantAvailableQty($variant) : ($product->track_stock ? (int) $product->stock : null);
                if ($availableQty !== null && $qty > $availableQty) {
                    abort(422, __('Insufficient stock for :sku', ['sku' => $variant?->sku ?? $product->sku ?? $product->id]));
                }

                $pricing = ProductPricing::build($product, $variant);
                $unitPriceSnapshot = (float) ($pricing['effective_price'] ?? $variant?->sale_price ?? $variant?->price ?? $product->sale_price ?? $product->price ?? 0);
                $resolvedUnitCost = (float) ($variant
                    ? ($variant->is_bundle ? $variant->derivedCostPrice() : $variant->cost_price)
                    : $product->cost_price
                );

                OrderItem::create([
                    'order_id' => $order->id,
                    'line_type' => 'product',
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                    'product_name_snapshot' => $product->name,
                    'display_name_snapshot' => $variant ? trim($product->name . ' - ' . $variant->title) : $product->name,
                    'sku_snapshot' => $product->sku,
                    'variant_name_snapshot' => $variant?->title,
                    'variant_sku_snapshot' => $variant?->sku,
                    'price_snapshot' => $unitPriceSnapshot,
                    'unit_price_snapshot' => $unitPriceSnapshot,
                    'variant_price_snapshot' => $variant?->price,
                    'variant_cost_snapshot' => $variant?->is_bundle ? $variant?->derivedCostPrice() : $variant?->cost_price,
                    'cost_price_snapshot' => $resolvedUnitCost,
                    'cost_amount_snapshot' => round($resolvedUnitCost * $qty, 2),
                    'quantity' => $qty,
                    'line_total' => 0,
                    'line_total_snapshot' => round($unitPriceSnapshot * $qty, 2),
                    'effective_unit_price' => 0,
                    'effective_line_total' => 0,
                    'is_staff_free_applied' => true,
                    'discount_amount' => round($unitPriceSnapshot * $qty, 2),
                    'line_total_after_discount' => 0,
                    'staff_id' => (int) $request->user()->staff_id,
                    'locked' => true,
                ]);

                $this->deductStaffConsumableStock($product, $variant, $qty, (int) $request->user()->id);
            }

            return $order->fresh(['items', 'creator']);
        });

        return $this->respond([
            'message' => __('Consumable claim recorded.'),
            'order_id' => (int) $order->id,
            'order_number' => (string) $order->order_number,
            'grand_total' => 0,
        ]);
    }

    protected function serializeStaffConsumableProduct(Product $product): array
    {
        $pricing = ProductPricing::build($product, null);

        return [
            'id' => (int) $product->id,
            'product_id' => (int) $product->id,
            'name' => (string) $product->name,
            'cn_name' => $product->cn_name,
            'sku' => (string) ($product->sku ?? ''),
            'barcode' => (string) ($product->barcode ?? ''),
            'price' => (float) ($pricing['effective_price'] ?? $product->sale_price ?? $product->price ?? 0),
            'is_staff_free' => true,
            'thumbnail_url' => $product->cover_image_url,
            'image_url' => $product->cover_image_url,
            'category' => $product->categories->first()?->name,
            'categories' => $product->categories->map(fn ($category) => ['id' => (int) $category->id, 'name' => (string) $category->name])->values(),
            'track_stock' => (bool) $product->track_stock,
            'stock' => $product->track_stock ? (int) $product->stock : null,
            'variants' => $product->variants->map(function (ProductVariant $variant) use ($product) {
                $variantPricing = ProductPricing::build($product, $variant);
                return [
                    'id' => (int) $variant->id,
                    'name' => (string) $variant->title,
                    'title' => (string) $variant->title,
                    'cn_name' => $variant->cn_name,
                    'sku' => (string) ($variant->sku ?? ''),
                    'barcode' => (string) ($variant->barcode ?? ''),
                    'price' => (float) ($variantPricing['effective_price'] ?? $variant->sale_price ?? $variant->price ?? 0),
                    'image_url' => $variant->image_url ?? $product->cover_image_url,
                    'is_active' => (bool) $variant->is_active,
                    'is_bundle' => (bool) $variant->is_bundle,
                    'track_stock' => (bool) $variant->track_stock,
                    'stock' => $this->resolveVariantAvailableQty($variant),
                ];
            })->values(),
        ];
    }

    protected function deductStaffConsumableStock(Product $product, ?ProductVariant $variant, int $qty, ?int $actorUserId = null): void
    {
        if ($variant) {
            if ($variant->is_bundle) {
                $variant->loadMissing('bundleItems.componentVariant.product');
                foreach ($variant->bundleItems as $bundleItem) {
                    $component = $bundleItem->componentVariant;
                    if (! $component || ! $component->track_stock) {
                        continue;
                    }

                    $required = max(1, (int) ($bundleItem->quantity ?? 1)) * $qty;
                    $componentVariant = ProductVariant::query()->where('id', (int) $component->id)->lockForUpdate()->first();
                    if (! $componentVariant) {
                        continue;
                    }

                    $beforeQty = (int) ($componentVariant->stock ?? 0);
                    $afterQty = max(0, $beforeQty - $required);
                    if ($afterQty === $beforeQty) {
                        continue;
                    }

                    $unitCost = (float) ($componentVariant->cost_price ?? 0);
                    $componentVariant->stock = $afterQty;
                    $componentVariant->save();

                    ProductStockMovement::create([
                        'product_id' => (int) ($component->product_id ?? $product->id),
                        'product_variant_id' => (int) $componentVariant->id,
                        'type' => 'stock_out',
                        'quantity_before' => $beforeQty,
                        'quantity_change' => $required,
                        'quantity_after' => $afterQty,
                        'cost_price_before' => $unitCost,
                        'cost_price_after' => $unitCost,
                        'inventory_value_before' => round($beforeQty * $unitCost, 2),
                        'inventory_value_after' => round($afterQty * $unitCost, 2),
                        'input_cost_price_per_unit' => null,
                        'remark' => 'Staff consumable claim (bundle)',
                        'created_by_user_id' => $actorUserId,
                    ]);
                }

                return;
            }

            if (! $variant->track_stock) {
                return;
            }

            $lockedVariant = ProductVariant::query()->where('id', (int) $variant->id)->lockForUpdate()->first();
            if (! $lockedVariant) {
                return;
            }

            $beforeQty = (int) ($lockedVariant->stock ?? 0);
            $afterQty = max(0, $beforeQty - $qty);
            if ($afterQty === $beforeQty) {
                return;
            }

            $unitCost = (float) ($lockedVariant->cost_price ?? 0);
            $lockedVariant->stock = $afterQty;
            $lockedVariant->save();

            ProductStockMovement::create([
                'product_id' => (int) $product->id,
                'product_variant_id' => (int) $lockedVariant->id,
                'type' => 'stock_out',
                'quantity_before' => $beforeQty,
                'quantity_change' => $qty,
                'quantity_after' => $afterQty,
                'cost_price_before' => $unitCost,
                'cost_price_after' => $unitCost,
                'inventory_value_before' => round($beforeQty * $unitCost, 2),
                'inventory_value_after' => round($afterQty * $unitCost, 2),
                'input_cost_price_per_unit' => null,
                'remark' => 'Staff consumable claim',
                'created_by_user_id' => $actorUserId,
            ]);

            return;
        }

        if (! $product->track_stock) {
            return;
        }

        $lockedProduct = Product::query()->where('id', (int) $product->id)->lockForUpdate()->first();
        if (! $lockedProduct) {
            return;
        }

        $beforeQty = (int) ($lockedProduct->stock ?? 0);
        $afterQty = max(0, $beforeQty - $qty);
        if ($afterQty === $beforeQty) {
            return;
        }

        $unitCost = (float) ($lockedProduct->cost_price ?? 0);
        $lockedProduct->stock = $afterQty;
        $lockedProduct->stock_quantity = $afterQty;
        $lockedProduct->inventory_value = round($afterQty * $unitCost, 2);
        $lockedProduct->save();

        ProductStockMovement::create([
            'product_id' => (int) $lockedProduct->id,
            'product_variant_id' => null,
            'type' => 'stock_out',
            'quantity_before' => $beforeQty,
            'quantity_change' => $qty,
            'quantity_after' => $afterQty,
            'cost_price_before' => $unitCost,
            'cost_price_after' => $unitCost,
            'inventory_value_before' => round($beforeQty * $unitCost, 2),
            'inventory_value_after' => round($afterQty * $unitCost, 2),
            'input_cost_price_per_unit' => null,
            'remark' => 'Staff consumable claim',
            'created_by_user_id' => $actorUserId,
        ]);
    }

    public function updateCartItem(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'qty' => ['required', 'integer', 'min:1'],
            'variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->items()->with(['variant', 'product', 'bookingProduct'])->findOrFail($itemId);

        $qty = (int) $validated['qty'];
        $targetVariantId = isset($validated['variant_id']) ? (int) $validated['variant_id'] : null;

        if ($targetVariantId) {
            $targetVariant = ProductVariant::query()
                ->with(['product', 'bundleItems.componentVariant'])
                ->where('id', $targetVariantId)
                ->where('is_active', true)
                ->first();

            if (! $targetVariant || ! $targetVariant->product || ! $targetVariant->product->is_active || $targetVariant->product->is_reward_only) {
                return $this->respondError(__('Product is not sellable.'), 404);
            }

            $duplicateItem = $cart->items()
                ->where('variant_id', $targetVariant->id)
                ->where('id', '!=', $item->id)
                ->first();

            $finalQty = $qty + (int) ($duplicateItem?->qty ?? 0);

            $targetAvailableQty = $this->resolveVariantAvailableQty($targetVariant);
            if ($targetAvailableQty !== null && $finalQty > $targetAvailableQty) {
                return $this->respondError(__('Insufficient stock.'), 422);
            }

            $pricing = ProductPricing::build($targetVariant->product, $targetVariant);
            $unitPrice = (float) ($pricing['effective_price'] ?? $targetVariant->sale_price ?? $targetVariant->price ?? $targetVariant->product->sale_price ?? $targetVariant->product->price ?? 0);

            $item->qty = $finalQty;
            $item->variant_id = $targetVariant->id;
            $item->product_id = null;
            $item->price_snapshot = $unitPrice;
            $item->save();

            if ($duplicateItem) {
                $duplicateItem->delete();
            }

            return $this->respond([
                'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
            ]);
        }

        if (($item->item_type ?? 'product') === 'booking_product') {
            $item->qty = $qty;
            $item->save();
            return $this->respond([
                'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'items.bookingProduct.categories', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
            ]);
        }

        if ($item->variant) {
            $availableQty = $this->resolveVariantAvailableQty($item->variant);
            if ($availableQty !== null && $qty > $availableQty) {
                return $this->respondError(__('Insufficient stock.'), 422);
            }
        }

        if (! $item->variant && $item->product?->track_stock && $qty > (int) $item->product->stock) {
            return $this->respondError(__('Insufficient stock.'), 422);
        }

        $item->qty = $qty;
        $item->save();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    public function removeCartItem(Request $request, int $itemId)
    {
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->items()->findOrFail($itemId);
        $item->delete();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    public function removeServiceCartItem(Request $request, int $itemId)
    {
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->serviceItems()->findOrFail($itemId);
        $this->customerServicePackageService->releaseReservedClaimsBySource('POS', (int) $item->id);
        $item->delete();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    /**
     * Release a reserved package claim for a POS cart service line (before checkout / remove).
     * Does not delete the cart line.
     */
    public function releaseServiceItemPackageClaim(Request $request, int $itemId)
    {
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->serviceItems()->findOrFail($itemId);
        $released = $this->customerServicePackageService->releaseReservedClaimsBySource('POS', (int) $item->id);
        if ($released === 0) {
            return $this->respondError(__('No reserved package claim found for this line. It may already be released or consumed.'), 422);
        }

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    public function cart(Request $request)
    {
        $cart = $this->resolveCart((int) $request->user()->id)->load([
            'items.variant.product',
            'items.product',
            'serviceItems.bookingService',
            'serviceItems.assignedStaff',
            'serviceItems.customer:id,name',
            'packageItems.servicePackage',
            'packageItems.customer:id,name',
            'appointmentSettlementItems.booking.customer:id,name',
            'appointmentSettlementItems.booking.service:id,name,cn_name,cn_name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type',
            'appointmentSettlementItems.booking.staff:id,name',
        ]);

        return $this->respond([
            'cart' => $this->serializeCart($cart),
        ]);
    }

    public function memberVouchers(Request $request, int $memberId)
    {
        $customer = Customer::query()->findOrFail($memberId);
        $now = now();

        $vouchers = CustomerVoucher::query()
            ->with('voucher')
            ->where('customer_id', $customer->id)
            ->where('status', 'active')
            ->get()
            ->filter(function (CustomerVoucher $customerVoucher) use ($now) {
                $voucher = $customerVoucher->voucher;
                if (! $voucher || ! $voucher->is_active) {
                    return false;
                }

                $quantityTotal = (int) ($customerVoucher->quantity_total ?? 1);
                $quantityUsed = (int) ($customerVoucher->quantity_used ?? 0);
                if ($quantityUsed >= $quantityTotal) {
                    return false;
                }

                $startAt = $customerVoucher->start_at ?? $voucher->start_at;
                $endAt = $customerVoucher->end_at ?? $customerVoucher->expires_at ?? $voucher->end_at;

                if ($startAt && $startAt->gt($now)) {
                    return false;
                }

                if ($endAt && $endAt->lt($now)) {
                    return false;
                }

                return true;
            })
            ->values();

        return $this->respond([
            'data' => $vouchers->map(function (CustomerVoucher $customerVoucher) {
                $voucher = $customerVoucher->voucher;
                return [
                    'id' => $customerVoucher->id,
                    'customer_voucher_id' => $customerVoucher->id,
                    'status' => $customerVoucher->status,
                    'quantity_total' => (int) ($customerVoucher->quantity_total ?? 1),
                    'quantity_used' => (int) ($customerVoucher->quantity_used ?? 0),
                    'expires_at' => $customerVoucher->end_at ?? $customerVoucher->expires_at,
                    'voucher' => $voucher ? [
                        'id' => $voucher->id,
                        'code' => $voucher->code,
                        'type' => $voucher->type,
                        'value' => (float) ($voucher->value ?? 0),
                        'min_order_amount' => (float) ($voucher->min_order_amount ?? 0),
                        'max_discount_amount' => $voucher->max_discount_amount !== null ? (float) $voucher->max_discount_amount : null,
                        'scope_type' => $voucher->scope_type ?? 'all',
                    ] : null,
                ];
            })->values(),
            'current_page' => 1,
            'last_page' => 1,
            'per_page' => max(1, $vouchers->count()),
            'total' => $vouchers->count(),
        ]);
    }

    public function applyVoucher(Request $request)
    {
        $validated = $request->validate([
            'voucher_code' => ['nullable', 'string', 'required_without:customer_voucher_id'],
            'customer_voucher_id' => ['nullable', 'integer', 'exists:customer_vouchers,id', 'required_without:voucher_code'],
            'member_id' => ['nullable', 'integer', 'exists:customers,id'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id)->load([
            'items.variant.product',
            'items.product',
            'serviceItems.bookingService',
            'serviceItems.assignedStaff',
            'serviceItems.customer:id,name',
            'packageItems.servicePackage',
            'packageItems.customer:id,name',
            'appointmentSettlementItems.booking.customer:id,name',
            'appointmentSettlementItems.booking.service:id,name,cn_name,cn_name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type',
            'appointmentSettlementItems.booking.staff:id,name',
        ]);
        if ($cart->items->isEmpty() && $cart->serviceItems->isEmpty() && $cart->packageItems->isEmpty() && $cart->appointmentSettlementItems->isEmpty()) {
            return $this->respondError(__('POS cart is empty.'), 422);
        }

        $member = !empty($validated['member_id']) ? Customer::query()->find((int) $validated['member_id']) : null;
        $customerVoucher = null;
        $voucherCode = !empty($validated['voucher_code']) ? trim((string) $validated['voucher_code']) : null;

        if (!empty($validated['customer_voucher_id'])) {
            $customerVoucher = CustomerVoucher::query()->with('voucher')->find((int) $validated['customer_voucher_id']);
            if (!$customerVoucher) {
                return $this->respondError(__('Voucher not found.'), 404);
            }

            if (!$member || $customerVoucher->customer_id !== $member->id) {
                return $this->respondError(__('Voucher not available for this member.'), 422);
            }

            $voucherCode = $customerVoucher->voucher?->code;
        }

        if (!$voucherCode) {
            return $this->respondError(__('Voucher code is required.'), 422);
        }

        $cartItems = $this->serializeCartItemsForVoucher($cart);
        $subtotal = collect($cartItems)->sum('line_total');

        $result = $this->voucherEligibilityService->validateVoucherForCart(
            $voucherCode,
            $member,
            $cartItems,
            (float) $subtotal,
            $customerVoucher,
        );

        if (!$result['is_valid']) {
            return $this->respondError($result['message'] ?? __('Invalid voucher'), 422);
        }

        $cart->voucher_code = (string) ($result['voucher']['code'] ?? $voucherCode);
        $cart->voucher_id = (int) ($result['voucher']['id'] ?? 0) ?: null;
        $cart->customer_voucher_id = (int) ($result['customer_voucher_id'] ?? 0) ?: null;
        $cart->voucher_discount_amount = (float) ($result['discount_amount'] ?? 0);
        $cart->voucher_snapshot = [
            'scope_type' => $result['voucher']['scope_type'] ?? 'all',
            'eligible_subtotal' => (float) ($result['eligible_subtotal'] ?? 0),
            'affected_items' => $result['affected_items'] ?? [],
            'display_scope_text' => $result['display_scope_text'] ?? null,
        ];
        $cart->save();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    public function removeVoucher(Request $request)
    {
        $cart = $this->resolveCart((int) $request->user()->id);
        $this->clearVoucherFromCart($cart);

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }




    protected function posCartRefreshResponse(PosCart $cart)
    {
        return $this->respond(['cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'items.bookingProduct.categories', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name', 'appointmentSettlementItems.booking.service', 'appointmentSettlementItems.booking.customer', 'appointmentSettlementItems.booking.staff']))]);
    }

    public function updateCartItemPrice(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'unit_price' => ['required', 'numeric', 'min:0'],
            'line_total' => ['nullable', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->items()->with(['variant.product', 'product'])->findOrFail($itemId);
        $qty = max(1, (int) $item->qty);
        $newBaseUnit = round((float) $validated['unit_price'], 6);
        $snapshots = is_array($item->selected_booking_product_options) ? $item->selected_booking_product_options : [];
        $optionUnitTotal = collect($snapshots)->flatMap(fn ($q) => (array) ($q['options'] ?? []))->sum(fn ($o) => (float) ($o['extra_price'] ?? 0));
        $originalBaseUnit = max(0.0, (float) $item->price_snapshot - (float) $optionUnitTotal);
        $item->price_snapshot = round($newBaseUnit + (float) $optionUnitTotal, 2);
        $baseLineTotal = isset($validated['line_total']) ? round((float) $validated['line_total'], 2) : round($newBaseUnit * $qty, 2);
        $item->price_override_line_total = isset($validated['line_total']) ? $baseLineTotal : null;
        $item->price_override_snapshot = $this->buildOrderPriceOverrideSnapshot($originalBaseUnit, $newBaseUnit, $qty, trim((string) ($validated['reason'] ?? '')) ?: null, (int) $request->user()->id, isset($validated['line_total']) ? $baseLineTotal : null);
        if ($item->discount_type && (float) $item->discount_value > 0) {
            $discount = $this->resolveManualDiscountAmount((string) $item->discount_type, (float) $item->discount_value, $baseLineTotal);
            $this->applyCartLineDiscountSnapshots($item, $discount, max(0.0, $baseLineTotal - $discount));
        }
        $item->save();
        return $this->posCartRefreshResponse($cart);
    }

    public function updateBookingProductOptionPrice(Request $request, int $itemId, int $optionId)
    {
        $validated = $request->validate(['unit_price' => ['required', 'numeric', 'min:0'], 'line_total' => ['nullable', 'numeric', 'min:0'], 'reason' => ['nullable', 'string', 'max:255']]);
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->items()->with(['bookingProduct.categories'])->findOrFail($itemId);
        $snapshots = is_array($item->selected_booking_product_options) ? $item->selected_booking_product_options : [];
        $oldOptionUnitTotal = collect($snapshots)->flatMap(fn ($q) => (array) ($q['options'] ?? []))->sum(fn ($o) => (float) ($o['extra_price'] ?? 0));
        $baseUnit = max(0.0, (float) $item->price_snapshot - (float) $oldOptionUnitTotal);
        $found = false;
        foreach ($snapshots as $questionIndex => $question) {
            foreach ((array) ($question['options'] ?? []) as $optionIndex => $option) {
                if ((int) ($option['id'] ?? 0) !== $optionId) continue;
                $old = (float) ($option['extra_price'] ?? 0);
                $new = round((float) $validated['unit_price'], 6);
                $option['original_unit_price_snapshot'] = (float) ($option['original_unit_price_snapshot'] ?? $old);
                $option['extra_price'] = round($new, 2);
                if (isset($validated['line_total'])) {
                    $option['line_total_override'] = round((float) $validated['line_total'], 2);
                } else {
                    unset($option['line_total_override']);
                }
                $option['price_override_amount'] = round($new - (float) $option['original_unit_price_snapshot'], 2);
                $option['price_override_reason'] = trim((string) ($validated['reason'] ?? '')) ?: null;
                $option['price_overridden_by'] = (int) $request->user()->id;
                $option['price_overridden_at'] = now()->toIso8601String();
                $lineTotal = isset($validated['line_total']) ? round((float) $validated['line_total'], 2) : round($new * max(1, (int) $item->qty), 2);
                if (($option['discount_type'] ?? null) && (float) ($option['discount_value'] ?? 0) > 0) {
                    $discount = $this->resolveManualDiscountAmount((string) $option['discount_type'], (float) $option['discount_value'], $lineTotal);
                    $option['discount_amount'] = $discount;
                    $option['line_total_after_discount'] = max(0.0, $lineTotal - $discount);
                } else { unset($option['discount_amount'], $option['line_total_after_discount']); }
                $snapshots[$questionIndex]['options'][$optionIndex] = $option;
                $found = true; break 2;
            }
        }
        if (! $found) return $this->respondError(__('Booking product option was not found in this cart item.'), 404);
        $item->selected_booking_product_options = $snapshots;
        $item->price_snapshot = round($baseUnit + collect($snapshots)->flatMap(fn ($q) => (array) ($q['options'] ?? []))->sum(fn ($o) => (float) ($o['extra_price'] ?? 0)), 2);
        $item->save();
        return $this->posCartRefreshResponse($cart);
    }

    public function updatePackageCartItemPrice(Request $request, int $itemId)
    {
        $validated = $request->validate(['unit_price' => ['required', 'numeric', 'min:0'], 'line_total' => ['nullable', 'numeric', 'min:0'], 'reason' => ['nullable', 'string', 'max:255']]);
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->packageItems()->findOrFail($itemId);
        $originalUnit = (float) $item->price_snapshot;
        $item->price_snapshot = round((float) $validated['unit_price'], 2);
        $lineTotal = isset($validated['line_total']) ? round((float) $validated['line_total'], 2) : round(((float) $item->price_snapshot) * max(1, (int) $item->qty), 2);
        $item->price_override_line_total = isset($validated['line_total']) ? $lineTotal : null;
        $item->price_override_snapshot = $this->buildOrderPriceOverrideSnapshot($originalUnit, (float) $item->price_snapshot, max(1, (int) $item->qty), trim((string) ($validated['reason'] ?? '')) ?: null, (int) $request->user()->id, isset($validated['line_total']) ? $lineTotal : null);
        if ($item->discount_type && (float) $item->discount_value > 0) {
            $discount = $this->resolveManualDiscountAmount((string) $item->discount_type, (float) $item->discount_value, $lineTotal);
            $this->applyCartLineDiscountSnapshots($item, $discount, max(0.0, $lineTotal - $discount));
        }
        $item->save();
        return $this->posCartRefreshResponse($cart);
    }


    protected function normalizePriceOverrideLines(mixed $value): array
    {
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : [];
        }
        if (! is_array($value)) {
            return [];
        }

        $normalized = [];
        foreach ($value as $lineKey => $override) {
            if (! is_string($lineKey) || ! is_array($override)) {
                continue;
            }
            $final = max(0.0, (float) ($override['final_unit_price'] ?? $override['unit_price_snapshot'] ?? 0));
            $original = max(0.0, (float) ($override['original_unit_price'] ?? $override['original_unit_price_snapshot'] ?? $final));
            $normalized[$lineKey] = [
                'original_unit_price' => round($original, 2),
                'final_unit_price' => round($final, 2),
                'price_override_amount' => round($final - $original, 2),
                'price_override_reason' => $override['price_override_reason'] ?? null,
                'price_overridden_by' => isset($override['price_overridden_by']) ? (int) $override['price_overridden_by'] : null,
                'price_overridden_at' => $override['price_overridden_at'] ?? null,
            ];
        }

        return $normalized;
    }

    protected function applyPriceOverrideToAmount(mixed $owner, string $lineKey, float $currentAmount): array
    {
        $overrides = $this->normalizePriceOverrideLines($owner->price_override_lines ?? []);
        $override = $overrides[$lineKey] ?? null;
        if (! $override) {
            return ['amount' => round(max(0.0, $currentAmount), 2), 'override' => null];
        }

        return ['amount' => round(max(0.0, (float) $override['final_unit_price']), 2), 'override' => $override];
    }

    protected function savePriceOverrideLine(Model $item, string $lineKey, float $originalAmount, float $newAmount, ?string $reason, int $userId): void
    {
        $overrides = $this->normalizePriceOverrideLines($item->getAttribute('price_override_lines') ?? []);
        $existingOriginal = (float) ($overrides[$lineKey]['original_unit_price'] ?? $originalAmount);
        $overrides[$lineKey] = [
            'original_unit_price' => round(max(0.0, $existingOriginal), 2),
            'final_unit_price' => round(max(0.0, $newAmount), 2),
            'price_override_amount' => round(max(0.0, $newAmount) - max(0.0, $existingOriginal), 2),
            'price_override_reason' => $reason,
            'price_overridden_by' => $userId,
            'price_overridden_at' => now()->toIso8601String(),
        ];
        $item->setAttribute('price_override_lines', $overrides);
    }


    protected function buildOrderPriceOverrideSnapshot(float $originalUnit, float $finalUnit, int $quantity, ?string $reason, ?int $userId, ?float $lineTotal = null, ?string $mode = null): array
    {
        $qty = max(1, $quantity);
        $originalUnit = round(max(0.0, $originalUnit), 2);
        $finalUnit = round(max(0.0, $finalUnit), 2);
        $originalLineTotal = round($originalUnit * $qty, 2);
        $adjustedLineTotal = $lineTotal !== null ? round(max(0.0, $lineTotal), 2) : round($finalUnit * $qty, 2);

        return [
            'original_unit_price' => $originalUnit,
            'original_unit_price_snapshot' => $originalUnit,
            'adjusted_unit_price' => $finalUnit,
            'final_unit_price' => $finalUnit,
            'unit_price_snapshot' => $finalUnit,
            'original_line_total' => $originalLineTotal,
            'adjusted_line_total' => $adjustedLineTotal,
            'final_line_total' => $adjustedLineTotal,
            'price_override_amount' => round($finalUnit - $originalUnit, 2),
            'price_override_reason' => $reason,
            'price_override_mode' => $mode ?: ($lineTotal !== null ? 'line_total' : 'unit_price'),
            'price_overridden_by' => $userId,
            'price_overridden_at' => now()->toIso8601String(),
        ];
    }

    protected function normalizeOverrideSnapshotForOrder(mixed $override, int $quantity = 1, ?float $fallbackFinal = null): ?array
    {
        if (! is_array($override)) {
            return null;
        }
        $qty = max(1, $quantity);
        $final = (float) ($override['final_unit_price'] ?? $override['adjusted_unit_price'] ?? $override['unit_price_snapshot'] ?? $fallbackFinal ?? 0);
        $original = (float) ($override['original_unit_price'] ?? $override['original_unit_price_snapshot'] ?? $final);
        $adjustedLine = isset($override['adjusted_line_total']) || isset($override['final_line_total'])
            ? (float) ($override['adjusted_line_total'] ?? $override['final_line_total'])
            : round($final * $qty, 2);

        return [
            ...$override,
            'original_unit_price' => round(max(0.0, $original), 2),
            'original_unit_price_snapshot' => round(max(0.0, $original), 2),
            'adjusted_unit_price' => round(max(0.0, $final), 2),
            'final_unit_price' => round(max(0.0, $final), 2),
            'unit_price_snapshot' => round(max(0.0, $final), 2),
            'original_line_total' => round(max(0.0, (float) ($override['original_line_total'] ?? ($original * $qty))), 2),
            'adjusted_line_total' => round(max(0.0, $adjustedLine), 2),
            'final_line_total' => round(max(0.0, $adjustedLine), 2),
            'price_override_mode' => $override['price_override_mode'] ?? 'unit_price',
        ];
    }

    public function updateServiceCartItemPrice(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'line_key' => ['required', 'string', 'max:180'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->serviceItems()->with(['bookingService'])->findOrFail($itemId);
        $lineKey = trim((string) $validated['line_key']);
        $newAmount = round((float) $validated['unit_price'], 2);
        $original = 0.0;
        if ($lineKey === 'main') {
            $original = (float) ($item->bookingService?->deposit_amount ?? 0);
            if ($original <= 0.0001 && $newAmount <= 0.0001) {
                return $this->respondError(__('This service deposit line is not chargeable.'), 422);
            }
        } elseif (str_starts_with($lineKey, 'addon:')) {
            $addonId = (int) substr($lineKey, 6);
            foreach ((array) ($item->addon_items_json ?? []) as $addon) {
                if ((int) ($addon['id'] ?? 0) === $addonId) {
                    $original = (float) ($addon['linked_deposit_amount'] ?? 0);
                    break;
                }
            }
            if ($addonId <= 0 || ($original <= 0.0001 && $newAmount <= 0.0001)) {
                return $this->respondError(__('This add-on deposit line is not chargeable.'), 422);
            }
        } else {
            return $this->respondError(__('Unknown service deposit line.'), 422);
        }
        $this->savePriceOverrideLine($item, $lineKey, $original, $newAmount, trim((string) ($validated['reason'] ?? '')) ?: null, (int) $request->user()->id);
        $item->save();
        return $this->posCartRefreshResponse($cart);
    }

    public function updateAppointmentSettlementCartItemPrice(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'line_key' => ['required', 'string', 'max:180'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);
        $cart = $this->resolveCart((int) $request->user()->id)->loadMissing('appointmentSettlementItems.booking.service');
        $item = $cart->appointmentSettlementItems->firstWhere('id', $itemId);
        if (! $item || ! $item->booking) {
            return $this->respondError(__('Settlement line was not found.'), 404);
        }
        $summary = $this->resolveAppointmentFinancialSummary($item->booking);
        $lineKey = trim((string) $validated['line_key']);
        $original = $this->resolveAppointmentSettlementLineGross($summary, $lineKey);
        if ($original === null) {
            return $this->respondError(__('Settlement line was not found or is no longer payable.'), 422);
        }
        $this->savePriceOverrideLine($item, $lineKey, (float) $original, round((float) $validated['unit_price'], 2), trim((string) ($validated['reason'] ?? '')) ?: null, (int) $request->user()->id);
        $item->save();
        return $this->posCartRefreshResponse($cart);
    }

    public function updateCartItemDiscount(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'discount_type' => ['nullable', 'in:percentage,fixed'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'discount_remark' => ['nullable', 'string', 'max:255'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->items()->with(['variant.product', 'product'])->findOrFail($itemId);

        $discountType = $validated['discount_type'] ?? null;
        $discountValue = (float) ($validated['discount_value'] ?? 0);

        if (!$discountType || $discountValue <= 0) {
            $item->discount_type = null;
            $item->discount_value = 0;
            $item->discount_remark = null;
            $this->applyCartLineDiscountSnapshots($item, 0.0, null);
            $item->save();

            return $this->respond(['cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'items.bookingProduct.categories', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name']))]);
        }

        $isStaffUser = !empty($request->user()?->staff_id);
        $basePricing = $this->resolvePosCartItemPricing($item, $isStaffUser);
        $baseLineTotal = (float) ($basePricing['booking_product_base_line_total'] ?? $basePricing['line_total_after_promotion'] ?? $basePricing['effective_line_total']);

        if ($discountType === 'percentage' && ($discountValue < 0 || $discountValue > 100)) {
            return $this->respondError(__('Percentage discount must be between 0 and 100.'), 422);
        }

        if ($discountType === 'fixed' && $discountValue > $baseLineTotal) {
            return $this->respondError(__('Fixed discount must not exceed line total.'), 422);
        }

        $discountAmount = $this->resolveManualDiscountAmount((string) $discountType, $discountValue, $baseLineTotal);
        $item->discount_type = $discountType;
        $item->discount_value = $discountValue;
        $item->discount_remark = isset($validated['discount_remark']) ? trim((string) $validated['discount_remark']) : null;
        $this->applyCartLineDiscountSnapshots($item, $discountAmount, max(0.0, $baseLineTotal - $discountAmount));
        $item->save();

        return $this->respond(['cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'items.bookingProduct.categories', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name']))]);
    }

    public function updateBookingProductOptionDiscount(Request $request, int $itemId, int $optionId)
    {
        $validated = $request->validate([
            'discount_type' => ['nullable', 'in:percentage,fixed'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'discount_remark' => ['nullable', 'string', 'max:255'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->items()->with(['bookingProduct.categories'])->findOrFail($itemId);

        if (strtolower((string) ($item->item_type ?? 'product')) !== 'booking_product') {
            return $this->respondError(__('Only booking product option discounts can be updated here.'), 422);
        }

        $snapshots = is_array($item->selected_booking_product_options) ? $item->selected_booking_product_options : [];
        $found = false;
        $lineTotal = 0.0;
        foreach ($snapshots as $questionIndex => $question) {
            if (! is_array($question)) {
                continue;
            }
            $options = is_array($question['options'] ?? null) ? $question['options'] : [];
            foreach ($options as $optionIndex => $option) {
                if ((int) ($option['id'] ?? 0) !== $optionId) {
                    continue;
                }
                $found = true;
                $lineTotal = round(max(0.0, (float) ($option['extra_price'] ?? 0)) * max(1, (int) $item->qty), 2);
                $discountType = $validated['discount_type'] ?? null;
                $discountValue = (float) ($validated['discount_value'] ?? 0);

                if (! $discountType || $discountValue <= 0) {
                    unset(
                        $option['discount_type'],
                        $option['discount_value'],
                        $option['discount_amount'],
                        $option['line_total_after_discount'],
                        $option['discount_remark']
                    );
                } else {
                    if ($discountType === 'percentage' && $discountValue > 100) {
                        return $this->respondError(__('Percentage discount must be between 0 and 100.'), 422);
                    }
                    if ($discountType === 'fixed' && $discountValue > $lineTotal) {
                        return $this->respondError(__('Fixed discount must not exceed option line total.'), 422);
                    }
                    $discountAmount = $this->resolveManualDiscountAmount((string) $discountType, $discountValue, $lineTotal);
                    $option['discount_type'] = $discountType;
                    $option['discount_value'] = $discountValue;
                    $option['discount_amount'] = $discountAmount;
                    $option['line_total_after_discount'] = max(0.0, $lineTotal - $discountAmount);
                    $option['discount_remark'] = isset($validated['discount_remark']) ? trim((string) $validated['discount_remark']) : null;
                }

                $snapshots[$questionIndex]['options'][$optionIndex] = $option;
                break 2;
            }
        }

        if (! $found) {
            return $this->respondError(__('Booking product option was not found in this cart item.'), 404);
        }

        $item->selected_booking_product_options = $snapshots;
        $item->save();

        return $this->respond(['cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'items.bookingProduct.categories', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name']))]);
    }

    protected function appointmentSettlementLineKey(string $kind, array $line, int $index): string
    {
        $identity = $kind === 'service'
            ? ($line['linked_booking_service_id'] ?? $line['id'] ?? $index)
            : (($line['service_ref'] ?? 'original') . ':' . ($line['id'] ?? $line['name'] ?? $index));

        return sprintf('%s:%s:%d', $kind, preg_replace('/[^A-Za-z0-9_.:-]+/', '-', (string) $identity), $index);
    }

    protected function normalizeAppointmentSettlementDiscountLines(mixed $value): array
    {
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : [];
        }
        if (! is_array($value)) {
            return [];
        }

        $normalized = [];
        foreach ($value as $lineKey => $discount) {
            if (! is_string($lineKey) || ! is_array($discount)) {
                continue;
            }
            $type = $discount['discount_type'] ?? null;
            $amount = (float) ($discount['discount_amount'] ?? 0);
            $discountValue = (float) ($discount['discount_value'] ?? 0);
            if (! in_array($type, ['fixed', 'percentage'], true) || $discountValue <= 0) {
                continue;
            }
            $normalized[$lineKey] = [
                'discount_type' => $type,
                'discount_value' => $discountValue,
                'discount_amount' => max(0.0, $amount),
                'discount_remark' => $discount['discount_remark'] ?? null,
            ];
        }

        return $normalized;
    }

    protected function resolveAppointmentSettlementLineGross(array $summary, string $lineKey): ?float
    {
        foreach ((array) ($summary['main_service_settlement_items'] ?? []) as $line) {
            if ((string) ($line['line_key'] ?? '') === $lineKey) {
                $gross = max(0.0, (float) ($line['balance_due'] ?? 0));
                return $gross > 0.0001 ? $gross : null;
            }
        }

        foreach ((array) ($summary['addon_settlement_items'] ?? []) as $line) {
            if ((string) ($line['line_key'] ?? '') === $lineKey) {
                $gross = max(0.0, (float) ($line['balance_due'] ?? 0));
                return $gross > 0.0001 ? $gross : null;
            }
        }

        return null;
    }

    protected function resolveAppointmentSettlementLineDiscount(PosCartAppointmentSettlementItem $item, string $lineKey, float $gross): array
    {
        $discountLines = $this->normalizeAppointmentSettlementDiscountLines($item->discount_lines ?? []);
        $discount = $discountLines[$lineKey] ?? null;
        if (! $discount) {
            return [
                'discount_type' => null,
                'discount_value' => 0.0,
                'discount_amount' => 0.0,
                'discount_remark' => null,
                'line_total_after_discount' => $gross,
            ];
        }

        $amount = $this->resolveManualDiscountAmount((string) $discount['discount_type'], (float) $discount['discount_value'], $gross);

        return [
            'discount_type' => $discount['discount_type'],
            'discount_value' => (float) $discount['discount_value'],
            'discount_amount' => min($gross, $amount),
            'discount_remark' => $discount['discount_remark'] ?? null,
            'line_total_after_discount' => max(0.0, $gross - min($gross, $amount)),
        ];
    }

    protected function resolvePackageCartItemGross(PosCartPackageItem $item): float
    {
        return round((float) ($item->price_override_line_total ?? (((float) $item->price_snapshot) * max(1, (int) $item->qty))), 2);
    }

    public function updatePackageCartItemDiscount(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'discount_type' => ['nullable', 'in:percentage,fixed'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'discount_remark' => ['nullable', 'string', 'max:255'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->packageItems()->findOrFail($itemId);

        $lineTotal = $this->resolvePackageCartItemGross($item);
        return $this->saveNonProductLineDiscount($cart, $item, $validated, $lineTotal);
    }

    public function updateAppointmentSettlementCartItemDiscount(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'line_key' => ['nullable', 'string', 'max:180'],
            'discount_type' => ['nullable', 'in:percentage,fixed'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'discount_remark' => ['nullable', 'string', 'max:255'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id)->loadMissing('appointmentSettlementItems.booking.service');
        $item = $cart->appointmentSettlementItems->firstWhere('id', $itemId);
        if (! $item) {
            abort(404);
        }

        $booking = $item->booking;
        if (! $booking) {
            return $this->respondError(__('Booking not found for settlement line.'), 422);
        }

        $summary = $this->resolveAppointmentFinancialSummary($booking);
        $lineKey = trim((string) ($validated['line_key'] ?? ''));
        if ($lineKey !== '') {
            $lineTotal = $this->resolveAppointmentSettlementLineGross($summary, $lineKey);
            if ($lineTotal === null) {
                return $this->respondError(__('Settlement line was not found or is no longer payable.'), 422);
            }

            return $this->saveAppointmentSettlementLineDiscount($cart, $item, $validated, (float) $lineTotal, $lineKey);
        }

        return $this->respondError(__('Settlement discounts must be applied to an individual settlement line.'), 422);
    }

    protected function saveAppointmentSettlementLineDiscount(PosCart $cart, PosCartAppointmentSettlementItem $item, array $validated, float $lineTotal, string $lineKey)
    {
        $discountType = $validated['discount_type'] ?? null;
        $discountValue = (float) ($validated['discount_value'] ?? 0);
        $discountLines = $this->normalizeAppointmentSettlementDiscountLines($item->discount_lines ?? []);

        if (!$discountType || $discountValue <= 0) {
            unset($discountLines[$lineKey]);
        } else {
            if ($discountType === 'percentage' && $discountValue > 100) {
                return $this->respondError(__('Percentage discount must be between 0 and 100.'), 422);
            }
            if ($discountType === 'fixed' && $discountValue > $lineTotal) {
                return $this->respondError(__('Fixed discount must not exceed line total.'), 422);
            }

            $discountAmount = $this->resolveManualDiscountAmount((string) $discountType, $discountValue, $lineTotal);
            $discountLines[$lineKey] = [
                'discount_type' => $discountType,
                'discount_value' => $discountValue,
                'discount_amount' => $discountAmount,
                'discount_remark' => isset($validated['discount_remark']) ? trim((string) $validated['discount_remark']) : null,
            ];
        }

        $item->discount_lines = empty($discountLines) ? null : $discountLines;
        $item->discount_type = null;
        $item->discount_value = 0;
        $item->discount_remark = null;
        $item->save();

        return $this->respond(['cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name', 'appointmentSettlementItems.booking.service', 'appointmentSettlementItems.booking.customer', 'appointmentSettlementItems.booking.staff']))]);
    }

    protected function saveNonProductLineDiscount(PosCart $cart, Model $item, array $validated, float $lineTotal)
    {
        $discountType = $validated['discount_type'] ?? null;
        $discountValue = (float) ($validated['discount_value'] ?? 0);

        if (!$discountType || $discountValue <= 0) {
            $item->discount_type = null;
            $item->discount_value = 0;
            $item->discount_remark = null;
            $this->applyCartLineDiscountSnapshots($item, 0.0, null);
            $item->save();

            return $this->respond(['cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'items.bookingProduct.categories', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name', 'appointmentSettlementItems.booking.service', 'appointmentSettlementItems.booking.customer', 'appointmentSettlementItems.booking.staff']))]);
        }

        if ($discountType === 'percentage' && $discountValue > 100) {
            return $this->respondError(__('Percentage discount must be between 0 and 100.'), 422);
        }
        if ($discountType === 'fixed' && $discountValue > $lineTotal) {
            return $this->respondError(__('Fixed discount must not exceed line total.'), 422);
        }

        $discountAmount = $this->resolveManualDiscountAmount((string) $discountType, $discountValue, $lineTotal);
        $item->discount_type = $discountType;
        $item->discount_value = $discountValue;
        $item->discount_remark = isset($validated['discount_remark']) ? trim((string) $validated['discount_remark']) : null;
        $this->applyCartLineDiscountSnapshots($item, $discountAmount, max(0.0, $lineTotal - $discountAmount));
        $item->save();

        return $this->respond(['cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'items.bookingProduct.categories', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'serviceItems.customer:id,name', 'packageItems.servicePackage', 'packageItems.customer:id,name', 'appointmentSettlementItems.booking.service', 'appointmentSettlementItems.booking.customer', 'appointmentSettlementItems.booking.staff']))]);
    }

    protected function applyCartLineDiscountSnapshots(Model $item, float $discountAmount, ?float $lineTotalAfterDiscount): void
    {
        $table = $item->getTable();
        if (Schema::hasColumn($table, 'discount_amount')) {
            $item->setAttribute('discount_amount', round(max(0.0, $discountAmount), 2));
        }
        if (Schema::hasColumn($table, 'line_total_after_discount')) {
            $item->setAttribute('line_total_after_discount', $lineTotalAfterDiscount === null ? null : round(max(0.0, $lineTotalAfterDiscount), 2));
        }
    }

    public function checkout(Request $request, OrderPaymentService $orderPaymentService)
    {
        $this->mergeJsonPayload($request);

        $hasPaymentsPayload = is_array($request->input('payments')) && count((array) $request->input('payments')) > 0;

        $validated = $request->validate([
            'payment_method' => $hasPaymentsPayload
                ? ['nullable', 'string', 'max:50']
                : ['nullable', 'in:cash,qrpay,billplz_credit_card,credit_card'],
            'payments' => ['nullable', 'array'],
            'payments.*.method' => ['required_with:payments', 'string', 'in:cash,qrpay,credit_card,billplz_credit_card'],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'gt:0'],
            'qr_payment_proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
            'member_id' => ['nullable', 'integer', 'exists:customers,id'],
            'guest_name' => ['nullable', 'string', 'max:255'],
            'guest_phone' => ['nullable', 'string', 'max:32'],
            'guest_email' => ['nullable', 'string', 'email', 'max:255'],
            'items' => ['nullable', 'array'],
            'items.*.cart_item_id' => ['nullable', 'integer'],
            'items.*.staff_splits' => ['nullable', 'array'],
            'items.*.staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'items.*.staff_splits.*.share_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'items.*.line_staff_splits' => ['nullable', 'array'],
            'items.*.line_staff_splits.*.line_key' => ['nullable', 'string', 'max:255'],
            'items.*.line_staff_splits.*.line_type' => ['required_with:items.*.line_staff_splits', 'string', 'max:80'],
            'items.*.line_staff_splits.*.line_ref_id' => ['nullable'],
            'items.*.line_staff_splits.*.staff_splits' => ['nullable', 'array'],
            'items.*.line_staff_splits.*.staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'items.*.line_staff_splits.*.staff_splits.*.share_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'service_items' => ['nullable', 'array'],
            'service_items.*.type' => ['nullable', 'in:service'],
            'service_items.*.cart_service_item_id' => ['nullable', 'integer'],
            'service_items.*.booking_service_id' => ['nullable', 'integer', 'exists:booking_services,id'],
            'service_items.*.quantity' => ['nullable', 'integer', 'min:1'],
            'service_items.*.customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'service_items.*.assigned_staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
            'service_items.*.start_at' => ['nullable', 'date'],
            'service_items.*.service_commission_rate_used' => ['nullable', 'numeric', 'min:0'],
            'service_items.*.line_staff_splits' => ['nullable', 'array'],
            'service_items.*.line_staff_splits.*.line_key' => ['nullable', 'string', 'max:255'],
            'service_items.*.line_staff_splits.*.line_type' => ['required_with:service_items.*.line_staff_splits', 'string', 'max:80'],
            'service_items.*.line_staff_splits.*.line_ref_id' => ['nullable'],
            'service_items.*.line_staff_splits.*.staff_splits' => ['nullable', 'array'],
            'service_items.*.line_staff_splits.*.staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'service_items.*.line_staff_splits.*.staff_splits.*.share_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'settlement_line_staff_splits' => ['nullable', 'array'],
            'settlement_line_staff_splits.*.settlement_cart_item_id' => ['nullable', 'integer'],
            'settlement_line_staff_splits.*.line_key' => ['nullable', 'string', 'max:255'],
            'settlement_line_staff_splits.*.line_type' => ['required_with:settlement_line_staff_splits', 'string', 'max:80'],
            'settlement_line_staff_splits.*.line_ref_id' => ['nullable'],
            'settlement_line_staff_splits.*.staff_splits' => ['nullable', 'array'],
            'settlement_line_staff_splits.*.staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'settlement_line_staff_splits.*.staff_splits.*.share_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'package_items' => ['nullable', 'array'],
            'package_items.*.type' => ['nullable', 'in:service_package'],
            'package_items.*.cart_package_item_id' => ['nullable', 'integer'],
            'package_items.*.service_package_id' => ['nullable', 'integer', 'exists:service_packages,id'],
            'package_items.*.quantity' => ['nullable', 'integer', 'min:1'],
            'package_items.*.snapshot_name' => ['nullable', 'string', 'max:255'],
            'package_items.*.snapshot_price' => ['nullable', 'numeric', 'min:0'],
            'package_items.*.customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'package_items.*.staff_splits' => ['nullable', 'array'],
            'package_items.*.staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'package_items.*.staff_splits.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id)->load([
            'items.variant.product',
            'items.product',
            'serviceItems.bookingService',
            'serviceItems.assignedStaff:id,name,is_active',
            'serviceItems.customer:id,name',
            'packageItems.servicePackage',
            'packageItems.customer:id,name',
            'appointmentSettlementItems.booking.customer:id,name',
            'appointmentSettlementItems.booking.service:id,name,cn_name,cn_name,cn_name,service_price,price,price_mode,price_range_min,price_range_max,service_type',
            'appointmentSettlementItems.booking.staff:id,name',
        ]);
        if ($cart->items->isEmpty() && $cart->serviceItems->isEmpty() && $cart->packageItems->isEmpty() && $cart->appointmentSettlementItems->isEmpty()) {
            return $this->respondError(__('POS cart is empty.'), 422);
        }

        $serviceItemsPayload = collect($validated['service_items'] ?? []);
        if ($serviceItemsPayload->isNotEmpty()) {
            $servicePayloadByCartId = $serviceItemsPayload
                ->filter(fn (array $item) => !empty($item['cart_service_item_id']))
                ->keyBy(fn (array $item) => (int) $item['cart_service_item_id']);

            foreach ($cart->serviceItems as $serviceItem) {
                $payloadItem = $servicePayloadByCartId->get((int) $serviceItem->id);
                if (!$payloadItem) {
                    continue;
                }

                if (!empty($payloadItem['booking_service_id']) && (int) $payloadItem['booking_service_id'] !== (int) $serviceItem->booking_service_id) {
                    return $this->respondError(__('Service item mismatch in checkout payload.'), 422);
                }

                if (!empty($payloadItem['assigned_staff_id']) && (int) $payloadItem['assigned_staff_id'] !== (int) ($serviceItem->assigned_staff_id ?? 0)) {
                    return $this->respondError(__('Assigned staff mismatch in checkout payload.'), 422);
                }

                if (!empty($payloadItem['customer_id']) && (int) $payloadItem['customer_id'] !== (int) ($serviceItem->customer_id ?? 0)) {
                    return $this->respondError(__('Customer mismatch in checkout payload.'), 422);
                }
            }
        }

        $packageItemsPayload = collect($validated['package_items'] ?? []);
        if ($packageItemsPayload->isNotEmpty()) {
            $packagePayloadByCartId = $packageItemsPayload
                ->filter(fn (array $item) => !empty($item['cart_package_item_id']))
                ->keyBy(fn (array $item) => (int) $item['cart_package_item_id']);


            $packagePayloadByCartId = collect($validated['package_items'] ?? [])
                ->filter(fn (array $item) => !empty($item['cart_package_item_id']))
                ->keyBy(fn (array $item) => (int) $item['cart_package_item_id']);

            foreach ($cart->packageItems as $packageItem) {
                $payloadItem = $packagePayloadByCartId->get((int) $packageItem->id);
                if (!$payloadItem) {
                    continue;
                }

                if (!empty($payloadItem['type']) && (string) $payloadItem['type'] !== 'service_package') {
                    return $this->respondError(__('Invalid package item type in checkout payload.'), 422);
                }

                if (!empty($payloadItem['service_package_id']) && (int) $payloadItem['service_package_id'] !== (int) $packageItem->service_package_id) {
                    return $this->respondError(__('Package item mismatch in checkout payload.'), 422);
                }

                if (!empty($payloadItem['customer_id']) && (int) $payloadItem['customer_id'] !== (int) ($packageItem->customer_id ?? 0)) {
                    return $this->respondError(__('Package member mismatch in checkout payload.'), 422);
                }

                $splitRows = collect($payloadItem['staff_splits'] ?? [])->values();
                if ($splitRows->isEmpty()) {
                    return $this->respondError(__('Staff split is required for service package checkout.'), 422);
                }

                $sum = (int) $splitRows->sum(fn (array $split) => (int) ($split['share_percent'] ?? 0));
                $uniqueCount = $splitRows->pluck('staff_id')->filter()->unique()->count();
                if ($sum !== 100 || $uniqueCount !== $splitRows->count()) {
                    return $this->respondError(__('Invalid service package staff split. Total must be 100% and staffs must be unique.'), 422);
                }
            }
        }

        [$order, $receiptUrl, $purchasedPackageLines, $confirmedBookingIds] = DB::transaction(function () use ($validated, $cart, $request, $orderPaymentService) {
            $confirmedBookingIds = [];
            $packageCustomerIds = $cart->packageItems
                ->pluck('customer_id')
                ->filter(fn ($id) => !empty($id))
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();

            if ($packageCustomerIds->count() > 1) {
                abort(422, __('All package items in one checkout must belong to the same member.'));
            }

            $packageCustomerId = $packageCustomerIds->first();
            $customerId = !empty($validated['member_id']) ? (int) $validated['member_id'] : ($packageCustomerId ?: null);

            $checkoutGuestName = trim((string) ($validated['guest_name'] ?? ''));
            $checkoutGuestPhone = trim((string) ($validated['guest_phone'] ?? ''));
            $checkoutGuestEmail = trim((string) ($validated['guest_email'] ?? ''));
            $checkoutUnknownGuest = str_starts_with(strtoupper($checkoutGuestName), 'UNKNOWN');
            if ($checkoutUnknownGuest) {
                $customerId = null;
                $checkoutGuestPhone = '';
                $checkoutGuestEmail = '';
                foreach ($cart->serviceItems as $row) {
                    $row->update([
                        'customer_id' => null,
                        'guest_name' => 'UNKNOWN',
                        'guest_phone' => null,
                        'guest_email' => null,
                    ]);
                }
            }

            if ($cart->packageItems->isNotEmpty() && empty($customerId)) {
                if ($checkoutUnknownGuest) {
                    abort(422, __('Unknown guest checkout cannot be used when a service package is in the cart. Assign a member first.'));
                }
                abort(422, __('Please assign member before purchasing service package.'));
            }

            if (!empty($customerId) && !empty($packageCustomerId) && (int) $customerId !== (int) $packageCustomerId) {
                abort(422, __('Selected checkout member does not match package member.'));
            }

            if ($cart->appointmentSettlementItems->isNotEmpty()) {
                foreach ($cart->appointmentSettlementItems as $settlementItem) {
                    $stlBooking = $settlementItem->booking;
                    if ($stlBooking && ($stlBooking->service?->price_mode ?? 'fixed') === 'range' && $stlBooking->settled_service_amount === null) {
                        abort(422, __('Please set the service amount for all range-priced settlement items before checkout.'));
                    }
                }

                $settlementCustomerIds = $cart->appointmentSettlementItems
                    ->map(fn (PosCartAppointmentSettlementItem $row) => (int) ($row->booking?->customer_id ?? 0))
                    ->filter(fn (int $id) => $id > 0)
                    ->unique()
                    ->values();

                if ($settlementCustomerIds->count() === 1) {
                    $settlementCustomerId = (int) $settlementCustomerIds->first();
                    if (empty($customerId)) {
                        $customerId = $settlementCustomerId;
                    }
                    if ((int) $customerId !== $settlementCustomerId) {
                        abort(422, __('Selected checkout member does not match settlement member.'));
                    }
                } elseif ($settlementCustomerIds->count() === 0) {
                    // Guest settlement: allow checkout without member, but do not allow mixing with packages.
                    if ($cart->packageItems->isNotEmpty()) {
                        abort(422, __('Cannot checkout guest settlement together with service packages.'));
                    }
                    $guestKeys = $cart->appointmentSettlementItems
                        ->map(fn (PosCartAppointmentSettlementItem $row) => $this->resolvePosGuestIdentityKey($row->booking))
                        ->filter(fn (?string $key) => ! empty($key))
                        ->unique()
                        ->values();
                    if ($guestKeys->count() !== 1) {
                        abort(422, __('All appointment settlement items in one checkout must belong to the same guest.'));
                    }
                    // Force member to be null for guest settlement.
                    $customerId = null;
                } else {
                    abort(422, __('All appointment settlement items in one checkout must belong to the same member or guest.'));
                }
            }

            $isStaffUser = !empty($request->user()?->staff_id);

            $cartPricing = $this->buildCartPricing($cart, $isStaffUser);
            $packageSubtotal = (float) $cart->packageItems->sum(function (PosCartPackageItem $item) {
                $lineTotal = $this->resolvePackageCartItemGross($item);
                $discountAmount = $this->resolveManualDiscountAmount((string) ($item->discount_type ?? ''), (float) ($item->discount_value ?? 0), $lineTotal);
                return max(0.0, $lineTotal - $discountAmount);
            });
            $depositTotal = $this->resolvePosBookingDepositForCart($cart);
            $settlementTotal = (float) $cart->appointmentSettlementItems->sum(function (PosCartAppointmentSettlementItem $row) {
                $booking = $row->booking;
                if (! $booking) return 0.0;
                $summary = $this->resolveAppointmentFinancialSummary($booking);
                $lineTotal = max(0.0, (float) ($summary['balance_due'] ?? 0));
                $discountLines = $this->normalizeAppointmentSettlementDiscountLines($row->discount_lines ?? []);
                if (! empty($discountLines)) {
                    $lineDiscountTotal = 0.0;
                    foreach ((array) ($summary['main_service_settlement_items'] ?? []) as $line) {
                        $gross = max(0.0, (float) ($line['balance_due'] ?? 0));
                        $discount = $this->resolveAppointmentSettlementLineDiscount($row, (string) ($line['line_key'] ?? ''), $gross);
                        $lineDiscountTotal += (float) ($discount['discount_amount'] ?? 0);
                    }
                    foreach ((array) ($summary['addon_settlement_items'] ?? []) as $line) {
                        $gross = max(0.0, (float) ($line['balance_due'] ?? 0));
                        $discount = $this->resolveAppointmentSettlementLineDiscount($row, (string) ($line['line_key'] ?? ''), $gross);
                        $lineDiscountTotal += (float) ($discount['discount_amount'] ?? 0);
                    }

                    return max(0.0, $lineTotal - round($lineDiscountTotal, 2));
                }

                $discountAmount = $this->resolveManualDiscountAmount((string) ($row->discount_type ?? ''), (float) ($row->discount_value ?? 0), $lineTotal);
                return max(0.0, $lineTotal - $discountAmount);
            });
            $subtotal = (float) $cartPricing['subtotal'] + $packageSubtotal + $depositTotal + $settlementTotal;
            $discountTotal = 0.0;
            $voucherData = null;

            if (!empty($cart->voucher_code)) {
                $customer = !empty($customerId) ? Customer::query()->find((int) $customerId) : null;
                $customerVoucher = null;
                if (!empty($cart->customer_voucher_id) && $customer) {
                    $customerVoucher = CustomerVoucher::query()
                        ->with('voucher')
                        ->where('id', (int) $cart->customer_voucher_id)
                        ->where('customer_id', $customer->id)
                        ->first();
                }

                $voucherResult = $this->voucherEligibilityService->validateVoucherForCart(
                    (string) $cart->voucher_code,
                    $customer,
                    $this->serializeCartItemsForVoucher($cart),
                    (float) $subtotal,
                    $customerVoucher,
                );

                if ($voucherResult['is_valid']) {
                    $discountTotal = (float) ($voucherResult['discount_amount'] ?? 0);
                    $voucherData = [
                        'id' => $voucherResult['voucher']['id'] ?? null,
                        'customer_voucher_id' => $voucherResult['customer_voucher_id'] ?? null,
                        'code' => $voucherResult['voucher']['code'] ?? $cart->voucher_code,
                        'scope_snapshot' => [
                            'scope_type' => $voucherResult['voucher']['scope_type'] ?? 'all',
                            'eligible_subtotal' => $voucherResult['eligible_subtotal'] ?? 0,
                            'affected_items' => $voucherResult['affected_items'] ?? [],
                            'display_scope_text' => $voucherResult['display_scope_text'] ?? null,
                        ],
                    ];
                }
            }

            $grandTotal = max(0, $subtotal - $discountTotal);
            $paymentRows = $this->resolveOrderPaymentRows($validated, $grandTotal);

            $guestName = trim((string) ($validated['guest_name'] ?? ''));
            $guestPhone = trim((string) ($validated['guest_phone'] ?? ''));
            $guestEmail = trim((string) ($validated['guest_email'] ?? ''));
            $hasGuestPayload = $guestName !== '' || $guestPhone !== '' || $guestEmail !== '';
            if ($hasGuestPayload) {
                $isUnknownGuest = str_starts_with(strtoupper($guestName), 'UNKNOWN');
                if ($guestName === '' && $guestPhone === '' && $guestEmail === '') {
                    $guestName = 'UNKNOWN';
                    $isUnknownGuest = true;
                }
                if (! $isUnknownGuest && $guestName === '') {
                    abort(422, __('Guest name is required when providing guest details.'));
                }
                if ($guestPhone !== '' && ! $isUnknownGuest && ! preg_match('/^\+?[0-9]{8,15}$/', $guestPhone)) {
                    abort(422, __('Invalid guest phone.'));
                }
                if ($isUnknownGuest) {
                    $guestPhone = '';
                    $guestEmail = '';
                }
            }

            if (empty($customerId) && ! $hasGuestPayload) {
                $guestLine = $cart->serviceItems->first(function (PosCartServiceItem $item) {
                    return empty($item->customer_id)
                        && trim((string) ($item->guest_name ?? '')) !== '';
                });
                if ($guestLine) {
                    $guestName = trim((string) ($guestLine->guest_name ?? ''));
                    $guestPhone = trim((string) ($guestLine->guest_phone ?? ''));
                    $guestEmail = trim((string) ($guestLine->guest_email ?? ''));
                    if (str_starts_with(strtoupper($guestName), 'UNKNOWN')) {
                        $guestPhone = '';
                        $guestEmail = '';
                        $hasGuestPayload = true;
                    } elseif ($guestName !== '') {
                        $hasGuestPayload = true;
                    }
                }
            }
            if (empty($customerId) && ! $hasGuestPayload && $cart->appointmentSettlementItems->isNotEmpty()) {
                $guestBooking = $cart->appointmentSettlementItems
                    ->map(fn (PosCartAppointmentSettlementItem $row) => $row->booking)
                    ->filter()
                    ->first(function (Booking $booking) {
                        return empty($booking->customer_id)
                            && $this->resolvePosGuestIdentityKey($booking) !== null;
                    });
                if ($guestBooking) {
                    $guestName = trim((string) ($guestBooking->guest_name ?? ''));
                    $guestPhone = trim((string) ($guestBooking->guest_phone ?? ''));
                    $guestEmail = trim((string) ($guestBooking->guest_email ?? ''));
                    if (str_starts_with(strtoupper($guestName), 'UNKNOWN')) {
                        $guestPhone = '';
                        $guestEmail = '';
                        $hasGuestPayload = true;
                    } elseif ($guestName !== '' && $guestPhone !== '' && $guestEmail !== '' && preg_match('/^\+?[0-9]{8,15}$/', $guestPhone)) {
                        $hasGuestPayload = true;
                    } elseif ($guestName !== '') {
                        $hasGuestPayload = true;
                    }
                }
            }

            $invoiceProfile = SettingService::get('ecommerce.invoice_profile', []);
            $walkInBillTo = data_get($invoiceProfile, 'pos_walk_in_bill_to', [
                'name' => 'Loyalty Tester',
                'phone' => '0123456789',
                'email' => 'loyalty.tester@example.com',
            ]);

            $posBillingName = null;
            $posBillingPhone = null;
            $posPaymentMeta = null;
            if (! empty($customerId)) {
                // Invoice "Bill To" uses customer relation when member is assigned.
            } elseif ($hasGuestPayload) {
                $posBillingName = $guestName;
                $posBillingPhone = $guestPhone;
                $posPaymentMeta = ['pos_billing_email' => $guestEmail];
            } else {
                $posBillingName = (string) (data_get($walkInBillTo, 'name') ?: 'Loyalty Tester');
                $posBillingPhone = (string) (data_get($walkInBillTo, 'phone') ?: '');
                $posPaymentMeta = ['pos_billing_email' => (string) (data_get($walkInBillTo, 'email') ?: '')];
            }

            $order = Order::create([
                'order_number' => $this->generateOrderNumber(),
                'customer_id' => $customerId,
                'created_by_user_id' => $request->user()->id,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => $this->orderPaymentMethodForRows($paymentRows),
                'payment_provider' => 'manual',
                'subtotal' => $subtotal,
                'discount_total' => $discountTotal,
                'shipping_fee' => 0,
                'grand_total' => $grandTotal,
                'pickup_or_shipping' => 'in_store',
                'pickup_store_id' => null,
                'billing_name' => $posBillingName,
                'billing_phone' => $posBillingPhone,
                'payment_meta' => $posPaymentMeta,
                'placed_at' => now(),
                'paid_at' => now(),
                'completed_at' => now(),
                'notes' => 'POS checkout by staff #' . $request->user()->id . ' | booking_deposit=' . number_format((float) $depositTotal, 2, '.', ''),
                'promotion_snapshot' => $cartPricing['promotions'] ?? [],
            ]);

            $purchasedPackageLines = [];

            $packagePayloadByCartId = collect($validated['package_items'] ?? [])
                ->filter(fn (array $item) => !empty($item['cart_package_item_id']))
                ->keyBy(fn (array $item) => (int) $item['cart_package_item_id']);

            $staffSplitsByCartItemId = collect($validated['items'] ?? [])->mapWithKeys(function (array $item) {
                $cartItemId = isset($item['cart_item_id']) ? (int) $item['cart_item_id'] : 0;
                return $cartItemId > 0 ? [$cartItemId => collect($item['staff_splits'] ?? [])->values()->all()] : [];
            });

            $lineStaffSplitsByCartItemId = collect($validated['items'] ?? [])->mapWithKeys(function (array $item) {
                $cartItemId = isset($item['cart_item_id']) ? (int) $item['cart_item_id'] : 0;
                return $cartItemId > 0 ? [$cartItemId => collect($item['line_staff_splits'] ?? [])->values()->all()] : [];
            });

            $lineStaffSplitsByServiceItemId = collect($validated['service_items'] ?? [])->mapWithKeys(function (array $item) {
                $cartServiceItemId = isset($item['cart_service_item_id']) ? (int) $item['cart_service_item_id'] : 0;
                return $cartServiceItemId > 0 ? [$cartServiceItemId => collect($item['line_staff_splits'] ?? [])->values()->all()] : [];
            });

            $lineStaffSplitsBySettlementItemId = collect($validated['settlement_line_staff_splits'] ?? [])
                ->groupBy(fn (array $line) => (int) ($line['settlement_cart_item_id'] ?? 0));

            $staffIds = $staffSplitsByCartItemId
                ->flatMap(fn (array $splits) => collect($splits)->pluck('staff_id'))
                ->merge($lineStaffSplitsByCartItemId->flatMap(fn (array $lines) => collect($lines)->flatMap(fn (array $line) => collect($line['staff_splits'] ?? [])->pluck('staff_id'))))
                ->merge($lineStaffSplitsByServiceItemId->flatMap(fn (array $lines) => collect($lines)->flatMap(fn (array $line) => collect($line['staff_splits'] ?? [])->pluck('staff_id'))))
                ->merge($lineStaffSplitsBySettlementItemId->flatMap(fn ($lines) => collect($lines)->flatMap(fn (array $line) => collect($line['staff_splits'] ?? [])->pluck('staff_id'))))
                ->filter()
                ->map(fn ($staffId) => (int) $staffId)
                ->unique()
                ->values();

            $staffCommissionRates = DB::table('staffs')
                ->whereIn('id', $staffIds)
                ->pluck('service_commission_rate', 'id')
                ->map(fn ($rate) => (float) $rate)
                ->all();

            $persistOrderItemLineSplits = function (OrderItem $orderItem, $splits, string $lineType, ?string $lineRefId, float $amountBasis, array $snapshot = []) use ($staffCommissionRates): void {
                $splitRows = collect($splits ?? [])->map(fn ($split) => [
                    'staff_id' => (int) ($split['staff_id'] ?? 0),
                    'share_percent' => (int) ($split['share_percent'] ?? 0),
                ])->filter(fn (array $split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)->values();

                if ($splitRows->isEmpty()) {
                    return;
                }

                $sum = (int) $splitRows->sum('share_percent');
                $uniqueCount = $splitRows->pluck('staff_id')->unique()->count();
                if ($sum !== 100 || $uniqueCount !== $splitRows->count()) {
                    abort(422, __('Invalid line staff split.'));
                }

                foreach ($splitRows as $split) {
                    OrderItemStaffSplit::query()->create([
                        'order_item_id' => (int) $orderItem->id,
                        'line_type' => $lineType,
                        'line_ref_id' => $lineRefId,
                        'staff_id' => (int) $split['staff_id'],
                        'share_percent' => (int) $split['share_percent'],
                        'amount_basis' => round(max(0, $amountBasis), 2),
                        'commission_rate_snapshot' => (float) ($staffCommissionRates[(int) $split['staff_id']] ?? 0),
                        'snapshot' => $snapshot,
                    ]);
                }
            };

            $findLineSplitPayload = function ($linePayloads, string $lineKey) {
                return collect($linePayloads ?? [])->first(function (array $line) use ($lineKey) {
                    $payloadKey = (string) ($line['line_key'] ?? '');
                    return $payloadKey === $lineKey || str_ends_with($payloadKey, ':' . $lineKey);
                });
            };

            $resolveLineSplits = function ($linePayloads, string $lineKey, $fallbackSplits = []) use ($findLineSplitPayload) {
                $payload = $findLineSplitPayload($linePayloads, $lineKey);

                return $payload ? collect($payload['staff_splits'] ?? [])->values()->all() : collect($fallbackSplits ?? [])->values()->all();
            };

            $lineSplitSource = function ($linePayloads, string $lineKey, string $fallbackSource = 'inherited') use ($findLineSplitPayload): string {
                return $findLineSplitPayload($linePayloads, $lineKey) ? 'explicit' : $fallbackSource;
            };

            $serviceClaimStatuses = $this->resolveServiceItemClaimStatuses($cart);
            $depositBreakdown = $this->resolvePosBookingDepositBreakdown($cart, $serviceClaimStatuses);
            $depositByServiceItemId = collect($depositBreakdown['deposit_by_service_item'] ?? [])
                ->mapWithKeys(fn ($amount, $id) => [(int) $id => (float) $amount])
                ->all();
            $depositAddonByServiceItemId = collect($depositBreakdown['deposit_by_service_item_addons'] ?? [])
                ->mapWithKeys(fn ($rows, $id) => [(int) $id => is_array($rows) ? $rows : []])
                ->all();

            foreach ($cart->items as $item) {
                $itemType = strtoupper((string) ($item->item_type ?? 'product'));
                if ($itemType === 'BOOKING_PRODUCT' || $itemType === 'booking_product') {
                    $bookingProduct = BookingProduct::query()
                        ->where('is_active', true)
                        ->find((int) ($item->booking_product_id ?? 0));
                    if (! $bookingProduct) {
                        abort(422, __('Booking product is not available for checkout.'));
                    }

                    $itemSplits = collect($staffSplitsByCartItemId->get((int) $item->id, []));
                    $pricing = $cartPricing['items'][(int) $item->id] ?? $this->resolvePosCartItemPricing($item, $isStaffUser);
                    $lineTotal = round((float) ($pricing['line_total_snapshot'] ?? (((float) $item->price_snapshot) * (int) $item->qty)), 2);
                    $lineNetTotal = round((float) ($pricing['line_total_after_discount'] ?? $pricing['effective_line_total'] ?? $lineTotal), 2);
                    $effectiveUnitPrice = (int) $item->qty > 0 ? round($lineNetTotal / (int) $item->qty, 2) : 0.0;
                    $orderItem = OrderItem::create([
                        'order_id' => $order->id,
                        'line_type' => 'booking_product',
                        'product_id' => null,
                        'product_variant_id' => null,
                        'product_name_snapshot' => (string) $bookingProduct->name,
                        'display_name_snapshot' => (string) $bookingProduct->name,
                        'variant_name_snapshot' => $bookingProduct->cn_name,
                        'selected_booking_product_options' => $item->selected_booking_product_options,
                        'price_snapshot' => (float) $item->price_snapshot,
                        'unit_price_snapshot' => (float) $item->price_snapshot,
                        'quantity' => (int) $item->qty,
                        'line_total' => (float) $lineNetTotal,
                        'line_total_snapshot' => (float) $lineTotal,
                        'effective_unit_price' => (float) $effectiveUnitPrice,
                        'effective_line_total' => (float) $lineNetTotal,
                        'discount_type' => $item->discount_type,
                        'discount_value' => (float) ($item->discount_value ?? 0),
                        'discount_remark' => $item->discount_remark,
                        'discount_amount' => (float) ($pricing['total_manual_discount_amount'] ?? $pricing['manual_discount_amount'] ?? 0),
                        'line_total_after_discount' => (float) $lineNetTotal,
                        'price_override_snapshot' => $this->normalizeOverrideSnapshotForOrder($item->price_override_snapshot ?? null, (int) $item->qty, $effectiveUnitPrice),
                        'staff_id' => $itemSplits->first()['staff_id'] ?? null,
                        'locked' => true,
                    ]);

                    $bookingProductOptionSnapshots = collect($item->selected_booking_product_options ?? [])
                        ->flatMap(fn ($question) => collect($question['options'] ?? []))
                        ->filter(fn ($option) => is_array($option))
                        ->values();

                    $bookingProductCommissionLines = $this->resolveBookingProductCommissionLines(
                        (int) $item->id,
                        (int) $item->qty,
                        $lineNetTotal,
                        $bookingProductOptionSnapshots,
                        $itemSplits->values()->all(),
                        $lineStaffSplitsByCartItemId->get((int) $item->id, []),
                    );

                    if ($itemSplits->isNotEmpty()) {
                        $sum = (int) $itemSplits->sum(fn (array $split) => (int) ($split['share_percent'] ?? 0));
                        $uniqueCount = $itemSplits->pluck('staff_id')->filter()->unique()->count();
                        if ($sum !== 100 || $uniqueCount !== $itemSplits->count()) {
                            abort(422, __('Invalid staff split.'));
                        }

                        $baseCommissionLine = collect($bookingProductCommissionLines)
                            ->first(fn (array $line) => ($line['line_type'] ?? '') === 'booking_product_base');
                        foreach (($baseCommissionLine['staff_splits'] ?? []) as $split) {
                            OrderItemStaffSplit::create([
                                'order_item_id' => $orderItem->id,
                                'line_type' => 'booking_product_base',
                                'line_ref_id' => (string) $item->id,
                                'staff_id' => (int) $split['staff_id'],
                                'share_percent' => (int) $split['share_percent'],
                                'amount_basis' => (float) ($baseCommissionLine['amount_basis'] ?? 0),
                                'commission_rate_snapshot' => (float) ($staffCommissionRates[(int) $split['staff_id']] ?? 0),
                                'snapshot' => [
                                    'cart_item_id' => (int) $item->id,
                                    'line_type' => 'booking_product_base',
                                    'staff_split_source' => 'parent',
                                ],
                            ]);
                        }
                    }


                    foreach ($bookingProductCommissionLines as $commissionLine) {
                        if (($commissionLine['line_type'] ?? '') !== 'booking_product_option') {
                            continue;
                        }
                        $optionSnapshot = $commissionLine['option'] ?? [];
                        $optionId = (string) ($commissionLine['line_ref_id'] ?? ($optionSnapshot['id'] ?? ''));
                        if ($optionId === '') {
                            continue;
                        }
                        $splits = collect($commissionLine['staff_splits'] ?? [])->values();
                        if ($splits->isEmpty()) {
                            continue;
                        }
                        $sum = (int) $splits->sum(fn (array $split) => (int) ($split['share_percent'] ?? 0));
                        $uniqueCount = $splits->pluck('staff_id')->filter()->unique()->count();
                        if ($sum !== 100 || $uniqueCount !== $splits->count()) {
                            abort(422, __('Invalid line staff split.'));
                        }
                        foreach ($splits as $split) {
                            OrderItemStaffSplit::create([
                                'order_item_id' => $orderItem->id,
                                'line_type' => 'booking_product_option',
                                'line_ref_id' => $optionId,
                                'staff_id' => (int) $split['staff_id'],
                                'share_percent' => (int) $split['share_percent'],
                                'amount_basis' => (float) ($commissionLine['amount_basis'] ?? 0),
                                'commission_rate_snapshot' => (float) ($staffCommissionRates[(int) $split['staff_id']] ?? 0),
                                'snapshot' => [
                                    'cart_item_id' => (int) $item->id,
                                    'line_key' => $commissionLine['line_key'] ?? sprintf('booking_product_option:%s', $optionId),
                                    'staff_split_source' => $commissionLine['staff_split_source'] ?? 'inherited',
                                    'option' => $optionSnapshot,
                                ],
                            ]);
                        }
                    }

                    continue;
                }
                $variant = $item->variant;
                $product = $variant?->product ?? $item->product;
                if (! $product) {
                    continue;
                }

                if ($variant) {
                    $availableQty = $this->resolveVariantAvailableQty($variant);
                    if ($availableQty !== null && $item->qty > $availableQty) {
                        abort(422, __('Insufficient stock for :sku', ['sku' => $variant->sku ?? $variant->id]));
                    }
                }

                if (! $variant && $product->track_stock && $item->qty > (int) $product->stock) {
                    abort(422, __('Insufficient stock for :sku', ['sku' => $product->sku ?? $product->id]));
                }

                $pricing = $cartPricing['items'][(int) $item->id] ?? $this->resolvePosCartItemPricing($item, $isStaffUser);
                $itemSplits = collect($staffSplitsByCartItemId->get((int) $item->id, []));
                $resolvedUnitCost = (float) ($variant
                    ? ($variant->is_bundle ? $variant->derivedCostPrice() : $variant->cost_price)
                    : $product->cost_price
                );
                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'line_type' => 'product',
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                    'product_name_snapshot' => $product->name,
                    'display_name_snapshot' => $product->name,
                    'sku_snapshot' => $product->sku,
                    'variant_name_snapshot' => $variant?->title,
                    'variant_sku_snapshot' => $variant?->sku,
                    'price_snapshot' => $pricing['unit_price_snapshot'],
                    'unit_price_snapshot' => $pricing['unit_price_snapshot'],
                    'variant_price_snapshot' => $variant?->price,
                    'variant_cost_snapshot' => $variant?->is_bundle ? $variant?->derivedCostPrice() : $variant?->cost_price,
                    'cost_price_snapshot' => $resolvedUnitCost,
                    'cost_amount_snapshot' => round($resolvedUnitCost * (int) $item->qty, 2),
                    'quantity' => $item->qty,
                    'line_total' => $pricing['effective_line_total'],
                    'line_total_snapshot' => $pricing['line_total_snapshot'],
                    'effective_unit_price' => $pricing['effective_unit_price'],
                    'effective_line_total' => $pricing['effective_line_total'],
                    'is_staff_free_applied' => $pricing['is_staff_free_applied'],
                    'discount_type' => $item->discount_type,
                    'discount_value' => (float) ($item->discount_value ?? 0),
                    'discount_remark' => $item->discount_remark,
                    'discount_amount' => (float) ($pricing['manual_discount_amount'] ?? 0),
                    'line_total_after_discount' => (float) ($pricing['line_total_after_discount'] ?? $pricing['effective_line_total']),
                    'price_override_snapshot' => $this->normalizeOverrideSnapshotForOrder($item->price_override_snapshot ?? null, (int) $item->qty, (float) ($pricing['effective_unit_price'] ?? 0)),
                    'promotion_id' => $pricing['promotion_id'] ?? null,
                    'promotion_name_snapshot' => $pricing['promotion_name'] ?? null,
                    'promotion_type_snapshot' => $pricing['promotion_type'] ?? null,
                    'promotion_discount_amount' => (float) ($pricing['promotion_discount_amount'] ?? 0),
                    'promotion_applied' => (bool) ($pricing['promotion_applied'] ?? false),
                    'promotion_snapshot' => $pricing['promotion_snapshot'] ?? null,
                    'staff_id' => $itemSplits->first()['staff_id'] ?? null,
                    'locked' => true,
                ]);

                if ($itemSplits->isNotEmpty()) {
                    $sum = (int) $itemSplits->sum(fn (array $split) => (int) ($split['share_percent'] ?? 0));
                    $uniqueCount = $itemSplits->pluck('staff_id')->filter()->unique()->count();
                    if ($sum !== 100 || $uniqueCount !== $itemSplits->count()) {
                        abort(422, __('Invalid staff split.'));
                    }

                    foreach ($itemSplits as $split) {
                        OrderItemStaffSplit::create([
                            'order_item_id' => $orderItem->id,
                            'staff_id' => (int) $split['staff_id'],
                            'share_percent' => (int) $split['share_percent'],
                            'commission_rate_snapshot' => (float) ($staffCommissionRates[(int) $split['staff_id']] ?? 0),
                        ]);
                    }
                }
            }

            foreach ($cart->serviceItems as $serviceItem) {
                if (! $serviceItem->bookingService || ! $serviceItem->bookingService->is_active) {
                    abort(422, __('Service is not available for checkout.'));
                }

                $guestName = trim((string) ($serviceItem->guest_name ?? ''));
                $guestPhone = trim((string) ($serviceItem->guest_phone ?? ''));
                $guestEmail = trim((string) ($serviceItem->guest_email ?? ''));
                $hasGuestSnapshot = $guestName !== '';

                if (! $serviceItem->customer_id && ! $hasGuestSnapshot) {
                    abort(422, __('Each booking service line must have a member or guest details.'));
                }

                if (! $serviceItem->start_at) {
                    abort(422, __('Appointment time is required for booking service item.'));
                }

                if ($serviceItem->assigned_staff_id && ! $serviceItem->assignedStaff) {
                    abort(422, __('Assigned staff is invalid for service checkout.'));
                }

                $startAt = Carbon::parse((string) $serviceItem->start_at);
                $endAt = $serviceItem->end_at ? Carbon::parse((string) $serviceItem->end_at) : $startAt->copy()->addMinutes((int) ($serviceItem->bookingService->duration_min ?? 0));
                $bufferMin = (int) ($serviceItem->bookingService->buffer_min ?? 0);

                if ($serviceItem->assigned_staff_id && ! (bool) ($serviceItem->assignedStaff?->is_active ?? true)) {
                    abort(422, __('Assigned staff is inactive.'));
                }

                $scheduleDiagnostics = $this->availabilityService->getStaffAvailabilityDiagnostics((int) $serviceItem->assigned_staff_id, $startAt, $endAt);
                $scheduleFailureReason = (string) ($scheduleDiagnostics['failure_reason'] ?? '');
                if (! (bool) ($scheduleDiagnostics['is_available'] ?? false)
                    && ! in_array($scheduleFailureReason, ['outside_staff_schedule', 'hits_staff_break'], true)) {
                    abort(409, __('Selected staff is not available on this day.'));
                }

                if ($serviceItem->assigned_staff_id) {
                    $conflictDiagnostics = $this->availabilityService->getConflictDiagnostics((int) $serviceItem->assigned_staff_id, $startAt, $endAt, $bufferMin);
                    if ((bool) ($conflictDiagnostics['has_conflict'] ?? false)) {
                        abort(409, $this->posAvailabilityMessage($this->posAvailabilityReasonCode($conflictDiagnostics)));
                    }
                }

                $scheduleOverride = $this->resolvePosScheduleOverride((int) $serviceItem->assigned_staff_id, $startAt, $endAt, $scheduleDiagnostics, $request->user()?->id);

                $booking = Booking::query()->create([
                    'booking_code' => 'BK-' . now()->format('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                    'source' => 'STAFF',
                    'customer_id' => $serviceItem->customer_id ? (int) $serviceItem->customer_id : null,
                    'guest_name' => $serviceItem->customer_id ? null : ($guestName !== '' ? $guestName : 'UNKNOWN'),
                    'guest_phone' => $serviceItem->customer_id ? null : ($guestPhone !== '' ? $guestPhone : null),
                    'guest_email' => $serviceItem->customer_id ? null : ($guestEmail !== '' ? $guestEmail : null),
                    'staff_id' => $serviceItem->assigned_staff_id,
                    'service_id' => $serviceItem->booking_service_id,
                    'start_at' => $startAt,
                    'end_at' => $endAt,
                    'buffer_min' => $bufferMin,
                    'status' => 'CONFIRMED',
                    'deposit_amount' => 0,
                    'addon_duration_min' => (int) ($serviceItem->addon_duration_min ?? 0),
                    'addon_price' => (float) ($serviceItem->addon_price ?? 0),
                    'addon_items_json' => $serviceItem->addon_items_json ?? [],
                    'payment_status' => 'PAID',
                    'created_by_staff_id' => (int) ($request->user()?->staff_id ?? 0) ?: null,
                    'notes' => $serviceItem->notes,
                    ...$scheduleOverride,
                ]);
                $this->recordScheduleOverrideAudit($booking, $scheduleOverride, $request);

                $confirmedBookingIds[] = (int) $booking->id;

                if ($serviceItem->customer_id) {
                    $this->customerServicePackageService->attachReservedClaimsToBooking(
                        (int) $serviceItem->customer_id,
                        (int) $serviceItem->booking_service_id,
                        'POS',
                        (int) $serviceItem->id,
                        (int) $booking->id,
                    );
                }

                $lineTotal = round(((float) $serviceItem->price_snapshot) * (int) $serviceItem->qty, 2);
                $splits = collect($serviceItem->staff_splits ?? []);
                if ($splits->isEmpty()) {
                    $splits = collect([[
                        'staff_id' => (int) ($serviceItem->assigned_staff_id ?? 0),
                        'share_percent' => 100,
                        'service_commission_rate_snapshot' => (float) ($serviceItem->commission_rate_used ?? 0),
                    ]]);
                }

                DB::table('booking_service_staff_splits')->insert($splits->map(fn (array $split) => [
                    'booking_id' => (int) $booking->id,
                    'staff_id' => (int) ($split['staff_id'] ?? 0),
                    'split_percent' => (int) ($split['share_percent'] ?? 0),
                    'service_commission_rate_snapshot' => (float) ($split['service_commission_rate_snapshot'] ?? 0),
                    'created_at' => now(),
                    'updated_at' => now(),
                ])->filter(fn (array $row) => $row['staff_id'] > 0)->values()->all());

                $commissionRate = (float) ($serviceItem->commission_rate_used ?? 0);
                OrderServiceItem::create([
                    'order_id' => $order->id,
                    'booking_id' => $booking->id,
                    'booking_service_id' => $serviceItem->booking_service_id,
                    'customer_id' => $serviceItem->customer_id ? (int) $serviceItem->customer_id : null,
                    'service_name_snapshot' => $serviceItem->service_name_snapshot,
                    'price_snapshot' => (float) $serviceItem->price_snapshot,
                    'qty' => (int) $serviceItem->qty,
                    'line_total' => $lineTotal,
                    'assigned_staff_id' => $serviceItem->assigned_staff_id,
                    'start_at' => $startAt,
                    'end_at' => $endAt,
                    'notes' => $serviceItem->notes,
                    'staff_splits' => $splits->values()->all(),
                    'commission_rate_used' => $commissionRate,
                    'commission_amount' => round($lineTotal * $commissionRate, 2),
                    'item_type' => 'service',
                ]);

                $claimStatus = $serviceClaimStatuses[(int) $serviceItem->id] ?? null;
                $claimedByPackage = in_array($claimStatus, ['reserved', 'consumed'], true);
                $depositContribution = ! $claimedByPackage
                    ? (float) ($depositByServiceItemId[(int) $serviceItem->id] ?? 0)
                    : 0.0;
                $depositPriceOverride = null;
                if (! $claimedByPackage) {
                    $depositPriceOverrideResult = $this->applyPriceOverrideToAmount($serviceItem, 'main', $depositContribution);
                    $depositContribution = (float) $depositPriceOverrideResult['amount'];
                    $depositPriceOverride = $depositPriceOverrideResult['override'] ?? ($depositByServiceItemOverrides[(int) $serviceItem->id] ?? null);
                }

                $depositOrderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'line_type' => 'booking_deposit',
                    'product_id' => null,
                    'product_name_snapshot' => 'Booking Deposit - ' . (string) ($serviceItem->service_name_snapshot ?: 'Service'),
                    'display_name_snapshot' => 'Booking Deposit - ' . (string) ($serviceItem->service_name_snapshot ?: 'Service'),
                    'quantity' => 1,
                    'price_snapshot' => $depositContribution,
                    'unit_price_snapshot' => $depositContribution,
                    'line_total' => $depositContribution,
                    'line_total_snapshot' => $depositContribution,
                    'effective_unit_price' => $depositContribution,
                    'effective_line_total' => $depositContribution,
                    'locked' => true,
                    'booking_id' => $booking->id,
                    'booking_service_id' => $serviceItem->booking_service_id,
                    'price_override_snapshot' => $this->normalizeOverrideSnapshotForOrder($depositPriceOverride, 1, $depositContribution),
                ]);

                $serviceLinePayloads = $lineStaffSplitsByServiceItemId->get((int) $serviceItem->id, []);
                $mainDepositSplits = $resolveLineSplits($serviceLinePayloads, 'main', $splits->values()->all());
                $persistOrderItemLineSplits($depositOrderItem, $mainDepositSplits, 'service_deposit', (string) $serviceItem->booking_service_id, (float) $depositContribution, [
                    'cart_service_item_id' => (int) $serviceItem->id,
                    'booking_id' => (int) $booking->id,
                    'line_type' => 'service_deposit',
                    'staff_split_source' => $lineSplitSource($serviceLinePayloads, 'main', 'parent'),
                ]);

                foreach (collect($serviceItem->addon_items_json ?? [])->filter(fn ($row) => strtolower((string) ($row['item_kind'] ?? '')) === 'main_service' && ! (bool) ($row['is_original'] ?? false))->values() as $extraMainRow) {
                    $extraMainName = (string) ($extraMainRow['name'] ?? $extraMainRow['label'] ?? 'Service');
                    $extraMainServiceId = (int) ($extraMainRow['linked_booking_service_id'] ?? 0);
                    $extraMainOrderItem = OrderItem::create([
                        'order_id' => $order->id,
                        'line_type' => 'booking_deposit',
                        'product_id' => null,
                        'product_name_snapshot' => 'Booking Deposit - ' . $extraMainName,
                        'display_name_snapshot' => 'Booking Deposit - ' . $extraMainName,
                        'quantity' => 1,
                        'price_snapshot' => 0,
                        'unit_price_snapshot' => 0,
                        'line_total' => 0,
                        'line_total_snapshot' => 0,
                        'effective_unit_price' => 0,
                        'effective_line_total' => 0,
                        'locked' => true,
                        'booking_id' => $booking->id,
                        'booking_service_id' => $extraMainServiceId > 0 ? $extraMainServiceId : $serviceItem->booking_service_id,
                    ]);

                    $extraMainLineKey = 'main_service:' . (string) ($extraMainServiceId > 0 ? $extraMainServiceId : ($extraMainRow['id'] ?? $extraMainName));
                    $extraMainStoredSplits = collect($extraMainRow['staff_splits'] ?? [])
                        ->map(fn ($split) => [
                            'staff_id' => (int) ($split['staff_id'] ?? 0),
                            'share_percent' => (int) ($split['share_percent'] ?? 0),
                        ])
                        ->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)
                        ->values();
                    $extraMainDepositSplits = $resolveLineSplits(
                        $serviceLinePayloads,
                        $extraMainLineKey,
                        $extraMainStoredSplits->isNotEmpty() ? $extraMainStoredSplits->all() : $splits->values()->all()
                    );
                    $persistOrderItemLineSplits($extraMainOrderItem, $extraMainDepositSplits, 'service_deposit', $extraMainLineKey, 0.0, [
                        'cart_service_item_id' => (int) $serviceItem->id,
                        'booking_id' => (int) $booking->id,
                        'line_type' => 'service_deposit',
                        'line_key' => $extraMainLineKey,
                        'staff_split_source' => $lineSplitSource(
                            $serviceLinePayloads,
                            $extraMainLineKey,
                            $extraMainStoredSplits->isNotEmpty() ? 'line' : 'parent'
                        ),
                    ]);
                }

                foreach (($depositAddonByServiceItemId[(int) $serviceItem->id] ?? []) as $addonRow) {
                    $addonDepositAmount = (float) ($addonRow['deposit_contribution'] ?? 0);
                    $addonId = (int) ($addonRow['id'] ?? 0);
                    if ($addonId <= 0 || strtolower((string) ($addonRow['item_kind'] ?? '')) === 'main_service') {
                        continue;
                    }
                    $addonName = (string) ($addonRow['name'] ?? $addonRow['label'] ?? 'Add-on');
                    $addonDepositPriceOverrideResult = $this->applyPriceOverrideToAmount($serviceItem, 'addon:' . $addonId, $addonDepositAmount);
                    $addonDepositAmount = (float) $addonDepositPriceOverrideResult['amount'];
                    $addonDepositPriceOverride = $addonDepositPriceOverrideResult['override'] ?? ($addonRow['price_override'] ?? null);
                    $addonDepositOrderItem = OrderItem::create([
                        'order_id' => $order->id,
                        'line_type' => 'booking_addon',
                        'product_id' => null,
                        'product_name_snapshot' => $addonName,
                        'display_name_snapshot' => $addonName,
                        'quantity' => 1,
                        'price_snapshot' => $addonDepositAmount,
                        'unit_price_snapshot' => $addonDepositAmount,
                        'line_total' => $addonDepositAmount,
                        'line_total_snapshot' => $addonDepositAmount,
                        'effective_unit_price' => $addonDepositAmount,
                        'effective_line_total' => $addonDepositAmount,
                        'variant_name_snapshot' => 'Booking Add-on Deposit',
                        'locked' => true,
                        'booking_id' => $booking->id,
                        'booking_service_id' => $serviceItem->booking_service_id,
                        'price_override_snapshot' => $this->normalizeOverrideSnapshotForOrder($addonDepositPriceOverride, 1, $addonDepositAmount),
                    ]);

                    $addonLineKey = 'addon:' . $addonId;
                    $addonStoredSplits = collect($addonRow['staff_splits'] ?? [])
                        ->map(fn ($split) => [
                            'staff_id' => (int) ($split['staff_id'] ?? 0),
                            'share_percent' => (int) ($split['share_percent'] ?? 0),
                        ])
                        ->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)
                        ->values();
                    $addonDepositSplits = $resolveLineSplits($serviceLinePayloads, $addonLineKey, $addonStoredSplits->isNotEmpty() ? $addonStoredSplits->all() : $splits->values()->all());
                    $persistOrderItemLineSplits($addonDepositOrderItem, $addonDepositSplits, 'service_addon_deposit', (string) $addonId, (float) $addonDepositAmount, [
                        'cart_service_item_id' => (int) $serviceItem->id,
                        'booking_id' => (int) $booking->id,
                        'line_type' => 'service_addon_deposit',
                        'staff_split_source' => $lineSplitSource($serviceLinePayloads, $addonLineKey, 'inherited'),
                        'inherited_from_line_id' => 'main',
                        'addon' => $addonRow,
                    ]);
                }

            }

            foreach ($cart->packageItems as $packageItem) {
                $servicePackage = ServicePackage::query()
                    ->with('items')
                    ->where('is_active', true)
                    ->findOrFail((int) $packageItem->service_package_id);
                $packageLineGross = $this->resolvePackageCartItemGross($packageItem);
                $packageDiscount = $this->resolveManualDiscountAmount((string) ($packageItem->discount_type ?? ''), (float) ($packageItem->discount_value ?? 0), $packageLineGross);
                $packageLineNet = max(0.0, $packageLineGross - $packageDiscount);
                $unitNetAmount = (int) $packageItem->qty > 0 ? round($packageLineNet / (int) $packageItem->qty, 2) : 0.0;
                $unitDiscountAmount = (int) $packageItem->qty > 0 ? round($packageDiscount / (int) $packageItem->qty, 2) : 0.0;

                $payloadItem = $packagePayloadByCartId->get((int) $packageItem->id) ?? [];
                $splitRows = collect($payloadItem['staff_splits'] ?? []);
                for ($i = 0; $i < (int) $packageItem->qty; $i++) {
                    $ownedPackage = $this->customerServicePackageService->purchase(
                        (int) $customerId,
                        $servicePackage,
                        'POS',
                        (int) $order->id,
                    );

                    foreach ($splitRows as $split) {
                        $staffId = (int) ($split['staff_id'] ?? 0);
                        if ($staffId <= 0) {
                            continue;
                        }
                        $sharePercent = (int) ($split['share_percent'] ?? 0);
                        $splitSales = round($unitNetAmount * ($sharePercent / 100), 2);
                        $rate = (float) ($split['service_commission_rate_snapshot'] ?? 0);

                        ServicePackageStaffSplit::query()->create([
                            'order_id' => (int) $order->id,
                            'customer_service_package_id' => (int) $ownedPackage->id,
                            'service_package_id' => (int) $packageItem->service_package_id,
                            'customer_id' => (int) $customerId,
                            'staff_id' => $staffId,
                            'share_percent' => $sharePercent,
                            'split_sales_amount' => $splitSales,
                            'service_commission_rate_snapshot' => $rate,
                            'commission_amount_snapshot' => round($splitSales * $rate, 2),
                        ]);
                    }

                    OrderItem::create([
                        'order_id' => $order->id,
                        'line_type' => 'service_package',
                        'product_id' => null,
                        'product_name_snapshot' => (string) ($packageItem->package_name_snapshot ?: $servicePackage->name),
                        'display_name_snapshot' => (string) ($packageItem->package_name_snapshot ?: $servicePackage->name),
                        'quantity' => 1,
                        'price_snapshot' => (float) $packageItem->price_snapshot,
                        'unit_price_snapshot' => (float) $unitNetAmount,
                        'line_total' => (float) $unitNetAmount,
                        'line_total_snapshot' => (float) $packageItem->price_snapshot,
                        'effective_unit_price' => (float) $unitNetAmount,
                        'effective_line_total' => (float) $unitNetAmount,
                        'discount_type' => $packageItem->discount_type,
                        'discount_value' => (float) ($packageItem->discount_value ?? 0),
                        'discount_remark' => $packageItem->discount_remark,
                        'discount_amount' => (float) $unitDiscountAmount,
                        'line_total_after_discount' => (float) $unitNetAmount,
                        'price_override_snapshot' => $this->normalizeOverrideSnapshotForOrder($packageItem->price_override_snapshot ?? null, (int) $packageItem->qty, (float) $unitNetAmount),
                        'locked' => true,
                        'service_package_id' => (int) $packageItem->service_package_id,
                        'customer_service_package_id' => (int) $ownedPackage->id,
                    ]);
                }

                $purchasedPackageLines[] = [
                    'type' => 'service_package',
                    'service_package_id' => (int) $packageItem->service_package_id,
                    'name' => (string) ($packageItem->package_name_snapshot ?: $servicePackage->name),
                    'qty' => (int) $packageItem->qty,
                    'unit_price' => (float) $packageItem->price_snapshot,
                    'line_total' => (float) $packageLineNet,
                    'customer_id' => (int) ($packageItem->customer_id ?? $customerId),
                    'customer_name' => $packageItem->customer?->name,
                    'staff_splits' => $splitRows->values()->all(),
                ];
            }

            foreach ($cart->appointmentSettlementItems as $settlementItem) {
                $booking = $settlementItem->booking;
                if (! $booking) {
                    continue;
                }
                $booking->loadMissing(['service', 'customer']);
                if ((string) $booking->status !== 'COMPLETED') {
                    abort(422, __('Only COMPLETED appointments can be settled from POS cart.'));
                }

                $summary = $this->resolveAppointmentFinancialSummary($booking);
                $serviceBalanceDue = max(0.0, (float) ($summary['service_balance_due'] ?? 0));
                $mainSettlementItems = collect((array) ($summary['main_service_settlement_items'] ?? []));
                $addonSettlementItems = collect((array) ($summary['addon_settlement_items'] ?? []));
                $balanceDue = max(0.0, (float) ($summary['balance_due'] ?? 0));
                $discountLines = $this->normalizeAppointmentSettlementDiscountLines($settlementItem->discount_lines ?? []);
                $hasPerLineDiscounts = ! empty($discountLines);
                $settlementDiscount = $hasPerLineDiscounts
                    ? 0.0
                    : $this->resolveManualDiscountAmount((string) ($settlementItem->discount_type ?? ''), (float) ($settlementItem->discount_value ?? 0), $balanceDue);
                $discountLeft = $settlementDiscount;
                if ($balanceDue <= 0.0001) {
                    $this->recordPackageCoveredAppointmentOnOrder($order, $booking);

                    continue;
                }

                if ($serviceBalanceDue > 0.0001) {
                    $serviceLines = $mainSettlementItems->isNotEmpty()
                        ? $mainSettlementItems
                        : collect([[
                            'name' => (string) ($booking->service?->name ?? 'Service'),
                            'balance_due' => $serviceBalanceDue,
                            'linked_booking_service_id' => (int) ($booking->service_id ?? 0),
                            'is_original' => true,
                            'line_key' => $this->appointmentSettlementLineKey('service', ['linked_booking_service_id' => (int) ($booking->service_id ?? 0)], 0),
                        ]]);

                    foreach ($serviceLines as $mainLine) {
                        $mainAmount = max(0.0, (float) ($mainLine['balance_due'] ?? 0));
                        if ($mainAmount <= 0.0001) {
                            continue;
                        }
                        $lineKey = (string) ($mainLine['line_key'] ?? $this->appointmentSettlementLineKey('service', (array) $mainLine, 0));
                        $priceOverrideResult = $this->applyPriceOverrideToAmount($settlementItem, $lineKey, $mainAmount);
                        $mainAmount = (float) $priceOverrideResult['amount'];
                        $mainLinePriceOverride = $priceOverrideResult['override'] ?? ($mainLine['price_override'] ?? null);
                        if ($mainAmount <= 0.0001) {
                            continue;
                        }
                        if ($hasPerLineDiscounts) {
                            $lineDiscount = $this->resolveAppointmentSettlementLineDiscount($settlementItem, $lineKey, $mainAmount);
                            $serviceLineDiscount = (float) $lineDiscount['discount_amount'];
                            $serviceLineDiscountType = $lineDiscount['discount_type'];
                            $serviceLineDiscountValue = (float) $lineDiscount['discount_value'];
                            $serviceLineDiscountRemark = $lineDiscount['discount_remark'];
                        } else {
                            $serviceLineDiscount = min($discountLeft, $mainAmount);
                            $discountLeft -= $serviceLineDiscount;
                            $serviceLineDiscountType = $settlementItem->discount_type;
                            $serviceLineDiscountValue = (float) ($settlementItem->discount_value ?? 0);
                            $serviceLineDiscountRemark = $settlementItem->discount_remark;
                        }
                        $serviceLineNet = max(0.0, $mainAmount - $serviceLineDiscount);

                        $settlementOrderItem = OrderItem::query()->create([
                            'order_id' => (int) $order->id,
                            'line_type' => 'booking_settlement',
                            'product_id' => null,
                            'product_name_snapshot' => 'Final Settlement - ' . (string) ($mainLine['name'] ?? ($booking->service?->name ?: 'Service')),
                            'display_name_snapshot' => 'Final Settlement - ' . (string) ($mainLine['name'] ?? ($booking->service?->name ?: 'Service')),
                            'quantity' => 1,
                            'price_snapshot' => $serviceLineNet,
                            'unit_price_snapshot' => $serviceLineNet,
                            'line_total' => $serviceLineNet,
                            'line_total_snapshot' => $mainAmount,
                            'effective_unit_price' => $serviceLineNet,
                            'effective_line_total' => $serviceLineNet,
                            'discount_type' => $serviceLineDiscountType,
                            'discount_value' => $serviceLineDiscountValue,
                            'discount_remark' => $serviceLineDiscountRemark,
                            'discount_amount' => $serviceLineDiscount,
                            'line_total_after_discount' => $serviceLineNet,
                            'price_override_snapshot' => $this->normalizeOverrideSnapshotForOrder($mainLinePriceOverride ?? null, 1, $serviceLineNet),
                            'locked' => true,
                            'booking_id' => (int) $booking->id,
                            'booking_service_id' => (int) ($mainLine['linked_booking_service_id'] ?? ($booking->service_id ?? 0)),
                        ]);

                        $lineSplits = collect($mainLine['staff_splits'] ?? [])->map(fn ($split) => [
                            'staff_id' => (int) ($split['staff_id'] ?? 0),
                            'share_percent' => (int) ($split['share_percent'] ?? 0),
                        ])->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)->values();
                        if ($lineSplits->isEmpty() && (($mainLine['is_original'] ?? false) === true)) {
                            $lineSplits = $this->resolveBookingStaffSplits((int) $booking->id, (int) ($booking->staff_id ?? 0))
                                ->map(fn ($split) => [
                                    'staff_id' => (int) ($split['staff_id'] ?? 0),
                                    'share_percent' => (int) ($split['share_percent'] ?? 0),
                                ])
                                ->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)
                                ->values();
                        }
                        if ($lineSplits->isNotEmpty()) {
                            $splitSum = (int) $lineSplits->sum('share_percent');
                            $uniqueCount = $lineSplits->pluck('staff_id')->unique()->count();
                            if ($splitSum === 100 && $uniqueCount === $lineSplits->count()) {
                                $submittedSettlementSplits = $resolveLineSplits($lineStaffSplitsBySettlementItemId->get((int) $settlementItem->id, []), $lineKey, $lineSplits->values()->all());
                                $persistOrderItemLineSplits($settlementOrderItem, $submittedSettlementSplits, 'settlement_service', $lineKey, (float) $serviceLineNet, [
                                    'settlement_cart_item_id' => (int) $settlementItem->id,
                                    'booking_id' => (int) $booking->id,
                                    'line_key' => $lineKey,
                                    'line_type' => 'settlement_service',
                                    'staff_split_source' => $lineSplitSource($lineStaffSplitsBySettlementItemId->get((int) $settlementItem->id, []), $lineKey, 'parent'),
                                    'service' => $mainLine,
                                ]);
                            }
                        }
                    }
                }

                foreach ($addonSettlementItems as $addon) {
                    $addonAmount = max(0.0, (float) ($addon['balance_due'] ?? 0));
                    if ($addonAmount <= 0.0001) {
                        continue;
                    }
                    $addonServiceRef = (string) ($addon['service_ref'] ?? 'original');
                    $addonName = (string) ($addon['name'] ?? 'Add-on');
                    $addonDisplayName = $addonServiceRef === 'original'
                        ? $addonName
                        : sprintf('%s::%s', $addonServiceRef, $addonName);
                    $lineKey = (string) ($addon['line_key'] ?? $this->appointmentSettlementLineKey('addon', (array) $addon, 0));
                    $priceOverrideResult = $this->applyPriceOverrideToAmount($settlementItem, $lineKey, $addonAmount);
                    $addonAmount = (float) $priceOverrideResult['amount'];
                    $addonPriceOverride = $priceOverrideResult['override'] ?? ($addon['price_override'] ?? null);
                    if ($addonAmount <= 0.0001) {
                        continue;
                    }
                    if ($hasPerLineDiscounts) {
                        $lineDiscount = $this->resolveAppointmentSettlementLineDiscount($settlementItem, $lineKey, $addonAmount);
                        $addonLineDiscount = (float) $lineDiscount['discount_amount'];
                        $addonLineDiscountType = $lineDiscount['discount_type'];
                        $addonLineDiscountValue = (float) $lineDiscount['discount_value'];
                        $addonLineDiscountRemark = $lineDiscount['discount_remark'];
                    } else {
                        $addonLineDiscount = min($discountLeft, $addonAmount);
                        $discountLeft -= $addonLineDiscount;
                        $addonLineDiscountType = $settlementItem->discount_type;
                        $addonLineDiscountValue = (float) ($settlementItem->discount_value ?? 0);
                        $addonLineDiscountRemark = $settlementItem->discount_remark;
                    }
                    $addonLineNet = max(0.0, $addonAmount - $addonLineDiscount);
                    $addonSettlementOrderItem = OrderItem::query()->create([
                        'order_id' => (int) $order->id,
                        'line_type' => 'booking_addon',
                        'product_id' => null,
                        'product_name_snapshot' => $addonDisplayName,
                        'display_name_snapshot' => $addonDisplayName,
                        'variant_name_snapshot' => 'Booking Add-on Settlement',
                        'quantity' => 1,
                        'price_snapshot' => $addonLineNet,
                        'unit_price_snapshot' => $addonLineNet,
                        'line_total' => $addonLineNet,
                        'line_total_snapshot' => $addonAmount,
                        'effective_unit_price' => $addonLineNet,
                        'effective_line_total' => $addonLineNet,
                        'discount_type' => $addonLineDiscountType,
                        'discount_value' => $addonLineDiscountValue,
                        'discount_remark' => $addonLineDiscountRemark,
                        'discount_amount' => $addonLineDiscount,
                        'line_total_after_discount' => $addonLineNet,
                        'price_override_snapshot' => $this->normalizeOverrideSnapshotForOrder($addonPriceOverride ?? null, 1, $addonLineNet),
                        'locked' => true,
                        'booking_id' => (int) $booking->id,
                        'booking_service_id' => (int) ($booking->service_id ?? 0),
                    ]);

                    $addonStoredSplits = collect($addon['staff_splits'] ?? [])
                        ->map(fn ($split) => [
                            'staff_id' => (int) ($split['staff_id'] ?? 0),
                            'share_percent' => (int) ($split['share_percent'] ?? 0),
                        ])
                        ->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)
                        ->values();
                    $addonSettlementSplits = $resolveLineSplits(
                        $lineStaffSplitsBySettlementItemId->get((int) $settlementItem->id, []),
                        $lineKey,
                        $addonStoredSplits->isNotEmpty()
                            ? $addonStoredSplits->all()
                            : $this->resolveBookingStaffSplits((int) $booking->id, (int) ($booking->staff_id ?? 0))->values()->all()
                    );
                    $persistOrderItemLineSplits($addonSettlementOrderItem, $addonSettlementSplits, 'settlement_addon', $lineKey, (float) $addonLineNet, [
                        'settlement_cart_item_id' => (int) $settlementItem->id,
                        'booking_id' => (int) $booking->id,
                        'line_key' => $lineKey,
                        'line_type' => 'settlement_addon',
                        'staff_split_source' => $lineSplitSource($lineStaffSplitsBySettlementItemId->get((int) $settlementItem->id, []), $lineKey, 'inherited'),
                        'inherited_from_line_id' => 'main',
                        'addon' => $addon,
                    ]);
                }

                $freshSummary = $this->resolveAppointmentFinancialSummary($booking->fresh(['service', 'customer']));
                $booking->payment_status = $this->calculateAppointmentPaymentStatus($freshSummary);
                $booking->save();

                $this->staffCommissionService->syncBookingCommissionState($booking->fresh(['service']));
            }

            $order->load(['items', 'customer']);

            if ($voucherData && $discountTotal > 0) {
                OrderVoucher::create([
                    'order_id' => $order->id,
                    'voucher_id' => $voucherData['id'] ?? null,
                    'customer_voucher_id' => $voucherData['customer_voucher_id'] ?? null,
                    'code_snapshot' => $voucherData['code'],
                    'discount_amount' => $discountTotal,
                    'scope_snapshot' => $voucherData['scope_snapshot'] ?? null,
                ]);

                if (!empty($voucherData['id'])) {
                    $this->voucherService->recordUsage(
                        (int) $voucherData['id'],
                        $customerId,
                        $order->id,
                        !empty($voucherData['customer_voucher_id']) ? (int) $voucherData['customer_voucher_id'] : null,
                        $discountTotal,
                    );
                }
            }

            $this->deductPosCheckoutStock($cart, (int) $request->user()->id);
            $this->replaceOrderPayments($order, $paymentRows, 'pos_checkout');
            if ($request->hasFile('qr_payment_proof')) {
                OrderUpload::query()->create([
                    'order_id' => (int) $order->id,
                    'type' => 'payment_slip',
                    'file_path' => $request->file('qr_payment_proof')->store('payment-slips', 'public'),
                    'note' => 'POS QRPay proof',
                    'status' => 'approved',
                ]);
            }
            $orderPaymentService->handlePaid($order);

            $receiptUrl = $this->buildReceiptUrl($order, $request);

            $cart->items()->delete();
            $cart->serviceItems()->delete();
            $cart->packageItems()->delete();
            $cart->appointmentSettlementItems()->delete();
            $this->clearVoucherFromCart($cart);

            return [$order, $receiptUrl, $purchasedPackageLines, $confirmedBookingIds];
        });

        $this->dispatchBookingConfirmationEmails($confirmedBookingIds);

        return $this->respond([
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'grand_total' => $order->grand_total,
                'payment_method' => $order->payment_method,
                'payments' => $order->payments()->get()->map(fn ($payment) => [
                    'method' => (string) $payment->payment_method,
                    'amount' => (float) $payment->amount,
                ])->values(),
            ],
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'receipt_public_url' => $receiptUrl,
            'package_items' => $purchasedPackageLines,
        ]);
    }

    private function mergeJsonPayload(Request $request): void
    {
        if (! $request->filled('payload')) {
            return;
        }

        $payload = json_decode((string) $request->input('payload'), true);
        if (is_array($payload)) {
            $request->merge($payload);
        }
    }

    private function normalizePosPaymentMethod(string $method): string
    {
        return match (strtolower(trim($method))) {
            'billplz_credit_card', 'credit-card', 'credit card', 'card' => 'credit_card',
            'cash' => 'cash',
            'qrpay', 'qr_pay', 'qr pay' => 'qrpay',
            default => strtolower(trim($method)),
        };
    }

    private function resolveOrderPaymentRows(array $validated, float $expectedTotal): array
    {
        $expectedCents = (int) round($expectedTotal * 100);
        if ($expectedCents <= 0) {
            return [];
        }

        $rows = collect($validated['payments'] ?? [])
            ->map(function (array $row) {
                return [
                    'method' => $this->normalizePosPaymentMethod((string) ($row['method'] ?? '')),
                    'amount' => round((float) ($row['amount'] ?? 0), 2),
                ];
            })
            ->filter(fn (array $row) => $row['method'] !== '' && $row['amount'] > 0)
            ->groupBy('method')
            ->map(fn ($group, string $method) => [
                'method' => $method,
                'amount' => round((float) $group->sum('amount'), 2),
            ])
            ->values();

        if ($rows->isEmpty() && ! empty($validated['payment_method'])) {
            $rows = collect([[
                'method' => $this->normalizePosPaymentMethod((string) $validated['payment_method']),
                'amount' => round($expectedTotal, 2),
            ]]);
        }

        $allowed = ['cash', 'qrpay', 'credit_card'];
        foreach ($rows as $row) {
            if (! in_array((string) $row['method'], $allowed, true)) {
                throw ValidationException::withMessages(['payments' => __('Unsupported payment method.')]);
            }
            if ((int) round(((float) $row['amount']) * 100) <= 0) {
                throw ValidationException::withMessages(['payments' => __('Payment amount must be greater than 0.')]);
            }
        }

        if ($rows->isEmpty()) {
            throw ValidationException::withMessages(['payments' => __('Payment is required for checkout.')]);
        }

        $paidCents = (int) $rows->sum(fn (array $row) => (int) round(((float) $row['amount']) * 100));
        $cashCents = (int) $rows
            ->filter(fn (array $row) => (string) $row['method'] === 'cash')
            ->sum(fn (array $row) => (int) round(((float) $row['amount']) * 100));
        $nonCashCents = $paidCents - $cashCents;
        $cashOnlyOverpaid = $cashCents > $expectedCents && $nonCashCents === 0;

        if ($paidCents !== $expectedCents && ! $cashOnlyOverpaid) {
            throw ValidationException::withMessages([
                'payments' => $paidCents > $expectedCents
                    ? __('Payment total cannot exceed grand total for split/non-cash payment.')
                    : __('Payment total must equal the order total.'),
            ]);
        }

        return $rows->all();
    }

    private function resolveDepositPaymentRows(array $validated, float $depositAmount): array
    {
        return $this->resolveOrderPaymentRows([
            'payments' => $validated['deposit_payments'] ?? [],
            'payment_method' => null,
        ], $depositAmount);
    }

    /**
     * Adjust the deposit credit applied toward settlement (amount + optional remark), without collecting a new payment.
     */
    protected function adjustAppointmentDepositContribution(Booking $booking, float $newAmount, ?string $remark, int $userId): void
    {
        $booking->loadMissing(['service']);
        $newAmount = round(max(0, $newAmount), 2);
        $remark = $remark !== null && trim($remark) !== '' ? trim($remark) : null;

        $depositItems = OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->where('line_type', 'booking_deposit')
            ->orderBy('id')
            ->get();

        if ($depositItems->isEmpty()) {
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

            if ($linkedOrderIds->isNotEmpty()) {
                $depositItems = OrderItem::query()
                    ->whereIn('order_id', $linkedOrderIds->all())
                    ->where('line_type', 'booking_deposit')
                    ->orderBy('id')
                    ->get();
            }
        }

        $previousAmount = $depositItems->isNotEmpty()
            ? round((float) $depositItems->sum('line_total'), 2)
            : round(max(0, (float) ($booking->deposit_amount ?? 0)), 2);

        if (abs($newAmount - $previousAmount) <= 0.0001 && $remark === null) {
            return;
        }

        $originalAmount = $previousAmount;
        if ($depositItems->isNotEmpty()) {
            $snapshotOriginal = data_get($depositItems->first()->price_override_snapshot, 'original_unit_price');
            if (is_numeric($snapshotOriginal) && (float) $snapshotOriginal > 0.0001) {
                $originalAmount = round((float) $snapshotOriginal, 2);
            } else {
                $originalAmount = round((float) ($depositItems->first()->line_total_snapshot ?? $depositItems->sum('line_total')), 2);
            }
        } elseif ((float) ($booking->deposit_amount ?? 0) > 0.0001) {
            $originalAmount = round((float) $booking->deposit_amount, 2);
        } elseif ($booking->service) {
            $originalAmount = round(max(0, (float) ($booking->service->deposit_amount ?? 0)), 2);
        }

        $overrideSnapshot = $this->buildOrderPriceOverrideSnapshot(
            $originalAmount,
            $newAmount,
            1,
            $remark,
            $userId,
        );

        DB::transaction(function () use ($booking, $newAmount, $depositItems, $overrideSnapshot, $remark) {
            if ($depositItems->isNotEmpty()) {
                /** @var OrderItem $primary */
                $primary = $depositItems->first();
                $primary->update([
                    'booking_id' => (int) $booking->id,
                    'price_snapshot' => $newAmount,
                    'unit_price_snapshot' => $newAmount,
                    'line_total' => $newAmount,
                    'line_total_snapshot' => max((float) ($primary->line_total_snapshot ?? $overrideSnapshot['original_unit_price']), $overrideSnapshot['original_unit_price']),
                    'effective_unit_price' => $newAmount,
                    'effective_line_total' => $newAmount,
                    'line_total_after_discount' => $newAmount,
                    'price_override_snapshot' => $overrideSnapshot,
                    'discount_remark' => $remark,
                ]);

                foreach ($depositItems->skip(1) as $extra) {
                    $extra->update([
                        'line_total' => 0,
                        'line_total_after_discount' => 0,
                        'effective_line_total' => 0,
                    ]);
                }

                $orderIds = $depositItems->pluck('order_id')->filter()->unique()->values();
                foreach ($orderIds as $orderId) {
                    $order = Order::query()->find((int) $orderId);
                    if (! $order) {
                        continue;
                    }
                    $notes = (string) ($order->notes ?? '');
                    if (preg_match('/booking_deposit=([0-9]+(?:\\.[0-9]+)?)/', $notes) === 1) {
                        $order->update([
                            'notes' => preg_replace(
                                '/booking_deposit=([0-9]+(?:\\.[0-9]+)?)/',
                                'booking_deposit=' . number_format($newAmount, 2, '.', ''),
                                $notes,
                                1,
                            ),
                        ]);
                    }
                }
            }

            $lockedBooking = Booking::query()->lockForUpdate()->findOrFail((int) $booking->id);
            $lockedBooking->deposit_amount = $newAmount;
            $freshSummary = $this->resolveAppointmentFinancialSummary($lockedBooking->fresh(['service']));
            $lockedBooking->payment_status = $this->calculateAppointmentPaymentStatus($freshSummary);
            $lockedBooking->save();
        });
    }

    private function orderPaymentMethodForRows(array $paymentRows): ?string
    {
        if (count($paymentRows) === 0) {
            return null;
        }

        return count($paymentRows) === 1 ? (string) $paymentRows[0]['method'] : 'split';
    }

    private function replaceOrderPayments(Order $order, array $paymentRows, string $source): void
    {
        $order->payments()->delete();
        foreach ($paymentRows as $row) {
            $order->payments()->create([
                'payment_method' => (string) $row['method'],
                'amount' => round((float) $row['amount'], 2),
                'meta' => ['source' => $source],
            ]);
        }
    }

    protected function deductPosCheckoutStock(PosCart $cart, ?int $actorUserId = null): void
    {
        foreach ($cart->items as $item) {
            $qty = max(0, (int) $item->qty);
            if ($qty <= 0) {
                continue;
            }

            $variant = $item->variant;
            $product = $variant?->product ?? $item->product;
            if (! $product) {
                continue;
            }

            if ($variant) {
                $lockedVariant = ProductVariant::query()
                    ->with(['bundleItems.componentVariant.product'])
                    ->where('id', (int) $variant->id)
                    ->lockForUpdate()
                    ->first();

                if (! $lockedVariant) {
                    continue;
                }

                // Bundle SKUs: inventory lives on component variants (same as OrderReserveService).
                if ($lockedVariant->is_bundle) {
                    $lockedVariant->loadMissing('bundleItems.componentVariant.product');
                    foreach ($lockedVariant->bundleItems as $bundleItem) {
                        $component = $bundleItem->componentVariant;
                        if (! $component || ! $component->track_stock) {
                            continue;
                        }

                        $required = (int) ($bundleItem->quantity ?? 1) * $qty;
                        if ($required <= 0) {
                            continue;
                        }

                        $componentVariant = ProductVariant::query()
                            ->where('id', (int) $component->id)
                            ->lockForUpdate()
                            ->first();
                        if (! $componentVariant) {
                            continue;
                        }

                        $beforeQty = (int) ($componentVariant->stock ?? 0);
                        $afterQty = max(0, $beforeQty - $required);
                        if ($afterQty === $beforeQty) {
                            continue;
                        }

                        $unitCost = (float) ($componentVariant->cost_price ?? 0);
                        $beforeInventory = round($beforeQty * $unitCost, 2);
                        $afterInventory = round($afterQty * $unitCost, 2);

                        $componentVariant->stock = $afterQty;
                        $componentVariant->save();

                        $componentProduct = $componentVariant->relationLoaded('product')
                            ? $componentVariant->product
                            : Product::query()->find($componentVariant->product_id);

                        ProductStockMovement::create([
                            'product_id' => (int) ($componentProduct?->id ?? $componentVariant->product_id),
                            'product_variant_id' => (int) $componentVariant->id,
                            'type' => 'stock_out',
                            'quantity_before' => $beforeQty,
                            'quantity_change' => $required,
                            'quantity_after' => $afterQty,
                            'cost_price_before' => $unitCost,
                            'cost_price_after' => $unitCost,
                            'inventory_value_before' => $beforeInventory,
                            'inventory_value_after' => $afterInventory,
                            'input_cost_price_per_unit' => null,
                            'remark' => 'POS checkout (bundle)',
                            'created_by_user_id' => $actorUserId,
                        ]);
                    }

                    continue;
                }

                if (! $lockedVariant->track_stock) {
                    continue;
                }

                $beforeQty = (int) ($lockedVariant->stock ?? 0);
                $afterQty = max(0, $beforeQty - $qty);
                if ($afterQty === $beforeQty) {
                    continue;
                }

                $unitCost = (float) ($lockedVariant->cost_price ?? 0);
                $beforeInventory = round($beforeQty * $unitCost, 2);
                $afterInventory = round($afterQty * $unitCost, 2);

                $lockedVariant->stock = $afterQty;
                $lockedVariant->save();

                ProductStockMovement::create([
                    'product_id' => (int) $product->id,
                    'product_variant_id' => (int) $lockedVariant->id,
                    'type' => 'stock_out',
                    'quantity_before' => $beforeQty,
                    'quantity_change' => $qty,
                    'quantity_after' => $afterQty,
                    'cost_price_before' => $unitCost,
                    'cost_price_after' => $unitCost,
                    'inventory_value_before' => $beforeInventory,
                    'inventory_value_after' => $afterInventory,
                    'input_cost_price_per_unit' => null,
                    'remark' => 'POS checkout',
                    'created_by_user_id' => $actorUserId,
                ]);

                continue;
            }

            if (! $product->track_stock) {
                continue;
            }

            $lockedProduct = Product::query()
                ->where('id', (int) $product->id)
                ->lockForUpdate()
                ->first();
            if (! $lockedProduct) {
                continue;
            }

            $beforeQty = (int) ($lockedProduct->stock ?? 0);
            $afterQty = max(0, $beforeQty - $qty);
            if ($afterQty === $beforeQty) {
                continue;
            }

            $unitCost = (float) ($lockedProduct->cost_price ?? 0);
            $beforeInventory = round($beforeQty * $unitCost, 2);
            $afterInventory = round($afterQty * $unitCost, 2);

            $lockedProduct->stock = $afterQty;
            $lockedProduct->stock_quantity = $afterQty;
            $lockedProduct->inventory_value = $afterInventory;
            $lockedProduct->save();

            ProductStockMovement::create([
                'product_id' => (int) $lockedProduct->id,
                'product_variant_id' => null,
                'type' => 'stock_out',
                'quantity_before' => $beforeQty,
                'quantity_change' => $qty,
                'quantity_after' => $afterQty,
                'cost_price_before' => $unitCost,
                'cost_price_after' => $unitCost,
                'inventory_value_before' => $beforeInventory,
                'inventory_value_after' => $afterInventory,
                'input_cost_price_per_unit' => null,
                'remark' => 'POS checkout',
                'created_by_user_id' => $actorUserId,
            ]);
        }
    }

    public function sendReceiptEmail(Request $request, int $orderId)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $order = Order::query()
            ->with(['items.booking', 'items.product', 'items.productVariant', 'items.bookingService', 'serviceItems', 'bankAccount'])
            ->findOrFail($orderId);

        $receiptUrl = $this->buildReceiptUrl($order, $request);

        $pdf = $this->invoiceService->buildPdf($order);

        $itemsPayload = $order->items->flatMap(function (OrderItem $item) {
            $row = $this->invoiceService->mapOrderItemToInvoiceRow($item);
            $quantity = max(1, (int) ($row['quantity'] ?? 1));
            $bookingProductOptions = collect($row['selected_booking_product_options'] ?? [])
                ->flatMap(fn ($question) => is_array($question) ? ($question['options'] ?? []) : [])
                ->filter(fn ($option) => is_array($option))
                ->values();
            $optionLineTotal = (float) $bookingProductOptions->sum(fn (array $option) => (float) ($option['extra_price'] ?? 0) * $quantity);

            $lines = [[
                ...$this->invoiceService->mapInvoiceRowToEmailItem($row),
                'qty' => $quantity,
                'line_total' => max(0, (float) $row['line_total'] - $optionLineTotal),
            ]];

            foreach ($bookingProductOptions as $option) {
                $label = trim((string) ($option['label'] ?? '')) ?: 'Booking Product Option';
                $cnLabel = trim((string) ($option['cn_label'] ?? ''));
                $lines[] = [
                    'name' => $label,
                    'cn_name' => $cnLabel !== '' ? $cnLabel : null,
                    'variant_name' => null,
                    'variant_cn_name' => null,
                    'qty' => $quantity,
                    'line_total' => (float) ($option['extra_price'] ?? 0) * $quantity,
                ];
            }

            return $lines;
        })->values()->all();

        $orderNumber = (string) ($order->order_number ?? $order->id);
        $placedAt = $order->placed_at?->toDateTimeString() ?? $order->created_at?->toDateTimeString() ?? now()->toDateTimeString();
        $pdfFilename = 'Invoice-' . $orderNumber . '.pdf';

        $booking = $this->resolveBookingForReceiptEmail($order);

        if ($booking) {
            Mail::to($validated['email'])->send(new BookingSettlementReceiptMail(
                bookingReference: (string) ($booking->booking_code ?? ''),
                appointmentAt: $booking->start_at?->format('Y-m-d H:i') ?? '—',
                orderNumber: $orderNumber,
                placedAt: $placedAt,
                totalAmount: (float) ($order->grand_total ?? 0),
                paymentMethodDisplay: OrderReceiptEmailLabels::paymentMethod($order),
                paymentStatusDisplay: OrderReceiptEmailLabels::paymentStatus($order),
                receiptUrl: $receiptUrl,
                pdfBytes: $pdf->output(),
                pdfFilename: $pdfFilename,
                items: $itemsPayload,
            ));
        } else {
            Mail::to($validated['email'])->send(new PosOrderReceiptMail(
                orderNumber: $orderNumber,
                placedAt: $placedAt,
                totalAmount: (float) ($order->grand_total ?? 0),
                paymentMethodDisplay: OrderReceiptEmailLabels::paymentMethod($order),
                paymentStatusDisplay: OrderReceiptEmailLabels::paymentStatus($order),
                receiptUrl: $receiptUrl,
                pdfBytes: $pdf->output(),
                pdfFilename: $pdfFilename,
                items: $itemsPayload,
            ));
        }

        return $this->respond([
            'ok' => true,
        ]);
    }

    protected function resolveBookingForReceiptEmail(Order $order): ?Booking
    {
        $order->loadMissing(['items.booking', 'serviceItems']);

        foreach ($order->items as $item) {
            if ($item->booking_id && $item->booking) {
                return $item->booking;
            }
        }

        foreach ($order->serviceItems as $serviceItem) {
            if ($serviceItem->booking_id) {
                $found = Booking::query()->find($serviceItem->booking_id);
                if ($found) {
                    return $found;
                }
            }
        }

        return null;
    }

    /**
     * @param int[] $bookingIds
     */
    protected function dispatchBookingConfirmationEmails(array $bookingIds): void
    {
        if (empty($bookingIds)) {
            return;
        }

        $bookings = Booking::query()
            ->with(['service', 'staff', 'customer'])
            ->whereIn('id', $bookingIds)
            ->where('status', 'CONFIRMED')
            ->get();

        foreach ($bookings as $booking) {
            $recipientEmail = $booking->billing_email
                ?: $booking->guest_email
                ?: $booking->customer?->email;

            if (! $recipientEmail || ! filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
                Log::info('Booking confirmation email skipped — no valid email.', ['booking_id' => $booking->id]);
                continue;
            }

            $bookingGuestName = trim((string) ($booking->guest_name ?? ''));
            if (str_starts_with(strtoupper($bookingGuestName), 'UNKNOWN')) {
                Log::info('Booking confirmation email skipped — unknown guest.', ['booking_id' => $booking->id]);
                continue;
            }

            $customerName = $booking->billing_name
                ?: $booking->guest_name
                ?: $booking->customer?->name
                ?: 'Customer';

            try {
                $contactPhone = $this->resolveContactPhoneForEmail();
                $addonItems = collect(is_array($booking->addon_items_json) ? $booking->addon_items_json : [])
                    ->map(fn ($item) => is_array($item) ? [
                        'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
                        'extra_duration_min' => (int) ($item['extra_duration_min'] ?? 0),
                        'extra_price' => round((float) ($item['extra_price'] ?? 0), 2),
                    ] : null)
                    ->filter()
                    ->values()
                    ->all();

                Mail::to($recipientEmail)->queue(new BookingConfirmationMail(
                    bookingCode: (string) ($booking->booking_code ?? ''),
                    customerName: $customerName,
                    serviceName: (string) ($booking->service?->name ?? 'Service'),
                    staffName: (string) ($booking->staff?->name ?? ''),
                    appointmentDate: $booking->start_at?->format('l, d M Y') ?? '—',
                    appointmentStartTime: $booking->start_at?->format('h:i A') ?? '—',
                    appointmentEndTime: $booking->end_at?->format('h:i A') ?? '—',
                    durationMin: (int) ($booking->service?->duration_min ?? 0),
                    depositAmount: (float) ($booking->deposit_amount ?? 0),
                    source: (string) ($booking->source ?? 'STAFF'),
                    addonItems: $addonItems,
                    contactPhone: $contactPhone,
                ));

                Log::info('Booking confirmation email queued.', [
                    'booking_id' => $booking->id,
                    'booking_code' => $booking->booking_code,
                    'email' => $recipientEmail,
                ]);
            } catch (\Throwable $e) {
                Log::error('Failed to queue booking confirmation email.', [
                    'booking_id' => $booking->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    protected function sendBookingRescheduledEmail(Booking $booking, ?Carbon $oldStart, ?Carbon $oldEnd): void
    {
        $recipientEmail = $booking->billing_email
            ?: $booking->guest_email
            ?: $booking->customer?->email;

        if (! $recipientEmail || ! filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $bookingGuestName = trim((string) ($booking->guest_name ?? ''));
        if (str_starts_with(strtoupper($bookingGuestName), 'UNKNOWN')) {
            return;
        }

        $customerName = $booking->billing_name
            ?: $booking->guest_name
            ?: $booking->customer?->name
            ?: 'Customer';

        $addonItems = collect(is_array($booking->addon_items_json) ? $booking->addon_items_json : [])
            ->map(fn ($item) => is_array($item) ? [
                'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
                'extra_price' => round((float) ($item['extra_price'] ?? 0), 2),
            ] : null)
            ->filter()
            ->values()
            ->all();

        $contactPhone = $this->resolveContactPhoneForEmail();

        try {
            Mail::to($recipientEmail)->queue(new BookingRescheduledMail(
                customerName: $customerName,
                bookingCode: (string) ($booking->booking_code ?? ''),
                serviceName: (string) ($booking->service?->name ?? 'Service'),
                addonItems: $addonItems,
                staffName: (string) ($booking->staff?->name ?? ''),
                oldDate: $oldStart?->format('l, d M Y') ?? '—',
                oldStartTime: $oldStart?->format('h:i A') ?? '—',
                oldEndTime: $oldEnd?->format('h:i A') ?? '—',
                newDate: $booking->start_at?->format('l, d M Y') ?? '—',
                newStartTime: $booking->start_at?->format('h:i A') ?? '—',
                newEndTime: $booking->end_at?->format('h:i A') ?? '—',
                durationMin: (int) ($booking->service?->duration_min ?? 0),
                contactPhone: $contactPhone,
            ));

            Log::info('Booking rescheduled email queued.', [
                'booking_id' => $booking->id,
                'email' => $recipientEmail,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to queue booking rescheduled email.', [
                'booking_id' => $booking->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function resolveContactPhoneForEmail(): string
    {
        $widget = SettingService::get('shop_contact_widget', null, 'booking');
        $phone = data_get($widget, 'whatsapp.phone');

        if ($phone && is_string($phone) && trim($phone) !== '') {
            return trim($phone);
        }

        return '010-387 0881';
    }

    protected function resolveCart(int $staffUserId): PosCart
    {
        return PosCart::firstOrCreate([
            'staff_user_id' => $staffUserId,
        ]);
    }

    protected function serializeCart(PosCart $cart): array
    {
        $isStaffUser = !empty($cart->staffUser?->staff_id);

        $cartPricing = $this->buildCartPricing($cart, $isStaffUser);

        $items = $cart->items->map(function (PosCartItem $item) use ($isStaffUser, $cartPricing) {
            if (strtolower((string) ($item->item_type ?? 'product')) === 'booking_product') {
                $pricing = $cartPricing['items'][(int) $item->id] ?? $this->resolvePosCartItemPricing($item, $isStaffUser);

                return [
                    'id' => $item->id,
                    'item_type' => 'BOOKING_PRODUCT',
                    'booking_product_id' => (int) ($item->booking_product_id ?? 0),
                    'booking_product_category' => $item->bookingProduct?->categories?->first()?->name,
                    'qty' => (int) $item->qty,
                    'unit_price' => (float) $pricing['effective_unit_price'],
                    'line_total' => (float) $pricing['effective_line_total'],
                    'unit_price_snapshot' => (float) $pricing['unit_price_snapshot'],
                    'line_total_snapshot' => (float) $pricing['line_total_snapshot'],
                    'product_name' => (string) ($item->bookingProduct?->name ?? 'Booking Product'),
                    'product_cn_name' => $item->bookingProduct?->cn_name,
                    'selected_booking_product_options' => $item->selected_booking_product_options,
                    'discount_type' => $item->discount_type,
                    'discount_value' => (float) ($item->discount_value ?? 0),
                    'discount_remark' => $item->discount_remark,
                    'discount_amount' => (float) ($pricing['manual_discount_amount'] ?? 0),
                    'line_total_after_discount' => (float) ($pricing['line_total_after_discount'] ?? $pricing['effective_line_total']),
                    'promotion_applied' => false,
                    'manual_discount_allowed' => true,
                ];
            }
            $variant = $item->variant;
            $product = $variant?->product ?? $item->product;
            $pricing = $cartPricing['items'][(int) $item->id] ?? $this->resolvePosCartItemPricing($item, $isStaffUser);

            return [
                'id' => $item->id,
                'qty' => $item->qty,
                'unit_price' => (float) $pricing['effective_unit_price'],
                'line_total' => (float) $pricing['effective_line_total'],
                'unit_price_snapshot' => (float) $pricing['unit_price_snapshot'],
                'line_total_snapshot' => (float) $pricing['line_total_snapshot'],
                'is_staff_free_applied' => (bool) $pricing['is_staff_free_applied'],
                'product_id' => $product?->id,
                'variant_id' => $variant?->id,
                'variant_name' => $variant?->title,
                'variant_cn_name' => $variant?->cn_name,
                'variant_sku' => $variant?->sku,
                'product_name' => $product?->name,
                'product_cn_name' => $product?->cn_name,
                'discount_type' => $item->discount_type,
                'discount_value' => (float) ($item->discount_value ?? 0),
                'discount_remark' => $item->discount_remark,
                'discount_amount' => (float) ($pricing['manual_discount_amount'] ?? 0),
                'line_total_after_discount' => (float) ($pricing['line_total_after_discount'] ?? $pricing['effective_line_total']),
                'promotion_applied' => (bool) ($pricing['promotion_applied'] ?? false),
                'promotion_name' => $pricing['promotion_name'] ?? null,
                'promotion_summary' => $pricing['promotion_summary'] ?? null,
                'promotion_snapshot' => $pricing['promotion_snapshot'] ?? null,
                'promotion_discount_amount' => (float) ($pricing['promotion_discount_amount'] ?? 0),
                'manual_discount_allowed' => !($pricing['promotion_applied'] ?? false),
            ];
        })->values();

        $serviceClaimStatuses = $this->resolveServiceItemClaimStatuses($cart);
        $depositBreakdown = $this->resolvePosBookingDepositBreakdown($cart, $serviceClaimStatuses);
        $depositByServiceItemId = collect($depositBreakdown['deposit_by_service_item'] ?? [])
            ->mapWithKeys(fn ($amount, $id) => [(int) $id => (float) $amount])
            ->all();
        $depositAddonByServiceItemId = (array) ($depositBreakdown['deposit_by_service_item_addons'] ?? []);
        $depositOverrideByServiceItemId = (array) ($depositBreakdown['deposit_by_service_item_overrides'] ?? []);

        $serviceItems = $cart->serviceItems->map(function (PosCartServiceItem $item) use ($depositByServiceItemId, $depositAddonByServiceItemId, $depositOverrideByServiceItemId, $serviceClaimStatuses) {
            $lineTotal = ((float) $item->price_snapshot) * (int) $item->qty;
            $serviceType = strtoupper((string) ($item->bookingService?->service_type ?? 'STANDARD'));
            $claimStatus = $serviceClaimStatuses[(int) $item->id] ?? null;
            $claimedByPackage = in_array($claimStatus, ['reserved', 'consumed'], true);
            $depositContribution = $claimedByPackage ? 0.0 : (float) ($depositByServiceItemId[(int) $item->id] ?? 0);

            $addonDepositLines = collect($depositAddonByServiceItemId[(int) $item->id] ?? [])
                ->filter(fn ($row) => strtolower((string) ($row['item_kind'] ?? '')) !== 'main_service')
                ->map(fn ($row) => [
                    'id' => isset($row['id']) ? (int) $row['id'] : null,
                    'name' => (string) ($row['name'] ?? 'Add-on'),
                    'cn_name' => $row['cn_name'] ?? $row['cn_label'] ?? $row['linked_cn_name'] ?? null,
                    'deposit' => round((float) ($row['deposit_contribution'] ?? 0), 2),
                    'price_override' => $row['price_override'] ?? null,
                ])
                ->filter(fn (array $row) => (int) ($row['id'] ?? 0) > 0)
                ->values()
                ->all();
            $depositAddonTotal = round(collect($addonDepositLines)->sum(fn (array $r) => (float) ($r['deposit'] ?? 0)), 2);
            $depositPayableTotal = round($depositContribution + $depositAddonTotal, 2);
            $rawAddonItems = collect($item->addon_items_json ?? []);
            $originalAddonItems = $rawAddonItems
                ->filter(fn ($addon) => strtolower((string) ($addon['item_kind'] ?? 'addon')) !== 'main_service')
                ->filter(fn ($addon) => (int) ($addon['id'] ?? 0) > 0)
                ->map(fn ($addon) => [
                    'id' => isset($addon['id']) ? (int) $addon['id'] : null,
                    'name' => (string) ($addon['name'] ?? $addon['label'] ?? 'Add-on'),
                    'cn_name' => $addon['cn_label'] ?? $addon['cn_name'] ?? $addon['linked_cn_name'] ?? null,
                    'extra_duration_min' => (int) ($addon['extra_duration_min'] ?? 0),
                    'extra_price' => (float) ($addon['extra_price'] ?? 0),
                    'staff_splits' => collect($addon['staff_splits'] ?? [])->map(fn ($split) => [
                        'staff_id' => (int) ($split['staff_id'] ?? 0),
                        'share_percent' => (int) ($split['share_percent'] ?? 0),
                    ])->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)->values()->all(),
                ])
                ->values();
            $mainServices = $rawAddonItems
                ->filter(fn ($addon) => strtolower((string) ($addon['item_kind'] ?? '')) === 'main_service')
                ->map(function ($service) use ($item, $originalAddonItems) {
                    $isOriginal = (bool) ($service['is_original'] ?? false);
                    $serviceAddons = collect((array) ($service['addon_items'] ?? []))
                        ->filter(fn ($addon) => (int) ($addon['id'] ?? 0) > 0)
                        ->map(fn ($addon) => [
                            'id' => isset($addon['id']) ? (int) $addon['id'] : null,
                            'name' => (string) ($addon['name'] ?? $addon['label'] ?? 'Add-on'),
                            'cn_name' => $addon['cn_label'] ?? $addon['cn_name'] ?? $addon['linked_cn_name'] ?? null,
                            'extra_duration_min' => (int) ($addon['extra_duration_min'] ?? 0),
                            'extra_price' => (float) ($addon['extra_price'] ?? 0),
                            'staff_splits' => collect($addon['staff_splits'] ?? [])->map(fn ($split) => [
                                'staff_id' => (int) ($split['staff_id'] ?? 0),
                                'share_percent' => (int) ($split['share_percent'] ?? 0),
                            ])->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)->values()->all(),
                        ])
                        ->values();

                    return [
                        'id' => $service['id'] ?? null,
                        'name' => (string) ($service['name'] ?? $service['label'] ?? $item->service_name_snapshot ?? 'Service'),
                        'cn_name' => $service['cn_name'] ?? $service['cn_label'] ?? $service['linked_cn_name'] ?? null,
                        'extra_duration_min' => (int) ($service['extra_duration_min'] ?? 0),
                        'extra_price' => (float) ($service['extra_price'] ?? 0),
                        'linked_booking_service_id' => isset($service['linked_booking_service_id']) ? (int) $service['linked_booking_service_id'] : null,
                        'is_original' => $isOriginal,
                        'add_ons' => $serviceAddons->all(),
                        'staff_splits' => collect($service['staff_splits'] ?? [])->map(fn ($split) => [
                            'staff_id' => (int) ($split['staff_id'] ?? 0),
                            'share_percent' => (int) ($split['share_percent'] ?? 0),
                        ])->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)->values()->all(),
                    ];
                })
                ->values();
            if ($mainServices->isEmpty()) {
                $mainServices = collect([[
                    'id' => (int) $item->booking_service_id,
                    'name' => (string) ($item->service_name_snapshot ?? 'Service'),
                    'cn_name' => $item->bookingService?->cn_name,
                    'extra_duration_min' => (int) ($item->bookingService?->duration_min ?? 0),
                    'extra_price' => (float) ($item->price_snapshot ?? 0),
                    'linked_booking_service_id' => (int) $item->booking_service_id,
                    'is_original' => true,
                    'add_ons' => $originalAddonItems->all(),
                    'staff_splits' => $item->staff_splits ?? [],
                ]]);
            }

            return [
                'id' => $item->id,
                'type' => 'service',
                'booking_service_id' => (int) $item->booking_service_id,
                'service_name' => $item->service_name_snapshot,
                'service_cn_name' => $item->bookingService?->cn_name,
                'service_type' => $serviceType,
                'qty' => (int) $item->qty,
                'unit_price' => (float) $item->price_snapshot,
                'line_total' => (float) $lineTotal,
                'addon_duration_min' => (int) ($item->addon_duration_min ?? 0),
                'addon_price' => (float) ($item->addon_price ?? 0),
                'addon_items' => $rawAddonItems
                    ->filter(fn ($addon) => strtolower((string) ($addon['item_kind'] ?? '')) !== 'main_service')
                    ->filter(fn ($addon) => (int) ($addon['id'] ?? 0) > 0)
                    ->map(fn ($addon) => [
                        'id' => isset($addon['id']) ? (int) $addon['id'] : null,
                        'name' => (string) ($addon['name'] ?? $addon['label'] ?? 'Add-on'),
                        'cn_name' => $addon['cn_label'] ?? $addon['cn_name'] ?? $addon['linked_cn_name'] ?? null,
                        'extra_duration_min' => (int) ($addon['extra_duration_min'] ?? 0),
                        'extra_price' => (float) ($addon['extra_price'] ?? 0),
                        'linked_deposit_amount' => round((float) ($addon['linked_deposit_amount'] ?? 0), 2),
                        'staff_splits' => collect($addon['staff_splits'] ?? [])->map(fn ($split) => [
                            'staff_id' => (int) ($split['staff_id'] ?? 0),
                            'share_percent' => (int) ($split['share_percent'] ?? 0),
                        ])->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)->values()->all(),
                    ])->values()->all(),
                'main_services' => $mainServices->all(),
                'deposit_contribution' => (float) $depositContribution,
                'deposit_price_override' => $depositOverrideByServiceItemId[(int) $item->id] ?? null,
                'deposit_main_reference' => $claimedByPackage
                    ? max(0.0, (float) ($item->bookingService?->deposit_amount ?? 0))
                    : null,
                'deposit_addon_lines' => $addonDepositLines,
                'deposit_addon_total' => (float) $depositAddonTotal,
                'deposit_payable_total' => (float) $depositPayableTotal,
                'package_claim_status' => $claimStatus,
                'claimed_by_package' => $claimedByPackage,
                'customer_id' => $item->customer_id ? (int) $item->customer_id : null,
                'customer_name' => $item->customer_id ? (string) ($item->customer?->name ?? '') : null,
                'guest_name' => $item->guest_name ? (string) $item->guest_name : null,
                'guest_phone' => $item->guest_phone ? (string) $item->guest_phone : null,
                'guest_email' => $item->guest_email ? (string) $item->guest_email : null,
                'assigned_staff_id' => $item->assigned_staff_id ? (int) $item->assigned_staff_id : null,
                'assigned_staff_name' => $item->assignedStaff?->name,
                'start_at' => $item->start_at?->toIso8601String(),
                'end_at' => $item->end_at?->toIso8601String(),
                'notes' => $item->notes,
                'staff_splits' => $item->staff_splits ?? [],
                'commission_rate_used' => (float) ($item->commission_rate_used ?? 0),
            ];
        })->values();

        $packageItems = $cart->packageItems->map(function (PosCartPackageItem $item) {
            $lineTotal = $this->resolvePackageCartItemGross($item);
            $discountAmount = $this->resolveManualDiscountAmount((string) ($item->discount_type ?? ''), (float) ($item->discount_value ?? 0), $lineTotal);
            $netLineTotal = max(0.0, $lineTotal - $discountAmount);

            return [
                'id' => $item->id,
                'type' => 'service_package',
                'service_package_id' => (int) $item->service_package_id,
                'package_name' => $item->package_name_snapshot,
                'qty' => (int) $item->qty,
                'unit_price' => (float) $item->price_snapshot,
                'line_total' => (float) $netLineTotal,
                'line_total_snapshot' => (float) $lineTotal,
                'discount_type' => $item->discount_type,
                'discount_value' => (float) ($item->discount_value ?? 0),
                'discount_amount' => (float) $discountAmount,
                'line_total_after_discount' => (float) $netLineTotal,
                'discount_remark' => $item->discount_remark,
                'customer_id' => $item->customer_id ? (int) $item->customer_id : null,
                'customer_name' => $item->customer_id ? (string) ($item->customer?->name ?? '') : null,
            ];
        })->values();

        $settlementItems = $cart->appointmentSettlementItems->map(function (PosCartAppointmentSettlementItem $item) {
            $booking = $item->booking;
            if (! $booking) {
                return null;
            }
            $summary = $this->resolveAppointmentFinancialSummary($booking);
            $balanceDue = (float) ($summary['balance_due'] ?? 0);
            $guestName = trim((string) ($booking->guest_name ?? ''));
            $guestPhone = trim((string) ($booking->guest_phone ?? ''));
            $guestEmail = trim((string) ($booking->guest_email ?? ''));
            $staffSplits = $this->resolveBookingStaffSplits((int) $booking->id, (int) ($booking->staff_id ?? 0));

            $lineTotal = round($balanceDue, 2);
            $rawMainSettlementItems = collect((array) ($summary['main_service_settlement_items'] ?? []));
            $mainSettlementItems = $rawMainSettlementItems->map(function (array $line) use ($item) {
                $gross = max(0.0, (float) ($line['balance_due'] ?? 0));
                $lineKey = (string) ($line['line_key'] ?? '');
                $priceOverride = $this->applyPriceOverrideToAmount($item, $lineKey, $gross);
                $gross = (float) $priceOverride['amount'];
                $discount = $this->resolveAppointmentSettlementLineDiscount($item, $lineKey, $gross);

                return [
                    ...$line,
                    'gross_amount' => $gross,
                    'balance_due' => $gross,
                    'price_override' => $priceOverride['override'],
                    'discount_type' => $discount['discount_type'],
                    'discount_value' => $discount['discount_value'],
                    'discount_amount' => $discount['discount_amount'],
                    'discount_remark' => $discount['discount_remark'],
                    'line_total_after_discount' => $discount['line_total_after_discount'],
                ];
            })->values();
            $addonSettlementItems = collect((array) ($summary['addon_settlement_items'] ?? []))->map(function (array $line) use ($item) {
                $gross = max(0.0, (float) ($line['balance_due'] ?? 0));
                $lineKey = (string) ($line['line_key'] ?? '');
                $priceOverride = $this->applyPriceOverrideToAmount($item, $lineKey, $gross);
                $gross = (float) $priceOverride['amount'];
                $discount = $this->resolveAppointmentSettlementLineDiscount($item, $lineKey, $gross);

                return [
                    ...$line,
                    'gross_amount' => $gross,
                    'price_override' => $priceOverride['override'],
                    'discount_type' => $discount['discount_type'],
                    'discount_value' => $discount['discount_value'],
                    'discount_amount' => $discount['discount_amount'],
                    'discount_remark' => $discount['discount_remark'],
                    'line_total_after_discount' => $discount['line_total_after_discount'],
                    'balance_due' => $discount['line_total_after_discount'],
                ];
            })->values();
            $lineTotal = round((float) $mainSettlementItems->sum('gross_amount') + (float) $addonSettlementItems->sum('gross_amount'), 2);
            $hasPerLineDiscounts = ! empty($this->normalizeAppointmentSettlementDiscountLines($item->discount_lines ?? []));
            $discountAmount = $hasPerLineDiscounts
                ? round((float) $mainSettlementItems->sum('discount_amount') + (float) $addonSettlementItems->sum('discount_amount'), 2)
                : $this->resolveManualDiscountAmount((string) ($item->discount_type ?? ''), (float) ($item->discount_value ?? 0), $lineTotal);
            $netLineTotal = $hasPerLineDiscounts
                ? max(0.0, $lineTotal - $discountAmount)
                : max(0.0, $lineTotal - $discountAmount);

            return [
                'id' => (int) $item->id,
                'booking_id' => (int) $booking->id,
                'booking_service_id' => (int) ($booking->service_id ?? 0),
                'booking_code' => (string) ($booking->booking_code ?: ('BOOKING-' . $booking->id)),
                'customer_id' => $booking->customer_id ? (int) $booking->customer_id : null,
                'customer_name' => (string) (str_starts_with(strtoupper($guestName), 'UNKNOWN')
                ? 'Walk-in / Unknown'
                : (($booking->customer?->name ?? '') !== '' ? $booking->customer?->name : ($guestName !== '' ? $guestName . ' (GUEST)' : '-'))),
                'guest_name' => $guestName !== '' ? $guestName : null,
                'guest_phone' => $guestPhone !== '' ? $guestPhone : null,
                'guest_email' => $guestEmail !== '' ? $guestEmail : null,
                'service_name' => (string) ($booking->service?->name ?? '-'),
                'service_cn_name' => $booking->service?->cn_name,
                'service_price_mode' => (string) ($booking->service?->price_mode ?? 'fixed'),
                'service_price_range_min' => $booking->service?->price_range_min !== null ? (float) $booking->service->price_range_min : null,
                'service_price_range_max' => $booking->service?->price_range_max !== null ? (float) $booking->service->price_range_max : null,
                'staff_name' => (string) ($booking->staff?->name ?? '-'),
                'staff_splits' => $staffSplits->values()->all(),
                'appointment_start_at' => optional($booking->start_at)?->toIso8601String(),
                'appointment_end_at' => optional($booking->end_at)?->toIso8601String(),
                'balance_due' => (float) $netLineTotal,
                'balance_due_snapshot' => (float) $lineTotal,
                'discount_type' => $item->discount_type,
                'discount_value' => (float) ($item->discount_value ?? 0),
                'discount_amount' => (float) $discountAmount,
                'line_total_after_discount' => (float) $netLineTotal,
                'discount_remark' => $item->discount_remark,
                'service_total' => (float) ($summary['service_total'] ?? 0),
                'main_services' => $summary['main_services'] ?? [],
                'main_service_settlement_items' => $mainSettlementItems->all(),
                'settled_service_amount' => $summary['settled_service_amount'] ?? null,
                'is_range_priced' => (bool) ($summary['is_range_priced'] ?? false),
                'requires_settled_amount' => (bool) ($summary['requires_settled_amount'] ?? false),
                'addon_total_price' => (float) ($summary['addon_total_price'] ?? 0),
                'deposit_contribution' => (float) ($summary['deposit_contribution'] ?? 0),
                'deposit_previously_collected' => (bool) ($summary['deposit_previously_collected'] ?? false),
                'deposit_previously_collected_amount' => (float) ($summary['deposit_previously_collected_amount'] ?? 0),
                'package_offset' => (float) ($summary['package_offset'] ?? 0),
                'amount_due_now' => (float) $netLineTotal,
                'service_balance_due' => (float) ($hasPerLineDiscounts ? $mainSettlementItems->sum('line_total_after_discount') : ($summary['service_balance_due'] ?? 0)),
                'addon_settlement_items' => $addonSettlementItems->all(),
                'package_status' => $summary['package_status'] ?? null,
                'can_apply_package' => (bool) ($summary['can_apply_package'] ?? false),
                'package_disabled_reason' => $summary['package_disabled_reason'] ?? null,
                'eligible_package_count' => (int) ($summary['eligible_package_count'] ?? 0),
            ];
        })->filter()->values();

        $voucherDiscount = (float) ($cart->voucher_discount_amount ?? 0);
        $bookingDepositTotal = (float) ($depositBreakdown['deposit_total'] ?? 0);
        $serviceAddonTotal = 0.0;
        $settlementTotal = (float) $settlementItems->sum(fn (array $row) => (float) ($row['balance_due'] ?? 0));
        $subtotal = (float) (($cartPricing['subtotal'] ?? $items->sum('line_total')) + $packageItems->sum('line_total') + $bookingDepositTotal + $settlementTotal);
        $grandTotal = max(0, $subtotal - $voucherDiscount);

        return [
            'id' => $cart->id,
            'items' => $items,
            'service_items' => $serviceItems,
            'package_items' => $packageItems,
            'appointment_settlement_items' => $settlementItems,
            'booking_deposit_total' => $bookingDepositTotal,
            'booking_addon_total' => $serviceAddonTotal,
            'booking_deposit_breakdown' => $depositBreakdown,
            'subtotal' => $subtotal,
            'grand_total' => $grandTotal,
            'voucher' => !empty($cart->voucher_code) ? [
                'id' => $cart->voucher_id,
                'customer_voucher_id' => $cart->customer_voucher_id,
                'code' => $cart->voucher_code,
                'discount_amount' => $voucherDiscount,
                'scope_snapshot' => $cart->voucher_snapshot,
            ] : null,
            'promotions' => $cartPricing['promotions'] ?? [],
        ];
    }


    protected function resolvePosBookingDepositForCart(PosCart $cart): float
    {
        return (float) ($this->resolvePosBookingDepositBreakdown($cart, $this->resolveServiceItemClaimStatuses($cart))['deposit_total'] ?? 0);
    }

    protected function resolvePosBookingDepositBreakdown(PosCart $cart, array $serviceClaimStatuses = []): array
    {
        if ($cart->serviceItems->isEmpty()) {
            return [
                'premium_count' => 0,
                'standard_count' => 0,
                'per_premium_amount' => 0,
                'standard_base_amount' => 0,
                'standard_base_applied_item_id' => null,
                'deposit_total' => 0,
            ];
        }

        $premiumCount = 0;
        $standardCount = 0;
        $premiumDepositTotal = 0.0;
        $standardBaseAmount = 0.0;
        $standardBaseAppliedItemId = null;
        $depositByServiceItem = [];
        $depositByServiceItemAddons = [];
        $depositByServiceItemOverrides = [];
        $candidates = [];

        foreach ($cart->serviceItems as $item) {
            $itemId = (int) $item->id;
            $depositByServiceItem[$itemId] = 0.0;
            $depositByServiceItemAddons[$itemId] = collect((array) ($item->addon_items_json ?? []))
                ->filter(fn ($addon) => strtolower((string) ($addon['item_kind'] ?? '')) !== 'main_service')
                ->filter(fn ($addon) => (int) ($addon['id'] ?? 0) > 0)
                ->map(fn ($addon) => [
                    'item_kind' => $addon['item_kind'] ?? null,
                    'id' => isset($addon['id']) ? (int) $addon['id'] : null,
                    'name' => (string) ($addon['name'] ?? $addon['label'] ?? 'Add-on'),
                    'cn_name' => $addon['cn_label'] ?? $addon['cn_name'] ?? $addon['linked_cn_name'] ?? null,
                    'deposit_contribution' => 0.0,
                ])
                ->values()
                ->all();
            $claimStatus = $serviceClaimStatuses[(int) $item->id] ?? null;
            $claimedByPackage = in_array($claimStatus, ['reserved', 'consumed'], true);
            // Package claim waives the main service deposit only; add-on deposits still apply.
            if (! $claimedByPackage) {
                $type = strtoupper((string) ($item->bookingService?->service_type ?? 'STANDARD'));
                $mainDeposit = max(0, (float) ($item->bookingService?->deposit_amount ?? 0));
                $mainOverride = $this->applyPriceOverrideToAmount($item, 'main', $mainDeposit);
                $candidates[] = ['service_item_id' => $itemId, 'type' => $type, 'deposit_amount' => (float) $mainOverride['amount'], 'price_override' => $mainOverride['override']];
            }

            foreach ((array) ($item->addon_items_json ?? []) as $addon) {
                if (strtolower((string) ($addon['item_kind'] ?? '')) === 'main_service' || (int) ($addon['id'] ?? 0) <= 0) {
                    continue;
                }
                $addonType = strtoupper((string) ($addon['linked_service_type'] ?? ''));
                if ($addonType === '') {
                    continue;
                }
                $addonDeposit = max(0, (float) ($addon['linked_deposit_amount'] ?? 0));
                $addonLineKey = 'addon:' . (int) ($addon['id'] ?? 0);
                $addonOverride = $this->applyPriceOverrideToAmount($item, $addonLineKey, $addonDeposit);
                $candidates[] = [
                    'service_item_id' => $itemId,
                    'type' => $addonType,
                    'deposit_amount' => (float) $addonOverride['amount'],
                    'price_override' => $addonOverride['override'],
                    'scope' => 'addon',
                    'addon_id' => isset($addon['id']) ? (int) $addon['id'] : null,
                ];
            }
        }

        $standardBaseAmount = 0.0;
        $standardBaseAppliedItemId = null;

        $premiumCandidates = collect($candidates)->filter(fn (array $row) => ($row['type'] ?? '') === 'PREMIUM')->values();
        if ($premiumCandidates->isNotEmpty()) {
            $premiumCount = (int) $premiumCandidates->count();
            $premiumDepositTotal = (float) $premiumCandidates->sum(fn (array $row) => (float) ($row['deposit_amount'] ?? 0));
            foreach ($premiumCandidates as $row) {
                $itemId = (int) ($row['service_item_id'] ?? 0);
                if ($itemId <= 0) {
                    continue;
                }
                $depositAmount = (float) ($row['deposit_amount'] ?? 0);
                $isAddon = ($row['scope'] ?? 'main') === 'addon';
                if ($isAddon) {
                    foreach ($depositByServiceItemAddons[$itemId] as &$addonRow) {
                        if ((int) ($addonRow['id'] ?? 0) === (int) ($row['addon_id'] ?? 0)) {
                            $addonRow['deposit_contribution'] = round($depositAmount, 2);
                            if (! empty($row['price_override'])) {
                                $addonRow['price_override'] = $row['price_override'];
                            }
                            break;
                        }
                    }
                    unset($addonRow);
                } else {
                    $depositByServiceItem[$itemId] = round((float) ($depositByServiceItem[$itemId] ?? 0) + $depositAmount, 2);
                    if (! empty($row['price_override'])) {
                        $depositByServiceItemOverrides[$itemId] = $row['price_override'];
                    }
                }
            }
        } else {
            $standardCandidates = collect($candidates)->filter(fn (array $row) => ($row['type'] ?? '') !== 'PREMIUM')->values();
            $standardCount = (int) $standardCandidates->count();
            foreach ($standardCandidates as $row) {
                $itemId = (int) ($row['service_item_id'] ?? 0);
                if ($itemId <= 0) {
                    continue;
                }
                $depositAmount = (float) ($row['deposit_amount'] ?? 0);
                $isAddon = ($row['scope'] ?? 'main') === 'addon';
                if ($isAddon) {
                    foreach ($depositByServiceItemAddons[$itemId] as &$addonRow) {
                        if ((int) ($addonRow['id'] ?? 0) === (int) ($row['addon_id'] ?? 0)) {
                            $addonRow['deposit_contribution'] = round($depositAmount, 2);
                            if (! empty($row['price_override'])) {
                                $addonRow['price_override'] = $row['price_override'];
                            }
                            break;
                        }
                    }
                    unset($addonRow);
                } else {
                    $depositByServiceItem[$itemId] = round((float) ($depositByServiceItem[$itemId] ?? 0) + $depositAmount, 2);
                    if (! empty($row['price_override'])) {
                        $depositByServiceItemOverrides[$itemId] = $row['price_override'];
                    }
                    if ($standardBaseAppliedItemId === null) {
                        $standardBaseAmount = round($depositAmount, 2);
                        $standardBaseAppliedItemId = $itemId;
                    }
                }
            }
        }

        $addonDepositSum = 0.0;
        foreach ($depositByServiceItemAddons as $rows) {
            foreach ((array) $rows as $ar) {
                $addonDepositSum += (float) ($ar['deposit_contribution'] ?? 0);
            }
        }
        $addonDepositSum = round($addonDepositSum, 2);

        $depositTotal = round((float) collect($depositByServiceItem)->sum() + $addonDepositSum, 2);

        return [
            'premium_count' => $premiumCount,
            'standard_count' => $standardCount,
            'per_premium_amount' => 0,
            'premium_deposit_total' => round($premiumDepositTotal, 2),
            'standard_base_amount' => round($standardBaseAmount, 2),
            'standard_base_applied_item_id' => $standardBaseAppliedItemId,
            'deposit_total' => (float) $depositTotal,
            'deposit_by_service_item' => $depositByServiceItem,
            'deposit_by_service_item_overrides' => $depositByServiceItemOverrides,
            'deposit_by_service_item_addons' => $depositByServiceItemAddons,
        ];
    }

    protected function resolveServiceItemClaimStatuses(PosCart $cart): array
    {
        if ($cart->serviceItems->isEmpty()) {
            return [];
        }

        $serviceItemIds = $cart->serviceItems->pluck('id')->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->values();
        if ($serviceItemIds->isEmpty()) {
            return [];
        }

        $claims = CustomerServicePackageUsage::query()
            ->where('used_from', 'POS')
            ->whereIn('used_ref_id', $serviceItemIds->all())
            ->whereIn('status', ['reserved', 'consumed', 'released'])
            ->get(['used_ref_id', 'status']);

        $priority = ['released' => 1, 'reserved' => 2, 'consumed' => 3];
        $map = [];

        foreach ($claims as $claim) {
            $itemId = (int) ($claim->used_ref_id ?? 0);
            if ($itemId <= 0) {
                continue;
            }

            $incoming = $priority[$claim->status] ?? 0;
            $existing = $priority[$map[$itemId] ?? ''] ?? 0;
            if ($incoming >= $existing) {
                $map[$itemId] = $claim->status;
            }
        }

        return $map;
    }

    protected function serializeCartItemsForVoucher(PosCart $cart): array
    {
        $isStaffUser = !empty($cart->staffUser?->staff_id);
        $cartPricing = $this->buildCartPricing($cart, $isStaffUser);

        return $cart->items->map(function (PosCartItem $item) use ($isStaffUser, $cartPricing) {
            $variant = $item->variant;
            $product = $variant?->product ?? $item->product;
            $pricing = $cartPricing['items'][(int) $item->id] ?? $this->resolvePosCartItemPricing($item, $isStaffUser);

            return [
                'product_id' => $product?->id,
                'line_total' => (float) $pricing['effective_line_total'],
            ];
        })->values()->all();
    }

    protected function resolvePosCartItemPricing(PosCartItem $item, bool $isStaffUser): array
    {
        $variant = $item->variant;
        $product = $variant?->product ?? $item->product;

        $unitPriceSnapshot = (float) $item->price_snapshot;
        $qty = max(1, (int) $item->qty);
        $lineTotalSnapshot = $item->price_override_line_total !== null ? round((float) $item->price_override_line_total, 2) : round($unitPriceSnapshot * $qty, 2);

        $isStaffFreeApplied = $isStaffUser && (bool) ($product?->is_staff_free ?? false);

        if (strtolower((string) ($item->item_type ?? 'product')) === 'booking_product') {
            $optionUnitTotal = (float) collect($item->selected_booking_product_options ?? [])
                ->flatMap(fn ($question) => is_array($question['options'] ?? null) ? $question['options'] : [])
                ->sum(fn ($option) => max(0.0, (float) ($option['extra_price'] ?? 0)));
            $baseUnitPrice = max(0.0, $unitPriceSnapshot - $optionUnitTotal);
            $baseLineTotal = $item->price_override_line_total !== null ? round((float) $item->price_override_line_total, 2) : round($baseUnitPrice * $qty, 2);
            $baseDiscountAmount = $this->resolveManualDiscountAmount((string) ($item->discount_type ?? ''), (float) ($item->discount_value ?? 0), $baseLineTotal);
            $optionDiscountAmount = 0.0;
            $optionNetTotal = 0.0;

            foreach (($item->selected_booking_product_options ?? []) as $question) {
                foreach ((array) ($question['options'] ?? []) as $option) {
                    $optionGross = isset($option['line_total_override']) ? round(max(0.0, (float) $option['line_total_override']), 2) : round(max(0.0, (float) ($option['extra_price'] ?? 0)) * $qty, 2);
                    $optionDiscount = $this->resolveManualDiscountAmount((string) ($option['discount_type'] ?? ''), (float) ($option['discount_value'] ?? 0), $optionGross);
                    $optionDiscountAmount += $optionDiscount;
                    $optionNetTotal += max(0.0, $optionGross - $optionDiscount);
                }
            }

            $effectiveLineTotal = max(0.0, $baseLineTotal - $baseDiscountAmount) + $optionNetTotal;

            return [
                'unit_price_snapshot' => $unitPriceSnapshot,
                'line_total_snapshot' => $lineTotalSnapshot,
                'booking_product_base_line_total' => $baseLineTotal,
                'booking_product_option_discount_amount' => round($optionDiscountAmount, 2),
                'manual_discount_amount' => round($baseDiscountAmount, 2),
                'total_manual_discount_amount' => round($baseDiscountAmount + $optionDiscountAmount, 2),
                'line_total_after_discount' => round($effectiveLineTotal, 2),
                'effective_unit_price' => $qty > 0 ? round($effectiveLineTotal / $qty, 2) : 0.0,
                'effective_line_total' => round($effectiveLineTotal, 2),
                'is_staff_free_applied' => false,
            ];
        }

        $effectiveUnitPrice = $isStaffFreeApplied ? 0.0 : ($qty > 0 ? round($lineTotalSnapshot / $qty, 6) : $unitPriceSnapshot);
        $effectiveLineTotal = $isStaffFreeApplied ? 0.0 : $lineTotalSnapshot;

        return [
            'unit_price_snapshot' => $unitPriceSnapshot,
            'line_total_snapshot' => $lineTotalSnapshot,
            'effective_unit_price' => $effectiveUnitPrice,
            'effective_line_total' => $effectiveLineTotal,
            'is_staff_free_applied' => $isStaffFreeApplied,
        ];
    }

    protected function resolveBookingProductCommissionLines(int $cartItemId, int $qty, float $lineNetTotal, $optionSnapshots, $parentSplits = [], $lineSplitPayloads = []): array
    {
        $qty = max(1, $qty);
        $normalizeSplits = fn ($splits) => collect($splits ?? [])
            ->map(fn ($split) => [
                'staff_id' => (int) ($split['staff_id'] ?? 0),
                'share_percent' => (int) ($split['share_percent'] ?? 0),
            ])
            ->filter(fn (array $split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)
            ->values();
        $findLineSplitPayload = function (string $lineKey, string $fallbackKey = '') use ($lineSplitPayloads) {
            return collect($lineSplitPayloads ?? [])->first(function (array $line) use ($lineKey, $fallbackKey) {
                $payloadKey = (string) ($line['line_key'] ?? '');

                return $payloadKey === $lineKey
                    || ($fallbackKey !== '' && $payloadKey === $fallbackKey)
                    || str_ends_with($payloadKey, ':' . $lineKey)
                    || ($fallbackKey !== '' && str_ends_with($payloadKey, ':' . $fallbackKey));
            });
        };

        $parentSplitRows = $normalizeSplits($parentSplits);
        $options = collect($optionSnapshots ?? [])
            ->filter(fn ($option) => is_array($option))
            ->values();
        $optionLines = $options->map(function (array $option) use ($qty, $parentSplitRows, $findLineSplitPayload, $normalizeSplits) {
            $optionId = (string) ($option['id'] ?? '');
            $lineKey = sprintf('booking_product_option:%s', $optionId);
            $lineSplitPayload = $optionId !== ''
                ? ($findLineSplitPayload($lineKey, $optionId) ?: null)
                : null;
            $amountBasis = round(max(0, (float) ($option['line_total_after_discount'] ?? (((float) ($option['extra_price'] ?? 0)) * $qty))), 2);
            $splitRows = $lineSplitPayload
                ? $normalizeSplits($lineSplitPayload['staff_splits'] ?? [])
                : $parentSplitRows;

            return [
                'line_type' => 'booking_product_option',
                'line_ref_id' => $optionId,
                'line_key' => $lineKey,
                'amount_basis' => $amountBasis,
                'staff_splits' => $splitRows->values()->all(),
                'staff_split_source' => $lineSplitPayload ? 'explicit' : 'inherited',
                'option' => $option,
            ];
        })->values();

        $optionTotal = round((float) $optionLines->sum('amount_basis'), 2);
        $baseAmountBasis = round(max(0, $lineNetTotal - $optionTotal), 2);

        return collect([[
            'line_type' => 'booking_product_base',
            'line_ref_id' => (string) $cartItemId,
            'line_key' => sprintf('booking_product_base:%d', $cartItemId),
            'amount_basis' => $baseAmountBasis,
            'staff_splits' => $parentSplitRows->values()->all(),
            'staff_split_source' => 'parent',
        ]])->merge($optionLines)->values()->all();
    }


    protected function buildCartPricing(PosCart $cart, bool $isStaffUser): array
    {
        $base = [];
        foreach ($cart->items as $item) {
            $base[(int) $item->id] = $this->resolvePosCartItemPricing($item, $isStaffUser);
        }

        $appliedPromotions = [];

        $promotions = Promotion::query()
            ->where('is_active', true)
            ->whereIn('id', DB::table('promotion_products')->select('promotion_id')->distinct())
            ->with(['promotionProducts', 'promotionTiers'])
            ->get();

        foreach ($promotions as $promotion) {
            $productIds = $promotion->promotionProducts->pluck('product_id')->map(fn ($x) => (int) $x)->all();
            $eligible = [];
            foreach ($cart->items as $item) {
                $product = $item->variant?->product ?? $item->product;
                if (! $product || ! in_array((int) $product->id, $productIds, true)) {
                    continue;
                }
                // Staff checkout: consumable / staff-free lines are priced at RM 0 and must not count
                // toward bundle promos (e.g. "2 items => RM 23") or receive promo discount portions.
                if ($isStaffUser && ! empty($base[(int) $item->id]['is_staff_free_applied'])) {
                    continue;
                }
                $eligible[] = $item;
            }
            if (empty($eligible)) {
                continue;
            }

            $totalQty = array_sum(array_map(fn ($it) => (int) $it->qty, $eligible));
            $totalAmount = array_sum(array_map(fn ($it) => (float) $base[(int) $it->id]['effective_line_total'], $eligible));

            $applicable = null;
            foreach ($promotion->promotionTiers as $tier) {
                $ok = $promotion->trigger_type === 'amount'
                    ? $totalAmount >= (float) ($tier->min_amount ?? 0)
                    : $totalQty >= (int) ($tier->min_qty ?? 0);
                if (! $ok) {
                    continue;
                }

                $tierThreshold = $promotion->trigger_type === 'amount'
                    ? (float) ($tier->min_amount ?? 0)
                    : (int) ($tier->min_qty ?? 0);
                $currentThreshold = $applicable
                    ? ($promotion->trigger_type === 'amount'
                        ? (float) ($applicable->min_amount ?? 0)
                        : (int) ($applicable->min_qty ?? 0))
                    : null;

                if (! $applicable || $tierThreshold > $currentThreshold) {
                    $applicable = $tier;
                }
            }
            if (! $applicable) {
                continue;
            }

            $thresholdQty = max(1, (int) ($applicable->min_qty ?? 0));
            $remaining = $thresholdQty;
            usort($eligible, fn ($a, $b) => ((float) $base[(int) $b->id]['unit_price_snapshot'] <=> (float) $base[(int) $a->id]['unit_price_snapshot']));

            $selected = [];
            foreach ($eligible as $it) {
                if ($remaining <= 0) {
                    break;
                }
                $use = min($remaining, (int) $it->qty);
                $selected[] = ['item' => $it, 'qty' => $use];
                $remaining -= $use;
            }
            if ($remaining > 0 && $promotion->trigger_type === 'quantity') {
                continue;
            }

            $selectedSubtotal = array_sum(array_map(fn ($x) => (float) $base[(int) $x['item']->id]['unit_price_snapshot'] * $x['qty'], $selected));

            $discount = 0.0;
            if ($applicable->discount_type === 'bundle_fixed_price') {
                $discount = max(0, $selectedSubtotal - (float) $applicable->discount_value);
            } elseif ($applicable->discount_type === 'percentage_discount') {
                $discount = max(0, $selectedSubtotal * ((float) $applicable->discount_value / 100));
            } else {
                $discount = min($selectedSubtotal, (float) $applicable->discount_value);
            }
            if ($discount <= 0) {
                continue;
            }

            $promotionSnapshot = [
                'promotion_id' => (int) $promotion->id,
                'promotion_name' => $promotion->name ?: $promotion->title,
                'promotion_type' => $applicable->discount_type,
                'trigger_type' => $promotion->trigger_type,
                'selected_tier' => [
                    'tier_id' => (int) $applicable->id,
                    'min_qty' => (int) ($applicable->min_qty ?? 0),
                    'min_amount' => (float) ($applicable->min_amount ?? 0),
                    'discount_type' => $applicable->discount_type,
                    'discount_value' => (float) ($applicable->discount_value ?? 0),
                ],
                'selected_qty' => (int) array_sum(array_map(fn ($x) => (int) $x['qty'], $selected)),
                'selected_subtotal' => (float) $selectedSubtotal,
                'tier_total' => (float) max(0, $selectedSubtotal - $discount),
                'discount_amount' => (float) $discount,
                'remaining_qty_charged_normal' => max(0, $totalQty - (int) array_sum(array_map(fn ($x) => (int) $x['qty'], $selected))),
                'summary' => $this->formatPromotionSummary($promotion, $applicable),
            ];

            $appliedPromotions[] = $promotionSnapshot;

            foreach ($selected as $entry) {
                $id = (int) $entry['item']->id;
                $line = (float) $base[$id]['effective_line_total'];
                $portionBase = max(0.01, (float) $base[$id]['unit_price_snapshot'] * $entry['qty']);
                $portion = min($line, $discount * ($portionBase / max(0.01, $selectedSubtotal)));
                $base[$id]['promotion_applied'] = true;
                $base[$id]['promotion_id'] = $promotion->id;
                $base[$id]['promotion_name'] = $promotion->name ?: $promotion->title;
                $base[$id]['promotion_type'] = $applicable->discount_type;
                $base[$id]['promotion_summary'] = $promotionSnapshot['summary'];
                $base[$id]['promotion_snapshot'] = $promotionSnapshot;
                $base[$id]['promotion_discount_amount'] = ($base[$id]['promotion_discount_amount'] ?? 0) + $portion;
                $base[$id]['line_total_after_promotion'] = max(0, $line - ($base[$id]['promotion_discount_amount'] ?? 0));
            }
        }

        $subtotal = 0.0;
        foreach ($cart->items as $item) {
            $id = (int) $item->id;
            if (strtolower((string) ($item->item_type ?? 'product')) === 'booking_product') {
                $line = (float) ($base[$id]['effective_line_total'] ?? 0);
                $base[$id]['line_total_after_discount'] = $line;
                $base[$id]['effective_line_total'] = $line;
                $base[$id]['effective_unit_price'] = (int) $item->qty > 0 ? ($line / (int) $item->qty) : 0;
                $subtotal += $line;
                continue;
            }

            $line = (float) ($base[$id]['line_total_after_promotion'] ?? $base[$id]['effective_line_total']);
            $manual = 0.0;
            if (empty($base[$id]['promotion_applied']) && ! empty($item->discount_type) && (float) $item->discount_value > 0) {
                $manual = $this->resolveManualDiscountAmount((string) $item->discount_type, (float) $item->discount_value, $line);
            }
            $base[$id]['manual_discount_amount'] = $manual;
            $base[$id]['line_total_after_discount'] = max(0, $line - $manual);
            $base[$id]['effective_line_total'] = $base[$id]['line_total_after_discount'];
            $base[$id]['effective_unit_price'] = (int) $item->qty > 0 ? ($base[$id]['line_total_after_discount'] / (int) $item->qty) : 0;
            $subtotal += (float) $base[$id]['line_total_after_discount'];
        }

        return ['items' => $base, 'subtotal' => $subtotal, 'promotions' => $appliedPromotions];
    }

    protected function formatPromotionSummary($promotion, $tier): string
    {
        if ($promotion->trigger_type === 'quantity') {
            return (int) ($tier->min_qty ?? 0) . ' items => RM ' . number_format((float) ($tier->discount_value ?? 0), 2);
        }

        return 'Min spend RM ' . number_format((float) ($tier->min_amount ?? 0), 2)
            . ' => ' . $tier->discount_type
            . ' ' . number_format((float) ($tier->discount_value ?? 0), 2);
    }

    protected function resolveManualDiscountAmount(string $discountType, float $discountValue, float $lineTotal): float
    {
        if ($lineTotal <= 0 || $discountValue <= 0) {
            return 0.0;
        }

        if ($discountType === 'percentage') {
            $percent = min(100, max(0, $discountValue));
            return round($lineTotal * ($percent / 100), 2);
        }

        return round(min($lineTotal, max(0, $discountValue)), 2);
    }

    protected function clearVoucherFromCart(PosCart $cart): void
    {
        $cart->voucher_code = null;
        $cart->voucher_id = null;
        $cart->customer_voucher_id = null;
        $cart->voucher_discount_amount = 0;
        $cart->voucher_snapshot = null;
        $cart->save();
    }

    /**
     * Member-linked booking, walk-in (UNKNOWN) guest, or named guest; service required. Phone/email optional for guests.
     */
    protected function bookingEligibleForPosSettlement(Booking $booking): bool
    {
        if (! $booking->service_id) {
            return false;
        }
        if ((int) $booking->customer_id > 0) {
            return true;
        }

        $name = trim((string) ($booking->guest_name ?? ''));
        $isUnknownGuest = str_starts_with(strtoupper($name), 'UNKNOWN');

        return $isUnknownGuest || $name !== '';
    }



    protected function posScheduleSoftFailureReasons(): array
    {
        return ['outside_staff_schedule', 'hits_staff_break'];
    }

    protected function isPosScheduleOverrideReason(?string $reasonCode): bool
    {
        return in_array((string) $reasonCode, $this->posScheduleSoftFailureReasons(), true);
    }

    protected function posScheduleFailureAllowsOverride(string $failureReason, bool $overrideRequested): bool
    {
        return $overrideRequested && $this->isPosScheduleOverrideReason($failureReason);
    }

    protected function respondPosScheduleFailure(string $failureReason, Staff $staff, Carbon $startAt, Carbon $endAt, array $scheduleDiagnostics, int $status = 409)
    {
        return $this->respondError(
            $this->formatPosUserFacingAvailabilityMessage([
                'staff_id' => (int) $staff->id,
                'staff_schedule' => $scheduleDiagnostics,
                'requested_start' => $startAt->toDateTimeString(),
                'requested_end' => $endAt->toDateTimeString(),
            ], $staff, $failureReason),
            $status,
            [
                'reason_code' => $failureReason,
                'validation_reason' => $failureReason,
                'staff_schedule' => $scheduleDiagnostics,
            ],
        );
    }

    protected function posAvailabilityReasonCode(array $diagnostics): string
    {
        $leaveTypes = collect($diagnostics['detected_leave_types'] ?? [])->map(fn ($type) => (string) $type)->all();
        if (in_array('off_day', $leaveTypes, true)) {
            return 'staff_off_day';
        }

        if (! empty($diagnostics['detected_leave_ids'] ?? [])) {
            return 'staff_leave';
        }

        if (! empty($diagnostics['conflicting_booking_ids'] ?? []) || ! empty($diagnostics['conflicting_cart_item_ids'] ?? []) || ! empty($diagnostics['detected_block_ids'] ?? [])) {
            return 'booking_conflict';
        }

        $scheduleFailure = (string) (($diagnostics['staff_schedule'] ?? [])['failure_reason'] ?? ($diagnostics['failure_reason'] ?? ''));
        if ($scheduleFailure !== '') {
            return $scheduleFailure;
        }

        return 'booking_conflict';
    }

    protected function posAvailabilityMessage(string $reasonCode): string
    {
        return match ($reasonCode) {
            'staff_inactive' => __('Selected staff is inactive.'),
            'staff_off_day' => __('Selected staff is on approved off day.'),
            'staff_leave' => __('Selected staff is on approved leave.'),
            'outside_staff_schedule' => __('Selected time is outside staff schedule.'),
            default => __('Selected slot conflicts with another booking or blocked time.'),
        };
    }

    protected function respondPosAvailabilityError(array $diagnostics, int $status = 409)
    {
        $reasonCode = $this->posAvailabilityReasonCode($diagnostics);
        $staff = null;
        $staffId = (int) ($diagnostics['staff_id'] ?? 0);
        if ($staffId > 0) {
            $staff = Staff::query()->find($staffId);
        }

        return $this->respondError($this->formatPosUserFacingAvailabilityMessage($diagnostics, $staff, $reasonCode), $status, [
            'reason_code' => $reasonCode,
            'validation_reason' => $reasonCode,
            'conflict_debug' => $diagnostics,
        ]);
    }

    protected function formatPosUserFacingAvailabilityMessage(array $diagnostics, ?Staff $staff = null, ?string $reasonCode = null): string
    {
        $reasonCode = $reasonCode ?? $this->posAvailabilityReasonCode($diagnostics);
        $staffLabel = trim((string) ($staff?->name ?? ''));
        $staffLabel = $staffLabel !== '' ? $staffLabel : __('Selected staff');

        $requestedStartRaw = (string) ($diagnostics['requested_start'] ?? $diagnostics['requested_start_original_timezone'] ?? '');
        $requestedEndRaw = (string) ($diagnostics['requested_end'] ?? $diagnostics['requested_end_original_timezone'] ?? '');
        $requestedStart = $requestedStartRaw !== '' ? Carbon::parse($requestedStartRaw) : null;
        $timeLabel = null;
        if ($requestedStart && $requestedStart->isValid()) {
            $requestedEnd = $requestedEndRaw !== '' ? Carbon::parse($requestedEndRaw) : null;
            $timeLabel = $requestedEnd && $requestedEnd->isValid()
                ? $requestedStart->format('d M Y, g:i A') . ' – ' . $requestedEnd->format('g:i A')
                : $requestedStart->format('d M Y, g:i A');
        }
        $slotLabel = $timeLabel ?? __('the selected time');
        $weekdayLabel = ($requestedStart && $requestedStart->isValid()) ? $requestedStart->format('l') : __('this day');

        if ($reasonCode === 'staff_inactive') {
            return __(':staff is inactive and cannot take appointments. Please assign another staff member.', ['staff' => $staffLabel]);
        }

        if ($reasonCode === 'staff_off_day') {
            return __(':staff is on approved off day for this date. Please pick another date or assign a different staff member.', ['staff' => $staffLabel]);
        }

        if ($reasonCode === 'staff_leave') {
            return __(':staff is on approved leave during :time. Please pick another time or assign a different staff member.', [
                'staff' => $staffLabel,
                'time' => $slotLabel,
            ]);
        }

        if ($reasonCode === 'no_staff_schedule') {
            return __(':staff is not rostered to work on :day (no staff schedule is set for this weekday). Add their schedule in Staff Schedules, pick another date, or assign another staff member.', [
                'staff' => $staffLabel,
                'day' => $weekdayLabel,
            ]);
        }

        if ($reasonCode === 'schedule_inactive') {
            return __(':staff has an inactive schedule on :day. Please update staff schedule settings or choose another date or staff member.', [
                'staff' => $staffLabel,
                'day' => $weekdayLabel,
            ]);
        }

        if ($reasonCode === 'hits_staff_break') {
            return __(':time overlaps with :staff break time. If this is a walk-in or overtime booking, you can continue with schedule override.', [
                'staff' => $staffLabel,
                'time' => $slotLabel,
            ]);
        }

        if ($reasonCode === 'outside_staff_schedule') {
            return __(':time is outside :staff regular working hours. If this is a walk-in or overtime booking, you can continue with schedule override.', [
                'staff' => $staffLabel,
                'time' => $slotLabel,
            ]);
        }

        $conflictParts = [];
        foreach ((array) ($diagnostics['conflicting_appointments'] ?? []) as $appointment) {
            if (! is_array($appointment)) {
                continue;
            }
            $code = trim((string) ($appointment['booking_code'] ?? ''));
            $label = $code !== '' ? $code : ('Booking #' . (int) ($appointment['id'] ?? 0));
            $startRaw = (string) ($appointment['start_at'] ?? '');
            $endRaw = (string) ($appointment['end_at'] ?? '');
            if ($startRaw !== '') {
                $start = Carbon::parse($startRaw);
                $end = $endRaw !== '' ? Carbon::parse($endRaw) : null;
                $range = $end && $end->isValid()
                    ? $start->format('d M, g:i A') . ' – ' . $end->format('g:i A')
                    : $start->format('d M, g:i A');
                $conflictParts[] = __('appointment :code (:time)', ['code' => $label, 'time' => $range]);
            } else {
                $conflictParts[] = __('appointment :code', ['code' => $label]);
            }
        }

        foreach ((array) ($diagnostics['conflicting_cart_items'] ?? []) as $cartItem) {
            if (! is_array($cartItem)) {
                continue;
            }
            $startRaw = (string) ($cartItem['start_at'] ?? '');
            $endRaw = (string) ($cartItem['end_at'] ?? '');
            $range = $startRaw !== ''
                ? Carbon::parse($startRaw)->format('d M, g:i A') . ($endRaw !== '' ? ' – ' . Carbon::parse($endRaw)->format('g:i A') : '')
                : __('unknown time');
            $conflictParts[] = __('active POS cart hold #:id (:time)', [
                'id' => (int) ($cartItem['id'] ?? 0),
                'time' => $range,
            ]);
        }

        foreach ((array) ($diagnostics['detected_blocks'] ?? []) as $block) {
            if (! is_array($block)) {
                continue;
            }
            $scope = strtoupper((string) ($block['scope'] ?? '')) === 'STORE'
                ? __('store blocked time')
                : __('staff blocked time');
            $startRaw = (string) ($block['start_at'] ?? '');
            $endRaw = (string) ($block['end_at'] ?? '');
            $range = $startRaw !== ''
                ? Carbon::parse($startRaw)->format('d M, g:i A') . ($endRaw !== '' ? ' – ' . Carbon::parse($endRaw)->format('g:i A') : '')
                : __('unknown time');
            $conflictParts[] = __(':scope #:id (:time)', [
                'scope' => $scope,
                'id' => (int) ($block['id'] ?? 0),
                'time' => $range,
            ]);
        }

        if ($conflictParts !== []) {
            return __('Cannot book :time for :staff because it overlaps with: :conflicts. Please choose a different time or staff member.', [
                'time' => $slotLabel,
                'staff' => $staffLabel,
                'conflicts' => implode('; ', $conflictParts),
            ]);
        }

        return __('Cannot book :time for :staff. This time overlaps with another appointment, an active cart hold, or blocked time. Please pick a different slot or staff member.', [
            'time' => $slotLabel,
            'staff' => $staffLabel,
        ]);
    }

    protected function formatSettlementConflictMessage(array $diagnostics): string
    {
        $reasonCode = (string) ($diagnostics['reason_code'] ?? '');
        $base = $reasonCode !== ''
            ? $this->posAvailabilityMessage($reasonCode)
            : __('This update extends the appointment time and conflicts with another booking or staff availability.');
        $parts = [];

        $bookingIds = collect($diagnostics['conflicting_booking_ids'] ?? [])->filter()->values()->all();
        if (! empty($bookingIds)) {
            $parts[] = 'Conflicting booking IDs: ' . implode(', ', $bookingIds);
        }

        $cartItemIds = collect($diagnostics['conflicting_cart_item_ids'] ?? [])->filter()->values()->all();
        if (! empty($cartItemIds)) {
            $parts[] = 'Conflicting cart hold IDs: ' . implode(', ', $cartItemIds);
        }

        $leaveIds = collect($diagnostics['detected_leave_ids'] ?? [])->filter()->values()->all();
        if (! empty($leaveIds)) {
            $parts[] = 'Staff leave/time-off IDs: ' . implode(', ', $leaveIds);
        }

        $blockIds = collect($diagnostics['detected_block_ids'] ?? [])->filter()->values()->all();
        if (! empty($blockIds)) {
            $parts[] = 'Booking block IDs: ' . implode(', ', $blockIds);
        }

        $schedule = (array) ($diagnostics['staff_schedule'] ?? []);
        if (($schedule['is_available'] ?? true) === false) {
            $parts[] = 'Staff schedule failure: ' . (string) ($schedule['failure_reason'] ?? 'unknown');
        }

        return empty($parts) ? $base : $base . ' ' . implode(' | ', $parts);
    }

    protected function recalculateAppointmentDurationMin(Booking $booking): int
    {
        $baseDurationMin = max(0, (int) ($booking->service?->duration_min ?? 0));

        $settlementItems = collect($booking->addon_items_json ?? []);
        $extraMainDurationMin = (int) $settlementItems
            ->filter(fn ($item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service')
            ->filter(fn ($item) => ! (bool) ($item['is_original'] ?? false))
            ->filter(fn ($item) => (int) ($item['linked_booking_service_id'] ?? 0) !== (int) ($booking->service_id ?? 0))
            ->sum(fn ($item) => max(0, (int) ($item['extra_duration_min'] ?? 0)));

        $topLevelAddonDurationMin = (int) $settlementItems
            ->filter(fn ($item) => strtolower((string) ($item['item_kind'] ?? 'addon')) !== 'main_service')
            ->sum(fn ($item) => max(0, (int) ($item['extra_duration_min'] ?? 0)));

        $nestedAddonDurationMin = (int) $settlementItems
            ->filter(fn ($item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service')
            ->filter(fn ($item) => ! (bool) ($item['is_original'] ?? false))
            ->filter(fn ($item) => (int) ($item['linked_booking_service_id'] ?? 0) !== (int) ($booking->service_id ?? 0))
            ->sum(fn ($item) => collect($item['addon_items'] ?? [])->sum(fn ($addon) => max(0, (int) ($addon['extra_duration_min'] ?? 0))));

        return $baseDurationMin + $extraMainDurationMin + $topLevelAddonDurationMin + $nestedAddonDurationMin;
    }


    protected function resolvePosScheduleOverride(int $staffId, Carbon $startAt, Carbon $endAt, array $scheduleDiagnostics, ?int $actorUserId = null): array
    {
        $failureReason = (string) ($scheduleDiagnostics['failure_reason'] ?? '');
        $scheduleStartRaw = $scheduleDiagnostics['schedule_start'] ?? null;
        $scheduleEndRaw = $scheduleDiagnostics['schedule_end'] ?? null;
        $scheduleStart = $scheduleStartRaw ? Carbon::parse((string) $scheduleStartRaw) : null;
        $scheduleEnd = $scheduleEndRaw ? Carbon::parse((string) $scheduleEndRaw) : null;
        $overrideUsed = in_array($failureReason, $this->posScheduleSoftFailureReasons(), true);
        $overrideType = null;

        if ($overrideUsed) {
            if ($failureReason === 'no_staff_schedule') {
                $overrideType = 'no_roster_day';
            } elseif ($failureReason === 'hits_staff_break') {
                $overrideType = 'hits_staff_break';
            } elseif ($scheduleStart && $scheduleEnd && $startAt->lt($scheduleStart)) {
                $overrideType = 'before_staff_working_hours';
            } elseif ($scheduleStart && $scheduleEnd && $endAt->gt($scheduleEnd)) {
                $overrideType = 'after_staff_working_hours';
            } else {
                $overrideType = $failureReason !== '' ? $failureReason : 'outside_staff_schedule';
            }
        }

        return [
            'schedule_override_used' => $overrideUsed,
            'schedule_override_type' => $overrideUsed ? $overrideType : null,
            'scheduled_staff_start_at' => $overrideUsed && $scheduleStart ? $scheduleStart : null,
            'scheduled_staff_end_at' => $overrideUsed && $scheduleEnd ? $scheduleEnd : null,
            'actual_booking_start_at' => $startAt,
            'actual_booking_end_at' => $endAt,
            'schedule_override_by' => $overrideUsed ? $actorUserId : null,
            'schedule_override_at' => $overrideUsed ? now() : null,
        ];
    }

    protected function recordScheduleOverrideAudit(Booking $booking, array $overrideData, Request $request): void
    {
        if (! (bool) ($overrideData['schedule_override_used'] ?? false)) {
            return;
        }

        $scheduledStart = $overrideData['scheduled_staff_start_at'] ?? null;
        $scheduledEnd = $overrideData['scheduled_staff_end_at'] ?? null;
        $actualStart = $overrideData['actual_booking_start_at'] ?? null;
        $actualEnd = $overrideData['actual_booking_end_at'] ?? null;
        $oldValueJson = [
            'staff_schedule_start' => $scheduledStart instanceof Carbon ? $scheduledStart->format('H:i') : null,
            'staff_schedule_end' => $scheduledEnd instanceof Carbon ? $scheduledEnd->format('H:i') : null,
        ];
        $newValueJson = [
            'booking_start' => $actualStart instanceof Carbon ? $actualStart->format('H:i') : null,
            'booking_end' => $actualEnd instanceof Carbon ? $actualEnd->format('H:i') : null,
            'override_type' => $overrideData['schedule_override_type'] ?? null,
        ];
        $user = $request->user();

        BookingLog::query()->create([
            'booking_id' => (int) $booking->id,
            'actor_type' => 'ADMIN',
            'actor_id' => $user?->id,
            'action' => 'SCHEDULE_OVERRIDE',
            'meta' => [
                'old_value_json' => $oldValueJson,
                'new_value_json' => $newValueJson,
                'performed_by' => $user?->id,
            ],
            'created_at' => now(),
        ]);
    }

    protected function serializeScheduleOverride(Booking $booking): array
    {
        return [
            'used' => (bool) ($booking->schedule_override_used ?? false),
            'type' => $booking->schedule_override_type,
            'scheduled_staff_start_at' => optional($booking->scheduled_staff_start_at)?->toIso8601String(),
            'scheduled_staff_end_at' => optional($booking->scheduled_staff_end_at)?->toIso8601String(),
            'actual_booking_start_at' => optional($booking->actual_booking_start_at)?->toIso8601String(),
            'actual_booking_end_at' => optional($booking->actual_booking_end_at)?->toIso8601String(),
            'by' => $booking->schedule_override_by ? (int) $booking->schedule_override_by : null,
            'at' => optional($booking->schedule_override_at)?->toIso8601String(),
        ];
    }

    protected function resolveAppointmentSnapshot(Booking $booking): array
    {
        $summary = $this->resolveAppointmentFinancialSummary($booking);
        $receiptHistory = $this->resolveAppointmentPaymentHistory((int) $booking->id);
        $guestName = trim((string) ($booking->guest_name ?? ''));
        $staffSplits = $this->resolveBookingStaffSplits((int) $booking->id, (int) ($booking->staff_id ?? 0));

        return [
            'id' => (int) $booking->id,
            'booking_code' => (string) ($booking->booking_code ?: ('BOOKING-' . $booking->id)),
            'status' => (string) $booking->status,
            'payment_status' => $this->calculateAppointmentPaymentStatus($summary),
            'appointment_start_at' => optional($booking->start_at)?->toIso8601String(),
            'appointment_end_at' => optional($booking->end_at)?->toIso8601String(),
            'schedule_override' => $this->serializeScheduleOverride($booking),
            'customer_name' => (string) (str_starts_with(strtoupper($guestName), 'UNKNOWN')
                ? 'Walk-in / Unknown'
                : (($booking->customer?->name ?? '') !== ''
                    ? $booking->customer?->name
                    : ($guestName !== '' ? $guestName . ' (GUEST)' : '-'))),
            'service_name' => (string) ($booking->service?->name ?? '-'),
            'service_cn_name' => $booking->service?->cn_name,
            'service_price_mode' => (string) ($booking->service?->price_mode ?? 'fixed'),
            'service_price_range_min' => $booking->service?->price_range_min !== null ? (float) $booking->service->price_range_min : null,
            'service_price_range_max' => $booking->service?->price_range_max !== null ? (float) $booking->service->price_range_max : null,
            'staff_name' => (string) ($booking->staff?->name ?? '-'),
            'staff_splits' => $staffSplits->values()->all(),
            'service_total' => (float) $summary['service_total'],
            'settled_service_amount' => $summary['settled_service_amount'],
            'is_range_priced' => (bool) $summary['is_range_priced'],
            'requires_settled_amount' => (bool) $summary['requires_settled_amount'],
            'deposit_contribution' => (float) $summary['deposit_contribution'],
            'deposit_paid' => (float) $summary['deposit_contribution'],
            'linked_booking_deposit' => (float) $summary['linked_booking_deposit'],
            'linked_booking_deposit_total' => (float) $summary['linked_booking_deposit'],
            'deposit_previously_collected' => (bool) $summary['deposit_previously_collected'],
            'deposit_previously_collected_amount' => (float) $summary['deposit_previously_collected_amount'],
            'package_offset' => (float) $summary['package_offset'],
            'settlement_paid' => (float) $summary['settlement_paid'],
            'balance_due' => (float) $summary['balance_due'],
            'amount_due_now' => (float) $summary['amount_due_now'],
            'add_ons' => $summary['add_ons'],
            'addon_total_duration_min' => (int) $summary['addon_total_duration_min'],
            'addon_total_price' => (float) $summary['addon_total_price'],
            'addon_paid_online' => (float) $summary['addon_paid_online'],
            'addon_paid_settlement' => (float) $summary['addon_paid_settlement'],
            'addon_balance_due' => (float) $summary['addon_balance_due'],
            'package_status' => $summary['package_status'],
            'can_apply_package' => (bool) ($summary['can_apply_package'] ?? false),
            'package_disabled_reason' => $summary['package_disabled_reason'] ?? null,
            'eligible_package_count' => (int) ($summary['eligible_package_count'] ?? 0),
            'receipts' => $receiptHistory,
        ];
    }


    protected function calculateAppointmentPaymentStatus(array $summary): string
    {
        $paidTotal = round(
            max(0.0, (float) ($summary['deposit_paid'] ?? $summary['deposit_contribution'] ?? 0))
            + max(0.0, (float) ($summary['settlement_paid'] ?? 0))
            + max(0.0, (float) ($summary['package_offset'] ?? 0)),
            2
        );
        $payableTotal = round(
            max(0.0, (float) ($summary['service_total'] ?? 0))
            + max(0.0, (float) ($summary['addon_total_price'] ?? 0)),
            2
        );

        if ($paidTotal <= 0.0001) {
            return 'UNPAID';
        }

        if ($paidTotal + 0.0001 < $payableTotal) {
            return 'PARTIAL';
        }

        return 'PAID';
    }

    protected function resolveAppointmentPaymentHistory(int $bookingId): array
    {
        return OrderItem::query()
            ->with(['order:id,order_number,payment_method,paid_at,created_at'])
            ->where('booking_id', $bookingId)
            ->whereIn('line_type', ['booking_deposit', 'booking_settlement', 'booking_addon'])
            ->orderBy('id')
            ->get()
            ->map(fn (OrderItem $item) => [
                'order_id' => (int) ($item->order?->id ?? 0),
                'order_number' => (string) ($item->order?->order_number ?? '-'),
                'line_type' => (string) ($item->line_type ?? ''),
                'stage_label' => match ((string) ($item->line_type ?? '')) {
                    'booking_deposit' => 'Booking Deposit Receipt',
                    'booking_settlement' => 'Final Settlement Receipt',
                    'booking_addon' => strcasecmp((string) ($item->variant_name_snapshot ?? ''), 'Booking Add-on Settlement') === 0
                        ? 'Booking Add-on Settlement Receipt'
                        : 'Booking Add-on Deposit Receipt',
                    default => 'Receipt',
                },
                'amount' => (float) ($item->line_total ?? 0),
                'payment_method' => (string) ($item->order?->payment_method ?? ''),
                'paid_at' => optional($item->order?->paid_at ?? $item->order?->created_at)?->toIso8601String(),
                'receipt_public_url' => $item->order ? $this->buildReceiptUrlForOrder((int) $item->order->id) : null,
            ])->values()->all();
    }

    protected function resolveHoldDepositOrder(Booking $booking): ?Order
    {
        $orderIds = OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->where('line_type', 'booking_deposit')
            ->pluck('order_id')
            ->filter()
            ->unique()
            ->values();

        if ($orderIds->isEmpty()) {
            return null;
        }

        return Order::query()
            ->whereIn('id', $orderIds)
            ->where('payment_status', '!=', 'paid')
            ->whereIn('status', ['pending', 'processing'])
            ->orderByDesc('id')
            ->first();
    }

    protected function resolveHoldDepositOrderForReview(Booking $booking): ?Order
    {
        $orderIds = OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->where('line_type', 'booking_deposit')
            ->pluck('order_id')
            ->filter()
            ->unique()
            ->values();

        if ($orderIds->isEmpty()) {
            return null;
        }

        return Order::query()
            ->whereIn('id', $orderIds)
            ->where('payment_status', '!=', 'paid')
            ->whereIn('status', ['pending', 'processing', 'reject_payment_proof'])
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @return int[]
     */
    protected function confirmHoldOrderBookings(Order $order): array
    {
        $bookingIds = $order->items()
            ->whereNotNull('booking_id')
            ->pluck('booking_id')
            ->unique()
            ->filter()
            ->values();

        if ($bookingIds->isEmpty()) {
            return [];
        }

        Booking::query()
            ->whereIn('id', $bookingIds)
            ->where('payment_status', '!=', 'PAID')
            ->update([
                'status' => 'CONFIRMED',
                'payment_status' => 'PAID',
                'hold_expires_at' => null,
                'updated_at' => now(),
            ]);

        foreach ($bookingIds as $bookingId) {
            BookingLog::create([
                'booking_id' => (int) $bookingId,
                'actor_type' => 'SYSTEM',
                'actor_id' => null,
                'action' => 'PAYMENT_CONFIRMED',
                'meta' => [
                    'order_id' => $order->id,
                    'order_no' => $order->order_number,
                    'source' => 'pos_hold_approve',
                ],
                'created_at' => now(),
            ]);
        }

        return $bookingIds->map(fn ($id) => (int) $id)->all();
    }

    protected function cancelHoldLinkedBookings(Order $order, Request $request, string $reason): void
    {
        $bookingIds = $order->items()
            ->whereNotNull('booking_id')
            ->pluck('booking_id')
            ->unique()
            ->filter()
            ->values();

        if ($bookingIds->isEmpty()) {
            return;
        }

        $bookings = Booking::query()
            ->whereIn('id', $bookingIds)
            ->lockForUpdate()
            ->get();

        foreach ($bookings as $booking) {
            if ((string) $booking->status === 'CANCELLED') {
                continue;
            }

            if ((string) $booking->payment_status === 'PAID') {
                throw new \RuntimeException('Linked paid booking cannot be cancelled from this flow.');
            }

            $this->bookingCancellationService->cancel(
                $booking,
                optional($request->user())->id,
                $reason,
                'ADMIN',
                ['HOLD', 'CONFIRMED', 'PENDING'],
                [
                    'order_id' => $order->id,
                    'order_no' => $order->order_number,
                    'source' => 'pos_hold_cancel',
                ]
            );
        }
    }

    protected function mapAppointmentPaymentProofs(Booking $booking): array
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

    protected function buildReceiptUrlForOrder(int $orderId): ?string
    {
        $receiptToken = OrderReceiptToken::query()
            ->where('order_id', $orderId)
            ->latest('id')
            ->first();

        if (! $receiptToken) {
            return null;
        }

        $frontendUrl = rtrim((string) config('services.frontend_url', config('app.url')), '/');
        return $frontendUrl . '/api/proxy/public/receipt/' . $receiptToken->token . '/invoice';
    }

    /**
     * POS cart settlement stores net amounts in line_total and pre-discount gross in line_total_snapshot.
     * Appointment collect-payment stores gross in line_total. Balance math must credit the gross value.
     */
    protected function resolveOrderItemSettlementGrossAmount(OrderItem|array $item): float
    {
        $lineTotal = (float) (is_array($item) ? ($item['line_total'] ?? 0) : ($item->line_total ?? 0));
        $snapshot = (float) (is_array($item) ? ($item['line_total_snapshot'] ?? 0) : ($item->line_total_snapshot ?? 0));
        if ($snapshot > $lineTotal + 0.0001) {
            return round($snapshot, 2);
        }

        return round($lineTotal, 2);
    }

    protected function resolveAppointmentFinancialSummary(Booking $booking): array
    {
        $isRangePriced = ($booking->service?->price_mode ?? 'fixed') === 'range';
        $settledServiceAmount = $booking->settled_service_amount !== null ? (float) $booking->settled_service_amount : null;
        $settlementItems = collect($booking->addon_items_json ?? []);
        $originalMainServiceItem = $settlementItems
            ->first(fn ($item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service' && (bool) ($item['is_original'] ?? false));
        $originalServiceAmount = $settledServiceAmount !== null
            ? $settledServiceAmount
            : (is_array($originalMainServiceItem) && array_key_exists('extra_price', $originalMainServiceItem)
                ? (float) $originalMainServiceItem['extra_price']
                : (float) ($booking->service?->service_price ?? $booking->service?->price ?? 0));
        $extraMainServices = $settlementItems
            ->filter(fn ($item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service')
            ->filter(fn ($item) => ! (bool) ($item['is_original'] ?? false))
            ->filter(fn ($item) => (int) ($item['linked_booking_service_id'] ?? 0) !== (int) ($booking->service_id ?? 0))
            ->map(fn ($item) => [
                'id' => isset($item['id']) ? (int) $item['id'] : null,
                'name' => (string) ($item['name'] ?? $item['label'] ?? 'Service'),
                'cn_name' => $item['cn_name'] ?? $item['linked_cn_name'] ?? null,
                'extra_duration_min' => max(0, (int) ($item['extra_duration_min'] ?? 0)),
                'extra_price' => round(max(0, (float) ($item['extra_price'] ?? 0)), 2),
                'linked_booking_service_id' => isset($item['linked_booking_service_id']) ? (int) $item['linked_booking_service_id'] : null,
                'is_original' => false,
                'add_ons' => collect($item['addon_items'] ?? [])->map(fn ($addon) => [
                    'id' => isset($addon['id']) ? (int) $addon['id'] : null,
                    'name' => (string) ($addon['name'] ?? $addon['label'] ?? 'Add-on'),
                    'cn_name' => $addon['cn_label'] ?? $addon['cn_name'] ?? $addon['linked_cn_name'] ?? null,
                    'extra_duration_min' => max(0, (int) ($addon['extra_duration_min'] ?? 0)),
                    'extra_price' => round(max(0, (float) ($addon['extra_price'] ?? 0)), 2),
                    'staff_splits' => collect($addon['staff_splits'] ?? [])->map(fn ($split) => [
                        'staff_id' => (int) ($split['staff_id'] ?? 0),
                        'share_percent' => (int) ($split['share_percent'] ?? 0),
                    ])->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)->values()->all(),
                ])->values()->all(),
                'staff_splits' => collect($item['staff_splits'] ?? [])->map(fn ($split) => [
                    'staff_id' => (int) ($split['staff_id'] ?? 0),
                    'share_percent' => (int) ($split['share_percent'] ?? 0),
                ])->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)->values()->all(),
            ])
            ->values();
        $mainServices = collect([[
            'id' => (int) ($booking->service_id ?? 0),
            'name' => (string) ($booking->service?->name ?? 'Service'),
            'cn_name' => $booking->service?->cn_name,
            'extra_duration_min' => max(0, (int) ($booking->service?->duration_min ?? 0)),
            'extra_price' => round(max(0, $originalServiceAmount), 2),
            'linked_booking_service_id' => (int) ($booking->service_id ?? 0),
            'is_original' => true,
            'add_ons' => [],
            'staff_splits' => $this->resolveBookingStaffSplits((int) $booking->id, (int) ($booking->staff_id ?? 0))->values()->all(),
        ]])->concat($extraMainServices)->values();

        $serviceTotal = round((float) $mainServices->sum('extra_price'), 2);
        $originalMainAddonItems = is_array($originalMainServiceItem) ? collect((array) ($originalMainServiceItem['addon_items'] ?? [])) : collect();
        $originalAddonSource = $originalMainAddonItems->isNotEmpty()
            ? $originalMainAddonItems
            : $settlementItems->filter(fn ($item) => strtolower((string) ($item['item_kind'] ?? 'addon')) !== 'main_service');
        $originalMainStaffSplits = $this->resolveBookingStaffSplits((int) $booking->id, (int) ($booking->staff_id ?? 0))->values()->all();
        $originalAddonItems = $originalAddonSource
            ->map(fn ($item) => [
            'id' => isset($item['id']) ? (int) $item['id'] : null,
            'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
            'cn_name' => $item['cn_label'] ?? $item['cn_name'] ?? $item['linked_cn_name'] ?? null,
            'extra_duration_min' => max(0, (int) ($item['extra_duration_min'] ?? 0)),
            'extra_price' => round(max(0, (float) ($item['extra_price'] ?? 0)), 2),
            'staff_splits' => collect($item['staff_splits'] ?? [])->map(fn ($split) => [
                'staff_id' => (int) ($split['staff_id'] ?? 0),
                'share_percent' => (int) ($split['share_percent'] ?? 0),
            ])->filter(fn ($split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)->values()->all() ?: $originalMainStaffSplits,
            'service_ref' => 'original',
        ])->values();
        $addedMainAddonItems = $extraMainServices
            ->flatMap(fn (array $service) => collect($service['add_ons'] ?? [])->map(fn (array $addon) => [
                ...$addon,
                'staff_splits' => ! empty($addon['staff_splits'] ?? []) ? $addon['staff_splits'] : ($service['staff_splits'] ?? []),
                'service_ref' => (string) ($service['name'] ?? 'Service'),
            ]))
            ->values();
        $addonItems = $originalAddonItems->concat($addedMainAddonItems)->values();
        $mainServices = $mainServices->map(function (array $service) use ($originalAddonItems) {
            if (($service['is_original'] ?? false) === true) {
                return [
                    ...$service,
                    'add_ons' => $originalAddonItems->map(fn (array $addon) => [
                        'id' => $addon['id'] ?? null,
                        'name' => $addon['name'] ?? 'Add-on',
                        'cn_name' => $addon['cn_name'] ?? null,
                        'extra_duration_min' => (int) ($addon['extra_duration_min'] ?? 0),
                        'extra_price' => (float) ($addon['extra_price'] ?? 0),
                        'staff_splits' => $addon['staff_splits'] ?? [],
                    ])->values()->all(),
                ];
            }

            return $service;
        })->values();
        $addonTotalDurationMin = (int) $addonItems->sum('extra_duration_min');
        $addonTotalPrice = round((float) ($booking->addon_price ?? $addonItems->sum('extra_price')), 2);
        $addonPaidRows = OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->where('line_type', 'booking_addon')
            ->get(['display_name_snapshot', 'product_name_snapshot', 'line_total', 'line_total_snapshot', 'variant_name_snapshot']);
        $addonPaidByName = $addonPaidRows
            ->groupBy(fn (OrderItem $row) => (string) ($row->display_name_snapshot ?: $row->product_name_snapshot ?: 'Add-on'))
            ->map(fn ($rows) => (float) $rows->sum(fn (OrderItem $row) => $this->resolveOrderItemSettlementGrossAmount($row)));
        $usedPaidByName = [];
        $addonSettlementItems = $addonItems->map(function (array $addon, int $idx) use ($addonPaidByName, &$usedPaidByName) {
            $name = ((string) ($addon['service_ref'] ?? 'original')) . '::' . (string) ($addon['name'] ?? 'Add-on');
            $totalPaidForName = (float) ($addonPaidByName->get($name) ?? 0);
            $alreadyUsed = (float) ($usedPaidByName[$name] ?? 0);
            $availablePaid = max(0, $totalPaidForName - $alreadyUsed);
            $extraPrice = max(0, (float) ($addon['extra_price'] ?? 0));
            $paidApplied = min($extraPrice, $availablePaid);
            $usedPaidByName[$name] = $alreadyUsed + $paidApplied;
            $balanceDue = max(0, $extraPrice - $paidApplied);

            return [
                ...$addon,
                'display_name' => $name,
                'line_key' => $this->appointmentSettlementLineKey('addon', $addon, $idx),
                'paid_amount' => round($paidApplied, 2),
                'balance_due' => round($balanceDue, 2),
            ];
        })->values();
        $actualAppointmentDepositCollected = round((float) OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->where('line_type', 'booking_deposit')
            ->sum('line_total'), 2);
        if ($actualAppointmentDepositCollected <= 0.0001) {
            $actualAppointmentDepositCollected = round(max(0, (float) ($booking->deposit_amount ?? 0)), 2);
        }
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
                    if (preg_match('/booking_deposit=([0-9]+(?:\\.[0-9]+)?)/', $notes, $matches) === 1) {
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
            $perPremiumContribution = $premiumBookings->count() > 0
                ? round($linkedBookingDeposit / $premiumBookings->count(), 2)
                : 0.0;
            $depositPaid = $currentType === 'PREMIUM' ? $perPremiumContribution : 0.0;
        } elseif ($standardBookings->isNotEmpty()) {
            $firstStandardBookingId = (int) ($standardBookings->first()?->booking_id ?? 0);
            $depositPaid = (int) $booking->id === $firstStandardBookingId ? $linkedBookingDeposit : 0.0;
        }

        $bookingDepositAmount = round(max(0, (float) ($booking->deposit_amount ?? 0)), 2);
        if ($actualAppointmentDepositCollected > 0.0001) {
            $depositPaid = $actualAppointmentDepositCollected;
        } elseif (abs($bookingDepositAmount - $depositPaid) > 0.0001) {
            $depositPaid = $bookingDepositAmount;
        }

        if ($linkedBookingDeposit <= 0.0001 && $actualAppointmentDepositCollected > 0.0001) {
            $linkedBookingDeposit = $actualAppointmentDepositCollected;
        }

        $mainSettlementPaidRows = OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->where('line_type', 'booking_settlement')
            ->get(['display_name_snapshot', 'product_name_snapshot', 'line_total', 'line_total_snapshot']);
        $serviceSettlementPaid = (float) $mainSettlementPaidRows
            ->sum(fn (OrderItem $row) => $this->resolveOrderItemSettlementGrossAmount($row));
        $mainPaidByName = $mainSettlementPaidRows
            ->groupBy(fn (OrderItem $row) => (string) ($row->display_name_snapshot ?: $row->product_name_snapshot ?: 'Service'))
            ->map(fn ($rows) => (float) $rows->sum(fn (OrderItem $row) => $this->resolveOrderItemSettlementGrossAmount($row)));
        $usedMainPaidByName = [];
        $mainSettlementItems = $mainServices->map(function (array $main) use ($mainPaidByName, &$usedMainPaidByName) {
            $displayName = 'Final Settlement - ' . (string) ($main['name'] ?? 'Service');
            $totalPaidForName = (float) ($mainPaidByName->get($displayName) ?? 0);
            $alreadyUsed = (float) ($usedMainPaidByName[$displayName] ?? 0);
            $availablePaid = max(0, $totalPaidForName - $alreadyUsed);
            $mainPrice = max(0, (float) ($main['extra_price'] ?? 0));
            $paidApplied = min($mainPrice, $availablePaid);
            $usedMainPaidByName[$displayName] = $alreadyUsed + $paidApplied;
            $balanceDue = max(0, $mainPrice - $paidApplied);

            return [
                ...$main,
                'paid_amount' => round($paidApplied, 2),
                'balance_due' => round($balanceDue, 2),
            ];
        })->values();
        $addonPaid = (float) $addonSettlementItems->sum('paid_amount');
        $addonPaidSettlement = (float) $addonPaidRows
            ->filter(fn (OrderItem $row) => strcasecmp((string) ($row->variant_name_snapshot ?? ''), 'Booking Add-on Settlement') === 0)
            ->sum(fn (OrderItem $row) => $this->resolveOrderItemSettlementGrossAmount($row));

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

        $coveredByPackage = $packageUsage !== null && in_array((string) $packageUsage->status, ['reserved', 'consumed'], true);
        $packageOffset = $coveredByPackage ? max(0.0, $originalServiceAmount) : 0.0;
        $packageEligibility = $this->resolveAppointmentPackageEligibility($booking, $packageUsage);

        $serviceOutstandingRows = $mainSettlementItems->map(function (array $item, int $idx) use ($depositPaid, $packageOffset) {
            $lineAmount = max(0, (float) ($item['extra_price'] ?? 0));
            $linePaid = max(0, (float) ($item['paid_amount'] ?? 0));
            $lineOutstanding = max(0, $lineAmount - $linePaid);
            if (($item['is_original'] ?? false) === true) {
                $lineOutstanding = max(0, $lineOutstanding - $depositPaid - $packageOffset);
            }

            return [
                ...$item,
                'line_key' => $this->appointmentSettlementLineKey('service', $item, $idx),
                'balance_due' => round($lineOutstanding, 2),
            ];
        })->values();
        $serviceBalanceDue = round((float) $serviceOutstandingRows->sum('balance_due'), 2);
        $addonBalanceDue = round((float) $addonSettlementItems->sum('balance_due'), 2);
        $settlementPaid = round($serviceSettlementPaid + $addonPaidSettlement, 2);
        $payableTotal = round($serviceTotal + $addonTotalPrice, 2);
        $paidTotal = round($depositPaid + $settlementPaid + $packageOffset, 2);
        $balanceDue = max(0.0, round($payableTotal - $paidTotal, 2));

        return [
            'service_total' => round($serviceTotal, 2),
            'main_services' => $mainServices->all(),
            'main_service_settlement_items' => $serviceOutstandingRows->all(),
            'settled_service_amount' => $settledServiceAmount !== null ? round($settledServiceAmount, 2) : null,
            'is_range_priced' => $isRangePriced,
            'requires_settled_amount' => $isRangePriced && $settledServiceAmount === null,
            'add_ons' => $addonItems->all(),
            'addon_settlement_items' => $addonSettlementItems->all(),
            'addon_total_duration_min' => $addonTotalDurationMin,
            'estimated_duration_min' => $this->recalculateAppointmentDurationMin($booking),
            'addon_total_price' => round($addonTotalPrice, 2),
            'deposit_contribution' => round($depositPaid, 2),
            'deposit_paid' => round($depositPaid, 2),
            'linked_booking_deposit' => round($linkedBookingDeposit, 2),
            'linked_booking_deposit_total' => round($linkedBookingDeposit, 2),
            'deposit_previously_collected' => $actualAppointmentDepositCollected > 0.0001,
            'deposit_previously_collected_amount' => round($actualAppointmentDepositCollected, 2),
            'package_offset' => round($packageOffset, 2),
            'service_balance_due' => round($serviceBalanceDue, 2),
            'settlement_paid' => $settlementPaid,
            'addon_paid_online' => round($addonPaid, 2),
            'addon_paid_settlement' => round($addonPaidSettlement, 2),
            'addon_balance_due' => round($addonBalanceDue, 2),
            'balance_due' => round($balanceDue, 2),
            'amount_due_now' => round($balanceDue, 2),
            'package_status' => $packageUsage ? [
                'status' => (string) $packageUsage->status,
                'used_qty' => (int) ($packageUsage->used_qty ?? 1),
                'reserved_at' => optional($packageUsage->reserved_at)?->toIso8601String(),
                'consumed_at' => optional($packageUsage->consumed_at)?->toIso8601String(),
            ] : null,
            'can_apply_package' => (bool) $packageEligibility['can_apply_package'],
            'package_disabled_reason' => $packageEligibility['package_disabled_reason'],
            'eligible_package_count' => (int) $packageEligibility['eligible_package_count'],
        ];
    }

    protected function resolveAppointmentPackageEligibility(Booking $booking, ?CustomerServicePackageUsage $packageUsage = null): array
    {
        if ($packageUsage && in_array((string) $packageUsage->status, ['reserved', 'consumed'], true)) {
            return [
                'can_apply_package' => false,
                'package_disabled_reason' => null,
                'eligible_package_count' => 0,
            ];
        }

        if (! $booking->customer_id) {
            return [
                'can_apply_package' => false,
                'package_disabled_reason' => __('Package can only be applied for members.'),
                'eligible_package_count' => 0,
            ];
        }

        if (! $booking->service_id) {
            return [
                'can_apply_package' => false,
                'package_disabled_reason' => __('No eligible package available.'),
                'eligible_package_count' => 0,
            ];
        }

        $eligibleCount = $this->countAvailablePackageBalance((int) $booking->customer_id, (int) $booking->service_id);

        return [
            'can_apply_package' => $eligibleCount > 0,
            'package_disabled_reason' => $eligibleCount > 0 ? null : __('No eligible package available.'),
            'eligible_package_count' => $eligibleCount,
        ];
    }

    protected function countAvailablePackageBalance(int $customerId, int $bookingServiceId): int
    {
        $balances = CustomerServicePackageBalance::query()
            ->select('customer_service_package_balances.*')
            ->join('customer_service_packages', 'customer_service_packages.id', '=', 'customer_service_package_balances.customer_service_package_id')
            ->where('customer_service_packages.customer_id', $customerId)
            ->where('customer_service_package_balances.booking_service_id', $bookingServiceId)
            ->where('customer_service_packages.status', 'active')
            ->where(function ($query) {
                $query->whereNull('customer_service_packages.expires_at')
                    ->orWhere('customer_service_packages.expires_at', '>=', now());
            })
            ->get();

        return (int) $balances->sum(function (CustomerServicePackageBalance $balance) use ($bookingServiceId) {
            $reservedQty = (int) CustomerServicePackageUsage::query()
                ->where('customer_service_package_id', (int) $balance->customer_service_package_id)
                ->where('booking_service_id', $bookingServiceId)
                ->where('status', 'reserved')
                ->sum('used_qty');

            return max(0, (int) $balance->remaining_qty - $reservedQty);
        });
    }

    protected function resolveBookingStaffSplits(int $bookingId, int $fallbackStaffId = 0)
    {
        $rows = DB::table('booking_service_staff_splits as splits')
            ->leftJoin('staffs', 'staffs.id', '=', 'splits.staff_id')
            ->where('splits.booking_id', $bookingId)
            ->orderBy('splits.id')
            ->get([
                'splits.staff_id',
                'staffs.name as staff_name',
                'splits.split_percent',
                'splits.service_commission_rate_snapshot',
            ])
            ->map(fn ($row) => [
                'staff_id' => (int) ($row->staff_id ?? 0),
                'staff_name' => (string) ($row->staff_name ?? '-'),
                'share_percent' => (int) ($row->split_percent ?? 0),
                'service_commission_rate_snapshot' => (float) ($row->service_commission_rate_snapshot ?? 0),
            ])
            ->filter(fn (array $row) => $row['staff_id'] > 0 && $row['share_percent'] > 0)
            ->values();

        if ($rows->isNotEmpty()) {
            return $rows;
        }

        if ($fallbackStaffId <= 0) {
            return collect();
        }

        $fallbackStaff = Staff::query()->find($fallbackStaffId, ['id', 'name', 'service_commission_rate']);
        if (! $fallbackStaff) {
            return collect();
        }

        return collect([[
            'staff_id' => (int) $fallbackStaff->id,
            'staff_name' => (string) ($fallbackStaff->name ?? '-'),
            'share_percent' => 100,
            'service_commission_rate_snapshot' => (float) ($fallbackStaff->service_commission_rate ?? 0),
        ]]);
    }

    protected function normalizeBookingStaffSplits($splits, int $fallbackStaffId): array
    {
        $rows = collect($splits)->values();
        if ($rows->isEmpty() && $fallbackStaffId > 0) {
            $rows = collect([['staff_id' => $fallbackStaffId, 'share_percent' => 100]]);
        }
        if ($rows->isEmpty()) {
            return ['error' => __('At least one staff split is required.'), 'splits' => []];
        }

        $normalized = $rows->map(fn ($row) => [
            'staff_id' => (int) ($row['staff_id'] ?? 0),
            'share_percent' => (int) ($row['share_percent'] ?? 0),
        ])->values();

        $uniqueStaff = $normalized->pluck('staff_id')->unique();
        if ($uniqueStaff->count() !== $normalized->count()) {
            return ['error' => __('Duplicate staff is not allowed in split.'), 'splits' => []];
        }

        if ($normalized->contains(fn ($row) => $row['staff_id'] <= 0 || $row['share_percent'] <= 0)) {
            return ['error' => __('Each staff split must have valid staff and percent.'), 'splits' => []];
        }

        $sum = (int) $normalized->sum('share_percent');
        if ($sum !== 100) {
            return ['error' => __('Staff split total must equal 100% (current: :sum%).', ['sum' => $sum]), 'splits' => []];
        }

        $staffRates = Staff::query()
            ->whereIn('id', $uniqueStaff->all())
            ->pluck('service_commission_rate', 'id');

        $withRate = $normalized->map(fn ($row) => [
            'staff_id' => (int) $row['staff_id'],
            'share_percent' => (int) $row['share_percent'],
            'service_commission_rate_snapshot' => (float) ($staffRates[(int) $row['staff_id']] ?? 0),
        ])->values();

        return ['error' => null, 'splits' => $withRate->all()];
    }

    protected function persistBookingStaffSplits(Booking $booking, $normalizedSplits): void
    {
        DB::table('booking_service_staff_splits')
            ->where('booking_id', (int) $booking->id)
            ->delete();

        $rows = collect($normalizedSplits)->map(fn ($split) => [
            'booking_id' => (int) $booking->id,
            'staff_id' => (int) ($split['staff_id'] ?? 0),
            'split_percent' => (int) ($split['share_percent'] ?? 0),
            'service_commission_rate_snapshot' => (float) ($split['service_commission_rate_snapshot'] ?? 0),
            'created_at' => now(),
            'updated_at' => now(),
        ])->filter(fn ($row) => $row['staff_id'] > 0 && $row['split_percent'] > 0)->values()->all();

        if (! empty($rows)) {
            DB::table('booking_service_staff_splits')->insert($rows);
            $booking->staff_id = (int) ($rows[0]['staff_id'] ?? $booking->staff_id);
            $booking->save();
        }
    }

    /**
     * When an appointment’s balance is fully covered (e.g. package), attach list-price OrderServiceItem lines,
     * mark booking paid, and consume reserved package claims — mirrors POS cart checkout behaviour.
     */
    protected function recordPackageCoveredAppointmentOnOrder(Order $order, Booking $booking): void
    {
        $booking->loadMissing(['service', 'customer']);
        $summary = $this->resolveAppointmentFinancialSummary($booking);

        $listTotal = max(0.0, (float) ($summary['service_total'] ?? 0));
        if ($listTotal <= 0.0001 && $booking->service) {
            $listTotal = (float) ($booking->service->service_price ?? $booking->service->price ?? 0);
        }

        $splitRows = DB::table('booking_service_staff_splits as splits')
            ->where('splits.booking_id', (int) $booking->id)
            ->orderBy('splits.id')
            ->get([
                'splits.staff_id',
                'splits.split_percent',
                'splits.service_commission_rate_snapshot',
            ]);

        $splitsPayload = $splitRows
            ->map(fn ($row) => [
                'staff_id' => (int) ($row->staff_id ?? 0),
                'share_percent' => (int) ($row->split_percent ?? 0),
                'service_commission_rate_snapshot' => (float) ($row->service_commission_rate_snapshot ?? 0),
            ])
            ->filter(fn (array $r) => $r['staff_id'] > 0)
            ->values()
            ->all();

        $primaryRate = (float) ($splitsPayload[0]['service_commission_rate_snapshot'] ?? 0);
        $commissionAmount = round($listTotal * $primaryRate, 2);

        OrderServiceItem::create([
            'order_id' => (int) $order->id,
            'booking_id' => (int) $booking->id,
            'booking_service_id' => (int) ($booking->service_id ?? 0),
            'customer_id' => $booking->customer_id ? (int) $booking->customer_id : null,
            'service_name_snapshot' => (string) ($booking->service?->name ?? 'Service'),
            'price_snapshot' => $listTotal,
            'qty' => 1,
            'line_total' => $listTotal,
            'assigned_staff_id' => $booking->staff_id ? (int) $booking->staff_id : null,
            'start_at' => $booking->start_at,
            'end_at' => $booking->end_at,
            'notes' => null,
            'staff_splits' => $splitsPayload,
            'commission_rate_used' => $primaryRate,
            'commission_amount' => $commissionAmount,
            'item_type' => 'service',
        ]);

        $booking->payment_status = 'PAID';
        $booking->save();

        $this->customerServicePackageService->consumeReservedClaimsForBooking((int) $booking->id);

        $this->staffCommissionService->syncBookingCommissionState($booking->fresh(['service']));
    }


    protected function buildReceiptUrl(Order $order, Request $request): string
    {
        $existingToken = OrderReceiptToken::query()
            ->where('order_id', $order->id)
            ->latest('id')
            ->first();

        if (! $existingToken) {
            $existingToken = OrderReceiptToken::create([
                'order_id' => $order->id,
                'token' => Str::random(64),
                'expires_at' => null,
            ]);
        }

        $frontendUrl = rtrim((string) config('services.frontend_url', config('app.url')), '/');

        return $frontendUrl . '/api/proxy/public/receipt/' . $existingToken->token . '/invoice';
    }

    protected function generateOrderNumber(): string
    {
        return 'POS-' . Carbon::now()->format('YmdHis') . '-' . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    }

    protected function resolvePosGuestIdentityKey(?Booking $booking): ?string
    {
        if (! $booking || ! empty($booking->customer_id)) {
            return null;
        }

        $guestName = strtoupper(trim((string) ($booking->guest_name ?? '')));
        if (str_starts_with($guestName, 'UNKNOWN')) {
            return 'unknown';
        }

        $guestEmail = strtolower(trim((string) ($booking->guest_email ?? '')));
        if ($guestEmail !== '') {
            return 'email:' . $guestEmail;
        }

        $guestPhone = trim((string) ($booking->guest_phone ?? ''));
        if ($guestName !== '' && $guestPhone !== '') {
            return 'guest:' . $guestName . '|' . $guestPhone;
        }

        if ($guestName !== '') {
            return 'name:' . $guestName;
        }

        return null;
    }
}
