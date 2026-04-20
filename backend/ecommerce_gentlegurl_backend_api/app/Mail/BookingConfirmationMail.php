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
     * @param array<int, array{name:string,extra_duration_min:int,extra_price:float}> $addonItems
     */
    public function __construct(
        private string $bookingCode,
        private string $customerName,
        private string $serviceName,
        private string $staffName,
        private string $appointmentDate,
        private string $appointmentStartTime,
        private string $appointmentEndTime,
        private int $durationMin,
        private float $depositAmount,
        private string $source,
        private array $addonItems = [],
    ) {
        $this->bookingCode = mb_scrub($this->bookingCode, 'UTF-8');
        $this->customerName = mb_scrub($this->customerName, 'UTF-8');
        $this->serviceName = mb_scrub($this->serviceName, 'UTF-8');
        $this->staffName = mb_scrub($this->staffName, 'UTF-8');
        $this->appointmentDate = mb_scrub($this->appointmentDate, 'UTF-8');
        $this->appointmentStartTime = mb_scrub($this->appointmentStartTime, 'UTF-8');
        $this->appointmentEndTime = mb_scrub($this->appointmentEndTime, 'UTF-8');
        $this->source = mb_scrub($this->source, 'UTF-8');
        $this->addonItems = array_map(
            fn (array $item): array => [
                'name' => mb_scrub((string) ($item['name'] ?? ''), 'UTF-8'),
                'extra_duration_min' => (int) ($item['extra_duration_min'] ?? 0),
                'extra_price' => (float) ($item['extra_price'] ?? 0),
            ],
            $this->addonItems
        );
    }

    public function build(): self
    {
        return $this->subject('Booking Confirmed — ' . $this->bookingCode)
            ->view('emails.booking-confirmation', [
                'bookingCode' => $this->bookingCode,
                'customerName' => $this->customerName,
                'serviceName' => $this->serviceName,
                'staffName' => $this->staffName,
                'appointmentDate' => $this->appointmentDate,
                'appointmentStartTime' => $this->appointmentStartTime,
                'appointmentEndTime' => $this->appointmentEndTime,
                'durationMin' => $this->durationMin,
                'depositAmount' => $this->depositAmount,
                'source' => $this->source,
                'addonItems' => $this->addonItems,
            ]);
    }
}
