<?php

namespace App\Notifications\Ecommerce;

use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\URL;

class VerifyCustomerEmail extends Notification
{
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $verificationUrl = $this->verificationUrl($notifiable);

        return (new MailMessage)
            ->subject('Verify your email address')
            ->line('Thanks for creating an account. Please verify your email to continue.')
            ->action('Verify Email', $verificationUrl)
            ->line('If you did not create an account, no further action is required.');
    }

    protected function verificationUrl(object $notifiable): string
    {
        $expiresAt = now()->addMinutes(config('auth.verification.expire', 60));
        $hash = sha1($notifiable->getEmailForVerification());
        $backendUrl = URL::temporarySignedRoute('shop.auth.verify', $expiresAt, [
            'id' => $notifiable->getKey(),
            'hash' => $hash,
        ]);

        $frontendUrl = rtrim(config('services.frontend_url', config('app.url')), '/');
        $parts = parse_url($backendUrl);
        $queryParams = [];

        if (!empty($parts['query'])) {
            parse_str($parts['query'], $queryParams);
        }

        $queryParams = array_merge($queryParams, [
            'id' => $notifiable->getKey(),
            'hash' => $hash,
        ]);

        return $frontendUrl . '/verify-email?' . http_build_query($queryParams);
    }
}
