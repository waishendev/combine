<?php

namespace App\Services\Ecommerce;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingRefund;
use App\Models\Booking\BookingRefundReceiptToken;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class VoidRefundService
{
    public const REASON = 'VOID REFUND';

    public function __construct(private CustomerWalletService $customerWalletService)
    {
    }

    public static function isVoidRefundReason(?string $reason): bool
    {
        return strtoupper(trim((string) $reason)) === self::REASON;
    }

    /**
     * Credit Customer Balance and create a VOID REFUND receipt for a voided order.
     * Must be called inside an existing DB transaction when possible.
     */
    public function createCustomerBalanceRefund(
        float $amount,
        ?int $actorId,
        ?string $remark = null,
        ?Order $order = null,
        ?Booking $booking = null,
    ): BookingRefund {
        $amount = round(max(0, $amount), 2);
        if ($amount <= 0.0001) {
            throw ValidationException::withMessages(['void_refund_amount' => 'VOID REFUND amount must be greater than zero.']);
        }

        $customerId = (int) ($order?->customer_id ?: $booking?->customer_id ?: 0);
        if ($customerId <= 0) {
            throw ValidationException::withMessages(['void_refund_to_balance' => 'Customer Balance VOID REFUND requires a linked member.']);
        }

        $customer = Customer::query()->findOrFail($customerId);
        if (! $customer->is_active) {
            throw ValidationException::withMessages(['void_refund_to_balance' => 'Customer Balance VOID REFUND requires an active member.']);
        }

        $bookingId = $booking?->id ? (int) $booking->id : null;
        if (! $bookingId && $order) {
            $bookingId = (int) (optional(
                $order->items()->whereNotNull('booking_id')->orderBy('id')->first()
            )->booking_id ?? 0) ?: null;
        }

        $refund = BookingRefund::query()->create([
            'booking_id' => $bookingId,
            'order_id' => $order?->id ? (int) $order->id : null,
            'return_request_id' => null,
            'refund_no' => 'VRF-'.now()->format('YmdHis').'-'.strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
            'amount' => $amount,
            'method' => 'customer_credit',
            'channel' => 'online',
            'reason' => self::REASON,
            'status' => 'completed',
            'processed_by' => $actorId,
            'processed_at' => now(),
            'remark' => $remark !== null && trim($remark) !== '' ? trim($remark) : self::REASON,
        ]);

        $this->customerWalletService->applyCrmRefundCreditDelta(
            $customer,
            (int) $refund->id,
            (string) $refund->refund_no,
            '0.00',
            (string) $amount,
            $actorId,
        );

        $this->ensureReceiptToken((int) $refund->id);

        return $refund->fresh();
    }

    public function ensureReceiptToken(int $refundId): BookingRefundReceiptToken
    {
        $token = BookingRefundReceiptToken::query()
            ->where('booking_refund_id', $refundId)
            ->latest('id')
            ->first();

        if ($token) {
            return $token;
        }

        return BookingRefundReceiptToken::create([
            'booking_refund_id' => $refundId,
            'token' => Str::random(64),
            'expires_at' => null,
        ]);
    }

    public function resolveCustomerForOrder(Order $order): ?Customer
    {
        if ($order->customer_id) {
            return Customer::query()->find((int) $order->customer_id);
        }

        $bookingId = (int) (optional(
            $order->items()->whereNotNull('booking_id')->orderBy('id')->first()
        )->booking_id ?? 0);

        if ($bookingId <= 0) {
            return null;
        }

        $booking = Booking::query()->find($bookingId);
        if (! $booking?->customer_id) {
            return null;
        }

        return Customer::query()->find((int) $booking->customer_id);
    }

    public function maxRefundableForOrders(array $orderIds): float
    {
        if ($orderIds === []) {
            return 0.0;
        }

        return round((float) Order::query()
            ->whereIn('id', $orderIds)
            ->whereNotIn('status', ['voided', 'cancelled', 'draft'])
            ->sum('grand_total'), 2);
    }

    public function assertAmountWithinMax(float $amount, float $maxAmount): void
    {
        if ($amount > $maxAmount + 0.0001) {
            throw new RuntimeException('VOID REFUND amount cannot exceed RM '.number_format($maxAmount, 2).'.');
        }
    }
}
