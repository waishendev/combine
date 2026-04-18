<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class BookingConfirmationMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    /**
     * @param array<int, string> $services
     * @param array<int, string> $addons
     */
    public function __construct(
        private string $customerName,
        private string $bookingNumber,
        private array $services,
        private array $addons,
        private ?string $staffName,
        private ?string $bookingDate,
        private ?string $bookingTime,
        private ?string $branchName,
        private string $paymentMethod,
        private float $totalAmountPaid,
        private string $bookingStatus,
        private string $paymentStatusMessage,
    ) {
    }

    public function build(): self
    {
        return $this->subject('Booking Confirmation - ' . $this->bookingNumber)
            ->view('emails.booking-confirmation', [
                'customerName' => $this->customerName,
                'bookingNumber' => $this->bookingNumber,
                'services' => $this->services,
                'addons' => $this->addons,
                'staffName' => $this->staffName,
                'bookingDate' => $this->bookingDate,
                'bookingTime' => $this->bookingTime,
                'branchName' => $this->branchName,
                'paymentMethod' => $this->paymentMethod,
                'totalAmountPaid' => $this->totalAmountPaid,
                'bookingStatus' => $this->bookingStatus,
                'paymentStatusMessage' => $this->paymentStatusMessage,
            ]);
    }
}
