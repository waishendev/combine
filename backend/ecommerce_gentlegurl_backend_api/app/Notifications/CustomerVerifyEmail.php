<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\URL;

class CustomerVerifyEmail extends VerifyEmail
{
    protected function verificationUrl($notifiable)
    {
        $backendUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(config('auth.verification.expire', 60)),
            [
                'id' => $notifiable->getKey(),
                'hash' => sha1($notifiable->getEmailForVerification()),
            ],
        );

        $frontendBase = rtrim(config('services.frontend_url') ?? config('app.url'), '/');
        $queryParams = [];
        $queryString = parse_url($backendUrl, PHP_URL_QUERY);

        if ($queryString) {
            parse_str($queryString, $queryParams);
        }

        $queryParams = array_merge([
            'id' => $notifiable->getKey(),
            'hash' => sha1($notifiable->getEmailForVerification()),
        ], $queryParams);

        return $frontendBase . '/verify-email?' . http_build_query($queryParams);
    }
}
