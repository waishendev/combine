<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PosOrderReceiptMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    /**
     * @param array<int, array{name:string,qty:int,line_total:float}> $items
     */
    public function __construct(
        private string $orderNumber,
        private string $placedAt,
        private float $totalAmount,
        private string $receiptUrl,
        private array $items = [],
    ) {
    }

    public function build(): self
    {
        return $this->subject('Your receipt for Order ' . $this->orderNumber)
            ->view('emails.pos-order-receipt', [
                'orderNumber' => $this->orderNumber,
                'placedAt' => $this->placedAt,
                'totalAmount' => $this->totalAmount,
                'receiptUrl' => $this->receiptUrl,
                'items' => $this->items,
            ]);
    }
}
