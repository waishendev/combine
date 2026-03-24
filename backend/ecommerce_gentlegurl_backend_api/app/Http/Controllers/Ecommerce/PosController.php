<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Mail\PosOrderReceiptMail;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderItemStaffSplit;
use App\Models\Ecommerce\OrderReceiptToken;
use App\Models\Ecommerce\PosCart;
use App\Models\Ecommerce\PosCartItem;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingSetting;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Booking\ServicePackage;
use App\Models\Ecommerce\OrderServiceItem;
use App\Models\Ecommerce\PosCartPackageItem;
use App\Models\Ecommerce\PosCartServiceItem;
use App\Models\Ecommerce\ServicePackageStaffSplit;
use App\Models\Staff;
use App\Services\Booking\BookingAvailabilityService;
use App\Services\Booking\CustomerServicePackageService;
use App\Models\Promotion;
use App\Models\Ecommerce\OrderVoucher;
use App\Models\Ecommerce\CustomerVoucher;
use App\Services\Ecommerce\InvoiceService;
use App\Services\Ecommerce\OrderPaymentService;
use App\Services\Voucher\VoucherEligibilityService;
use App\Services\Voucher\VoucherService;
use App\Support\Pricing\ProductPricing;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class PosController extends Controller
{
    public function __construct(
        protected VoucherEligibilityService $voucherEligibilityService,
        protected VoucherService $voucherService,
        protected InvoiceService $invoiceService,
        protected CustomerServicePackageService $customerServicePackageService,
        protected BookingAvailabilityService $availabilityService,
    ) {}

    public function memberSearch(Request $request)
    {
        $query = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));

        $builder = Customer::query();

        if ($query !== '') {
            $builder->where(function ($queryBuilder) use ($query) {
                $queryBuilder->where('name', 'like', "%{$query}%")
                    ->orWhere('phone', 'like', "%{$query}%")
                    ->orWhere('email', 'like', "%{$query}%")
                    ->orWhereRaw('CAST(id AS TEXT) = ?', [$query]);
            });
        }

        $paginator = $builder
            ->orderBy('id', 'desc')
            ->paginate($perPage, ['id', 'name', 'phone', 'email'], 'page', $page);

        return $this->respond([
            'data' => collect($paginator->items())->map(fn (Customer $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'phone' => $member->phone,
                'member_code' => (string) $member->id,
                'email' => $member->email,
            ])->values(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
    }


    public function serviceSearch(Request $request)
    {
        $query = trim((string) $request->query('q', ''));

        $builder = BookingService::query()->where('is_active', true)->orderBy('name');

        if ($query !== '') {
            $builder->where(function ($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                    ->orWhere('service_type', 'like', "%{$query}%");
            });
        }

        return $this->respond([
            'data' => $builder->get(['id', 'name', 'service_type', 'service_price', 'duration_min', 'buffer_min']),
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
            'data' => $builder->get(['id', 'name', 'description', 'selling_price', 'total_sessions', 'valid_days']),
        ]);
    }

    public function appointmentSearch(Request $request)
    {
        $query = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));

        $builder = Booking::query()->with(['customer:id,name', 'service:id,name,service_price,price', 'staff:id,name']);

        if ($query !== '') {
            $builder->where(function ($q) use ($query) {
                $q->where('booking_code', 'like', "%{$query}%")
                    ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'like', "%{$query}%"))
                    ->orWhereHas('service', fn ($sq) => $sq->where('name', 'like', "%{$query}%"));
            });
        }

        if ($request->filled('date')) {
            $builder->whereDate('start_at', $request->string('date'));
        }
        if ($request->filled('customer_id')) {
            $builder->where('customer_id', (int) $request->query('customer_id'));
        }
        if ($request->filled('staff_id')) {
            $builder->where('staff_id', (int) $request->query('staff_id'));
        }
        if ($request->filled('status')) {
            $builder->where('status', (string) $request->query('status'));
        } else {
            $builder->whereIn('status', ['CONFIRMED', 'PENDING', 'IN_PROGRESS']);
        }

        $paginator = $builder->orderBy('start_at')->paginate($perPage, ['*'], 'page', $page);

        $rows = collect($paginator->items())->map(function (Booking $booking) {
            $summary = $this->resolveAppointmentFinancialSummary($booking);
            return [
                'id' => (int) $booking->id,
                'booking_code' => (string) ($booking->booking_code ?: ('BOOKING-' . $booking->id)),
                'customer_name' => (string) ($booking->customer?->name ?? '-'),
                'service_names' => [(string) ($booking->service?->name ?? '-')],
                'appointment_start_at' => optional($booking->start_at)?->toIso8601String(),
                'appointment_end_at' => optional($booking->end_at)?->toIso8601String(),
                'staff_name' => (string) ($booking->staff?->name ?? '-'),
                'status' => (string) $booking->status,
                'deposit_contribution' => (float) $summary['deposit_contribution'],
                'deposit_paid' => (float) $summary['deposit_contribution'],
                'linked_booking_deposit' => (float) $summary['linked_booking_deposit'],
                'linked_booking_deposit_total' => (float) $summary['linked_booking_deposit'],
                'package_offset' => (float) $summary['package_offset'],
                'balance_due' => (float) $summary['balance_due'],
                'amount_due_now' => (float) $summary['balance_due'],
                'service_total' => (float) $summary['service_total'],
                'package_status' => $summary['package_status'],
            ];
        })->values();

        return $this->respond([
            'data' => $rows,
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
    }

    public function appointmentDetail(int $id)
    {
        $booking = Booking::query()
            ->with(['customer:id,name,phone,email', 'service:id,name,service_price,price,service_type', 'staff:id,name'])
            ->findOrFail($id);

        $summary = $this->resolveAppointmentFinancialSummary($booking);
        $history = $this->resolveAppointmentPaymentHistory((int) $booking->id);
        $staffSplits = DB::table('booking_service_staff_splits as splits')
            ->leftJoin('staffs', 'staffs.id', '=', 'splits.staff_id')
            ->where('splits.booking_id', (int) $booking->id)
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
                'split_percent' => (int) ($row->split_percent ?? 0),
                'service_commission_rate_snapshot' => (float) ($row->service_commission_rate_snapshot ?? 0),
            ])->values();

        return $this->respond([
            'id' => (int) $booking->id,
            'booking_code' => (string) ($booking->booking_code ?: ('BOOKING-' . $booking->id)),
            'status' => (string) $booking->status,
            'appointment_start_at' => optional($booking->start_at)?->toIso8601String(),
            'appointment_end_at' => optional($booking->end_at)?->toIso8601String(),
            'customer' => [
                'id' => (int) ($booking->customer?->id ?? 0),
                'name' => (string) ($booking->customer?->name ?? '-'),
                'phone' => $booking->customer?->phone,
                'email' => $booking->customer?->email,
            ],
            'service' => [
                'id' => (int) ($booking->service?->id ?? 0),
                'name' => (string) ($booking->service?->name ?? '-'),
                'service_type' => (string) ($booking->service?->service_type ?? ''),
            ],
            'staff' => [
                'id' => (int) ($booking->staff?->id ?? 0),
                'name' => (string) ($booking->staff?->name ?? '-'),
            ],
            'staff_splits' => $staffSplits,
            'service_total' => (float) $summary['service_total'],
            'deposit_contribution' => (float) $summary['deposit_contribution'],
            'deposit_paid' => (float) $summary['deposit_contribution'],
            'linked_booking_deposit' => (float) $summary['linked_booking_deposit'],
            'linked_booking_deposit_total' => (float) $summary['linked_booking_deposit'],
            'package_offset' => (float) $summary['package_offset'],
            'settlement_paid' => (float) $summary['settlement_paid'],
            'balance_due' => (float) $summary['balance_due'],
            'amount_due_now' => (float) $summary['balance_due'],
            'package_status' => $summary['package_status'],
            'payment_history' => $history,
        ]);
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

    public function collectAppointmentPayment(Request $request, int $id)
    {
        $validated = $request->validate([
            'payment_method' => ['required', 'in:cash,qrpay'],
        ]);

        $booking = Booking::query()->with(['service', 'customer'])->findOrFail($id);
        if (! $booking->customer_id || ! $booking->service_id) {
            return $this->respondError(__('Appointment must have customer and service before settlement.'), 422);
        }

        $summary = $this->resolveAppointmentFinancialSummary($booking);
        $balanceDue = (float) $summary['balance_due'];
        if ($balanceDue <= 0) {
            return $this->respondError(__('No balance due for this appointment.'), 422);
        }

        $amount = (float) $balanceDue;
        if ($amount <= 0) {
            return $this->respondError(__('Payment amount must be greater than 0.'), 422);
        }

        [$order, $receiptUrl] = DB::transaction(function () use ($request, $booking, $amount, $validated) {
            $order = Order::query()->create([
                'order_number' => 'POS-' . now()->format('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                'customer_id' => (int) $booking->customer_id,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => $validated['payment_method'],
                'payment_provider' => 'manual',
                'subtotal' => $amount,
                'discount_total' => 0,
                'shipping_fee' => 0,
                'grand_total' => $amount,
                'pickup_or_shipping' => 'pickup',
                'placed_at' => now(),
                'paid_at' => now(),
                'completed_at' => now(),
                'notes' => 'POS appointment settlement by staff #' . $request->user()->id . ' | booking_id=' . $booking->id,
            ]);

            OrderItem::query()->create([
                'order_id' => (int) $order->id,
                'line_type' => 'booking_settlement',
                'product_name_snapshot' => 'Appointment Settlement - ' . (string) ($booking->service?->name ?: 'Service'),
                'display_name_snapshot' => 'Appointment Settlement - ' . (string) ($booking->service?->name ?: 'Service'),
                'quantity' => 1,
                'price_snapshot' => $amount,
                'unit_price_snapshot' => $amount,
                'line_total' => $amount,
                'line_total_snapshot' => $amount,
                'effective_unit_price' => $amount,
                'effective_line_total' => $amount,
                'locked' => true,
                'booking_id' => (int) $booking->id,
                'booking_service_id' => (int) $booking->service_id,
            ]);

            $receipt = $this->buildReceiptUrl($order, $request);
            return [$order, $receipt];
        });

        $freshSummary = $this->resolveAppointmentFinancialSummary($booking->fresh(['service', 'customer']));

        return $this->respond([
            'order_id' => (int) $order->id,
            'order_number' => (string) $order->order_number,
            'receipt_public_url' => $receiptUrl,
            'paid_amount' => (float) $amount,
                'balance_due' => (float) $freshSummary['balance_due'],
                'amount_due_now' => (float) $freshSummary['balance_due'],
                'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
        ], __('Appointment payment collected.'));
    }

    public function markAppointmentCompleted(int $id)
    {
        $booking = Booking::query()->with(['service', 'customer', 'staff'])->findOrFail($id);
        $summary = $this->resolveAppointmentFinancialSummary($booking);
        if ((float) $summary['balance_due'] > 0.0001) {
            return $this->respondError(__('Please collect outstanding balance before marking completed.'), 422);
        }

        DB::transaction(function () use ($booking) {
            $booking->status = 'COMPLETED';
            $booking->completed_at = now();
            $booking->payment_status = 'PAID';
            $booking->save();

            $this->customerServicePackageService->consumeReservedClaimsForBooking((int) $booking->id);
            $this->customerServicePackageService->attachReservedClaimsToBooking(
                (int) ($booking->customer_id ?? 0),
                (int) ($booking->service_id ?? 0),
                'POS',
                (int) $booking->id,
                (int) $booking->id,
            );
            $this->customerServicePackageService->consumeReservedClaimsForBooking((int) $booking->id);
        });

        return $this->respond([
            'appointment' => $this->resolveAppointmentSnapshot($booking->fresh(['customer', 'service', 'staff'])),
        ], __('Appointment marked as completed.'));
    }

    public function addByBarcode(Request $request)
    {
        $validated = $request->validate([
            'barcode' => ['required', 'string'],
            'qty' => ['nullable', 'integer', 'min:1'],
        ]);

        $barcode = trim((string) $validated['barcode']);

        $variant = ProductVariant::query()
            ->with('product')
            ->where('sku', $barcode)
            ->where('is_active', true)
            ->first();

        $product = null;
        if (! $variant) {
            $product = Product::query()
                ->where('sku', $barcode)
                ->where('is_active', true)
                ->where('is_reward_only', false)
                ->first();
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

    public function addByVariant(Request $request)
    {
        $validated = $request->validate([
            'variant_id' => ['nullable', 'integer', 'exists:product_variants,id', 'required_without:product_id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id', 'required_without:variant_id'],
            'qty' => ['nullable', 'integer', 'min:1'],
        ]);

        $qty = (int) ($validated['qty'] ?? 1);

        $variant = null;
        $product = null;

        if (! empty($validated['variant_id'])) {
            $variant = ProductVariant::query()
                ->with('product')
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

    public function addService(Request $request)
    {
        $validated = $request->validate([
            'booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'start_at' => ['required', 'date'],
            'assigned_staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'qty' => ['nullable', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'staff_splits' => ['nullable', 'array'],
            'staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'staff_splits.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
        ]);

        $service = BookingService::query()->where('is_active', true)->findOrFail((int) $validated['booking_service_id']);
        $customer = Customer::query()->findOrFail((int) $validated['customer_id']);
        $staff = Staff::query()->findOrFail((int) $validated['assigned_staff_id']);
        $qty = max(1, (int) ($validated['qty'] ?? 1));

        $startAt = Carbon::parse((string) $validated['start_at']);
        $endAt = $startAt->copy()->addMinutes((int) ($service->duration_min ?? 0));

        $splits = collect($validated['staff_splits'] ?? [
            ['staff_id' => (int) $staff->id, 'share_percent' => 100],
        ])->values();

        $sum = (int) $splits->sum(fn (array $split) => (int) ($split['share_percent'] ?? 0));
        $uniqueCount = $splits->pluck('staff_id')->filter()->unique()->count();
        if ($sum !== 100 || $uniqueCount !== $splits->count()) {
            return $this->respondError(__('Invalid staff split. Total must be 100% and staffs must be unique.'), 422);
        }

        $staffIds = $splits->pluck('staff_id')->map(fn ($id) => (int) $id)->unique()->values();
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

        $primaryStaffId = (int) ($normalizedSplits[0]['staff_id'] ?? $staff->id);
        $primaryCommissionRate = (float) ($staffCommissionRates[$primaryStaffId] ?? $staff->service_commission_rate ?? 0);

        $cart = $this->resolveCart((int) $request->user()->id);

        $item = PosCartServiceItem::query()->create([
            'pos_cart_id' => $cart->id,
            'booking_service_id' => $service->id,
            'customer_id' => $customer->id,
            'service_name_snapshot' => $service->name,
            'price_snapshot' => (float) ($service->price ?? $service->service_price ?? 0),
            'qty' => $qty,
            'assigned_staff_id' => $primaryStaffId,
            'start_at' => $startAt,
            'end_at' => $endAt,
            'notes' => $validated['notes'] ?? null,
            'staff_splits' => $normalizedSplits,
            'commission_rate_used' => $primaryCommissionRate,
        ]);

        return $this->respond([
            'item' => $item->load(['bookingService:id,name', 'assignedStaff:id,name']),
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ], __('Booking service added to POS cart.'));
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

        $service = BookingService::query()->where('is_active', true)->findOrFail((int) $validated['booking_service_id']);
        $customer = Customer::query()->findOrFail((int) $validated['customer_id']);
        $staff = Staff::query()->findOrFail((int) $validated['assigned_staff_id']);

        $startAt = Carbon::parse((string) $validated['start_at']);
        $endAt = $startAt->copy()->addMinutes((int) $service->duration_min);

        if ($availabilityService->hasConflict((int) $staff->id, $startAt, $endAt, (int) $service->buffer_min)) {
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
        $cart = $this->resolveCart((int) $request->user()->id);

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
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ], __('Package added to POS cart.'));
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
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    public function removePackageCartItem(Request $request, int $itemId)
    {
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->packageItems()->findOrFail($itemId);
        $item->delete();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
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

        if ($variant && $variant->track_stock && (int) $variant->stock < $qty) {
            return $this->respondError(__('Insufficient stock.'), 422);
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

        if ($variant && $variant->track_stock && $item->qty > (int) $variant->stock) {
            return $this->respondError(__('Insufficient stock.'), 422);
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
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    public function productSearch(Request $request)
    {
        $query = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));

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
            ->with(['product', 'product.images'])
            ->where('is_active', true)
            ->whereHas('product', fn ($builder) => $builder->where('is_active', true)->where('is_reward_only', false))
            ->where(function ($builder) use ($query) {
                $builder->whereRaw('LOWER(sku) = ?', [mb_strtolower($query)])
                    ->orWhere('sku', 'like', "%{$query}%")
                    ->orWhereHas('product', function ($productQuery) use ($query) {
                        $productQuery->whereRaw('LOWER(sku) = ?', [mb_strtolower($query)])
                            ->orWhere('sku', 'like', "%{$query}%")
                            ->orWhere('name', 'like', "%{$query}%");
                    });
            })
            ->orderByRaw('CASE WHEN LOWER(sku) = ? THEN 0 ELSE 1 END', [$exact])
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
                    'name' => $product?->name,
                    'sku' => $variant->sku,
                    'barcode' => $variant->sku,
                    'price' => (float) ($pricing['unit_price'] ?? $variant->sale_price ?? $variant->price ?? 0),
                    'thumbnail_url' => $variant->image_url ?? $product?->cover_image_url,
                ];
            })->values(),
            'current_page' => $variants->currentPage(),
            'last_page' => $variants->lastPage(),
            'per_page' => $variants->perPage(),
            'total' => $variants->total(),
        ]);
    }

    public function updateCartItem(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'qty' => ['required', 'integer', 'min:1'],
            'variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->items()->with(['variant', 'product'])->findOrFail($itemId);

        $qty = (int) $validated['qty'];
        $targetVariantId = isset($validated['variant_id']) ? (int) $validated['variant_id'] : null;

        if ($targetVariantId) {
            $targetVariant = ProductVariant::query()
                ->with('product')
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

            if ($targetVariant->track_stock && $finalQty > (int) $targetVariant->stock) {
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
                'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
            ]);
        }

        if ($item->variant?->track_stock && $qty > (int) $item->variant->stock) {
            return $this->respondError(__('Insufficient stock.'), 422);
        }

        if (! $item->variant && $item->product?->track_stock && $qty > (int) $item->product->stock) {
            return $this->respondError(__('Insufficient stock.'), 422);
        }

        $item->qty = $qty;
        $item->save();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    public function removeCartItem(Request $request, int $itemId)
    {
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->items()->findOrFail($itemId);
        $item->delete();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    public function removeServiceCartItem(Request $request, int $itemId)
    {
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->serviceItems()->findOrFail($itemId);
        $this->customerServicePackageService->releaseReservedClaimsBySource('POS', (int) $item->id);
        $item->delete();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    public function cart(Request $request)
    {
        $cart = $this->resolveCart((int) $request->user()->id)->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name']);

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

        $cart = $this->resolveCart((int) $request->user()->id)->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name']);
        if ($cart->items->isEmpty() && $cart->serviceItems->isEmpty() && $cart->packageItems->isEmpty()) {
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
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }

    public function removeVoucher(Request $request)
    {
        $cart = $this->resolveCart((int) $request->user()->id);
        $this->clearVoucherFromCart($cart);

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name'])),
        ]);
    }



    public function updateCartItemDiscount(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'discount_type' => ['nullable', 'in:percentage,fixed'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->items()->with(['variant.product', 'product'])->findOrFail($itemId);

        $discountType = $validated['discount_type'] ?? null;
        $discountValue = (float) ($validated['discount_value'] ?? 0);

        if (!$discountType || $discountValue <= 0) {
            $item->discount_type = null;
            $item->discount_value = 0;
            $item->save();

            return $this->respond(['cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name']))]);
        }

        $isStaffUser = !empty($request->user()?->staff_id);
        $basePricing = $this->resolvePosCartItemPricing($item, $isStaffUser);
        $baseLineTotal = (float) ($basePricing['line_total_after_promotion'] ?? $basePricing['effective_line_total']);

        if ($discountType === 'percentage' && ($discountValue < 0 || $discountValue > 100)) {
            return $this->respondError(__('Percentage discount must be between 0 and 100.'), 422);
        }

        if ($discountType === 'fixed' && $discountValue > $baseLineTotal) {
            return $this->respondError(__('Fixed discount must not exceed line total.'), 422);
        }

        $item->discount_type = $discountType;
        $item->discount_value = $discountValue;
        $item->save();

        return $this->respond(['cart' => $this->serializeCart($cart->fresh()->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name']))]);
    }

    public function checkout(Request $request, OrderPaymentService $orderPaymentService)
    {
        $validated = $request->validate([
            'payment_method' => ['required', 'in:cash,qrpay'],
            'member_id' => ['nullable', 'integer', 'exists:customers,id'],
            'items' => ['nullable', 'array'],
            'items.*.cart_item_id' => ['nullable', 'integer'],
            'items.*.staff_splits' => ['nullable', 'array'],
            'items.*.staff_splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'items.*.staff_splits.*.share_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'service_items' => ['nullable', 'array'],
            'service_items.*.type' => ['nullable', 'in:service'],
            'service_items.*.cart_service_item_id' => ['nullable', 'integer'],
            'service_items.*.booking_service_id' => ['nullable', 'integer', 'exists:booking_services,id'],
            'service_items.*.quantity' => ['nullable', 'integer', 'min:1'],
            'service_items.*.customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'service_items.*.assigned_staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
            'service_items.*.start_at' => ['nullable', 'date'],
            'service_items.*.service_commission_rate_used' => ['nullable', 'numeric', 'min:0'],
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

        $cart = $this->resolveCart((int) $request->user()->id)->load(['items.variant.product', 'items.product', 'serviceItems.bookingService', 'serviceItems.assignedStaff', 'packageItems.servicePackage', 'packageItems.customer:id,name']);
        if ($cart->items->isEmpty() && $cart->serviceItems->isEmpty() && $cart->packageItems->isEmpty()) {
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

        [$order, $receiptUrl, $purchasedPackageLines] = DB::transaction(function () use ($validated, $cart, $request, $orderPaymentService) {
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

            if ($cart->packageItems->isNotEmpty() && empty($customerId)) {
                abort(422, __('Please assign member before purchasing service package.'));
            }

            if (!empty($customerId) && !empty($packageCustomerId) && (int) $customerId !== (int) $packageCustomerId) {
                abort(422, __('Selected checkout member does not match package member.'));
            }

            $isStaffUser = !empty($request->user()?->staff_id);

            $cartPricing = $this->buildCartPricing($cart, $isStaffUser);
            $packageSubtotal = (float) $cart->packageItems->sum(fn (PosCartPackageItem $item) => ((float) $item->price_snapshot) * (int) $item->qty);
            $depositTotal = $this->resolvePosBookingDepositForCart($cart);
            $subtotal = (float) $cartPricing['subtotal'] + $packageSubtotal + $depositTotal;
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

            $order = Order::create([
                'order_number' => $this->generateOrderNumber(),
                'customer_id' => $customerId,
                'created_by_user_id' => $request->user()->id,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => $validated['payment_method'],
                'payment_provider' => 'manual',
                'subtotal' => $subtotal,
                'discount_total' => $discountTotal,
                'shipping_fee' => 0,
                'grand_total' => $grandTotal,
                'pickup_or_shipping' => 'pickup',
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

            $staffIds = $staffSplitsByCartItemId
                ->flatMap(fn (array $splits) => collect($splits)->pluck('staff_id'))
                ->filter()
                ->map(fn ($staffId) => (int) $staffId)
                ->unique()
                ->values();

            $staffCommissionRates = DB::table('staffs')
                ->whereIn('id', $staffIds)
                ->pluck('service_commission_rate', 'id')
                ->map(fn ($rate) => (float) $rate)
                ->all();

            $serviceClaimStatuses = $this->resolveServiceItemClaimStatuses($cart);
            $depositBreakdown = $this->resolvePosBookingDepositBreakdown($cart, $serviceClaimStatuses);
            $standardBaseAppliedItemId = (int) ($depositBreakdown['standard_base_applied_item_id'] ?? 0);
            $premiumDepositAmount = (float) ($depositBreakdown['per_premium_amount'] ?? 0);
            $standardBaseAmount = (float) ($depositBreakdown['standard_base_amount'] ?? 0);

            foreach ($cart->items as $item) {
                $variant = $item->variant;
                $product = $variant?->product ?? $item->product;
                if (! $product) {
                    continue;
                }

                if ($variant && $variant->track_stock && $item->qty > (int) $variant->stock) {
                    abort(422, __('Insufficient stock for :sku', ['sku' => $variant->sku ?? $variant->id]));
                }

                if (! $variant && $product->track_stock && $item->qty > (int) $product->stock) {
                    abort(422, __('Insufficient stock for :sku', ['sku' => $product->sku ?? $product->id]));
                }

                $pricing = $cartPricing['items'][(int) $item->id] ?? $this->resolvePosCartItemPricing($item, $isStaffUser);
                $itemSplits = collect($staffSplitsByCartItemId->get((int) $item->id, []));
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
                    'variant_cost_snapshot' => $variant?->cost_price,
                    'quantity' => $item->qty,
                    'line_total' => $pricing['effective_line_total'],
                    'line_total_snapshot' => $pricing['line_total_snapshot'],
                    'effective_unit_price' => $pricing['effective_unit_price'],
                    'effective_line_total' => $pricing['effective_line_total'],
                    'is_staff_free_applied' => $pricing['is_staff_free_applied'],
                    'discount_type' => $item->discount_type,
                    'discount_value' => (float) ($item->discount_value ?? 0),
                    'discount_amount' => (float) ($pricing['manual_discount_amount'] ?? 0),
                    'line_total_after_discount' => (float) ($pricing['line_total_after_discount'] ?? $pricing['effective_line_total']),
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

                if (! $serviceItem->customer_id) {
                    abort(422, __('Member is required for booking service item.'));
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

                if ($serviceItem->assigned_staff_id && $this->availabilityService->hasConflict((int) $serviceItem->assigned_staff_id, $startAt, $endAt, $bufferMin)) {
                    abort(409, __('Selected slot is no longer available.'));
                }

                $booking = Booking::query()->create([
                    'booking_code' => 'BK-' . now()->format('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                    'source' => 'STAFF',
                    'customer_id' => (int) $serviceItem->customer_id,
                    'staff_id' => $serviceItem->assigned_staff_id,
                    'service_id' => $serviceItem->booking_service_id,
                    'start_at' => $startAt,
                    'end_at' => $endAt,
                    'buffer_min' => $bufferMin,
                    'status' => 'CONFIRMED',
                    'deposit_amount' => 0,
                    'payment_status' => 'PAID',
                    'created_by_staff_id' => (int) ($request->user()?->staff_id ?? 0) ?: null,
                    'notes' => $serviceItem->notes,
                ]);


                $this->customerServicePackageService->attachReservedClaimsToBooking(
                    (int) $serviceItem->customer_id,
                    (int) $serviceItem->booking_service_id,
                    'POS',
                    (int) $serviceItem->id,
                    (int) $booking->id,
                );

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
                    'customer_id' => (int) $serviceItem->customer_id,
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
                $serviceType = strtoupper((string) ($serviceItem->bookingService?->service_type ?? 'STANDARD'));
                $depositContribution = 0.0;
                if (! $claimedByPackage) {
                    if ($serviceType === 'PREMIUM') {
                        $depositContribution = (float) $serviceItem->qty * $premiumDepositAmount;
                    } elseif ($standardBaseAppliedItemId > 0 && (int) $serviceItem->id === $standardBaseAppliedItemId) {
                        $depositContribution = $standardBaseAmount;
                    }
                }

                if ($depositContribution > 0) {
                    OrderItem::create([
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
                    ]);
                }
            }

            foreach ($cart->packageItems as $packageItem) {
                $servicePackage = ServicePackage::query()
                    ->with('items')
                    ->where('is_active', true)
                    ->findOrFail((int) $packageItem->service_package_id);

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
                        $splitSales = round(((float) $packageItem->price_snapshot) * ($sharePercent / 100), 2);
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
                        'unit_price_snapshot' => (float) $packageItem->price_snapshot,
                        'line_total' => (float) $packageItem->price_snapshot,
                        'line_total_snapshot' => (float) $packageItem->price_snapshot,
                        'effective_unit_price' => (float) $packageItem->price_snapshot,
                        'effective_line_total' => (float) $packageItem->price_snapshot,
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
                    'line_total' => round(((float) $packageItem->price_snapshot) * (int) $packageItem->qty, 2),
                    'customer_id' => (int) ($packageItem->customer_id ?? $customerId),
                    'customer_name' => $packageItem->customer?->name,
                    'staff_splits' => $splitRows->values()->all(),
                ];
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

            $orderPaymentService->handlePaid($order);

            $receiptUrl = $this->buildReceiptUrl($order, $request);

            $cart->items()->delete();
            $cart->serviceItems()->delete();
            $cart->packageItems()->delete();
            $this->clearVoucherFromCart($cart);

            return [$order, $receiptUrl, $purchasedPackageLines];
        });

        return $this->respond([
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'grand_total' => $order->grand_total,
                'payment_method' => $order->payment_method,
            ],
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'receipt_public_url' => $receiptUrl,
            'package_items' => $purchasedPackageLines,
        ]);
    }

    public function sendReceiptEmail(Request $request, int $orderId)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $order = Order::query()
            ->with(['items'])
            ->findOrFail($orderId);

        $receiptUrl = $this->buildReceiptUrl($order, $request);

        $pdf = $this->invoiceService->buildPdf($order);

        Mail::to($validated['email'])->queue(new PosOrderReceiptMail(
            orderNumber: (string) ($order->order_number ?? $order->id),
            placedAt: $order->placed_at?->toDateTimeString() ?? $order->created_at?->toDateTimeString() ?? now()->toDateTimeString(),
            totalAmount: (float) ($order->grand_total ?? 0),
            receiptUrl: $receiptUrl,
            pdfBytes: $pdf->output(),
            pdfFilename: 'Invoice-' . (string) ($order->order_number ?? $order->id) . '.pdf',
            items: $order->items->map(fn (OrderItem $item) => [
                'name' => $item->display_name_snapshot ?: $item->product_name_snapshot ?: 'Item #' . $item->id,
                'qty' => (int) $item->quantity,
                'line_total' => (float) ($item->effective_line_total ?? $item->line_total),
            ])->values()->all(),
        ));

        return $this->respond([
            'ok' => true,
        ]);
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
                'variant_sku' => $variant?->sku,
                'product_name' => $product?->name,
                'discount_type' => $item->discount_type,
                'discount_value' => (float) ($item->discount_value ?? 0),
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
        $standardBaseAppliedItemId = $depositBreakdown['standard_base_applied_item_id'] ?? null;
        $premiumItemDeposit = (float) ($depositBreakdown['per_premium_amount'] ?? 0);
        $hasPremium = (int) ($depositBreakdown['premium_count'] ?? 0) > 0;

        $serviceItems = $cart->serviceItems->map(function (PosCartServiceItem $item) use ($standardBaseAppliedItemId, $premiumItemDeposit, $hasPremium, $serviceClaimStatuses, $depositBreakdown) {
            $lineTotal = ((float) $item->price_snapshot) * (int) $item->qty;
            $serviceType = strtoupper((string) ($item->bookingService?->service_type ?? 'STANDARD'));
            $claimStatus = $serviceClaimStatuses[(int) $item->id] ?? null;
            $claimedByPackage = in_array($claimStatus, ['reserved', 'consumed'], true);
            $depositContribution = 0.0;
            if ($claimedByPackage) {
                $depositContribution = 0.0;
            } elseif ($serviceType === 'PREMIUM') {
                $depositContribution = (float) $item->qty * $premiumItemDeposit;
            } elseif (! $hasPremium && $standardBaseAppliedItemId && (int) $item->id === (int) $standardBaseAppliedItemId) {
                $depositContribution = (float) ($depositBreakdown['standard_base_amount'] ?? 0);
            }

            return [
                'id' => $item->id,
                'type' => 'service',
                'booking_service_id' => (int) $item->booking_service_id,
                'service_name' => $item->service_name_snapshot,
                'service_type' => $serviceType,
                'qty' => (int) $item->qty,
                'unit_price' => (float) $item->price_snapshot,
                'line_total' => (float) $lineTotal,
                'deposit_contribution' => (float) $depositContribution,
                'package_claim_status' => $claimStatus,
                'claimed_by_package' => $claimedByPackage,
                'customer_id' => $item->customer_id ? (int) $item->customer_id : null,
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
            $lineTotal = ((float) $item->price_snapshot) * (int) $item->qty;

            return [
                'id' => $item->id,
                'type' => 'service_package',
                'service_package_id' => (int) $item->service_package_id,
                'package_name' => $item->package_name_snapshot,
                'qty' => (int) $item->qty,
                'unit_price' => (float) $item->price_snapshot,
                'line_total' => (float) $lineTotal,
                'customer_id' => $item->customer_id ? (int) $item->customer_id : null,
            ];
        })->values();

        $voucherDiscount = (float) ($cart->voucher_discount_amount ?? 0);
        $bookingDepositTotal = (float) ($depositBreakdown['deposit_total'] ?? 0);
        $subtotal = (float) (($cartPricing['subtotal'] ?? $items->sum('line_total')) + $packageItems->sum('line_total') + $bookingDepositTotal);
        $grandTotal = max(0, $subtotal - $voucherDiscount);

        return [
            'id' => $cart->id,
            'items' => $items,
            'service_items' => $serviceItems,
            'package_items' => $packageItems,
            'booking_deposit_total' => $bookingDepositTotal,
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

        $settings = BookingSetting::query()->first();
        $premiumDeposit = (float) ($settings?->deposit_amount_per_premium ?? 0);
        $standardDeposit = (float) ($settings?->deposit_base_amount_if_only_standard ?? 0);

        $premiumCount = 0;
        $standardCount = 0;
        $standardBaseAppliedItemId = null;

        foreach ($cart->serviceItems as $item) {
            $claimStatus = $serviceClaimStatuses[(int) $item->id] ?? null;
            if (in_array($claimStatus, ['reserved', 'consumed'], true)) {
                continue;
            }

            $type = strtoupper((string) ($item->bookingService?->service_type ?? 'STANDARD'));
            $qty = max(1, (int) $item->qty);
            if ($type === 'PREMIUM') {
                $premiumCount += $qty;
            } else {
                $standardCount += $qty;
                if ($standardBaseAppliedItemId === null) {
                    $standardBaseAppliedItemId = (int) $item->id;
                }
            }
        }

        $depositTotal = $premiumCount > 0
            ? ($premiumCount * $premiumDeposit)
            : ($standardCount > 0 ? $standardDeposit : 0);

        return [
            'premium_count' => $premiumCount,
            'standard_count' => $standardCount,
            'per_premium_amount' => $premiumDeposit,
            'standard_base_amount' => $standardDeposit,
            'standard_base_applied_item_id' => $standardBaseAppliedItemId,
            'deposit_total' => (float) $depositTotal,
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
        $lineTotalSnapshot = $unitPriceSnapshot * (int) $item->qty;

        $isStaffFreeApplied = $isStaffUser && (bool) ($product?->is_staff_free ?? false);
        $effectiveUnitPrice = $isStaffFreeApplied ? 0.0 : $unitPriceSnapshot;
        $effectiveLineTotal = $isStaffFreeApplied ? 0.0 : $lineTotalSnapshot;

        return [
            'unit_price_snapshot' => $unitPriceSnapshot,
            'line_total_snapshot' => $lineTotalSnapshot,
            'effective_unit_price' => $effectiveUnitPrice,
            'effective_line_total' => $effectiveLineTotal,
            'is_staff_free_applied' => $isStaffFreeApplied,
        ];
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
            ->whereNotNull('promotion_type')
            ->whereIn('id', \DB::table('promotion_products')->select('promotion_id')->distinct())
            ->with(['promotionProducts', 'promotionTiers'])
            ->get();

        foreach ($promotions as $promotion) {
            $productIds = $promotion->promotionProducts->pluck('product_id')->map(fn ($x) => (int) $x)->all();
            $eligible = [];
            foreach ($cart->items as $item) {
                $product = $item->variant?->product ?? $item->product;
                if ($product && in_array((int) $product->id, $productIds, true)) {
                    $eligible[] = $item;
                }
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
                'promotion_type' => $promotion->promotion_type,
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
                $base[$id]['promotion_type'] = $promotion->promotion_type;
                $base[$id]['promotion_summary'] = $promotionSnapshot['summary'];
                $base[$id]['promotion_snapshot'] = $promotionSnapshot;
                $base[$id]['promotion_discount_amount'] = ($base[$id]['promotion_discount_amount'] ?? 0) + $portion;
                $base[$id]['line_total_after_promotion'] = max(0, $line - ($base[$id]['promotion_discount_amount'] ?? 0));
            }
        }

        $subtotal = 0.0;
        foreach ($cart->items as $item) {
            $id = (int) $item->id;
            $line = (float) ($base[$id]['line_total_after_promotion'] ?? $base[$id]['effective_line_total']);
            $manual = 0.0;
            if (empty($base[$id]['promotion_applied']) && ! empty($item->discount_type) && (float) $item->discount_value > 0) {
                if ($item->discount_type === 'percentage') {
                    $manual = $line * ((float) $item->discount_value / 100);
                } else {
                    $manual = min($line, (float) $item->discount_value);
                }
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

    protected function clearVoucherFromCart(PosCart $cart): void
    {
        $cart->voucher_code = null;
        $cart->voucher_id = null;
        $cart->customer_voucher_id = null;
        $cart->voucher_discount_amount = 0;
        $cart->voucher_snapshot = null;
        $cart->save();
    }

    protected function resolveAppointmentSnapshot(Booking $booking): array
    {
        $summary = $this->resolveAppointmentFinancialSummary($booking);

        return [
            'id' => (int) $booking->id,
            'booking_code' => (string) ($booking->booking_code ?: ('BOOKING-' . $booking->id)),
            'status' => (string) $booking->status,
            'appointment_start_at' => optional($booking->start_at)?->toIso8601String(),
            'appointment_end_at' => optional($booking->end_at)?->toIso8601String(),
            'customer_name' => (string) ($booking->customer?->name ?? '-'),
            'service_name' => (string) ($booking->service?->name ?? '-'),
            'staff_name' => (string) ($booking->staff?->name ?? '-'),
            'service_total' => (float) $summary['service_total'],
            'deposit_contribution' => (float) $summary['deposit_contribution'],
            'deposit_paid' => (float) $summary['deposit_contribution'],
            'linked_booking_deposit' => (float) $summary['linked_booking_deposit'],
            'linked_booking_deposit_total' => (float) $summary['linked_booking_deposit'],
            'package_offset' => (float) $summary['package_offset'],
            'settlement_paid' => (float) $summary['settlement_paid'],
            'balance_due' => (float) $summary['balance_due'],
            'package_status' => $summary['package_status'],
        ];
    }

    protected function resolveAppointmentPaymentHistory(int $bookingId): array
    {
        return OrderItem::query()
            ->with(['order:id,order_number,payment_method,paid_at,created_at'])
            ->where('booking_id', $bookingId)
            ->whereIn('line_type', ['booking_deposit', 'booking_settlement'])
            ->orderBy('id')
            ->get()
            ->map(fn (OrderItem $item) => [
                'order_id' => (int) ($item->order?->id ?? 0),
                'order_number' => (string) ($item->order?->order_number ?? '-'),
                'line_type' => (string) ($item->line_type ?? ''),
                'amount' => (float) ($item->line_total ?? 0),
                'payment_method' => (string) ($item->order?->payment_method ?? ''),
                'paid_at' => optional($item->order?->paid_at ?? $item->order?->created_at)?->toIso8601String(),
            ])->values()->all();
    }

    protected function resolveAppointmentFinancialSummary(Booking $booking): array
    {
        $serviceTotal = (float) ($booking->service?->service_price ?? $booking->service?->price ?? 0);
        $linkedOrderIds = OrderServiceItem::query()
            ->where('booking_id', (int) $booking->id)
            ->pluck('order_id')
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

        $settlementPaid = (float) OrderItem::query()
            ->where('booking_id', (int) $booking->id)
            ->where('line_type', 'booking_settlement')
            ->sum('line_total');

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
        $packageOffset = $coveredByPackage ? $serviceTotal : 0.0;
        $balanceDue = max(0, $serviceTotal - $depositPaid - $packageOffset - $settlementPaid);

        return [
            'service_total' => round($serviceTotal, 2),
            'deposit_contribution' => round($depositPaid, 2),
            'deposit_paid' => round($depositPaid, 2),
            'linked_booking_deposit' => round($linkedBookingDeposit, 2),
            'linked_booking_deposit_total' => round($linkedBookingDeposit, 2),
            'package_offset' => round($packageOffset, 2),
            'settlement_paid' => round($settlementPaid, 2),
            'balance_due' => round($balanceDue, 2),
            'package_status' => $packageUsage ? [
                'status' => (string) $packageUsage->status,
                'used_qty' => (int) ($packageUsage->used_qty ?? 1),
                'reserved_at' => optional($packageUsage->reserved_at)?->toIso8601String(),
                'consumed_at' => optional($packageUsage->consumed_at)?->toIso8601String(),
            ] : null,
        ];
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
}
