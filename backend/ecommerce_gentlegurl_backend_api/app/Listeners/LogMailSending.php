<?php

namespace App\Listeners;

use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Log;

class LogMailSending
{
    public function handle(MessageSending $event): void
    {
        $message = $event->message;

        Log::debug('Mail sending', [
            'to' => $this->getAddresses($message->getTo()),
            'from' => $this->getAddresses($message->getFrom()),
            'subject' => $message->getSubject(),
            'mail_driver' => config('mail.default'),
        ]);
    }

    /**
     * @param iterable<int, \Symfony\Component\Mime\Address>|null $addresses
     * @return array<int, array{email: string, name: string}>
     */
    private function getAddresses(?iterable $addresses): array
    {
        if ($addresses === null) {
            return [];
        }

        $result = [];
        foreach ($addresses as $address) {
            $result[] = [
                'email' => $address->getAddress(),
                'name' => $address->getName() ?? '',
            ];
        }

        return $result;
    }
}
