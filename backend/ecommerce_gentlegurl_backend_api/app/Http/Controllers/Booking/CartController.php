<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingCart;
use App\Models\Booking\BookingCartItem;
use App\Models\Booking\BookingCartPackageItem;
use App\Models\Booking\BookingItemPhoto;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceQuestionOption;
use App\Models\Booking\BookingSetting;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Booking\ServicePackage;
use App\Models\BillplzBill;
use App\Models\BillplzPaymentGatewayOption;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Services\BillplzService;
use App\Services\Booking\BookingAvailabilityService;
use App\Services\Booking\BookingCartCleanupService;
use App\Services\Booking\CustomerServicePackageService;
use App\Support\WorkspaceType;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class CartController extends Controller
{
    public function __construct(
        private readonly BookingAvailabilityService $availabilityService,
        private readonly BookingCartCleanupService $cartCleanupService,
        private readonly CustomerServicePackageService $customerServicePackageService,
        private readonly BillplzService $billplzService,
    ) {}

    public function add(Request $request)
    {
        $validated = $request->validate([
            'service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'start_at' => ['required', 'date'],
            'selected_option_ids' => ['nullable', 'array'],
            'selected_option_ids.*' => ['integer', 'exists:booking_service_question_options,id'],
        ]);

        $service = BookingService::query()->with('allowedStaffs:id')->findOrFail($validated['service_id']);
        if (! $service->isStaffAllowed((int) $validated['staff_id'])) {
            return $this->respondError('Selected staff is not allowed for this service.', 422);
        }
        $startAt = Carbon::parse($validated['start_at']);
        $selectedOptionIds = collect($validated['selected_option_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values()->all();
        $serviceQuestions = $service->questions()->where('is_active', true)->with(['options' => fn ($q) => $q->where('is_active', true)])->get();
        $selectedOptions = BookingServiceQuestionOption::query()
            ->whereIn('id', $selectedOptionIds)
            ->whereIn('booking_service_question_id', $serviceQuestions->pluck('id')->all())
            ->where('is_active', true)
            ->with('linkedBookingService:id,name,duration_min,service_price,service_type,deposit_amount')
            ->get();

        foreach ($serviceQuestions as $question) {
            $selectedForQuestion = $selectedOptions->where('booking_service_question_id', $question->id)->values();
            if ((bool) $question->is_required && $selectedForQuestion->isEmpty()) {
                return $this->respondError('Please complete required booking questions.', 422);
            }
            if ((string) $question->question_type === 'single_choice' && $selectedForQuestion->count() > 1) {
                return $this->respondError('Single choice question allows only one option.', 422);
            }
        }

        $addonDurationMin = (int) $selectedOptions->sum(function (BookingServiceQuestionOption $option): int {
            return $option->linkedBookingService
                ? (int) $option->linkedBookingService->duration_min
                : (int) $option->extra_duration_min;
        });
        $addonPrice = round((float) $selectedOptions->sum(function (BookingServiceQuestionOption $option): float {
            return $option->linkedBookingService
                ? (float) $option->linkedBookingService->service_price
                : (float) $option->extra_price;
        }), 2);
        $endAt = $startAt->copy()->addMinutes((int) $service->duration_min + $addonDurationMin);

        return DB::transaction(function () use ($request, $validated, $service, $startAt, $endAt, $addonDurationMin, $addonPrice, $selectedOptions, $selectedOptionIds) {
            $cart = $this->resolveActiveCart($request);
            $this->cleanupExpiredItems($cart);

            if ($this->availabilityService->hasConflict((int) $validated['staff_id'], $startAt, $endAt, (int) $service->buffer_min)) {
                return $this->respondError('Selected slot is no longer available.', 409);
            }

            $settings = $this->getSettings();
            $expiresAt = now()->addMinutes((int) $settings->cart_hold_minutes);

            $duplicate = BookingCartItem::query()
                ->where('booking_cart_id', $cart->id)
                ->where('service_id', $service->id)
                ->where('staff_id', (int) $validated['staff_id'])
                ->where('start_at', $startAt)
                ->where('status', 'active')
                ->first();

            if ($duplicate) {
                $duplicate->update(['expires_at' => $expiresAt]);
            } else {
                BookingCartItem::create([
                    'booking_cart_id' => $cart->id,
                    'service_id' => $service->id,
                    'staff_id' => (int) $validated['staff_id'],
                    'service_type' => $service->service_type,
                    'start_at' => $startAt,
                    'end_at' => $endAt,
                    'addon_duration_min' => $addonDurationMin,
                    'addon_price' => $addonPrice,
                    'question_answers_json' => [
                        'selected_option_ids' => $selectedOptionIds,
                        'selected_options' => $selectedOptions->map(fn (BookingServiceQuestionOption $option) => [
                            'id' => (int) $option->id,
                            'label' => trim((string) $option->label) !== ''
                                ? (string) $option->label
                                : (string) optional($option->linkedBookingService)->name,
                            'extra_duration_min' => $option->linkedBookingService
                                ? (int) $option->linkedBookingService->duration_min
                                : (int) $option->extra_duration_min,
                            'extra_price' => $option->linkedBookingService
                                ? (float) $option->linkedBookingService->service_price
                                : (float) $option->extra_price,
                            'linked_booking_service_id' => $option->linkedBookingService
                                ? (int) $option->linkedBookingService->id
                                : null,
                            'linked_service_type' => $option->linkedBookingService
                                ? (string) $option->linkedBookingService->service_type
                                : null,
                            'linked_deposit_amount' => $option->linkedBookingService
                                ? (float) $option->linkedBookingService->deposit_amount
                                : null,
                        ])->values()->all(),
                    ],
                    'expires_at' => $expiresAt,
                    'status' => 'active',
                ]);
            }

            return $this->respond($this->buildCartPayload($cart->fresh()));
        });
    }

    public function addPackage(Request $request)
    {
        $customer = $request->user('customer');
        if (! $customer) {
            return $this->respondError('Please login before adding package to cart.', 401);
        }

        $validated = $request->validate([
            'service_package_id' => ['required', 'integer', 'exists:service_packages,id'],
            'qty' => ['nullable', 'integer', 'min:1', 'max:10'],
        ]);

        $package = ServicePackage::query()
            ->where('is_active', true)
            ->findOrFail((int) $validated['service_package_id']);

        $qty = (int) ($validated['qty'] ?? 1);

        return DB::transaction(function () use ($request, $package, $qty) {
            $cart = $this->resolveActiveCart($request);
            $this->cleanupExpiredItems($cart);

            $item = BookingCartPackageItem::query()
                ->where('booking_cart_id', $cart->id)
                ->where('service_package_id', $package->id)
                ->where('status', 'active')
                ->first();

            if ($item) {
                $item->update([
                    'qty' => min(10, (int) $item->qty + $qty),
                    'price_snapshot' => (float) ($package->selling_price ?? 0),
                    'package_name_snapshot' => (string) $package->name,
                ]);
            } else {
                BookingCartPackageItem::query()->create([
                    'booking_cart_id' => $cart->id,
                    'service_package_id' => $package->id,
                    'package_name_snapshot' => (string) $package->name,
                    'price_snapshot' => (float) ($package->selling_price ?? 0),
                    'qty' => $qty,
                    'status' => 'active',
                ]);
            }

            return $this->respond($this->buildCartPayload($cart->fresh()));
        });
    }

    public function show(Request $request)
    {
        return DB::transaction(function () use ($request) {
            $cart = $this->resolveActiveCart($request, false);
            if (! $cart) {
                return $this->respond([
                    'id' => null,
                    'status' => 'active',
                    'items' => [],
                    'package_items' => [],
                    'deposit_total' => 0,
                    'package_total' => 0,
                    'cart_total' => 0,
                    'next_expiry_at' => null,
                ]);
            }

            $this->cleanupExpiredItems($cart);

            return $this->respond($this->buildCartPayload($cart->fresh()));
        });
    }

    public function removeItem(Request $request, int $itemId)
    {
        return DB::transaction(function () use ($request, $itemId) {
            $cart = $this->resolveActiveCart($request);
            $this->cleanupExpiredItems($cart);

            $item = BookingCartItem::where('booking_cart_id', $cart->id)->findOrFail($itemId);
            if ($item->status === 'active') {
                $item->update(['status' => 'removed']);
                $this->customerServicePackageService->releaseReservedClaimsBySource('BOOKING', (int) $item->id);
            }

            return $this->respond($this->buildCartPayload($cart->fresh()));
        });
    }

    /** Release package reservation for a cart line without removing the slot (unclaim). */
    public function releasePackageClaim(Request $request, int $itemId)
    {
        return DB::transaction(function () use ($request, $itemId) {
            $cart = $this->resolveActiveCart($request);
            $this->cleanupExpiredItems($cart);

            $item = BookingCartItem::query()
                ->where('booking_cart_id', $cart->id)
                ->where('status', 'active')
                ->findOrFail($itemId);

            $this->customerServicePackageService->releaseReservedClaimsBySource('BOOKING', (int) $item->id);

            return $this->respond($this->buildCartPayload($cart->fresh()));
        });
    }

    public function removePackageItem(Request $request, int $itemId)
    {
        return DB::transaction(function () use ($request, $itemId) {
            $cart = $this->resolveActiveCart($request);
            $this->cleanupExpiredItems($cart);

            $item = BookingCartPackageItem::query()
                ->where('booking_cart_id', $cart->id)
                ->findOrFail($itemId);

            if ($item->status === 'active') {
                $item->update(['status' => 'removed']);
                $this->customerServicePackageService->releaseReservedClaimsBySource('BOOKING', (int) $item->id);
            }

            return $this->respond($this->buildCartPayload($cart->fresh()));
        });
    }

    public function updatePackageItem(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'qty' => ['required', 'integer', 'min:1', 'max:10'],
        ]);

        return DB::transaction(function () use ($request, $itemId, $validated) {
            $cart = $this->resolveActiveCart($request);
            $this->cleanupExpiredItems($cart);

            $item = BookingCartPackageItem::query()
                ->where('booking_cart_id', $cart->id)
                ->where('status', 'active')
                ->findOrFail($itemId);

            $item->update(['qty' => (int) $validated['qty']]);

            return $this->respond($this->buildCartPayload($cart->fresh()));
        });
    }


    public function uploadItemPhotos(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'photos' => ['required', 'array', 'min:1', 'max:3'],
            'photos.*' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:5120'],
        ]);

        return DB::transaction(function () use ($request, $itemId, $validated) {
            $cart = $this->resolveActiveCart($request);
            $this->cleanupExpiredItems($cart);

            $item = BookingCartItem::query()
                ->where('booking_cart_id', $cart->id)
                ->where('status', 'active')
                ->with('service')
                ->findOrFail($itemId);

            if (! (bool) ($item->service?->allow_photo_upload ?? false)) {
                return $this->respondError('Photo upload is not enabled for this service.', 422);
            }

            $existingCount = BookingItemPhoto::query()->where('booking_cart_item_id', $item->id)->count();
            $incoming = count($validated['photos']);
            if (($existingCount + $incoming) > 3) {
                return $this->respondError('Maximum 3 photos are allowed per booking item.', 422);
            }

            $sortOrder = BookingItemPhoto::query()->where('booking_cart_item_id', $item->id)->max('sort_order');
            $nextSort = is_numeric($sortOrder) ? ((int) $sortOrder + 1) : 0;

            foreach ($validated['photos'] as $photo) {
                $ext = strtolower((string) $photo->getClientOriginalExtension());
                $filename = sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $ext);
                $path = $photo->storeAs('booking/item-photos', $filename, 'public');

                BookingItemPhoto::query()->create([
                    'booking_cart_item_id' => (int) $item->id,
                    'file_path' => $path,
                    'original_name' => (string) $photo->getClientOriginalName(),
                    'mime_type' => (string) $photo->getClientMimeType(),
                    'size' => (int) $photo->getSize(),
                    'sort_order' => $nextSort++,
                ]);
            }

            return $this->respond($this->buildCartPayload($cart->fresh()));
        });
    }

    public function removeItemPhoto(Request $request, int $itemId, int $photoId)
    {
        return DB::transaction(function () use ($request, $itemId, $photoId) {
            $cart = $this->resolveActiveCart($request);
            $this->cleanupExpiredItems($cart);

            $item = BookingCartItem::query()
                ->where('booking_cart_id', $cart->id)
                ->where('status', 'active')
                ->findOrFail($itemId);

            $photo = BookingItemPhoto::query()
                ->where('booking_cart_item_id', $item->id)
                ->findOrFail($photoId);

            if ($photo->file_path && Storage::disk('public')->exists($photo->file_path)) {
                Storage::disk('public')->delete($photo->file_path);
            }

            $photo->delete();

            return $this->respond($this->buildCartPayload($cart->fresh()));
        });
    }

    public function checkout(Request $request)
    {
        $customer = $request->user('customer');
        $validated = $request->validate([
            'guest_name' => ['nullable', 'string', 'max:255'],
            'guest_phone' => ['nullable', 'string', 'max:50', 'regex:/^\+?[0-9]{8,15}$/'],
            'guest_email' => ['nullable', 'email', 'max:255'],
            'billing_same_as_contact' => ['nullable', 'boolean'],
            'billing_name' => ['nullable', 'string', 'max:255'],
            'billing_phone' => ['nullable', 'string', 'max:50', 'regex:/^\+?[0-9]{8,15}$/'],
            'billing_email' => ['nullable', 'email', 'max:255'],
            'payment_method' => ['nullable', 'string', 'in:manual_transfer,billplz_fpx,billplz_card,billplz_online_banking,billplz_credit_card'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'billplz_gateway_option_id' => ['nullable', 'integer', 'exists:billplz_payment_gateway_options,id'],
        ]);

        if (empty($validated['guest_name']) || empty($validated['guest_phone'])) {
            return $this->respondError('Contact name and phone are required for booking checkout.', 422);
        }

        $billingSameAsContact = (bool) ($validated['billing_same_as_contact'] ?? true);
        if (! $billingSameAsContact && (empty($validated['billing_name']) || empty($validated['billing_phone']))) {
            return $this->respondError('Billing name and phone are required when billing contact is custom.', 422);
        }

        return DB::transaction(function () use ($request, $validated, $billingSameAsContact) {
            $cart = $this->resolveActiveCart($request);
            $this->cleanupExpiredItems($cart);
            $cart->load(['items.service', 'packageItems.servicePackage']);

            $activeItems = $cart->items->where('status', 'active')->values();
            $activePackageItems = $cart->packageItems->where('status', 'active')->values();

            if ($activeItems->isEmpty() && $activePackageItems->isEmpty()) {
                return $this->respondError('Cart is empty or all items have expired.', 422);
            }

            if ($activeItems->contains(fn ($item) => $item->expires_at->lte(now()))) {
                return $this->respondError('Some cart items are expired. Please refresh cart.', 422);
            }

            $customer = $request->user('customer');
            if (! $customer && $activePackageItems->isNotEmpty()) {
                return $this->respondError('Please login to purchase service packages.', 422);
            }
            $isDepositWaivedForCustomer = (bool) ($customer?->allow_booking_without_deposit ?? false);

            $bookingIds = [];
            $ownedPackageIds = [];
            $claimStatusesByItem = $this->claimStatusesByCartItem($customer?->id, $activeItems->pluck('id')->all());
            $depositBreakdown = $isDepositWaivedForCustomer
                ? $this->buildZeroDepositBreakdown($activeItems->all())
                : $this->resolveDepositBreakdownByCartItem($activeItems->all(), $claimStatusesByItem);
            $depositByCartItemId = $depositBreakdown['deposit_by_cart_item'] ?? [];
            $mainDepositByCartItemId = $depositBreakdown['main_deposit_by_cart_item'] ?? [];
            $addonDepositByCartItemId = $depositBreakdown['addon_deposit_by_cart_item'] ?? [];
            $addonDepositItemsByCartItemId = $depositBreakdown['addon_deposit_items_by_cart_item'] ?? [];
            $depositTotal = round((float) ($depositBreakdown['deposit_total'] ?? 0), 2);
            $addonTotal = 0.0;
            $packageTotal = (float) $activePackageItems->sum(fn (BookingCartPackageItem $item) => ((float) $item->price_snapshot) * (int) $item->qty);
            $activeItemIds = $activeItems->pluck('id')->all();
            $paymentMethod = $this->normalizeRequestedPaymentMethod((string) ($validated['payment_method'] ?? 'manual_transfer'));
            $selectedGatewayOption = $this->resolveBillplzGatewayOption($validated, $paymentMethod);
            if ($paymentMethod === 'billplz_online_banking' && ! $selectedGatewayOption && $this->hasActiveBillplzOptions('online_banking')) {
                return $this->respondError('Selected online banking option is not available.', 422);
            }
            if ($paymentMethod === 'billplz_credit_card' && ! $selectedGatewayOption && $this->hasActiveBillplzOptions('credit_card')) {
                return $this->respondError('Credit card payment is not available.', 422);
            }
            $order = null;

            $order = Order::query()->create([
                'order_number' => $this->generateOrderNumber(),
                'customer_id' => $customer?->id,
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'payment_method' => $paymentMethod,
                'requested_payment_method' => $paymentMethod,
                'payment_provider' => str_starts_with($paymentMethod, 'billplz_') ? 'billplz' : 'manual',
                'selected_gateway_code' => $selectedGatewayOption?->code,
                'selected_gateway_name' => $selectedGatewayOption?->name,
                'billplz_gateway_option_id' => $selectedGatewayOption?->id,
                'bank_account_id' => $paymentMethod === 'manual_transfer'
                    ? (int) ($validated['bank_account_id'] ?? 0) ?: null
                    : null,
                'pickup_or_shipping' => 'pickup',
                'subtotal' => round($depositTotal + $packageTotal, 2),
                'discount_total' => 0,
                'shipping_fee' => 0,
                'grand_total' => round($depositTotal + $packageTotal, 2),
                'placed_at' => now(),
                'shipping_name' => (string) ($validated['guest_name'] ?? ''),
                'shipping_phone' => (string) ($validated['guest_phone'] ?? ''),
                'billing_same_as_shipping' => $billingSameAsContact,
                'billing_name' => $billingSameAsContact ? (string) ($validated['guest_name'] ?? '') : (string) ($validated['billing_name'] ?? ''),
                'billing_phone' => $billingSameAsContact ? (string) ($validated['guest_phone'] ?? '') : (string) ($validated['billing_phone'] ?? ''),
                'notes' => $customer
                    ? 'Booking cart checkout'
                    : ('Booking cart checkout | guest_token:' . (string) ($cart->guest_token ?? '')),
            ]);

            foreach ($activeItems as $item) {
                $service = $item->service;

                if (! $this->isItemStillAvailable($item, (int) $service->buffer_min, $activeItemIds)) {
                    return $this->respondError('One or more selected slots are no longer available.', 409);
                }

                $contactName = (string) ($validated['guest_name'] ?? '');
                $contactPhone = (string) ($validated['guest_phone'] ?? '');
                $contactEmail = (string) ($validated['guest_email'] ?? '');
                $billingName = $billingSameAsContact ? $contactName : (string) ($validated['billing_name'] ?? '');
                $billingPhone = $billingSameAsContact ? $contactPhone : (string) ($validated['billing_phone'] ?? '');
                $billingEmail = $billingSameAsContact ? $contactEmail : (string) ($validated['billing_email'] ?? '');

                $booking = Booking::create([
                    'booking_code' => 'BK-' . now()->format('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                    'source' => $customer ? 'CUSTOMER' : 'GUEST',
                    'customer_id' => $customer?->id,
                    'guest_name' => $contactName ?: null,
                    'guest_phone' => $contactPhone ?: null,
                    'guest_email' => $contactEmail ?: null,
                    'billing_name' => $billingName ?: null,
                    'billing_phone' => $billingPhone ?: null,
                    'billing_email' => $billingEmail ?: null,
                    'staff_id' => $item->staff_id,
                    'service_id' => $item->service_id,
                    'start_at' => $item->start_at,
                    'end_at' => $item->end_at,
                    'buffer_min' => (int) $service->buffer_min,
                    'status' => 'HOLD',
                    'deposit_amount' => (float) ($depositByCartItemId[(int) $item->id] ?? 0),
                    'addon_price' => (float) ($item->addon_price ?? 0),
                    'addon_items_json' => $item->question_answers_json['selected_options'] ?? [],
                    'payment_status' => 'UNPAID',
                    'hold_expires_at' => $item->expires_at,
                    'notes' => $customer ? null : ('guest_token:' . (string) ($cart->guest_token ?? '')),
                ]);

                if ($isDepositWaivedForCustomer) {
                    $booking->notes = trim((string) ($booking->notes ? ($booking->notes . ' | ') : '') . 'deposit_waived_for_member');
                    $booking->save();
                }

                if ($customer) {
                    $this->customerServicePackageService->attachReservedClaimsToBooking(
                        (int) $customer->id,
                        (int) $item->service_id,
                        'BOOKING',
                        (int) $item->id,
                        (int) $booking->id,
                    );
                }

                BookingItemPhoto::query()
                    ->where('booking_cart_item_id', (int) $item->id)
                    ->update(['booking_id' => (int) $booking->id]);

                $item->update(['status' => 'converted']);
                $bookingIds[] = $booking->id;

                $bookingDepositAmount = (float) ($depositByCartItemId[(int) $item->id] ?? 0);
                $mainDepositAmount = (float) ($mainDepositByCartItemId[(int) $item->id] ?? 0);
                $addonDepositItems = collect($addonDepositItemsByCartItemId[(int) $item->id] ?? []);

                if ($order && $mainDepositAmount > 0) {
                    OrderItem::query()->create([
                        'order_id' => (int) $order->id,
                        'line_type' => 'booking_deposit',
                        'product_name_snapshot' => 'Booking Deposit - ' . (string) ($service->name ?? 'Service'),
                        'display_name_snapshot' => 'Booking Deposit - ' . (string) ($service->name ?? 'Service'),
                        'quantity' => 1,
                        'price_snapshot' => $mainDepositAmount,
                        'unit_price_snapshot' => $mainDepositAmount,
                        'line_total' => $mainDepositAmount,
                        'line_total_snapshot' => $mainDepositAmount,
                        'effective_unit_price' => $mainDepositAmount,
                        'effective_line_total' => $mainDepositAmount,
                        'locked' => true,
                        'booking_id' => (int) $booking->id,
                        'booking_service_id' => (int) $item->service_id,
                    ]);
                }

                if ($order) {
                    foreach ($addonDepositItems as $addonDepositItem) {
                        $addonDepositAmount = (float) ($addonDepositItem['deposit_contribution'] ?? 0);
                        $addonLabel = (string) ($addonDepositItem['label'] ?? 'Add-on');
                        OrderItem::query()->create([
                            'order_id' => (int) $order->id,
                            'line_type' => 'booking_addon',
                            'product_name_snapshot' => $addonLabel,
                            'display_name_snapshot' => $addonLabel,
                            'quantity' => 1,
                            'price_snapshot' => $addonDepositAmount,
                            'unit_price_snapshot' => $addonDepositAmount,
                            'line_total' => $addonDepositAmount,
                            'line_total_snapshot' => $addonDepositAmount,
                            'effective_unit_price' => $addonDepositAmount,
                            'effective_line_total' => $addonDepositAmount,
                            'variant_name_snapshot' => 'Booking Add-on Deposit',
                            'locked' => true,
                            'booking_id' => (int) $booking->id,
                            'booking_service_id' => (int) $item->service_id,
                        ]);
                    }
                }

            }

            if ($customer && $activePackageItems->isNotEmpty()) {
                foreach ($activePackageItems as $packageItem) {
                    $servicePackage = ServicePackage::query()
                        ->with('items')
                        ->where('is_active', true)
                        ->findOrFail((int) $packageItem->service_package_id);

                    for ($i = 0; $i < (int) $packageItem->qty; $i++) {
                        $owned = $this->customerServicePackageService->purchase(
                            (int) $customer->id,
                            $servicePackage,
                            'BOOKING',
                            null,
                        );

                        $ownedPackageIds[] = (int) $owned->id;

                        if ($order) {
                            $unitPrice = (float) ($packageItem->price_snapshot ?? 0);
                            OrderItem::query()->create([
                                'order_id' => (int) $order->id,
                                'line_type' => 'service_package',
                                'product_name_snapshot' => (string) ($packageItem->package_name_snapshot ?: $servicePackage->name),
                                'display_name_snapshot' => (string) ($packageItem->package_name_snapshot ?: $servicePackage->name),
                                'quantity' => 1,
                                'price_snapshot' => $unitPrice,
                                'unit_price_snapshot' => $unitPrice,
                                'line_total' => $unitPrice,
                                'line_total_snapshot' => $unitPrice,
                                'effective_unit_price' => $unitPrice,
                                'effective_line_total' => $unitPrice,
                                'locked' => true,
                                'service_package_id' => (int) $packageItem->service_package_id,
                                'customer_service_package_id' => (int) $owned->id,
                            ]);
                        }
                    }

                    $packageItem->update(['status' => 'converted']);
                }
            }

            $cart->update(['status' => 'converted']);

            if ($order && (float) $order->grand_total <= 0) {
                $order->status = 'confirmed';
                $order->payment_status = 'paid';
                $order->paid_at = now();
                $order->payment_method = 'no_payment_required';
                $order->payment_provider = 'none';
                $order->payment_reference = null;
                $order->payment_url = null;
                $order->save();

                if (! empty($bookingIds)) {
                    Booking::query()
                        ->whereIn('id', $bookingIds)
                        ->update([
                            'status' => 'CONFIRMED',
                            'payment_status' => 'PAID',
                            'hold_expires_at' => null,
                            'updated_at' => now(),
                        ]);
                }
            }

            $billplzPaymentUrl = null;
            if (! $customer && $order && (float) $order->grand_total > 0 && str_starts_with($paymentMethod, 'billplz_')) {
                $billResponse = $this->billplzService->createBill(
                    $order,
                    WorkspaceType::BOOKING,
                    $selectedGatewayOption?->code,
                    (array) data_get($selectedGatewayOption?->meta, 'billplz_payload', []),
                );

                $billplzId = data_get($billResponse, 'id');
                $billplzUrl = data_get($billResponse, 'url');
                if (! $billplzId || ! $billplzUrl) {
                    throw new RuntimeException('Invalid Billplz response.');
                }

                $order->payment_reference = $billplzId;
                $order->payment_url = $billplzUrl;
                $order->payment_provider = $order->payment_provider ?: 'billplz';
                $order->payment_meta = [
                    'provider' => 'billplz',
                    'bill_id' => $billplzId,
                    'collection_id' => data_get($billResponse, 'collection_id'),
                    'state' => data_get($billResponse, 'state'),
                    'reference_1' => data_get($billResponse, 'reference_1'),
                ];
                $order->save();

                BillplzBill::updateOrCreate(
                    ['billplz_id' => $billplzId],
                    [
                        'order_id' => $order->id,
                        'collection_id' => data_get($billResponse, 'collection_id'),
                        'state' => data_get($billResponse, 'state'),
                        'paid' => false,
                        'amount' => data_get($billResponse, 'amount'),
                        'payload' => $billResponse,
                    ]
                );

                $billplzPaymentUrl = (string) $billplzUrl;
            }

            Log::info('Booking cart checkout amount summary', [
                'cart_id' => (string) $cart->id,
                'customer_id' => $customer?->id,
                'booking_item_count' => $activeItems->count(),
                'package_item_count' => $activePackageItems->count(),
                'booking_ids' => $bookingIds,
                'deposit_total' => $depositTotal,
                'package_total' => round($packageTotal, 2),
                'cart_total' => round($depositTotal + $addonTotal + $packageTotal, 2),
                'order_id' => $order?->id,
                'order_grand_total' => (float) ($order?->grand_total ?? 0),
                'payment_method' => $paymentMethod,
                'deposit_waived_for_customer' => $isDepositWaivedForCustomer,
                'billplz_amount_sen' => $order ? (int) round(((float) $order->grand_total) * 100) : null,
            ]);

            return $this->respond([
                'status' => $order && (float) $order->grand_total <= 0 ? 'confirmed' : 'success',
                'booking_ids' => $bookingIds,
                'owned_package_ids' => $ownedPackageIds,
                'deposit_total' => $depositTotal,
                'addon_total' => $addonTotal,
                'package_total' => round($packageTotal, 2),
                'cart_total' => round($depositTotal + $addonTotal + $packageTotal, 2),
                'order_id' => $order?->id,
                'order_no' => $order?->order_number,
                'payment_method' => $order?->payment_method,
                'payment_status' => $order?->payment_status,
                'payment_url' => $billplzPaymentUrl,
                'redirect_url' => $order
                    ? '/payment-result?' . http_build_query(['order_id' => (int) $order->id, 'order_no' => (string) $order->order_number])
                    : null,
                'payment_expires_at' => $activeItems->min('expires_at')?->toIso8601String(),
                'payment_instruction' => $order && (float) $order->grand_total <= 0
                    ? 'No payment required for this booking.'
                    : 'Complete payment before hold expires to confirm booking.',
            ]);
        });
    }

    private function generateOrderNumber(): string
    {
        return 'ORD' . now()->format('YmdHis') . rand(100, 999);
    }

    private function resolveActiveCart(Request $request, bool $createIfMissing = true): ?BookingCart
    {
        $customerId = $request->user('customer')?->id;
        $guestToken = $request->header('X-Booking-Guest-Token');

        if (! $customerId && ! $guestToken) {
            abort(response()->json(['success' => false, 'message' => 'Missing booking guest token.', 'data' => null], 422));
        }

        if ($customerId) {
            $this->mergeGuestCartIntoCustomerCart($customerId, $guestToken);

            $query = BookingCart::query()
                ->where('status', 'active')
                ->where('customer_id', $customerId)
                ->whereNull('guest_token');

            $cart = $query->oldest('created_at')->first();
            if (! $cart && $createIfMissing) {
                $cart = BookingCart::create([
                    'customer_id' => $customerId,
                    'guest_token' => null,
                    'status' => 'active',
                ]);
            }

            return $this->ensureSingleActiveCartForOwner($cart, $customerId, null);
        }

        $query = BookingCart::query()->where('status', 'active')->where('guest_token', $guestToken);
        $cart = $query->oldest('created_at')->first();
        if (! $cart && $createIfMissing) {
            $cart = BookingCart::create([
                'customer_id' => null,
                'guest_token' => $guestToken,
                'status' => 'active',
            ]);
        }

        return $this->ensureSingleActiveCartForOwner($cart, null, $guestToken);
    }

    private function mergeGuestCartIntoCustomerCart(int $customerId, ?string $guestToken): void
    {
        if (! $guestToken) {
            return;
        }

        $guestCart = BookingCart::query()
            ->where('status', 'active')
            ->where('guest_token', $guestToken)
            ->whereNull('customer_id')
            ->oldest('created_at')
            ->first();

        if (! $guestCart) {
            return;
        }

        $customerCart = BookingCart::query()
            ->where('status', 'active')
            ->where('customer_id', $customerId)
            ->whereNull('guest_token')
            ->oldest('created_at')
            ->first();

        if (! $customerCart) {
            $guestCart->update(['customer_id' => $customerId, 'guest_token' => null]);
            return;
        }

        BookingCartItem::query()
            ->where('booking_cart_id', $guestCart->id)
            ->where('status', 'active')
            ->update(['booking_cart_id' => $customerCart->id, 'updated_at' => now()]);

        BookingCartPackageItem::query()
            ->where('booking_cart_id', $guestCart->id)
            ->where('status', 'active')
            ->update(['booking_cart_id' => $customerCart->id, 'updated_at' => now()]);

        BookingItemPhoto::query()
            ->whereIn('booking_cart_item_id', BookingCartItem::query()->where('booking_cart_id', $customerCart->id)->pluck('id'))
            ->update(['updated_at' => now()]);

        $guestCart->update(['status' => 'converted']);
    }

    private function ensureSingleActiveCartForOwner(?BookingCart $activeCart, ?int $customerId, ?string $guestToken): ?BookingCart
    {
        if (! $activeCart) {
            return null;
        }

        if ($customerId) {
            BookingCart::query()
                ->where('status', 'active')
                ->where('customer_id', $customerId)
                ->whereNull('guest_token')
                ->whereKeyNot($activeCart->id)
                ->update(['status' => 'converted', 'updated_at' => now()]);

            return $activeCart;
        }

        BookingCart::query()
            ->where('status', 'active')
            ->whereNull('customer_id')
            ->where('guest_token', $guestToken)
            ->whereKeyNot($activeCart->id)
            ->update(['status' => 'converted', 'updated_at' => now()]);

        return $activeCart;
    }

    private function cleanupExpiredItems(BookingCart $cart): void
    {
        $this->cartCleanupService->expireItems($cart);
    }

    private function buildCartPayload(BookingCart $cart): array
    {
        $cart->load([
            'items' => fn ($q) => $q->where('status', 'active')->orderBy('expires_at'),
            'items.service:id,name,deposit_amount,service_type,service_price,price,price_mode,price_range_min,price_range_max,allow_photo_upload',
            'items.staff:id,name',
            'items.photos',
            'packageItems' => fn ($q) => $q->where('status', 'active')->orderByDesc('id'),
        ]);

        $activeItems = $cart->items;
        $activePackageItems = $cart->packageItems;

        $nextExpiry = $activeItems->min('expires_at');
        $claimStatusesByItem = $this->claimStatusesByCartItem($cart->customer_id, $activeItems->pluck('id')->all());
        $isDepositWaivedForCustomer = false;
        if ($cart->customer_id) {
            $isDepositWaivedForCustomer = (bool) DB::table('customers')
                ->where('id', $cart->customer_id)
                ->value('allow_booking_without_deposit');
        }
        $depositBreakdown = $isDepositWaivedForCustomer
            ? $this->buildZeroDepositBreakdown($activeItems->all())
            : $this->resolveDepositBreakdownByCartItem($activeItems->all(), $claimStatusesByItem);
        $depositByCartItemId = $depositBreakdown['deposit_by_cart_item'] ?? [];
        $mainDepositByCartItemId = $depositBreakdown['main_deposit_by_cart_item'] ?? [];
        $addonDepositByCartItemId = $depositBreakdown['addon_deposit_by_cart_item'] ?? [];
        $addonDepositItemsByCartItemId = $depositBreakdown['addon_deposit_items_by_cart_item'] ?? [];
        $depositTotal = round((float) ($depositBreakdown['deposit_total'] ?? 0), 2);
        $packageTotal = (float) $activePackageItems->sum(fn (BookingCartPackageItem $item) => ((float) $item->price_snapshot) * (int) $item->qty);

        return [
            'id' => $cart->id,
            'status' => $cart->status,
            'items' => $activeItems->map(fn (BookingCartItem $item) => [
                'id' => (int) $item->id,
                'service_id' => (int) $item->service_id,
                'service_name' => $item->service?->name,
                'staff_id' => (int) $item->staff_id,
                'staff_name' => $item->staff?->name,
                'service_type' => $item->service_type,
                'start_at' => $item->start_at?->toIso8601String(),
                'end_at' => $item->end_at?->toIso8601String(),
                'addon_duration_min' => (int) ($item->addon_duration_min ?? 0),
                'addon_price' => (float) ($item->addon_price ?? 0),
                'listed_service_price' => (float) ($item->service?->price ?? $item->service?->service_price ?? 0),
                'price_mode' => (string) ($item->service?->price_mode ?? 'fixed'),
                'price_range_min' => $item->service?->price_range_min !== null ? (float) $item->service->price_range_min : null,
                'price_range_max' => $item->service?->price_range_max !== null ? (float) $item->service->price_range_max : null,
                'selected_options' => $item->question_answers_json['selected_options'] ?? [],
                'allow_photo_upload' => (bool) ($item->service?->allow_photo_upload ?? false),
                'photos' => $item->photos->map(fn (BookingItemPhoto $photo) => [
                    'id' => (int) $photo->id,
                    'file_url' => $photo->file_url,
                    'original_name' => (string) $photo->original_name,
                    'mime_type' => (string) $photo->mime_type,
                    'size' => (int) $photo->size,
                ])->values(),
                'expires_at' => $item->expires_at?->toIso8601String(),
                'status' => $item->status,
                'package_claim_status' => $claimStatusesByItem[(int) $item->id] ?? null,
                'package_covers_main_service' => in_array($claimStatusesByItem[(int) $item->id] ?? null, ['reserved', 'consumed'], true),
                'reference_main_deposit' => (float) ($item->service?->deposit_amount ?? 0),
                'deposit_amount' => (float) ($depositByCartItemId[(int) $item->id] ?? 0),
                'main_deposit_amount' => (float) ($mainDepositByCartItemId[(int) $item->id] ?? 0),
                'addon_deposit_amount' => (float) ($addonDepositByCartItemId[(int) $item->id] ?? 0),
                'addon_deposit_items' => $addonDepositItemsByCartItemId[(int) $item->id] ?? [],
            ])->values(),
            'package_items' => $activePackageItems->map(fn (BookingCartPackageItem $item) => [
                'id' => (int) $item->id,
                'service_package_id' => (int) $item->service_package_id,
                'package_name' => $item->package_name_snapshot,
                'qty' => (int) $item->qty,
                'unit_price' => (float) $item->price_snapshot,
                'line_total' => round(((float) $item->price_snapshot) * (int) $item->qty, 2),
                'status' => (string) $item->status,
            ])->values(),
            'deposit_total' => $depositTotal,
            'main_deposit_total' => round((float) ($depositBreakdown['main_deposit_total'] ?? 0), 2),
            'addon_deposit_total' => round((float) ($depositBreakdown['addon_deposit_total'] ?? 0), 2),
            'addon_total' => 0,
            'package_total' => round($packageTotal, 2),
            'cart_total' => round($depositTotal + $packageTotal, 2),
            'next_expiry_at' => $nextExpiry?->toIso8601String(),
            'allow_booking_without_deposit' => $isDepositWaivedForCustomer,
        ];
    }

    private function buildZeroDepositBreakdown(array $items): array
    {
        $map = collect($items)->mapWithKeys(fn (BookingCartItem $item) => [(int) $item->id => 0.0])->all();
        $addonItems = collect($items)->mapWithKeys(fn (BookingCartItem $item) => [(int) $item->id => []])->all();

        return [
            'deposit_by_cart_item' => $map,
            'main_deposit_by_cart_item' => $map,
            'addon_deposit_by_cart_item' => $map,
            'addon_deposit_items_by_cart_item' => $addonItems,
            'main_deposit_total' => 0.0,
            'addon_deposit_total' => 0.0,
            'deposit_total' => 0.0,
        ];
    }

    private function isItemStillAvailable(BookingCartItem $item, int $bufferMin, array $ignoreCartItemIds): bool
    {
        $blockEnd = $item->end_at->copy()->addMinutes($bufferMin);

        $bookingConflict = Booking::query()
            ->where('staff_id', $item->staff_id)
            ->whereNotIn('status', ['EXPIRED', 'CANCELLED'])
            ->where('start_at', '<', $blockEnd)
            ->whereRaw("end_at + (buffer_min * interval '1 minute') > ?", [$item->start_at->toDateTimeString()])
            ->exists();

        if ($bookingConflict) {
            return false;
        }

        $cartConflict = BookingCartItem::query()
            ->where('staff_id', $item->staff_id)
            ->where('status', 'active')
            ->where('expires_at', '>', now())
            ->whereNotIn('id', $ignoreCartItemIds)
            ->where('start_at', '<', $blockEnd)
            ->whereRaw('end_at > ?', [$item->start_at->toDateTimeString()])
            ->exists();

        return ! $cartConflict;
    }

    private function resolveDepositByCartItem(array $items, array $claimStatusesByItem = []): array
    {
        return $this->resolveDepositBreakdownByCartItem($items, $claimStatusesByItem)['deposit_by_cart_item'] ?? [];
    }

    private function resolveDepositBreakdownByCartItem(array $items, array $claimStatusesByItem = []): array
    {
        $result = collect($items)->mapWithKeys(fn (BookingCartItem $item) => [(int) $item->id => 0.0])->all();
        $mainResult = collect($items)->mapWithKeys(fn (BookingCartItem $item) => [(int) $item->id => 0.0])->all();
        $addonResult = collect($items)->mapWithKeys(fn (BookingCartItem $item) => [(int) $item->id => 0.0])->all();
        $addonDepositItems = collect($items)->mapWithKeys(fn (BookingCartItem $item) => [(int) $item->id => []])->all();
        $candidatesByItem = collect($items)->mapWithKeys(fn (BookingCartItem $item) => [(int) $item->id => []])->all();
        foreach ($items as $item) {
            $itemId = (int) $item->id;
            $claimStatus = $claimStatusesByItem[$itemId] ?? null;
            $packageCoversMain = in_array($claimStatus, ['reserved', 'consumed'], true);

            // Package applies to the main booking service only; add-on deposits still apply.
            if ($packageCoversMain) {
                foreach ((array) ($item->question_answers_json['selected_options'] ?? []) as $selectedOption) {
                    $linkedType = strtoupper((string) ($selectedOption['linked_service_type'] ?? ''));
                    if ($linkedType === '') {
                        continue;
                    }
                    $linkedDeposit = max(0, (float) ($selectedOption['linked_deposit_amount'] ?? 0));
                    $candidatesByItem[$itemId][] = [
                        'item_id' => $itemId,
                        'type' => $linkedType,
                        'deposit_amount' => $linkedDeposit,
                        'scope' => 'addon',
                        'option_id' => isset($selectedOption['id']) ? (int) $selectedOption['id'] : null,
                        'label' => (string) ($selectedOption['label'] ?? 'Add-on'),
                    ];
                    $addonDepositItems[$itemId][] = [
                        'id' => isset($selectedOption['id']) ? (int) $selectedOption['id'] : null,
                        'label' => (string) ($selectedOption['label'] ?? 'Add-on'),
                        'deposit_contribution' => 0.0,
                    ];
                }

                continue;
            }

            $isPayable = ! in_array($claimStatus, ['reserved', 'consumed'], true);
            if (! $isPayable) {
                continue;
            }

            $mainType = strtoupper((string) ($item->service?->service_type ?? $item->service_type ?? 'STANDARD'));
            $mainDeposit = (float) ($item->service?->deposit_amount ?? 0);
            $candidatesByItem[$itemId][] = ['item_id' => $itemId, 'type' => $mainType, 'deposit_amount' => $mainDeposit, 'scope' => 'main'];

            foreach ((array) ($item->question_answers_json['selected_options'] ?? []) as $selectedOption) {
                $linkedType = strtoupper((string) ($selectedOption['linked_service_type'] ?? ''));
                if ($linkedType === '') {
                    continue;
                }
                $linkedDeposit = max(0, (float) ($selectedOption['linked_deposit_amount'] ?? 0));
                $candidatesByItem[$itemId][] = [
                    'item_id' => $itemId,
                    'type' => $linkedType,
                    'deposit_amount' => $linkedDeposit,
                    'scope' => 'addon',
                    'option_id' => isset($selectedOption['id']) ? (int) $selectedOption['id'] : null,
                    'label' => (string) ($selectedOption['label'] ?? 'Add-on'),
                ];
                $addonDepositItems[$itemId][] = [
                    'id' => isset($selectedOption['id']) ? (int) $selectedOption['id'] : null,
                    'label' => (string) ($selectedOption['label'] ?? 'Add-on'),
                    'deposit_contribution' => 0.0,
                ];
            }
        }

        foreach ($candidatesByItem as $itemId => $candidates) {
            $itemId = (int) $itemId;
            $candidates = array_values(array_filter(is_array($candidates) ? $candidates : [], fn ($row) => is_array($row)));
            if (empty($candidates)) {
                continue;
            }

            $premiumCandidates = array_values(array_filter($candidates, fn (array $row) => ($row['type'] ?? null) === 'PREMIUM'));
            if (! empty($premiumCandidates)) {
                foreach ($premiumCandidates as $row) {
                    $deposit = (float) ($row['deposit_amount'] ?? 0);
                    $result[$itemId] += $deposit;
                    if (($row['scope'] ?? 'main') === 'addon') {
                        $addonResult[$itemId] += $deposit;
                        foreach ($addonDepositItems[$itemId] as &$addonRow) {
                            if ((int) ($addonRow['id'] ?? 0) === (int) ($row['option_id'] ?? 0)) {
                                $addonRow['deposit_contribution'] = round($deposit, 2);
                                break;
                            }
                        }
                        unset($addonRow);
                    } else {
                        $mainResult[$itemId] += $deposit;
                    }
                }
                continue;
            }

            // STANDARD tier: apply the first candidate for this cart line only (main first, then add-ons).
            $applied = $candidates[0];
            $appliedAmount = max(0, (float) ($applied['deposit_amount'] ?? 0));
            $result[$itemId] += $appliedAmount;
            if (($applied['scope'] ?? 'main') === 'addon') {
                $addonResult[$itemId] += $appliedAmount;
                foreach ($addonDepositItems[$itemId] as &$addonRow) {
                    if ((int) ($addonRow['id'] ?? 0) === (int) ($applied['option_id'] ?? 0)) {
                        $addonRow['deposit_contribution'] = round($appliedAmount, 2);
                        break;
                    }
                }
                unset($addonRow);
            } else {
                $mainResult[$itemId] += $appliedAmount;
            }
        }

        $depositByItem = array_map(fn ($amount) => round((float) $amount, 2), $result);
        $mainByItem = array_map(fn ($amount) => round((float) $amount, 2), $mainResult);
        $addonByItem = array_map(fn ($amount) => round((float) $amount, 2), $addonResult);

        return [
            'deposit_by_cart_item' => $depositByItem,
            'main_deposit_by_cart_item' => $mainByItem,
            'addon_deposit_by_cart_item' => $addonByItem,
            'addon_deposit_items_by_cart_item' => $addonDepositItems,
            'main_deposit_total' => round((float) collect($mainByItem)->sum(), 2),
            'addon_deposit_total' => round((float) collect($addonByItem)->sum(), 2),
            'deposit_total' => round((float) collect($depositByItem)->sum(), 2),
        ];
    }

    private function claimStatusesByCartItem(?int $customerId, array $cartItemIds): array
    {
        if (! $customerId || empty($cartItemIds)) {
            return [];
        }

        $claims = CustomerServicePackageUsage::query()
            ->where('customer_id', $customerId)
            ->where('used_from', 'BOOKING')
            ->whereIn('used_ref_id', $cartItemIds)
            ->whereIn('status', ['reserved', 'consumed', 'released'])
            ->get(['used_ref_id', 'status']);

        $priority = ['released' => 1, 'reserved' => 2, 'consumed' => 3];
        $map = [];

        foreach ($claims as $claim) {
            $itemId = (int) ($claim->used_ref_id ?? 0);
            if ($itemId <= 0) {
                continue;
            }

            $incomingPriority = $priority[$claim->status] ?? 0;
            $existingPriority = $priority[$map[$itemId] ?? ''] ?? 0;

            if ($incomingPriority >= $existingPriority) {
                $map[$itemId] = $claim->status;
            }
        }

        return $map;
    }

    private function normalizeRequestedPaymentMethod(string $method): string
    {
        return match ($method) {
            'billplz_fpx' => 'billplz_online_banking',
            'billplz_card' => 'billplz_credit_card',
            default => $method,
        };
    }

    private function resolveBillplzGatewayOption(array $validated, string $paymentMethod): ?BillplzPaymentGatewayOption
    {
        if ($paymentMethod === 'manual_transfer') {
            return null;
        }

        if ($paymentMethod === 'billplz_online_banking') {
            $optionId = (int) ($validated['billplz_gateway_option_id'] ?? 0);
            if ($optionId <= 0) {
                return null;
            }
            return BillplzPaymentGatewayOption::query()
                ->where('type', 'booking')
                ->where('gateway_group', 'online_banking')
                ->where('is_active', true)
                ->find($optionId);
        }

        return BillplzPaymentGatewayOption::query()
            ->where('type', 'booking')
            ->where('gateway_group', 'credit_card')
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('sort_order')
            ->first();
    }

    private function hasActiveBillplzOptions(string $gatewayGroup): bool
    {
        return BillplzPaymentGatewayOption::query()
            ->where('type', 'booking')
            ->where('gateway_group', $gatewayGroup)
            ->where('is_active', true)
            ->exists();
    }

    private function getSettings(): BookingSetting
    {
        return BookingSetting::query()->firstOrCreate([], [
            'deposit_amount_per_premium' => 30,
            'deposit_base_amount_if_only_standard' => 30,
            'cart_hold_minutes' => 15,
        ]);
    }
}
