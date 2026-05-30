<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PaymentProofUploadedMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        private string $orderType,
        private string $orderNumber,
        private string $customerName,
        private string $customerEmail,
        private string $customerPhone,
        private float $amount,
        private string $uploadedAt,
        private bool $isReupload,
    ) {
        $this->orderType = mb_scrub($this->orderType, 'UTF-8');
        $this->orderNumber = mb_scrub($this->orderNumber, 'UTF-8');
        $this->customerName = mb_scrub($this->customerName, 'UTF-8');
        $this->customerEmail = mb_scrub($this->customerEmail, 'UTF-8');
        $this->customerPhone = mb_scrub($this->customerPhone, 'UTF-8');
        $this->uploadedAt = mb_scrub($this->uploadedAt, 'UTF-8');
    }

    public function build(): self
    {
        $prefix = $this->isReupload ? 'Re-uploaded' : 'New';

        return $this->subject("{$prefix} Payment Proof — {$this->orderNumber}")
            ->view('emails.payment-proof-uploaded', [
                'orderType' => $this->orderType,
                'orderNumber' => $this->orderNumber,
                'customerName' => $this->customerName,
                'customerEmail' => $this->customerEmail,
                'customerPhone' => $this->customerPhone,
                'amount' => $this->amount,
                'uploadedAt' => $this->uploadedAt,
                'isReupload' => $this->isReupload,
            ]);
    }
}
