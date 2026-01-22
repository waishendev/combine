<?php

namespace App\Notifications;

use App\Services\MailgunService;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Log;
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

    /**
     * Build the mail representation of the notification.
     *
     * @param  mixed  $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail($notifiable)
    {
        $verificationUrl = $this->verificationUrl($notifiable);

        if (static::$toMailCallback) {
            return call_user_func(static::$toMailCallback, $notifiable, $verificationUrl);
        }

        return (new MailMessage)
            ->subject(__('Verify Email Address'))
            ->line(__('Please click the button below to verify your email address.'))
            ->action(__('Verify Email Address'), $verificationUrl)
            ->line(__('If you did not create an account, no further action is required.'));
    }

    /**
     * Send the notification using MailgunService directly for better logging
     */
    public function via($notifiable)
    {
        // 如果配置了使用 MailgunService，则使用它
        if (config('mail.default') === 'mailgun' && env('USE_MAILGUN_SDK', false)) {
            return ['mailgun-sdk'];
        }
        
        // 否则使用默认的邮件通道
        return ['mail'];
    }
}
