<?php

namespace App\Services\Notifications;

use Illuminate\Support\Facades\Log;

class WhatsAppSender
{
    public function send(string $to, string $body): void
    {
        $from = config('services.twilio.whatsapp_from');

        if (! $from || ! env('TWILIO_SID') || ! env('TWILIO_TOKEN')) {
            Log::info('WhatsAppSender stub (Twilio not configured):', [
                'to' => $to,
                'body' => $body,
            ]);
            return;
        }

        Log::info('WhatsAppSender would send via Twilio:', [
            'from' => $from,
            'to' => $to,
            'body' => $body,
        ]);
    }
}
