<?php

namespace App\Listeners;

use Illuminate\Mail\Events\MessageSending;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class LogMailFailed
{
    /**
     * Handle mail sending failures.
     */
    public function handle($event): void
    {
        if ($event instanceof \Exception || $event instanceof TransportExceptionInterface) {
            Log::error('Mail sending failed', [
                'error' => $event->getMessage(),
                'trace' => $event->getTraceAsString(),
                'mail_driver' => config('mail.default'),
                'mailgun_domain' => config('services.mailgun.domain'),
            ]);
        }
    }
}
