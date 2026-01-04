<?php

namespace App\Services\Notifications;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class EmailSender
{
    public function send(string $to, string $subject, string $body): void
    {
        $from = config('mail.from.address');

        if (! $from) {
            Log::warning('EmailSender: mail.from.address not configured, skip email.', [
                'to' => $to,
                'subject' => $subject,
            ]);
            return;
        }

        try {
            Mail::raw($body, function ($message) use ($to, $subject) {
                $message->to($to)->subject($subject);
            });
        } catch (TransportExceptionInterface $exception) {
            Log::error('EmailSender: failed to send email.', [
                'to' => $to,
                'subject' => $subject,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
