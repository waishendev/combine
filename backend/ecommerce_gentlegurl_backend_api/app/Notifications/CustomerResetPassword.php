<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;

class CustomerResetPassword extends ResetPassword
{
    protected function resetUrl($notifiable)
    {
        $frontendBase = rtrim(config('services.frontend_url') ?? config('app.url'), '/');

        return $frontendBase . '/reset-password?' . http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);
    }
}
