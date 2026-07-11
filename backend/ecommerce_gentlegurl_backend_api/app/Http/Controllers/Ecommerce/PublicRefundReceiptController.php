<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingRefund;
use App\Models\Booking\BookingRefundReceiptToken;
use App\Services\Ecommerce\InvoiceService;
use Carbon\Carbon;

class PublicRefundReceiptController extends Controller
{
    public function __construct(
        protected InvoiceService $invoiceService,
    ) {
    }

    public function show(string $token)
    {
        $receiptToken = BookingRefundReceiptToken::query()
            ->where('token', $token)
            ->with(['bookingRefund.booking.customer', 'bookingRefund.order.customer', 'bookingRefund.processor:id,name'])
            ->first();

        if (! $receiptToken) {
            return $this->respondError(__('Refund receipt not found.'), 404);
        }

        if ($receiptToken->expires_at && Carbon::parse($receiptToken->expires_at)->isPast()) {
            return $this->respondError(__('Refund receipt has expired.'), 410);
        }

        $refund = $receiptToken->bookingRefund;
        if (! $refund) {
            return $this->respondError(__('Refund receipt not found.'), 404);
        }

        $booking = $refund->booking;
        $order = $refund->order;

        return $this->respond([
            'refund' => [
                'id' => (int) $refund->id,
                'refund_no' => (string) $refund->refund_no,
                'amount' => (float) $refund->amount,
                'method' => (string) $refund->method,
                'channel' => (string) $refund->channel,
                'remark' => $refund->remark,
                'processed_at' => optional($refund->processed_at)?->toIso8601String(),
                'booking_code' => (string) ($booking?->booking_code ?? ''),
                'order_number' => (string) ($order?->order_number ?? ''),
                'customer_name' => (string) ($booking?->customer?->name ?? $booking?->guest_name ?? $order?->customer?->name ?? ''),
            ],
        ]);
    }

    public function invoice(string $token)
    {
        $receiptToken = BookingRefundReceiptToken::query()
            ->where('token', $token)
            ->with(['bookingRefund.booking.customer', 'bookingRefund.order.customer', 'bookingRefund.processor:id,name'])
            ->first();

        if (! $receiptToken) {
            return $this->respondError(__('Refund receipt not found.'), 404);
        }

        if ($receiptToken->expires_at && Carbon::parse($receiptToken->expires_at)->isPast()) {
            return $this->respondError(__('Refund receipt has expired.'), 410);
        }

        $refund = $receiptToken->bookingRefund;
        if (! $refund) {
            return $this->respondError(__('Refund receipt not found.'), 404);
        }

        $pdf = $this->invoiceService->buildRefundPdf($refund);
        $filename = 'Refund-' . ($refund->refund_no ?? $refund->id) . '.pdf';

        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }
}
