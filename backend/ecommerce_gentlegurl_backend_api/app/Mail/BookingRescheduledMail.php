<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class BookingRescheduledMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    /**
     * @param array<int, array{name:string,extra_price:float}> $addonItems
     */
    public function __construct(
        private string $customerName,
        private string $bookingCode,
        private string $serviceName,
        private array $addonItems,
        private string $staffName,
        private string $oldDate,
        private string $oldStartTime,
        private string $oldEndTime,
        private string $newDate,
        private string $newStartTime,
        private string $newEndTime,
        private int $durationMin,
        private string $contactPhone,
    ) {
        $this->customerName = mb_scrub($this->customerName, 'UTF-8');
        $this->bookingCode = mb_scrub($this->bookingCode, 'UTF-8');
        $this->serviceName = mb_scrub($this->serviceName, 'UTF-8');
        $this->staffName = mb_scrub($this->staffName, 'UTF-8');
        $this->oldDate = mb_scrub($this->oldDate, 'UTF-8');
        $this->oldStartTime = mb_scrub($this->oldStartTime, 'UTF-8');
        $this->oldEndTime = mb_scrub($this->oldEndTime, 'UTF-8');
        $this->newDate = mb_scrub($this->newDate, 'UTF-8');
        $this->newStartTime = mb_scrub($this->newStartTime, 'UTF-8');
        $this->newEndTime = mb_scrub($this->newEndTime, 'UTF-8');
        $this->contactPhone = mb_scrub($this->contactPhone, 'UTF-8');
        $this->addonItems = array_map(
            fn (array $item): array => [
                'name' => mb_scrub((string) ($item['name'] ?? ''), 'UTF-8'),
                'extra_price' => (float) ($item['extra_price'] ?? 0),
            ],
            $this->addonItems
        );
    }

    public function build(): self
    {
        return $this->subject('Booking Rescheduled — ' . $this->bookingCode)
            ->view('emails.booking-rescheduled', [
                'customerName' => $this->customerName,
                'bookingCode' => $this->bookingCode,
                'serviceName' => $this->serviceName,
                'addonItems' => $this->addonItems,
                'staffName' => $this->staffName,
                'oldDate' => $this->oldDate,
                'oldStartTime' => $this->oldStartTime,
                'oldEndTime' => $this->oldEndTime,
                'newDate' => $this->newDate,
                'newStartTime' => $this->newStartTime,
                'newEndTime' => $this->newEndTime,
                'durationMin' => $this->durationMin,
                'contactPhone' => $this->contactPhone,
            ]);
    }
}
