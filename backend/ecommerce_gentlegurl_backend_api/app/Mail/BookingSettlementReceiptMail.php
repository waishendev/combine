<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class BookingSettlementReceiptMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    private string $pdfBytesBase64;

    /**
     * @param array<int, array{name:string,qty:int,line_total:float}> $items
     */
    public function __construct(
        private string $bookingReference,
        private string $appointmentAt,
        private string $orderNumber,
        private string $placedAt,
        private float $totalAmount,
        private string $paymentMethodDisplay,
        private string $paymentStatusDisplay,
        private string $receiptUrl,
        string $pdfBytes,
        private string $pdfFilename,
        private array $items = [],
    ) {
        $this->pdfBytesBase64 = base64_encode($pdfBytes);
        $this->bookingReference = mb_scrub($this->bookingReference, 'UTF-8');
        $this->appointmentAt = mb_scrub($this->appointmentAt, 'UTF-8');
        $this->orderNumber = mb_scrub($this->orderNumber, 'UTF-8');
        $this->placedAt = mb_scrub($this->placedAt, 'UTF-8');
        $this->paymentMethodDisplay = mb_scrub($this->paymentMethodDisplay, 'UTF-8');
        $this->paymentStatusDisplay = mb_scrub($this->paymentStatusDisplay, 'UTF-8');
        $this->receiptUrl = mb_scrub($this->receiptUrl, 'UTF-8');
        $this->pdfFilename = mb_scrub($this->pdfFilename, 'UTF-8');
        $this->items = array_map(
            fn (array $item): array => [
                'name' => mb_scrub((string) ($item['name'] ?? ''), 'UTF-8'),
                'qty' => (int) ($item['qty'] ?? 0),
                'line_total' => (float) ($item['line_total'] ?? 0),
            ],
            $this->items
        );
    }

    public function build(): self
    {
        $pdfBinary = base64_decode($this->pdfBytesBase64, true) ?: '';

        return $this->subject('Booking · Final Settlement — ' . $this->bookingReference)
            ->view('emails.booking-settlement-receipt', [
                'bookingReference' => $this->bookingReference,
                'appointmentAt' => $this->appointmentAt,
                'orderNumber' => $this->orderNumber,
                'placedAt' => $this->placedAt,
                'totalAmount' => $this->totalAmount,
                'paymentMethodDisplay' => $this->paymentMethodDisplay,
                'paymentStatusDisplay' => $this->paymentStatusDisplay,
                'receiptUrl' => $this->receiptUrl,
                'items' => $this->items,
            ])
            ->attachData($pdfBinary, $this->pdfFilename, [
                'mime' => 'application/pdf',
            ]);
    }
}
