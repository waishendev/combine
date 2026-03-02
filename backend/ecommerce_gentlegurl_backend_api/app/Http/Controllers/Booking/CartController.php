<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingCart;
use App\Models\Booking\BookingCartItem;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingSetting;
use App\Services\Booking\BookingAvailabilityService;
use App\Services\Booking\BookingCartCleanupService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CartController extends Controller
{
    public function __construct(
        private readonly BookingAvailabilityService $availabilityService,
        private readonly BookingCartCleanupService $cartCleanupService,
    ) {}

    public function add(Request $request)
    {
        $validated = $request->validate([
            'service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'start_at' => ['required', 'date'],
        ]);

        $service = BookingService::findOrFail($validated['service_id']);
        $startAt = Carbon::parse($validated['start_at']);
        $endAt = $startAt->copy()->addMinutes((int) $service->duration_min);

        return DB::transaction(function () use ($request, $validated, $service, $startAt, $endAt) {
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
                    'expires_at' => $expiresAt,
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
            if (!$cart) {
                return $this->respond([
                    'id' => null,
                    'status' => 'active',
                    'items' => [],
                    'deposit_total' => 0,
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
            }

            return $this->respond($this->buildCartPayload($cart->fresh()));
        });
    }

    public function checkout(Request $request)
    {
        $customer = $request->user('customer');
        $validated = $request->validate([
            'guest_name' => ['nullable', 'string', 'max:255'],
            'guest_phone' => ['nullable', 'string', 'max:50'],
            'guest_email' => ['nullable', 'email', 'max:255'],
        ]);

        if (!$customer && (empty($validated['guest_name']) || empty($validated['guest_phone']))) {
            return $this->respondError('Guest name and phone are required for guest checkout.', 422);
        }

        return DB::transaction(function () use ($request) {
            $cart = $this->resolveActiveCart($request);
            $this->cleanupExpiredItems($cart);
            $cart->load(['items.service']);

            $activeItems = $cart->items->where('status', 'active')->values();
            if ($activeItems->isEmpty()) {
                return $this->respondError('Cart is empty or all items have expired.', 422);
            }

            if ($activeItems->contains(fn ($item) => $item->expires_at->lte(now()))) {
                return $this->respondError('Some cart items are expired. Please refresh cart.', 422);
            }

            $bookingIds = [];
            $depositTotal = $this->calculateDepositTotal($activeItems->all());
            $activeItemIds = $activeItems->pluck('id')->all();

            foreach ($activeItems as $item) {
                $service = $item->service;

                if (!$this->isItemStillAvailable($item, (int) $service->buffer_min, $activeItemIds)) {
                    return $this->respondError('One or more selected slots are no longer available.', 409);
                }

                $customer = $request->user('customer');
                $booking = Booking::create([
                    'booking_code' => 'BK-' . now()->format('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                    'source' => $customer ? 'CUSTOMER' : 'GUEST',
                    'customer_id' => $customer?->id,
                    'guest_name' => $customer ? null : ($request->input('guest_name') ?? null),
                    'guest_phone' => $customer ? null : ($request->input('guest_phone') ?? null),
                    'guest_email' => $customer ? null : ($request->input('guest_email') ?? null),
                    'staff_id' => $item->staff_id,
                    'service_id' => $item->service_id,
                    'start_at' => $item->start_at,
                    'end_at' => $item->end_at,
                    'buffer_min' => (int) $service->buffer_min,
                    'status' => 'HOLD',
                    'deposit_amount' => $depositTotal,
                    'payment_status' => 'UNPAID',
                    'hold_expires_at' => $item->expires_at,
                ]);

                $item->update(['status' => 'converted']);
                $bookingIds[] = $booking->id;
            }

            $cart->update(['status' => 'converted']);

            return $this->respond([
                'status' => 'success',
                'booking_ids' => $bookingIds,
                'deposit_total' => $depositTotal,
                'payment_expires_at' => $activeItems->min('expires_at')?->toIso8601String(),
                'payment_instruction' => 'Complete payment before hold expires to confirm booking.',
            ]);
        });
    }

    private function resolveActiveCart(Request $request, bool $createIfMissing = true): ?BookingCart
    {
        $customerId = $request->user('customer')?->id;
        $guestToken = $request->header('X-Booking-Guest-Token') ?: $request->header('X-Session-Token');

        if (!$customerId && !$guestToken) {
            abort(response()->json(['success' => false, 'message' => 'Missing booking guest token.', 'data' => null], 422));
        }

        if ($customerId) {
            $this->mergeGuestCartIntoCustomerCart($customerId, $guestToken);

            $query = BookingCart::query()
                ->where('status', 'active')
                ->where('customer_id', $customerId)
                ->whereNull('guest_token');

            $cart = $query->latest()->first();
            if (!$cart && $createIfMissing) {
                $cart = BookingCart::create([
                    'customer_id' => $customerId,
                    'guest_token' => null,
                    'status' => 'active',
                ]);
            }

            return $cart;
        }

        $query = BookingCart::query()->where('status', 'active')->where('guest_token', $guestToken);
        $cart = $query->latest()->first();
        if (!$cart && $createIfMissing) {
            $cart = BookingCart::create([
                'customer_id' => null,
                'guest_token' => $guestToken,
                'status' => 'active',
            ]);
        }

        return $cart;
    }

    private function mergeGuestCartIntoCustomerCart(int $customerId, ?string $guestToken): void
    {
        if (!$guestToken) {
            return;
        }

        $guestCart = BookingCart::query()
            ->where('status', 'active')
            ->where('guest_token', $guestToken)
            ->whereNull('customer_id')
            ->latest()
            ->first();

        if (!$guestCart) {
            return;
        }

        $customerCart = BookingCart::query()
            ->where('status', 'active')
            ->where('customer_id', $customerId)
            ->whereNull('guest_token')
            ->latest()
            ->first();

        if (!$customerCart) {
            $guestCart->update(['customer_id' => $customerId, 'guest_token' => null]);
            return;
        }

        BookingCartItem::query()
            ->where('booking_cart_id', $guestCart->id)
            ->where('status', 'active')
            ->update(['booking_cart_id' => $customerCart->id, 'updated_at' => now()]);

        $guestCart->update(['status' => 'converted']);
    }

    private function cleanupExpiredItems(BookingCart $cart): void
    {
        $this->cartCleanupService->expireItems($cart);
    }

    private function buildCartPayload(BookingCart $cart): array
    {
        $cart->load(['items' => fn ($q) => $q->where('status', 'active')->orderBy('expires_at'), 'items.service:id,name', 'items.staff:id,name']);
        $activeItems = $cart->items;

        $nextExpiry = $activeItems->min('expires_at');
        $depositTotal = $this->calculateDepositTotal($activeItems->all());

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
                'expires_at' => $item->expires_at?->toIso8601String(),
                'status' => $item->status,
            ])->values(),
            'deposit_total' => $depositTotal,
            'next_expiry_at' => $nextExpiry?->toIso8601String(),
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

        return !$cartConflict;
    }

    private function calculateDepositTotal(array $items): float
    {
        $settings = $this->getSettings();
        $premiumCount = collect($items)->where('service_type', 'premium')->count();

        if ($premiumCount > 0) {
            return (float) $settings->deposit_amount_per_premium * $premiumCount;
        }

        return count($items) > 0 ? (float) $settings->deposit_base_amount_if_only_standard : 0.0;
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
