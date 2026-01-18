<?php

namespace App\Notifications\Ecommerce;

use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class ResetCustomerPassword extends Notification
{
    public function __construct(protected string $token)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $resetUrl = $this->resetUrl($notifiable);

        return (new MailMessage)
            ->subject('Reset your password')
            ->line('We received a request to reset your password.')
            ->action('Reset Password', $resetUrl)
            ->line('If you did not request a password reset, no further action is required.');
    }

    protected function resetUrl(object $notifiable): string
    {
        $frontendUrl = rtrim(config('services.frontend_url', config('app.url')), '/');
        $email = $notifiable->getEmailForPasswordReset();

        return $frontendUrl . '/reset-password?email=' . urlencode($email) . '&token=' . urlencode($this->token);
    }
}
