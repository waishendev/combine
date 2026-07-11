<?php

namespace App\Services\Ecommerce;

use App\Models\Booking\BookingRefund;
use App\Models\Booking\BookingRefundReceiptToken;
use App\Models\Ecommerce\ReturnRequest;
use Illuminate\Support\Str;

class ReturnRefundService
{
    public function createRefundForReturn(
        ReturnRequest $returnRequest,
        float $amount,
        string $method,
        ?string $remark,
        ?int $processedBy,
    ): BookingRefund {
        $existing = $this->findRefundForReturn((int) $returnRequest->id);
        if ($existing) {
            return $existing;
        }

        return BookingRefund::query()->create([
            'booking_id' => null,
            'order_id' => (int) $returnRequest->order_id,
            'return_request_id' => (int) $returnRequest->id,
            'refund_no' => 'REF-' . now()->format('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
            'amount' => $amount,
            'method' => $method,
            'channel' => $method === 'customer_credit' ? 'online' : 'offline',
            'reason' => 'Ecommerce return refund',
            'status' => 'completed',
            'processed_by' => $processedBy,
            'processed_at' => now(),
            'remark' => $remark,
        ]);
    }

    public function findRefundForReturn(int $returnRequestId): ?BookingRefund
    {
        return BookingRefund::query()
            ->where('return_request_id', $returnRequestId)
            ->where('status', 'completed')
            ->latest('id')
            ->first();
    }

    public function buildReceiptPublicUrl(int $refundId, ?string $frontendBaseUrl = null): string
    {
        $token = BookingRefundReceiptToken::query()
            ->where('booking_refund_id', $refundId)
            ->latest('id')
            ->first();

        if (! $token) {
            $token = BookingRefundReceiptToken::create([
                'booking_refund_id' => $refundId,
                'token' => Str::random(64),
                'expires_at' => null,
            ]);
        }

        $base = rtrim((string) ($frontendBaseUrl ?? config('services.frontend_url', config('app.url'))), '/');

        return $base . '/api/proxy/public/refund-receipt/' . $token->token . '/invoice';
    }

    public function refundPayloadForReturn(int $returnRequestId, ?string $frontendBaseUrl = null): ?array
    {
        $refund = $this->findRefundForReturn($returnRequestId);
        if (! $refund) {
            return null;
        }

        return [
            'id' => (int) $refund->id,
            'refund_no' => (string) $refund->refund_no,
            'receipt_public_url' => $this->buildReceiptPublicUrl((int) $refund->id, $frontendBaseUrl),
        ];
    }
}
