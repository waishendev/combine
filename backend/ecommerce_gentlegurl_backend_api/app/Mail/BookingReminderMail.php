<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class BookingReminderMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    /**
     * @param array<int, array{name:string,extra_price:float}> $addonItems
     */
    public function __construct(
        private string $customerName,
        private string $serviceName,
        private array $addonItems,
        private string $staffName,
        private string $appointmentDate,
        private string $appointmentStartTime,
        private string $appointmentEndTime,
        private int $durationMin,
        private string $contactPhone,
    ) {
        $this->customerName = mb_scrub($this->customerName, 'UTF-8');
        $this->serviceName = mb_scrub($this->serviceName, 'UTF-8');
        $this->staffName = mb_scrub($this->staffName, 'UTF-8');
        $this->appointmentDate = mb_scrub($this->appointmentDate, 'UTF-8');
        $this->appointmentStartTime = mb_scrub($this->appointmentStartTime, 'UTF-8');
        $this->appointmentEndTime = mb_scrub($this->appointmentEndTime, 'UTF-8');
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
        return $this->subject('Appointment Reminder — Tomorrow')
            ->view('emails.booking-reminder', [
                'customerName' => $this->customerName,
                'serviceName' => $this->serviceName,
                'addonItems' => $this->addonItems,
                'staffName' => $this->staffName,
                'appointmentDate' => $this->appointmentDate,
                'appointmentStartTime' => $this->appointmentStartTime,
                'appointmentEndTime' => $this->appointmentEndTime,
                'durationMin' => $this->durationMin,
                'contactPhone' => $this->contactPhone,
            ]);
    }
}
