<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class BookingFeedbackMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        private string $customerName,
        private string $serviceName,
        private string $staffName,
        private string $appointmentDate,
        private string $whatsappUrl,
        private string $contactPhone,
    ) {
        $this->customerName = mb_scrub($this->customerName, 'UTF-8');
        $this->serviceName = mb_scrub($this->serviceName, 'UTF-8');
        $this->staffName = mb_scrub($this->staffName, 'UTF-8');
        $this->appointmentDate = mb_scrub($this->appointmentDate, 'UTF-8');
        $this->whatsappUrl = mb_scrub($this->whatsappUrl, 'UTF-8');
        $this->contactPhone = mb_scrub($this->contactPhone, 'UTF-8');
    }

    public function build(): self
    {
        return $this->subject('How was your visit? — Gentlegurls Nail Salon')
            ->view('emails.booking-feedback', [
                'customerName' => $this->customerName,
                'serviceName' => $this->serviceName,
                'staffName' => $this->staffName,
                'appointmentDate' => $this->appointmentDate,
                'whatsappUrl' => $this->whatsappUrl,
                'contactPhone' => $this->contactPhone,
            ]);
    }
}
